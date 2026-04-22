/* eslint-disable no-undef */
// functions/index.js

const admin = require("firebase-admin");
const {
  onDocumentCreated,
  onDocumentWritten,
} = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const fcm = admin.messaging();

setGlobalOptions({
  region: "asia-southeast1",
  memoryMiB: 256,
  timeoutSeconds: 60,
});

async function notifyRoles({
  companyId,
  title,
  body,
  link = "/",
  roles = ["owner", "gm", "manager", "branchAdmin"],
  writeInbox = true,
}) {
  console.log("[notifyRoles] start", { companyId, roles });

  // 1) users are under /companies/{companyId}/users
  const usersSnap = await db
    .collection("companies")
    .doc(companyId)
    .collection("users")
    .where("role", "in", roles)
    .get();

  const uids = usersSnap.docs.map((d) => d.id);
  console.log("[notifyRoles] recipients uids:", uids);

  if (!uids.length) {
    console.log("[notifyRoles] no recipients found");
    return;
  }

  // 2) optional in-app inbox at /companies/{companyId}/users/{uid}/inbox
  if (writeInbox) {
    const createdAt = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    for (const uid of uids) {
      const ref = db.doc(
        `companies/${companyId}/users/${uid}/inbox/${
          db.collection("_").doc().id
        }`
      );
      batch.set(ref, { title, body, link, createdAt, readAt: null });
    }
    await batch.commit();
    console.log("[notifyRoles] inbox written");
  }

  // 3) gather tokens from /companies/{companyId}/users/{uid}/fcmTokens/{token}
  const tokenSnaps = await Promise.all(
    uids.map((uid) =>
      db.collection(`companies/${companyId}/users/${uid}/fcmTokens`).get()
    )
  );
  const tokens = tokenSnaps
    .flatMap((s) => s.docs.map((d) => d.id))
    .filter(Boolean);
  console.log("[notifyRoles] tokens found:", tokens.length);

  if (!tokens.length) {
    console.log(
      "[notifyRoles] no tokens — ensure devices registered under this company"
    );
    return;
  }

  // 4) send push and log per-token results
  const res = await fcm.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { link, companyId },
  });

  console.log(
    "[notifyRoles] success:",
    res.successCount,
    "failure:",
    res.failureCount
  );

  // Clean invalid tokens to reduce noise next time
  const INVALID = new Set([
    "messaging/registration-token-not-registered",
    "messaging/invalid-argument",
  ]);
  const bad = [];
  res.responses.forEach((r, i) => {
    if (!r.success) {
      console.warn(
        "[notifyRoles] send error",
        tokens[i],
        r.error?.code,
        r.error?.message
      );
      if (r.error && INVALID.has(r.error.code)) bad.push(tokens[i]);
    }
  });
  if (bad.length) {
    // remove from each user's subcollection
    await Promise.all(
      uids.map(async (uid) => {
        const col = db.collection(
          `companies/${companyId}/users/${uid}/fcmTokens`
        );
        await Promise.all(
          bad.map((t) =>
            col
              .doc(t)
              .delete()
              .catch(() => {})
          )
        );
      })
    );
    console.log("[notifyRoles] cleaned invalid tokens:", bad.length);
  }
}

// 🔔 sales trigger (kept same; uses the fixed notifyRoles)
exports.onSalesCreated = onDocumentCreated(
  "companies/{companyId}/branches/{branchId}/sales/{saleId}",
  async (event) => {
    const { companyId, branchId } = event.params;
    const d = event.data?.data() || {};

    const amount = Number(d.total ?? d.amount ?? 0);
    const amountStr = isFinite(amount)
      ? `RM ${amount.toFixed(2)}`
      : "a new entry";

    let dateStr = "";
    if (typeof d.date === "string") dateStr = d.date;
    else if (d.date?.toDate)
      dateStr = d.date.toDate().toISOString().slice(0, 10);

    const title = "New Sales Entry";
    const body = dateStr
      ? `${amountStr} on ${dateStr}`
      : `Sales recorded: ${amountStr}`;
    const link = `/reports/sales-report?branch=${branchId}`;

    console.log("[onSalesCreated] firing", {
      companyId,
      branchId,
      amount,
      dateStr,
    });
    await notifyRoles({
      companyId,
      title,
      body,
      link,
      roles: ["owner", "gm", "manager", "branchAdmin"],
      writeInbox: true,
    });
  }
);
// helpers reused by all triggers
const toRM = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? `RM ${n.toFixed(2)}` : "a new entry";
};

