import { describe, expect, it } from "vitest";
import { afterDiscount, billExtras, billTotals, discountAmount, discountLabel, discountProblem, discountToSave, round5, signedMoney } from "@/lib/purchases/discount";
import { aggregatePurchases, purchaseReportCsv } from "@/lib/purchases/purchaseReport";
import { approveSupplier, checkSupplier, supplierBillTotal, supplierText } from "@/lib/payouts/supplier";

describe("a discount on a bill", () => {
  it("comes off to the sen", () => {
    expect(afterDiscount(100.1, { amount: "0.2" })).toBe(99.9);
    expect(afterDiscount(100, null)).toBe(100);
  });
  it("blank or below zero is no discount", () => {
    expect(discountAmount({ amount: "" })).toBe(0);
    expect(discountAmount({ amount: -5 })).toBe(0);
    expect(discountToSave({ amount: "", kind: "Voucher", note: "x" })).toBeNull();
  });
  it("can't be the whole bill or more", () => {
    expect(discountProblem(50, { amount: 50 })).toMatch(/whole bill/);
    expect(discountProblem(50, { amount: 49.99 })).toBe("");
    expect(discountProblem(50, null)).toBe("");
  });
  it("saves as a number, with its kind and note", () => {
    expect(discountToSave({ amount: "12.5", kind: "Voucher", note: " V-9 " })).toEqual({ amount: 12.5, kind: "Voucher", note: "V-9" });
    expect(discountToSave({ amount: 3, kind: "anything" })).toEqual({ amount: 3, kind: "Discount", note: "" });
  });
  it("reads as a label", () => {
    expect(discountLabel({ kind: "Voucher", note: "V-9" })).toBe("Voucher · V-9");
    expect(discountLabel({ kind: "Discount", note: "" })).toBe("Discount");
  });
});

describe("the purchase report", () => {
  const order = (id, lines, extra = {}) => ({ id, poNo: id, vendorName: "Cool Drinks", invoiceDate: "2026-11-08", receivedItems: lines, ...extra });
  const cola = { itemId: "cola", name: "Cola", unit: "Ctn", receivedQty: 10, finalPrice: 32 };
  const orders = [order("a", [cola], { discount: { amount: 20, kind: "Discount", note: "" } }), order("b", [cola])];
  const range = { startDate: "2026-11-01", endDate: "2026-11-30" };

  it("takes the discount off the total and leaves the item at its price", () => {
    const { items, totals } = aggregatePurchases(orders, range);
    expect(totals.spend).toBe(620);
    expect(totals.discount).toBe(20);
    expect(totals.avgOrderValue).toBe(310);
    expect(items[0]).toMatchObject({ spend: 640, lastPrice: 32 });
  });
  it("shows it in the CSV", () => {
    const { items, totals } = aggregatePurchases(orders, range);
    const csv = purchaseReportCsv({ items, totals, currency: "RM", startDate: "a", endDate: "b" });
    expect(csv).toContain("Discounts and vouchers");
    expect(csv).toContain("-20.00");
  });
  it("no discount, no line", () => {
    const { items, totals } = aggregatePurchases([order("b", [cola])], range);
    expect(totals).toMatchObject({ spend: 320, discount: 0 });
    expect(purchaseReportCsv({ items, totals, currency: "RM", startDate: "a", endDate: "b" })).not.toContain("Discounts");
  });
});

describe("collecting an order with a pay-out", () => {
  const manager = { uid: "m1", name: "KL Manager", role: "manager" };
  const now = new Date("2026-11-08T10:00:00Z");
  const po = { status: "Sent", vendorId: "v" };
  const lines = [{ itemId: "cola", receivedQty: 10, finalPrice: 32, requestedQty: 10 }];
  const s = { mode: "po", vendorId: "v", vendorName: "Cool Drinks", poId: "p", poNo: "PO-1", invoiceNo: "INV-1", lines, paid: 300, discount: { amount: "20", kind: "Voucher", note: "V-9" } };
  const settle = { id: "s1", payoutId: "o1", date: "2026-11-08", floatAmount: 300, to: { name: "Ali" }, by: manager, attachments: [], supplier: s };

  it("the bill comes to the lines less the discount", () => {
    expect(supplierBillTotal(s)).toBe(300);
    expect(checkSupplier(s)).toEqual({});
    expect(supplierText(s, String)).not.toContain("still due");
  });
  it("can't pay more than the bill after the discount", () => {
    expect(checkSupplier({ ...s, paid: 320 })).toEqual({ paid: "Paid can't be more than the bill" });
  });
  it("a discount as big as the bill is refused", () => {
    expect(checkSupplier({ ...s, discount: { amount: 320 } }).discount).toMatch(/whole bill/);
  });
  it("approving raises the net bill and closes the order with it", () => {
    const r = approveSupplier(settle, [], manager, now, { paymentId: "pay", newBillId: "bill" }, { po, termsDays: 7 });
    expect(r.billWrites[0].data).toMatchObject({ total: 300, subtotal: 320, paid: 300, balance: 0, status: "paid", discount: { amount: 20, kind: "Voucher", note: "V-9" } });
    expect(r.poPatch).toMatchObject({ finalTotal: 300, subtotal: 320, discount: { amount: 20 } });
    expect(r.vendorDelta).toEqual({ billed: 300, paid: 300 });
  });
  it("no discount: the bill is as before", () => {
    const r = approveSupplier({ ...settle, supplier: { ...s, discount: null, paid: 320 } }, [], manager, now, { paymentId: "pay", newBillId: "bill" }, { po, termsDays: 7 });
    expect(r.billWrites[0].data.total).toBe(320);
    expect(r.billWrites[0].data).not.toHaveProperty("discount");
    expect(r.poPatch).not.toHaveProperty("discount");
  });
});

