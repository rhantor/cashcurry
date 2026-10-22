// lib/payouts/supplier.js — a pay-out spent at a supplier (roadmap 4.10, 21 Oct
// 2026). Pure — no Firebase.
//
// Money handed out can go to a listed supplier (vendor) rather than a shop:
//   "pays"    — paying bills already in Purchases → Due Bills (raised by a
//               purchase order or New Vendor Bill), oldest first
//   "newBill" — buying from the supplier and paying on the spot: the bill is
//               raised now, paid in full or in part (the rest stays due)
//   "po"      — collecting a purchase order (22 Oct): what came and at what
//               price, line by line, as Purchases → Receive does; approving
//               receives the order (it closes with what came), raises its bill
//               with those lines and pays it, in full or in part
// The pay-out's `out` record may say which supplier and bills it is for
// (forVendor / forBills); the bill brought back (settle) carries `supplier`.
// Approving writes, in one go: the bills paid (or the new bill), a vendor
// payment, the supplier's balance, and ONE cost — the vendor-payment cost
// Purchases → Due Bills writes, so nothing is counted twice.

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** A bill's status from its total and what has been paid (as Purchases has it). */
export const billStatus = (total, paid) => (r2(paid) <= 0 ? "unpaid" : r2(paid) >= r2(total) ? "paid" : "partially_paid");

/**
 * Split `amount` over bills, oldest first, never past what each still owes.
 * bills: [{ id, invoiceNo, invoiceDate, balance }]. → { pays: [{ billId, invoiceNo, amount }], left }
 */
export function allocate(bills, amount) {
  let left = r2(amount);
  const pays = [];
  for (const b of [...bills].sort((x, y) => String(x.invoiceDate || "").localeCompare(String(y.invoiceDate || "")))) {
    if (left <= 0) break;
    const take = Math.min(left, r2(b.balance));
    if (take <= 0) continue;
    pays.push({ billId: b.id, invoiceNo: b.invoiceNo || "", amount: r2(take) });
    left = r2(left - take);
  }
  return { pays, left };
}

/** A purchase order's received lines → what the bill comes to, to the sen. */
export const linesTotal = (lines = []) => Math.round(lines.reduce((n, l) => n + (Number(l.receivedQty) || 0) * (Number(l.finalPrice) || 0), 0) * 100) / 100;

/** A purchase order's lines ready to receive: what was asked, at the price planned. */
export const poLines = (po) =>
  (po?.items || []).map((i) => ({ itemId: i.itemId, name: i.name || "", unit: i.unit || "", category: i.category || "", requestedQty: Number(i.requestedQty) || 0, receivedQty: Number(i.requestedQty) || 0, finalPrice: Number(i.estPrice) || 0, estPrice: Number(i.estPrice) || 0 }));

/** May this purchase order still be collected? Not received, cancelled or rejected — nor waiting on another bill. */
export const canCollect = (po, settleId = null) =>
  !!po && !["Received", "Cancelled", "Rejected"].includes(po.status) && (!po.payoutHold || po.payoutHold === settleId);

/** What's wrong with a supplier bill before saving it, by field; {} when fine. */
export function checkSupplier(s) {
  const e = {};
  if (!s?.vendorId) e.vendor = "Which supplier?";
  if (s?.mode === "po") {
    if (!s.poId) e.po = "Which purchase order?";
    else if (!(linesTotal(s.lines) > 0)) e.lines = "What came, and at what price";
    if (!String(s.invoiceNo || "").trim()) e.invoiceNo = "The invoice number on the bill";
    const paid = r2(s.paid);
    if (!(paid > 0)) e.paid = "How much was paid now";
    else if (paid > linesTotal(s.lines)) e.paid = "Paid can't be more than the bill";
    return e;
  }
  if (s?.mode === "pays") {
    if (!(s.pays || []).length) e.pays = "Pick the bill(s) it paid";
    else if ((s.pays || []).some((p) => !(r2(p.amount) > 0))) e.pays = "Each bill needs an amount";
  } else if (s?.mode === "newBill") {
    const total = r2(s.newBill?.total);
    const paid = r2(s.newBill?.paid);
    if (!(total > 0)) e.total = "The bill's total";
    if (!(paid > 0)) e.paid = "How much was paid now";
    else if (paid > total) e.paid = "Paid can't be more than the bill";
  } else e.mode = "Paid old bills, or a new bill?";
  return e;
}

