// /utils/payVendorBills.js
import { businessToday } from "@/lib/region";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  increment,
  arrayUnion,
} from "firebase/firestore";
import { stampOf } from "@/lib/people";
import { billStatus } from "@/lib/redux/api/vendorBillsApiSlice";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Record payment(s) against one or more vendor bills and mirror as a Cost entry.
 *
 * @param {Object} args
 * @param {string} args.companyId
 * @param {string} args.branchId
 * @param {string} args.vendorId
 * @param {string} args.vendorName
 * @param {Array<{billId:string, amount:number}>} args.allocations
 * @param {"front"|"back"} args.paidFromOffice
 * @param {string} args.paidMethod         // e.g. "cash", "card", "qr", "online", "bank_transfer"
 * @param {string} [args.reference]        // optional ref / note
 * @param {Object} [args.createdBy]        // user object
 * @param {string} [args.costCategory="Inventory"] // cost category for mirrored cost row
 * @param {string|null} [args.paymentFileURL=null] // backward compat specific file
 * @param {string[]} [args.attachments=[]] // NEW: multi-attachment array natively mirrored to generic viewer
 *
 * @returns {Promise<{paymentId, total, applied}>} what was actually paid
 */
export async function payVendorBills({
  companyId,
  branchId,
  vendorId,
  vendorName,
  allocations,
  paidFromOffice,
  paidMethod,
  reference = "",
  createdBy = {},
  costCategory = "Inventory",
  paymentFileURL = null,
  attachments = [],
  paymentDate = null,
}) {
  if (!companyId || !branchId) throw new Error("Missing company/branch");
  if (!vendorId) throw new Error("Missing vendorId");
  if (!Array.isArray(allocations) || allocations.length === 0) {
    throw new Error("allocations[] required");
  }

  const now = serverTimestamp();
  const paymentDateStr = paymentDate || businessToday();
  const billsCol = collection(db, "companies", companyId, "branches", branchId, "vendorBills");
  const paymentRef = doc(collection(db, "companies", companyId, "branches", branchId, "vendorPayments"));
  const costRef = doc(collection(db, "companies", companyId, "branches", branchId, "costs"));
  const vendorRef = doc(db, "companies", companyId, "vendors", vendorId);
  const receipt = paymentFileURL || (attachments.length > 0 ? attachments[0] : null);

  // All in one transaction: each bill is read as it is now, so two people
  // paying the same bill at once can't both take its balance, and nothing is
  // paid past what a bill still owes (the payment, the cost and the vendor's
  // totals use what was actually applied).
  return runTransaction(db, async (tx) => {
    const wanted = allocations.map((x) => ({ ...x, amount: r2(x.amount) })).filter((x) => x.billId && x.amount > 0);
    const snaps = await Promise.all(wanted.map((x) => tx.get(doc(billsCol, x.billId))));

    const applied = [];
    const updates = [];
    snaps.forEach((snap, i) => {
      if (!snap.exists()) return;
      const bill = snap.data();
      if (bill.vendorId && bill.vendorId !== vendorId) throw new Error(`Bill ${bill.invoiceNo || snap.id} is from another vendor.`);
      const total = r2(bill.total);
      const paidBefore = r2(bill.paid);
      const amount = Math.min(wanted[i].amount, r2(total - paidBefore));
      if (amount <= 0) return;
      const paidNow = r2(paidBefore + amount);
      applied.push({ ...wanted[i], billId: snap.id, amount }); // keeps invoiceNo etc. for the cost report
      updates.push([
        snap.ref,
        {
          paid: paidNow,
          balance: r2(total - paidNow),
          status: billStatus(total, paidNow),
          updatedAt: now,
          paymentHistory: arrayUnion({
            amount,
            paidFrom: paidFromOffice,
            paidMethod: paidMethod || "",
            paidBy: stampOf(createdBy || {}),
            note: reference || "",
            paymentDate: paymentDateStr,
            paidAtClient: new Date().toISOString(),
          }),
        },
      ]);
    });

    const totalPaid = r2(applied.reduce((n, x) => n + x.amount, 0));
    if (totalPaid <= 0) throw new Error("These bills are already paid — nothing was taken.");

    updates.forEach(([ref, data]) => tx.update(ref, data));

    // the payment, for Payments and the vendor's history
    tx.set(paymentRef, {
      vendorId,
      vendorName: vendorName || "",
      total: totalPaid,
      allocations: applied, // [{ billId, amount }]
      paidFromOffice, // "front" | "back"
      paidMethod,
      reference: reference || "",
      createdBy: createdBy || {},
      paymentDate: paymentDateStr,
      createdAt: now,
      createdAtClient: new Date().toISOString(),
      receiptURL: receipt,
      attachments,
    });

    // the same money as a cost, so it is in the cost report and the cash / bank figures
    tx.set(costRef, {
      date: paymentDateStr, // YYYY-MM-DD
      amount: totalPaid,
      category: costCategory,
      description: reference?.trim() ? `Vendor payment to ${vendorName} — ${reference}` : `Vendor payment to ${vendorName}`,
      fileURL: receipt,
      attachments,
      paidFromOffice,
      paidMethod,
      isFrontOffice: paidFromOffice === "front",
      isBackOffice: paidFromOffice === "back",
      createdAt: now,
      createdAtClient: new Date().toISOString(),
      createdBy: createdBy || {},
      meta: {
        vendorId,
        vendorName: vendorName || "",
        vendorPaymentId: paymentRef.id,
        allocations: applied,
        type: "vendor_payment",
      },
    });

    // what the vendor is owed, and has been paid
    tx.update(vendorRef, {
      currentBalance: increment(-totalPaid),
      totalPaid: increment(totalPaid),
      lastPaymentDate: paymentDateStr,
      updatedAt: now,
    });

    return { paymentId: paymentRef.id, total: totalPaid, applied };
  });
}