const toISODate = (d) => {
  if (!d) return "";
  if (typeof d === "string") return d;
  if (d?.toDate) return d.toDate().toISOString().slice(0, 10);
  return "";
};

const buildBody = ({ amount, dateStr, prefix }) =>
  dateStr ? `${prefix}${amount} on ${dateStr}` : `${prefix}${amount}`;

// 🔔 cost trigger
exports.onCostCreated = onDocumentCreated(
  "companies/{companyId}/branches/{branchId}/costs/{costId}", // change "costs" if your collection name differs
  async (event) => {
    const { companyId, branchId } = event.params;
    const d = event.data?.data() || {};

    // try common field names
    const amount = toRM(d.total ?? d.amount ?? d.costAmount);
    const dateStr = toISODate(d.date ?? d.txnDate ?? d.createdAt);
    const category = d.category || d.type || d.costType || "";
    const vendor = d.vendor || d.supplier || "";

    const title = "New Cost Entry";
    const details =
      [category, vendor].filter(Boolean).join(" • ") || "Cost recorded";
    const body = buildBody({ amount, dateStr, prefix: `${details}: ` });

    const link = `/reports/cost-report?branch=${branchId}`;

    console.log("[onCostCreated] firing", {
      companyId,
      branchId,
      amount,
      dateStr,
      category,
      vendor,
    });
    await notifyRoles({
      companyId,
      title,
      body,
      link,
      roles: ["owner", "gm", "manager", "branchAdmin", "accountant"],
      writeInbox: true,
    });
  }
);