/** How much of the pay-out went to the supplier. */
export const supplierPaid = (s) =>
  s?.mode === "newBill" ? r2(s.newBill?.paid) : s?.mode === "po" ? r2(s.paid) : r2((s?.pays || []).reduce((n, p) => n + r2(p.amount), 0));

/** "Rice Co · INV-1021, INV-1035" / "Rice Co · new bill INV-77 (৳300 still due)" */
export function supplierText(s, money = (v) => String(v)) {
  if (!s?.vendorName) return "";
  if (s.mode === "po") {
    const due = r2(linesTotal(s.lines) - r2(s.paid));
    return `${s.vendorName} · ${s.poNo || "purchase order"} received${due > 0 ? ` (${money(due)} still due)` : ""}`;
  }
  if (s.mode === "newBill") {
    const due = r2(r2(s.newBill?.total) - r2(s.newBill?.paid));
    return `${s.vendorName} · new bill ${s.newBill?.invoiceNo || ""}${due > 0 ? ` (${money(due)} still due)` : ""}`.replace("  ", " ");
  }
  return `${s.vendorName} · ${(s.pays || []).map((p) => p.invoiceNo || "a bill").join(", ")}`;
}

/** "2026-10-22" + 14 days → "2026-11-05" */
const addDays = (d, n) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + (Number(n) || 0));
  return t.toISOString().slice(0, 10);
};

/**
 * Approving a supplier bill. settle: the bill brought back (with id, supplier,
 * to, date, by, createdAt); bills: the vendor bills it pays, as they are NOW
 * ({ id, vendorId, total, paid, invoiceNo }); approver; ids: { paymentId,
 * newBillId } for the new records; po: the purchase order as it is NOW (mode
 * "po"), termsDays: the supplier's credit days. Throws if a bill is another
 * supplier's, the order can't be received, or nothing is left to pay.
 * → { billWrites: [{ id, data, create? }], payment, cost, vendorDelta, settlePatch, poPatch, paid }
 */