describe("rounding a bill to the nearest 0.05", () => {
  it("as the owner said", () => {
    expect(round5(1024.32)).toBe(1024.3);
    expect(round5(1024.33)).toBe(1024.35);
  });
  it("every last sen", () => {
    expect([0.31, 0.32, 0.33, 0.34, 0.35, 0.36, 0.37, 0.38, 0.39, 0.4].map((c) => round5(1000 + c))).toEqual([1000.3, 1000.3, 1000.35, 1000.35, 1000.35, 1000.35, 1000.35, 1000.4, 1000.4, 1000.4]);
  });
  it("happens after the discount", () => {
    expect(billTotals(1029.32, { amount: 5 })).toEqual({ subtotal: 1029.32, net: 1024.32, rounding: -0.02, total: 1024.3 });
  });
  it("off leaves the exact sen", () => {
    expect(billTotals(1024.32, null, false)).toMatchObject({ rounding: 0, total: 1024.32 });
  });
  it("a plain bill stores nothing extra", () => {
    expect(billExtras(100, null, true)).toEqual({});
  });
  it("stores what it did", () => {
    expect(billExtras(1024.33, null, true)).toEqual({ subtotal: 1024.33, rounding: 0.02 });
    expect(billExtras(1024.33, null, false)).toEqual({ roundingOff: true });
    expect(billExtras(110, { amount: 10, kind: "Discount" }, true)).toEqual({ subtotal: 110, discount: { amount: 10, kind: "Discount", note: "" } });
  });
  it("reads with its sign", () => {
    expect(signedMoney(-0.02, (v) => `RM ${v}`)).toBe("− RM 0.02");
    expect(signedMoney(0.02, (v) => `RM ${v}`)).toBe("+ RM 0.02");
  });
  it("the report's total follows the rounding", () => {
    const o = { poNo: "x", invoiceDate: "2026-11-08", rounding: -0.02, receivedItems: [{ itemId: "a", name: "A", receivedQty: 1, finalPrice: 1024.32 }] };
    const { items, totals } = aggregatePurchases([o], { startDate: "2026-11-01", endDate: "2026-11-30" });
    expect(totals.spend).toBeCloseTo(1024.3, 2);
    expect(items[0].spend).toBe(1024.32);
    expect(purchaseReportCsv({ items, totals, currency: "RM", startDate: "a", endDate: "b" })).toContain("Rounding");
  });
});

describe("rounding on a pay-out bill", () => {
  const manager = { uid: "m1", name: "KL Manager", role: "manager" };
  const now = new Date("2026-11-08T10:00:00Z");
  const po = { status: "Sent", vendorId: "v" };
  const lines = [{ itemId: "a", receivedQty: 1, finalPrice: 1024.32, requestedQty: 1 }];
  const base = { mode: "po", vendorId: "v", vendorName: "V", poId: "p", poNo: "PO-1", invoiceNo: "INV-1", lines, paid: 1024.3, round: true };
  const settle = (s) => ({ id: "s1", payoutId: "o1", date: "2026-11-08", floatAmount: 2000, to: { name: "Ali" }, by: manager, attachments: [], supplier: s });
  const ids = { paymentId: "pay", newBillId: "bill" };

  it("a collected order rounds", () => {
    expect(supplierBillTotal(base)).toBe(1024.3);
    expect(checkSupplier(base)).toEqual({});
    const r = approveSupplier(settle(base), [], manager, now, ids, { po });
    expect(r.billWrites[0].data).toMatchObject({ total: 1024.3, subtotal: 1024.32, rounding: -0.02, paid: 1024.3, balance: 0, status: "paid" });
    expect(r.poPatch).toMatchObject({ finalTotal: 1024.3, rounding: -0.02 });
  });
  it("a bill saved before rounding came in keeps its exact total", () => {
    const { round, ...old } = base;
    expect(round).toBe(true);
    const r = approveSupplier(settle({ ...old, paid: 1024.32 }), [], manager, now, ids, { po });
    expect(r.billWrites[0].data).toMatchObject({ total: 1024.32, paid: 1024.32, balance: 0 });
  });
  it("a new bill rounds what was typed", () => {
    const nb = { invoiceNo: "N1", total: 1024.33, paid: 1024.35, round: true };
    const s = { mode: "newBill", vendorId: "v", vendorName: "V", newBill: nb };
    expect(checkSupplier(s)).toEqual({});
    const r = approveSupplier(settle(s), [], manager, now, ids, {});
    expect(r.billWrites[0].data).toMatchObject({ total: 1024.35, subtotal: 1024.33, rounding: 0.02, balance: 0 });
  });
});