// 🔔 advance trigger (staff advance / loan advance)
exports.onAdvanceCreated = onDocumentCreated(
  "companies/{companyId}/branches/{branchId}/advances/{advanceId}", // change if different (e.g., "advanceEntries")
  async (event) => {
    const { companyId, branchId } = event.params;
    const d = event.data?.data() || {};

    const amount = toRM(d.amount ?? d.advanceAmount ?? d.total);
    const dateStr = toISODate(d.date ?? d.advanceDate ?? d.createdAt);

    // who received it?
    const staff =
      d.staffName ||
      d.employeeName ||
      d.userName ||
      d.staffId ||
      d.employeeId ||
      "";

    const title = "New Advance Entry";
    const who = staff ? `to ${staff}` : "recorded";
    const body = buildBody({ amount, dateStr, prefix: `Advance ${who}: ` });

    const link = `/reports/advance-report?branch=${branchId}`;

    console.log("[onAdvanceCreated] firing", {
      companyId,
      branchId,
      amount,
      dateStr,
      staff,
    });
    await notifyRoles({
      companyId,
      title,
      body,
      link,
      roles: ["owner", "gm", "manager", "branchAdmin", "accountant"],
      writeInbox: true,
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 📋 AUDIT LOGGING
// Writes a record to companies/{companyId}/auditLog/{autoId} on every
// create / update / delete on financial collections.
// Uses Admin SDK so it bypasses Firestore rules (clients cannot fake audit logs).
// ─────────────────────────────────────────────────────────────────────────────

async function writeAuditLog({
  companyId,
  branchId = null,
  collection,
  docId,
  action,
  before,
  after,
}) {
  const actor =
    after?.createdBy?.uid ||
    after?.updatedBy?.uid ||
    before?.createdBy?.uid ||
    null;

  const actorName =
    after?.createdBy?.username ||
    after?.updatedBy?.username ||
    before?.createdBy?.username ||
    "unknown";

  await db.collection(`companies/${companyId}/auditLog`).add({
    companyId,
    branchId,
    collection,
    docId,
    action,
    actorUid: actor,
    actorName,
    before: action === "created" ? null : before,
    after: action === "deleted" ? null : after,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

function makeAuditTrigger(collectionPath, collectionName) {
  return onDocumentWritten(collectionPath, async (event) => {
    const params = event.params;
    const companyId = params.companyId;
    const branchId = params.branchId || null;
    const docId = params[Object.keys(params).find((k) => k !== "companyId" && k !== "branchId")] || event.document.split("/").pop();

    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;

    let action;
    if (!before && after) action = "created";
    else if (before && !after) action = "deleted";
    else action = "updated";

    try {
      await writeAuditLog({ companyId, branchId, collection: collectionName, docId, action, before, after });
    } catch (err) {
      console.error("[audit] failed to write log:", err);
    }
  });
}

exports.auditSales = makeAuditTrigger(
  "companies/{companyId}/branches/{branchId}/sales/{saleId}",
  "sales"
);
exports.auditCosts = makeAuditTrigger(
  "companies/{companyId}/branches/{branchId}/costs/{costId}",
  "costs"
);
exports.auditSalaries = makeAuditTrigger(
  "companies/{companyId}/branches/{branchId}/salaries/{salaryId}",
  "salaries"
);
exports.auditLoans = makeAuditTrigger(
  "companies/{companyId}/loans/{loanId}",
  "loans"
);
exports.auditVendorBills = makeAuditTrigger(
  "companies/{companyId}/branches/{branchId}/vendorBills/{billId}",
  "vendorBills"
);

// ─────────────────────────────────────────────────────────────────────────────
// 📊 MONTHLY SUMMARY ROLLUPS
//
// On every write (create / update / delete) to a financial collection, we do a
// FULL RECOMPUTE of that month's total from Firestore. No deltas, no increments.
// Slower per write but 100% accurate — critical for hand-in-cash calculations.
//
// Writes to: companies/{companyId}/branches/{branchId}/summaries/{YYYY-MM}
// Stored fields (merge: true so collections don't overwrite each other):
//   totalSales, totalCosts, totalDeposits, totalWithdrawals,
//   totalAdvances, totalSalaries  + their *Count counterparts
//
// NOTE: handInCash / bankExpected / bankedSales are NOT stored here.
//       Those depend on tender settings and opening balance — they stay
//       client-side in useBranchData where they've been validated.
// ─────────────────────────────────────────────────────────────────────────────

/** "2026-04" → "2026-05" (handles Dec → Jan correctly) */
function nextMonthStr(month) {
  const [y, m] = month.split("-").map(Number);
  return m === 12
    ? `${y + 1}-01`
    : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * Extract YYYY-MM from a Firestore document's data.
 * Prefers the `date` string field (YYYY-MM-DD) used by all entry forms.
 * Falls back to `createdAt` timestamp if `date` is absent.
 */
function getDocMonth(data) {
  if (!data) return null;
  const d = data.date;
  if (typeof d === "string" && /^\d{4}-\d{2}/.test(d)) return d.slice(0, 7);
  const ts = data.createdAt;
  if (ts?.toDate) return ts.toDate().toISOString().slice(0, 7);
  return null;
}

/**
 * Re-query the entire month's data for one collection and write the
 * accurate total into the branch summary doc (merge: true).
 */
async function recomputeAndWriteSummary({
  companyId,
  branchId,
  collectionName,
  month,
  totalField,
  countField,
  amountFn,
}) {
  const start     = `${month}-01`;
  const end       = nextMonthStr(month); // exclusive upper bound

  const snap = await db
    .collection(`companies/${companyId}/branches/${branchId}/${collectionName}`)
    .where("date", ">=", start)
    .where("date", "<", end)
    .get();

  let total = 0;
  snap.docs.forEach((d) => {
    const v = amountFn(d.data());
    if (Number.isFinite(v) && v > 0) total += v;
  });

  // Round to 2 decimal places to avoid floating-point drift
  const rounded = Math.round(total * 100) / 100;

  const summaryRef = db.doc(
    `companies/${companyId}/branches/${branchId}/summaries/${month}`
  );

  // merge: true → other collection totals in the same doc are preserved
  await summaryRef.set(
    {
      period: month,
      companyId,
      branchId,
      [totalField]: rounded,
      [countField]: snap.size,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(
    `[rollup] ${collectionName} ${companyId}/${branchId}/${month}` +
    ` → ${totalField}=${rounded} (${snap.size} docs)`
  );
}

/** Amount extractors — must match exactly what useBranchData uses client-side */
const ROLLUP_CONFIG = {
  sales: {
    totalField: "totalSales",
    countField: "salesCount",
    // Prefer saved `total`; fall back to `amount` (matches saleTotalDynamic simple case)
    amountFn: (d) => Number(d.total ?? d.amount ?? 0),
  },
  costs: {
    totalField: "totalCosts",
    countField: "costsCount",
    amountFn: (d) => Number(d.amount ?? d.total ?? d.costAmount ?? 0),
  },
  deposits: {
    totalField: "totalDeposits",
    countField: "depositsCount",
    amountFn: (d) => Number(d.amount ?? 0),
  },
  cashWithdrawals: {
    totalField: "totalWithdrawals",
    countField: "withdrawalsCount",
    amountFn: (d) => Number(d.amount ?? 0),
  },
  advances: {
    totalField: "totalAdvances",
    countField: "advancesCount",
    amountFn: (d) => Number(d.amount ?? 0),
  },
  salaries: {
    totalField: "totalSalaries",
    countField: "salariesCount",
    // Match useBranchData: totalSalary ?? amount ?? total ?? total_amount
    amountFn: (d) =>
      Number(d.totalSalary ?? d.amount ?? d.total ?? d.total_amount ?? 0),
  },
};

/**
 * Factory: returns an onDocumentWritten trigger for one collection.
 * Handles create, update (including date changes), and delete.
 */
function makeRollupTrigger(collectionName, config) {
  const path = `companies/{companyId}/branches/{branchId}/${collectionName}/{docId}`;

  return onDocumentWritten(path, async (event) => {
    const { companyId, branchId } = event.params;
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after  = event.data?.after?.exists  ? event.data.after.data()  : null;

    // Collect every month that may have changed (handles date edits on updates)
    const months = new Set();
    const bm = getDocMonth(before);
    const am = getDocMonth(after);
    if (bm) months.add(bm);
    if (am) months.add(am);

    if (!months.size) {
      console.warn(
        `[rollup] ${collectionName} ${companyId}/${branchId}: no valid date found, skipping`
      );
      return;
    }

    for (const month of months) {
      try {
        await recomputeAndWriteSummary({
          companyId,
          branchId,
          collectionName,
          month,
          ...config,
        });
      } catch (err) {
        console.error(
          `[rollup] failed for ${collectionName} ${companyId}/${branchId}/${month}:`,
          err
        );
      }
    }
  });
}

exports.rollupSales         = makeRollupTrigger("sales",           ROLLUP_CONFIG.sales);
exports.rollupCosts         = makeRollupTrigger("costs",           ROLLUP_CONFIG.costs);
exports.rollupDeposits      = makeRollupTrigger("deposits",        ROLLUP_CONFIG.deposits);
exports.rollupWithdrawals   = makeRollupTrigger("cashWithdrawals", ROLLUP_CONFIG.cashWithdrawals);
exports.rollupAdvances      = makeRollupTrigger("advances",        ROLLUP_CONFIG.advances);
exports.rollupSalaries      = makeRollupTrigger("salaries",        ROLLUP_CONFIG.salaries);

// 🔔 cash deposit trigger (bank deposit)
exports.onDepositCreated = onDocumentCreated(
  "companies/{companyId}/branches/{branchId}/deposits/{depositId}",
  async (event) => {
    const { companyId, branchId } = event.params;
    const d = event.data?.data() || {};

    const amount = toRM(d.amount ?? d.depositAmount ?? d.total);
    const dateStr = toISODate(d.date ?? d.depositDate ?? d.createdAt);

    const method = d.method || d.channel || d.bank || d.accountName || "";
    const ref = d.reference || d.ref || d.slipNo || "";

    const title = "New Cash Deposit";
    const pieces = [method, ref].filter(Boolean).join(" • ");
    const prefix = pieces ? `${pieces}: ` : "";
    const body = buildBody({ amount, dateStr, prefix });

    const link = `/reports/deposit-report?branch=${branchId}`;

    console.log("[onDepositCreated] firing", {
      companyId,
      branchId,
      amount,
      dateStr,
      method,
      ref,
    });
    await notifyRoles({
      companyId,
      title,
      body,
      link,
      roles: ["owner", "gm", "manager", "branchAdmin", "accountant"],
      writeInbox: true,
    });
  }
);