export function approveSupplier(settle, bills, approver, now, ids, { po = null, termsDays = 0 } = {}) {
  const s = settle.supplier;
  const who = { uid: approver.uid, name: approver.name || approver.username || "", role: approver.role || "" };
  const note = `Pay-out to ${settle.to?.name || "someone"}`;
  const history = (amount) => ({
    amount,
    paidFrom: "front",
    paidMethod: "cash",
    paidBy: settle.by || who,
    approvedBy: who,
    note,
    paymentDate: settle.date,
    paidAtClient: now.toISOString(),
    payoutSettleId: settle.id,
  });
  const billWrites = [];
  const applied = [];
  let billed = 0;
  let poPatch = null;

  if (s.mode === "po") {
    if (!po) throw new Error("That purchase order no longer exists.");
    if (po.vendorId && po.vendorId !== s.vendorId) throw new Error("That purchase order is from another supplier.");
    if (!canCollect(po, settle.id)) throw new Error(po.status === "Received" ? "That purchase order has already been received." : "That purchase order can't be received any more.");
    const lines = (s.lines || []).map((l) => ({ ...l, receivedQty: Number(l.receivedQty) || 0, finalPrice: Number(l.finalPrice) || 0, requestedQty: Number(l.requestedQty) || 0 }));
    const total = linesTotal(lines);
    const paid = Math.min(r2(s.paid), total);
    const invoiceDate = s.invoiceDate || settle.date;
    billed = total;
    applied.push({ billId: ids.newBillId, invoiceNo: s.invoiceNo || "", amount: paid });
    billWrites.push({
      id: ids.newBillId,
      create: true,
      data: {
        vendorId: s.vendorId,
        vendorName: s.vendorName || "",
        invoiceNo: String(s.invoiceNo || "").trim(),
        invoiceDate,
        dueDate: addDays(invoiceDate, termsDays),
        total,
        paid,
        balance: r2(total - paid),
        status: billStatus(total, paid),
        items: lines,
        attachments: settle.attachments || [],
        notes: `Received from PO: ${s.poNo || s.poId}${settle.note ? ` — ${settle.note}` : ""}`,
        sourcePoId: s.poId,
        paymentHistory: [history(paid)],
        payoutSettleId: settle.id,
        lastPayoutSettleId: settle.id,
        createdBy: settle.by || who,
      },
    });
    // the order closes with what came (anything short is ordered again)
    poPatch = {
      status: "Received",
      receivedItems: lines,
      finalTotal: total,
      receivedBy: settle.by || who,
      billId: ids.newBillId,
      invoiceNo: String(s.invoiceNo || "").trim(),
      invoiceAttachment: (settle.attachments || [])[0] || null,
      payoutHold: null,
    };
  } else if (s.mode === "newBill") {
    const total = r2(s.newBill.total);
    const paid = Math.min(r2(s.newBill.paid), total);
    billed = total;
    applied.push({ billId: ids.newBillId, invoiceNo: s.newBill.invoiceNo || "", amount: paid });
    billWrites.push({
      id: ids.newBillId,
      create: true,
      data: {
        vendorId: s.vendorId,
        vendorName: s.vendorName || "",
        invoiceNo: s.newBill.invoiceNo || "",
        invoiceDate: s.newBill.invoiceDate || settle.date,
        dueDate: s.newBill.dueDate || s.newBill.invoiceDate || settle.date,
        total,
        paid,
        balance: r2(total - paid),
        status: billStatus(total, paid),
        items: [],
        attachments: settle.attachments || [],
        notes: settle.note || "",
        paymentHistory: [history(paid)],
        payoutSettleId: settle.id,
        lastPayoutSettleId: settle.id,
        createdBy: settle.by || who,
      },
    });
  } else {
    const want = Object.fromEntries((s.pays || []).map((p) => [p.billId, r2(p.amount)]));
    for (const b of bills) {
      if (b.vendorId && b.vendorId !== s.vendorId) throw new Error(`Bill ${b.invoiceNo || b.id} is from another supplier.`);
      const total = r2(b.total);
      const before = r2(b.paid);
      const amount = Math.min(want[b.id] || 0, r2(total - before));
      if (amount <= 0) continue;
      const after = r2(before + amount);
      applied.push({ billId: b.id, invoiceNo: b.invoiceNo || "", amount });
      billWrites.push({ id: b.id, data: { paid: after, balance: r2(total - after), status: billStatus(total, after), history: history(amount), lastPayoutSettleId: settle.id } });
    }
  }

  const paid = r2(applied.reduce((n, a) => n + a.amount, 0));
  if (paid <= 0) throw new Error("Those bills are already paid — there is nothing to pay.");

  const payment = {
    vendorId: s.vendorId,
    vendorName: s.vendorName || "",
    total: paid,
    allocations: applied,
    paidFromOffice: "front",
    paidMethod: "cash",
    reference: note,
    createdBy: settle.by || who,
    approvedBy: who,
    paymentDate: settle.date,
    createdAtClient: now.toISOString(),
    receiptURL: (settle.receipts || settle.attachments || [])[0] || null,
    attachments: [...(settle.attachments || []), ...(settle.receipts || [])],
    payoutId: settle.payoutId,
    payoutSettleId: settle.id,
  };
  // the same cost Purchases → Due Bills writes (changed from Purchases, never twice)
  const cost = {
    date: settle.date,
    amount: paid,
    category: "Inventory",
    description: `Vendor payment to ${s.vendorName || "a supplier"} — ${note}`,
    fileURL: payment.receiptURL,
    attachments: payment.attachments,
    paidFromOffice: "front",
    paidMethod: "cash",
    isFrontOffice: true,
    isBackOffice: false,
    createdAtClient: now.toISOString(),
    createdBy: settle.by || who,
    approvedBy: who,
    meta: { type: "vendor_payment", vendorId: s.vendorId, vendorName: s.vendorName || "", vendorPaymentId: ids.paymentId, allocations: applied, payoutId: settle.payoutId, settleId: settle.id },
  };
  const vendorDelta = { billed, paid };
  const settlePatch = { status: "approved", billAmount: paid, change: r2(r2(settle.floatAmount) - paid), review: { by: who, at: now }, vendorPaymentId: ids.paymentId };
  return { billWrites, payment, cost, vendorDelta, settlePatch, poPatch, paid };
}
