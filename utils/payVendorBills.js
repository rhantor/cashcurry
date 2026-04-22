// /utils/payVendorBills.js
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  increment,
  getDoc,
  arrayUnion,
} from "firebase/firestore";

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
 * @returns {Promise<void>}
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
}) {
  if (!companyId || !branchId) throw new Error("Missing company/branch");
  if (!vendorId) throw new Error("Missing vendorId");
  if (!Array.isArray(allocations) || allocations.length === 0) {
    throw new Error("allocations[] required");
  }

  const now = serverTimestamp();
  const batch = writeBatch(db);

  // --- 1) Create a vendor payment "header" (optional; useful for audit) ---
  const paymentsCol = collection(
    db,
    "companies",
    companyId,
    "branches",
    branchId,
    "vendorPayments"
  );
  const paymentRef = doc(paymentsCol); // auto id

  const totalPaid = allocations.reduce((s, a) => s + Number(a.amount || 0), 0);

  batch.set(paymentRef, {
    vendorId,
    vendorName: vendorName || "",
    total: Number(totalPaid),
    allocations, // [{ billId, amount }]
    paidFromOffice, // "front" | "back"
    paidMethod, // normalized already by caller
    reference: reference || "",
    createdBy: createdBy || {},
    createdAt: now,
    createdAtClient: new Date().toISOString(),
  });

  // --- 2) Apply allocations to each bill ---
  const billsCol = collection(
    db,
    "companies",
    companyId,
    "branches",
    branchId,
    "vendorBills"
  );

  for (const { billId, amount } of allocations) {
    const a = Number(amount || 0);
    if (a <= 0) continue;

    const billRef = doc(billsCol, billId);
    const billSnap = await getDoc(billRef);
    if (!billSnap.exists()) continue;

    const bill = billSnap.data();
    const prevPaid = Number(bill.paid || 0);
    const prevTotal = Number(bill.total || 0);
    const nextPaid = prevPaid + a;
    const nextBalance = Math.max(0, prevTotal - nextPaid);

    let nextStatus = "unpaid";
    if (nextPaid <= 0) nextStatus = "unpaid";
    else if (nextPaid < prevTotal) nextStatus = "partially_paid";
    else nextStatus = "paid";

    batch.update(billRef, {
      paid: increment(a),
      balance: nextBalance,
      status: nextStatus,
      updatedAt: now,
      // Append payment record to history for the ViewBillModal
      paymentHistory: arrayUnion({
        amount: a,
        paidFrom: paidFromOffice,
        paidMethod: paidMethod || "",
        paidBy: createdBy ? { username: createdBy.username || createdBy.email || "" } : {},
        note: reference || "",
        paidAtClient: new Date().toISOString(),
      }),
    });
  }

  // --- 3) Mirror a single Cost entry for the payment (so it appears in Cost Report) ---
  // If you prefer *per-allocation* cost rows, you can split this into multiple batch.set calls.
  const costsCol = collection(
    db,
    "companies",
    companyId,
    "branches",
    branchId,
    "costs"
  );

  const costRef = doc(costsCol);
  batch.set(costRef, {
    // Required / standard fields your cost report expects:
    date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
    amount: Number(totalPaid),
    category: costCategory, // e.g. "Inventory"
    description: reference?.trim()
      ? `Vendor payment to ${vendorName} — ${reference}`
      : `Vendor payment to ${vendorName}`,
    fileURL: paymentFileURL || (attachments.length > 0 ? attachments[0] : null), 
    attachments: attachments, // <- NEW: array representing all bound proof URLs

    // Payment source flags for your dashboards
    paidFromOffice, // "front" | "back"
    paidMethod, // already normalized by caller
    isFrontOffice: paidFromOffice === "front",
    isBackOffice: paidFromOffice === "back",

    // Audit
    createdAt: now,
    createdAtClient: new Date().toISOString(),
    createdBy: createdBy || {},

    // Optional linkage back to vendor payment
    meta: {
      vendorId,
      vendorName: vendorName || "",
      vendorPaymentId: paymentRef.id,
      allocations, // could be helpful in drill-down
      type: "vendor_payment",
    },
  });

  // --- 4) Update vendor aggregate AP if you track it here (optional) ---
  // If you maintain vendors.currentBalance as "amount owed to vendor",
  // decrease it by the total paid:
  const vendorRef = doc(db, "companies", companyId, "vendors", vendorId);
  batch.update(vendorRef, {
    currentBalance: increment(-Number(totalPaid)),
    totalPaid: increment(Number(totalPaid)),
    lastPaymentDate: new Date().toISOString(),
    updatedAt: now,
  });

  // --- Commit ---
  await batch.commit();
}
