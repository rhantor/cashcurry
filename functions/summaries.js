// Monthly totals per branch: companies/{c}/branches/{b}/summaries/{YYYY-MM}.
//
// Computed with the app's own finance engine (engine.cjs, bundled from
// lib/finance), so the totals mean exactly what the screens mean. Used by the
// Cloud Functions (index.js) and by scripts/summaries-rebuild.mjs.
//
// A month is always recomputed in full from its records — never adjusted by
// deltas — so re-running is harmless and a failed run is fixed by the next.
//
// Takes the Firestore instance as an argument and imports no Firebase package
// itself, so the seed and rebuild scripts can pass their own.
const engine = require("./engine.cjs");

/** Firestore collection → the engine's name for it. */
const SOURCES = Object.fromEntries(Object.entries(engine.COLLECTION).map(([key, col]) => [col, key]));
/** Advances and staff loans move money on the day they are paid out. */
const PAID_OUT = new Set(["advances", "loans"]);

const branchPath = (companyId, branchId) => `companies/${companyId}/branches/${branchId}`;
const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/** Everything the engine needs for one branch-month, read through `get`. */
async function monthRecords(db, get, companyId, branchId, month) {
  const { from, to } = engine.monthBounds(month);
  const base = branchPath(companyId, branchId);
  const records = {};
  await Promise.all(
    Object.entries(SOURCES).map(async ([col, key]) => {
      const field = engine.DATE_FIELD[key];
      const queries = [db.collection(`${base}/${col}`).where(field, ">=", from).where(field, "<=", to)];
      if (PAID_OUT.has(col)) {
        queries.push(db.collection(`${base}/${col}`).where("paidOut.date", ">=", from).where("paidOut.date", "<=", to));
      }
      const byId = new Map();
      for (const snap of await Promise.all(queries.map(get))) for (const r of docs(snap)) byId.set(r.id, r);
      records[key] = [...byId.values()];
    })
  );
  // Loans between branches: few, company-wide; the engine picks this branch's side.
  records.loanActivities = docs(await get(db.collection(`companies/${companyId}/loans`).where("status", "==", "approved")));
  return records;
}

/**
 * Recompute and store (or remove, when empty) one branch-month's totals.
 *
 * Runs in a transaction that reads the summary first: two recomputes of the
 * same month wait for each other, so the one started last — after the last
 * write — is the one that lands.
 */
async function recomputeSummary(db, companyId, branchId, month) {
  const base = branchPath(companyId, branchId);
  const ref = db.doc(`${base}/summaries/${month}`);
  return db.runTransaction(async (tx) => {
    await tx.get(ref);
    const get = (q) => tx.get(q);
    const [records, settingsSnap] = await Promise.all([
      monthRecords(db, get, companyId, branchId, month),
      get(db.doc(`${base}/settings/settings`)),
    ]);
    const summary = engine.summarizeMonth({
      branchId,
      settings: settingsSnap.exists ? settingsSnap.data() : null,
      records,
      month,
    });
    const empty =
      Object.values(summary.counts).every((n) => n === 0) && summary.cashChange === 0 && summary.bankChange === 0;
    if (empty) tx.delete(ref);
    else tx.set(ref, { ...summary, companyId, updatedAt: new Date() });
    return summary;
  });
}

/** Months a change to one branch record touches (before and after the edit). */
function monthsTouched(collection, before, after) {
  const key = SOURCES[collection];
  const months = new Set();
  for (const d of [before, after]) {
    if (!d) continue;
    const m = engine.monthOf(d[engine.DATE_FIELD[key]]);
    if (m) months.add(m);
    if (PAID_OUT.has(collection)) {
      const p = engine.monthOf(d.paidOut?.date);
      if (p) months.add(p);
    }
  }
  return [...months];
}

// A loan with only a creation time is dated on each branch's own clock; the
// earliest and latest clocks on Earth bracket every branch's month.
const ZONE_EXTREMES = ["Etc/GMT+12", "Pacific/Kiritimati"];

/** {branchId, month} pairs a change to a loan between branches touches. */
function loanTouches(before, after) {
  const out = new Map();
  for (const d of [before, after]) {
    if (!d) continue;
    for (const zone of ZONE_EXTREMES) {
      const month = engine.monthOf(engine.loanActivityDay(d, zone));
      if (!month) continue;
      for (const b of [d.requestFromBranchId, d.requestedToBranchId, d.fromBranchId, d.toBranchId]) {
        if (b) out.set(`${b}|${month}`, { branchId: b, month });
      }
    }
  }
  return [...out.values()];
}

/** Every month from a branch's first record to its last (inclusive). */
async function monthsWithData(db, companyId, branchId) {
  const base = branchPath(companyId, branchId);
  const found = [];
  await Promise.all(
    Object.entries(SOURCES).map(async ([col, key]) => {
      // First and last dated record; for advances and staff loans also the
      // last payout (money can move in a month after the last request).
      const ends = [[engine.DATE_FIELD[key], "asc"], [engine.DATE_FIELD[key], "desc"]];
      if (PAID_OUT.has(col)) ends.push(["paidOut.date", "desc"]);
      for (const [field, dir] of ends) {
        const snap = await db.collection(`${base}/${col}`).orderBy(field, dir).limit(1).get();
        const m = snap.empty ? null : engine.monthOf(snap.docs[0].get(field));
        if (m) found.push(m);
      }
    })
  );
  const loans = docs(await db.collection(`companies/${companyId}/loans`).where("status", "==", "approved").get());
  for (const { branchId: b, month } of loans.flatMap((l) => loanTouches(null, l))) {
    if (b === branchId) found.push(month);
  }
  if (!found.length) return [];
  found.sort();
  const months = [];
  for (let m = found[0]; m <= found[found.length - 1]; m = engine.nextMonth(m)) months.push(m);
  return months;
}

/** Recompute every month a branch has data for (and drop stale ones). */
async function rebuildBranch(db, companyId, branchId) {
  const months = await monthsWithData(db, companyId, branchId);
  const stale = (await db.collection(`${branchPath(companyId, branchId)}/summaries`).get()).docs
    .map((d) => d.id)
    .filter((m) => !months.includes(m));
  for (const m of months) await recomputeSummary(db, companyId, branchId, m);
  for (const m of stale) await db.doc(`${branchPath(companyId, branchId)}/summaries/${m}`).delete();
  return months;
}

/** Rebuild every branch of a company. Returns {branchId: months}. */
async function rebuildCompany(db, companyId) {
  const out = {};
  for (const branch of await db.collection(`companies/${companyId}/branches`).listDocuments()) {
    out[branch.id] = await rebuildBranch(db, companyId, branch.id);
  }
  return out;
}

module.exports = { SOURCES, rebuildCompany, recomputeSummary, monthsTouched, loanTouches, monthsWithData, rebuildBranch };
