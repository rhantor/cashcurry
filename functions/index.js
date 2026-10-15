// functions/index.js

const admin = require("firebase-admin");
// Imported directly: the Functions emulator wraps admin.firestore and drops its
// static members, so admin.firestore.FieldValue is undefined there.
const { FieldValue } = require("firebase-admin/firestore");
const {
  onDocumentCreated,
  onDocumentWritten,
} = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
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
    const createdAt = FieldValue.serverTimestamp();
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
    timestamp: FieldValue.serverTimestamp(),
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
// 📊 MONTHLY SUMMARIES
//
// companies/{companyId}/branches/{branchId}/summaries/{YYYY-MM}: each month's
// cash and bank movement and totals, computed by the app's own finance engine
// (functions/summaries.js). Dashboards add these up instead of downloading
// every record ever entered, and check their counts before trusting them.
//
// Any write recomputes the whole month(s) it touches; retry on failure, and a
// nightly pass recomputes this month and last month for every branch.
// ─────────────────────────────────────────────────────────────────────────────
const summaries = require("./summaries");

function makeSummaryTrigger(collection) {
  return onDocumentWritten(
    { document: `companies/{companyId}/branches/{branchId}/${collection}/{docId}`, retry: true },
    async (event) => {
      const { companyId, branchId } = event.params;
      const months = summaries.monthsTouched(collection, event.data?.before?.data(), event.data?.after?.data());
      for (const month of months) await summaries.recomputeSummary(db, companyId, branchId, month);
    }
  );
}

exports.summarySales = makeSummaryTrigger("sales");
exports.summaryCosts = makeSummaryTrigger("costs");
exports.summaryAdvances = makeSummaryTrigger("advances");
exports.summaryStaffLoans = makeSummaryTrigger("loans");
exports.summaryDeposits = makeSummaryTrigger("deposits");
exports.summaryWithdrawals = makeSummaryTrigger("cashWithdrawals");
exports.summarySalaries = makeSummaryTrigger("salaries");

// Loans between branches move both branches' cash.
exports.summaryBranchLoans = onDocumentWritten(
  { document: "companies/{companyId}/loans/{loanId}", retry: true },
  async (event) => {
    const { companyId } = event.params;
    const touched = summaries.loanTouches(event.data?.before?.data(), event.data?.after?.data());
    for (const { branchId, month } of touched) await summaries.recomputeSummary(db, companyId, branchId, month);
  }
);

// Payment-method settings decide cash vs bank: recompute the branch's history.
exports.summaryBranchSettings = onDocumentWritten(
  { document: "companies/{companyId}/branches/{branchId}/settings/settings", retry: true, timeoutSeconds: 540 },
  async (event) => {
    const { companyId, branchId } = event.params;
    await summaries.rebuildBranch(db, companyId, branchId);
  }
);

exports.summaryNightly = onSchedule(
  { schedule: "every day 04:00", timeZone: "Asia/Kuala_Lumpur", timeoutSeconds: 540 },
  async () => {
    // Last month and this month in any branch's time zone (UTC−12…+14).
    const day = 24 * 3600 * 1000;
    const months = [...new Set([-32, -1, 0, 1].map((d) => new Date(Date.now() + d * day).toISOString().slice(0, 7)))].sort();
    const companies = await db.collection("companies").listDocuments();
    for (const company of companies) {
      const branches = await company.collection("branches").listDocuments();
      for (const branch of branches) {
        for (const month of months) {
          try {
            await summaries.recomputeSummary(db, company.id, branch.id, month);
          } catch (err) {
            console.error("[summaryNightly]", company.id, branch.id, month, err);
          }
        }
      }
    }
  }
);

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
