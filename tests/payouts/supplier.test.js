import { describe, expect, it } from "vitest";
import { allocate, approveSupplier, billStatus, checkSupplier, supplierPaid, supplierText } from "@/lib/payouts/supplier";

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
  it("refuses another supplier's bill, and a bill with nothing left to pay", () => {
    const s = settle({ vendorId: "rice", vendorName: "Rice Co", mode: "pays", pays: [{ billId: "x", amount: 100 }] });
    expect(() => approveSupplier(s, [{ id: "x", vendorId: "oil", total: 100, paid: 0 }], manager, now, { paymentId: "vp" })).toThrow(/another supplier/);
    expect(() => approveSupplier(s, [{ id: "x", vendorId: "rice", total: 100, paid: 100 }], manager, now, { paymentId: "vp" })).toThrow(/already paid/);
  });
});
