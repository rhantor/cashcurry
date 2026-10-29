import { describe, expect, it } from "vitest";
import { approveBill, deliveryOf, goodsOf, newPayout, newSettle, payoutCash } from "@/lib/payouts/model";
import { approveSupplier } from "@/lib/payouts/supplier";

const cashier = { uid: "c1", role: "cashier", firstName: "Siti" };
const manager = { uid: "m1", role: "manager", firstName: "Mira" };
const now = new Date("2026-10-30T10:00:00Z");
const transport = { categoryId: "delivery", category: "Transport & delivery", costGroupId: "running", costGroup: "Running the business", costKind: "expense" };
const grocery = { categoryId: "groceries", category: "Groceries", costGroupId: "food", costGroup: "Food & stock", costKind: "expense" };

describe("a bill with a delivery / transport charge on top", () => {
  const p = { id: "p1", ...newPayout({ date: "2026-10-30", amount: "300", to: { name: "Ali" }, purpose: "Groceries" }, cashier) };
  // 240 of groceries + 25 delivery, brought back with 35 change
  const s = { id: "s1", ...newSettle(p, { date: "2026-10-30", billAmount: 265, fields: grocery, files: ["bill.jpg"], delivery: { amount: "25", fields: transport, receipts: ["lalamove.jpg", ""] } }, cashier) };

  it("the bill is everything spent; the till moves by the change", () => {
    expect(s).toMatchObject({ billAmount: 265, change: 35, delivery: { amount: 25, categoryId: "delivery", receipts: ["lalamove.jpg"] } });
    expect(goodsOf(s)).toBe(240);
    expect(payoutCash(s)).toBe(35);
  });

  it("approving makes two costs: the goods in their category, the delivery in its own", () => {
    const r = approveBill(s, {}, manager, now);
    expect(r.cost).toMatchObject({ amount: 240, category: "Groceries", meta: { type: "payout", settleId: "s1" } });
    expect(r.deliveryCost).toMatchObject({ date: "2026-10-30", amount: 25, categoryId: "delivery", category: "Transport & delivery", fileURL: "lalamove.jpg", receipts: ["lalamove.jpg"], paidFromOffice: "front", meta: { type: "payout", part: "delivery", settleId: "s1" } });
    // nothing counted twice: the float back to the till, the two costs take the 265
    expect(payoutCash({ ...s, ...r.settle })).toBe(300);
    expect(r.cost.amount + r.deliveryCost.amount).toBe(r.settle.billAmount);
  });

  it("a corrected amount is the whole bill; the delivery stays as it was", () => {
    const r = approveBill(s, { billAmount: 255 }, manager, now);
    expect(r.cost.amount).toBe(230);
    expect(r.deliveryCost.amount).toBe(25);
    expect(r.settle).toMatchObject({ billAmount: 255, change: 45 });
    expect(() => approveBill(s, { billAmount: 20 }, manager, now)).toThrow(/delivery/);
  });

  it("no delivery: one cost as before", () => {
    const plain = { id: "s2", ...newSettle(p, { date: "2026-10-30", billAmount: 240, fields: grocery }, cashier) };
    expect(plain.delivery).toBeNull();
    expect(deliveryOf(plain)).toBeNull();
    const r = approveBill(plain, {}, manager, now);
    expect(r.cost.amount).toBe(240);
    expect(r.deliveryCost).toBeNull();
    // a zero delivery is no delivery
    expect(deliveryOf({ delivery: { amount: 0 } })).toBeNull();
  });

  it("at a supplier: the vendor payment as before, the delivery a cost of its own", () => {
    const bills = [{ id: "b1", vendorId: "rice", invoiceNo: "INV-1", invoiceDate: "2026-10-20", total: 500, paid: 0, balance: 500 }];
    const settle = {
      id: "s3", payoutId: "p3", date: "2026-10-30", floatAmount: 600, to: { name: "Ali" }, by: cashier, attachments: ["inv.jpg"],
      billAmount: 530,
      supplier: { vendorId: "rice", vendorName: "Rice Co", mode: "pays", pays: [{ billId: "b1", amount: 500 }] },
      delivery: { amount: 30, ...transport, receipts: [] },
    };
    const r = approveSupplier(settle, bills, { uid: "m1", name: "KL Manager", role: "manager" }, now, { paymentId: "vp1" });
    expect(r.paid).toBe(500);
    expect(r.cost).toMatchObject({ amount: 500, category: "Inventory" });
    expect(r.deliveryCost).toMatchObject({ amount: 30, category: "Transport & delivery", description: expect.stringContaining("Rice Co") });
    expect(r.settlePatch).toMatchObject({ billAmount: 530, change: 70 });
  });
});
