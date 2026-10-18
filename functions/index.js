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

// ─────────────────────────────────────────────────────────────────────────────
// 🔔 NOTIFICATIONS (roadmap 4.3) — who is told what: lib/notify/model.js.
// Requests are told at once; sales and costs once a day, never per entry.
// ─────────────────────────────────────────────────────────────────────────────
const notify = require("./notify")({ db, fcm, FieldValue });

const requestTrigger = (collection, type) =>
  onDocumentWritten(`companies/{companyId}/branches/{branchId}/${collection}/{id}`, async (event) => {
    const { companyId, branchId, id } = event.params;
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    try {
      await notify.onRequest({ companyId, branchId, type, id, before, after });
    } catch (err) {
      console.error(`[notify ${collection}]`, companyId, branchId, id, err);
    }
  });

exports.notifyAdvances = requestTrigger("advances", "advance");
exports.notifyStaffLoans = requestTrigger("loans", "staffLoan");
exports.notifyLeaves = requestTrigger("leaves", "leave");

exports.notifyPurchaseOrders = onDocumentWritten("companies/{companyId}/branches/{branchId}/requisitions/{id}", async (event) => {
  const { companyId, branchId, id } = event.params;
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  try {
    await notify.onPurchaseOrder({ companyId, branchId, id, before, after });
  } catch (err) {
    console.error("[notify requisitions]", companyId, branchId, id, err);
  }
});

// Every hour; each branch's summary goes out at its own time on its own clock.
exports.notifyDailySummary = onSchedule({ schedule: "0 * * * *", timeZone: "UTC", timeoutSeconds: 540 }, async () => {
  await notify.dailySummaries(new Date());
});

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

