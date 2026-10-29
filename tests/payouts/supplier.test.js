import { describe, expect, it } from "vitest";
import { allocate, approveSupplier, billStatus, canCollect, checkSupplier, linesTotal, poLines, supplierPaid, supplierText } from "@/lib/payouts/supplier";

const manager = { uid: "m1", name: "KL Manager", role: "manager" };
const cashier = { uid: "c1", name: "KL Cashier", role: "cashier" };
const now = new Date("2026-10-21T10:00:00Z");
const bills = [
  { id: "b2", vendorId: "rice", invoiceNo: "INV-1035", invoiceDate: "2026-10-18", total: 450, paid: 0, balance: 450 },
  { id: "b1", vendorId: "rice", invoiceNo: "INV-1021", invoiceDate: "2026-10-12", total: 500, paid: 200, balance: 300 },
];
const settle = (supplier, extra = {}) => ({
  id: "s1", payoutId: "p1", date: "2026-10-21", floatAmount: 800, to: { name: "Ali" }, by: cashier, attachments: ["receipt.jpg"], supplier, ...extra,
});

describe("splitting money over a supplier's bills", () => {
  it("oldest first, never past what a bill still owes", () => {
    expect(allocate(bills, 500)).toEqual({ pays: [{ billId: "b1", invoiceNo: "INV-1021", amount: 300 }, { billId: "b2", invoiceNo: "INV-1035", amount: 200 }], left: 0 });
    expect(allocate(bills, 1000).left).toBe(250);
  });
  it("bill status as Purchases has it", () => {
    expect([billStatus(500, 0), billStatus(500, 200), billStatus(500, 500)]).toEqual(["unpaid", "partially_paid", "paid"]);
  });
});

describe("checking a supplier bill", () => {
  it("names what is missing", () => {
    expect(checkSupplier({})).toMatchObject({ vendor: "Which supplier?", mode: expect.any(String) });
    expect(checkSupplier({ vendorId: "rice", mode: "pays", pays: [] })).toEqual({ pays: "Pick the bill(s) it paid" });
    expect(checkSupplier({ vendorId: "rice", mode: "newBill", newBill: { total: 300, paid: 500 } })).toEqual({ paid: "Paid can't be more than the bill" });
    expect(checkSupplier({ vendorId: "rice", mode: "newBill", newBill: { total: 800, paid: 500 } })).toEqual({});
  });
  it("how much went to the supplier, and in words", () => {
    expect(supplierPaid({ mode: "pays", pays: [{ amount: 300 }, { amount: 200 }] })).toBe(500);
    expect(supplierPaid({ mode: "newBill", newBill: { total: 800, paid: 500 } })).toBe(500);
    expect(supplierText({ vendorName: "Rice Co", mode: "newBill", newBill: { invoiceNo: "INV-77", total: 800, paid: 500 } }, (v) => `RM ${v}`)).toBe("Rice Co · new bill INV-77 (RM 300 still due)");
    expect(supplierText({ vendorName: "Rice Co", mode: "pays", pays: [{ invoiceNo: "INV-1021" }, { invoiceNo: "INV-1035" }] })).toBe("Rice Co · INV-1021, INV-1035");
  });
});

describe("approving a supplier bill", () => {
  it("pays existing bills: each bill, one payment, one vendor-payment cost, the supplier's balance", () => {
    const s = settle({ vendorId: "rice", vendorName: "Rice Co", mode: "pays", pays: [{ billId: "b1", amount: 300 }, { billId: "b2", amount: 200 }] });
    const r = approveSupplier(s, bills, manager, now, { paymentId: "vp1", newBillId: "nb" });
    expect(r.paid).toBe(500);
    const b1 = r.billWrites.find((w) => w.id === "b1").data;
    expect(b1).toMatchObject({ paid: 500, balance: 0, status: "paid", lastPayoutSettleId: "s1" });
    expect(r.billWrites.find((w) => w.id === "b2").data).toMatchObject({ paid: 200, balance: 250, status: "partially_paid" });
    expect(b1.history).toMatchObject({ amount: 300, paidFrom: "front", paidMethod: "cash", note: "Pay-out to Ali", payoutSettleId: "s1" });
    expect(r.payment).toMatchObject({ vendorId: "rice", total: 500, paidFromOffice: "front", paidMethod: "cash", payoutSettleId: "s1" });
    expect(r.cost).toMatchObject({ amount: 500, category: "Inventory", paidFromOffice: "front", meta: { type: "vendor_payment", vendorPaymentId: "vp1", payoutId: "p1" } });
    expect(r.vendorDelta).toEqual({ billed: 0, paid: 500 });
    expect(r.settlePatch).toMatchObject({ status: "approved", billAmount: 500, change: 300, vendorPaymentId: "vp1" });
  });
  it("never pays past what a bill owes now (someone paid part of it meanwhile)", () => {
    const s = settle({ vendorId: "rice", vendorName: "Rice Co", mode: "pays", pays: [{ billId: "b1", amount: 300 }] });
    const r = approveSupplier(s, [{ ...bills[1], paid: 450 }], manager, now, { paymentId: "vp1" });
    expect(r.paid).toBe(50);
    expect(r.settlePatch.change).toBe(750);
  });
  it("a new bill paid in part: raised with what is still due", () => {
    const s = settle({ vendorId: "rice", vendorName: "Rice Co", mode: "newBill", newBill: { invoiceNo: "INV-77", invoiceDate: "2026-10-21", total: 800, paid: 500 } });
    const r = approveSupplier(s, [], manager, now, { paymentId: "vp1", newBillId: "nb1" });
    expect(r.billWrites).toHaveLength(1);
    expect(r.billWrites[0]).toMatchObject({ id: "nb1", create: true, data: { vendorId: "rice", total: 800, paid: 500, balance: 300, status: "partially_paid", payoutSettleId: "s1" } });
    expect(r.vendorDelta).toEqual({ billed: 800, paid: 500 });
  });
  it("the payment's file: the payment receipt, else the bill paper", () => {
    const sup = { vendorId: "rice", vendorName: "Rice Co", mode: "pays", pays: [{ billId: "b1", amount: 300 }] };
    const pay = (extra) => approveSupplier(settle(sup, extra), bills, manager, now, { paymentId: "vp1" }).payment;
    expect(pay({ attachments: ["bill.jpg"], receipts: [] })).toMatchObject({ receiptURL: "bill.jpg", attachments: ["bill.jpg"] });
    expect(pay({ attachments: [], receipts: ["slip.pdf"] })).toMatchObject({ receiptURL: "slip.pdf", attachments: ["slip.pdf"] });
    expect(pay({ attachments: ["bill.jpg"], receipts: ["slip.pdf"] })).toMatchObject({ receiptURL: "slip.pdf", attachments: ["bill.jpg", "slip.pdf"] });
    expect(pay({ attachments: [], receipts: [] }).receiptURL).toBeNull();
  });
  it("refuses another supplier's bill, and a bill with nothing left to pay", () => {
    const s = settle({ vendorId: "rice", vendorName: "Rice Co", mode: "pays", pays: [{ billId: "x", amount: 100 }] });
    expect(() => approveSupplier(s, [{ id: "x", vendorId: "oil", total: 100, paid: 0 }], manager, now, { paymentId: "vp" })).toThrow(/another supplier/);
    expect(() => approveSupplier(s, [{ id: "x", vendorId: "rice", total: 100, paid: 100 }], manager, now, { paymentId: "vp" })).toThrow(/already paid/);
  });
});

