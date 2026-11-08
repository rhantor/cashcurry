import { describe, expect, it } from "vitest";
import { afterDiscount, discountAmount, discountLabel, discountProblem, discountToSave } from "@/lib/purchases/discount";
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