describe("collecting a purchase order", () => {
  const po = { vendorId: "rice", poNo: "PO-0042", status: "Sent", items: [{ itemId: "rice", name: "Rice", unit: "kg", requestedQty: 50, estPrice: 22 }, { itemId: "oil", name: "Oil", unit: "L", requestedQty: 10, estPrice: 15 }] };
  const lines = [
    { ...poLines(po)[0] },
    { ...poLines(po)[1], receivedQty: 8, finalPrice: 15.5 }, // two short, dearer
  ];
  const sup = (extra = {}) => ({ vendorId: "rice", vendorName: "Rice Co", mode: "po", poId: "po1", poNo: "PO-0042", lines, invoiceNo: "INV-2201", invoiceDate: "2026-10-22", paid: 1224, ...extra });
  it("lines start as ordered, at the planned price; the bill is what came at the real price", () => {
    expect(poLines(po)[0]).toMatchObject({ requestedQty: 50, receivedQty: 50, finalPrice: 22 });
    expect(linesTotal(lines)).toBe(1224); // 50 × 22 + 8 × 15.50
  });
  it("can be collected unless received, cancelled or waiting on another bill", () => {
    expect(canCollect(po)).toBe(true);
    expect(canCollect({ ...po, status: "Received" })).toBe(false);
    expect(canCollect({ ...po, payoutHold: "other" }, "s1")).toBe(false);
    expect(canCollect({ ...po, payoutHold: "s1" }, "s1")).toBe(true);
  });
  it("names what is missing", () => {
    expect(checkSupplier(sup())).toEqual({});
    expect(checkSupplier(sup({ invoiceNo: "" }))).toEqual({ invoiceNo: "The invoice number on the bill" });
    expect(checkSupplier(sup({ paid: 2000 }))).toEqual({ paid: "Paid can't be more than the bill" });
    expect(supplierPaid(sup({ paid: 1000 }))).toBe(1000);
    expect(supplierText(sup({ paid: 1000 }), (v) => `RM ${v}`)).toBe("Rice Co · PO-0042 received (RM 224 still due)");
  });
  it("approving receives the order, raises its bill with the lines (due on the supplier's terms) and pays it", () => {
    const r = approveSupplier(settle(sup({ paid: 1000 }), { floatAmount: 1200 }), [], manager, now, { paymentId: "vp1", newBillId: "nb1" }, { po, termsDays: 14 });
    expect(r.billWrites[0]).toMatchObject({ id: "nb1", create: true, data: { total: 1224, paid: 1000, balance: 224, status: "partially_paid", sourcePoId: "po1", dueDate: "2026-11-05", invoiceNo: "INV-2201" } });
    expect(r.billWrites[0].data.items).toHaveLength(2);
    expect(r.poPatch).toMatchObject({ status: "Received", finalTotal: 1224, billId: "nb1", invoiceNo: "INV-2201", payoutHold: null });
    expect(r.vendorDelta).toEqual({ billed: 1224, paid: 1000 });
    expect(r.settlePatch).toMatchObject({ billAmount: 1000, change: 200 });
    expect(r.cost).toMatchObject({ amount: 1000, meta: { type: "vendor_payment" } });
  });
  it("refuses an order already received, gone, or another supplier's", () => {
    const s = settle(sup());
    expect(() => approveSupplier(s, [], manager, now, { paymentId: "vp", newBillId: "nb" }, { po: { ...po, status: "Received" } })).toThrow(/already been received/);
    expect(() => approveSupplier(s, [], manager, now, { paymentId: "vp", newBillId: "nb" }, { po: null })).toThrow(/no longer exists/);
    expect(() => approveSupplier(s, [], manager, now, { paymentId: "vp", newBillId: "nb" }, { po: { ...po, vendorId: "oil" } })).toThrow(/another supplier/);
  });
});
