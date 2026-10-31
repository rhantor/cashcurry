import { describe, expect, it } from "vitest";
import { approveBill, approvesOwnBill, billWaitsFor, canReviewBill, changeOf, changeText, newPayout, newSettle, openByPerson, payoutCash, rejectBill } from "@/lib/payouts/model";
import { can } from "@/lib/authz/permissions";

const cashier = { uid: "c1", role: "cashier", firstName: "Siti" };
const manager = { uid: "m1", role: "manager", firstName: "Mira" };

describe("pay-outs", () => {
  const p = { id: "p1", ...newPayout({ date: "2026-10-10", amount: "100", to: { name: "Ali", staffId: "st1" }, purpose: "Gas" }, cashier) };
  it("a new pay-out is open and leaves the till", () => {
    expect(p).toMatchObject({ kind: "out", amount: 100, status: "open", to: { name: "Ali", staffId: "st1" }, by: { uid: "c1" } });
    expect(payoutCash(p)).toBe(-100);
  });
  it("the bill: change back or extra paid", () => {
    const s = newSettle(p, { date: "2026-10-11", billAmount: 82.5, fields: { categoryId: "gas", category: "Cooking gas", costKind: "expense" } }, cashier);
    expect(s).toMatchObject({ kind: "settle", payoutId: "p1", floatAmount: 100, billAmount: 82.5, change: 17.5, status: "pending", payoutBy: { uid: "c1" } });
    expect(payoutCash(s)).toBe(17.5);
    expect(changeOf(100, 120)).toBe(-20);
    expect(changeText(100, 120)).toMatch(/20.00 more paid/);
    expect(changeText(100, 100)).toMatch(/Exact/);
  });
  it("in charge approves — not the one who handed it out or brought the bill", () => {
    const s = { id: "s1", ...newSettle(p, { date: "2026-10-11", billAmount: 82.5 }, cashier) };
    expect(canReviewBill(manager, s, can)).toBe(true);
    expect(canReviewBill(cashier, s, can)).toBe(false);
    expect(canReviewBill({ uid: "x", role: "inCharge" }, s, can)).toBe(true);
    expect(canReviewBill({ uid: "a", role: "accountant" }, s, can)).toBe(false);
    const ownHandOut = { ...s, by: { uid: "c2" }, payoutBy: { uid: "m1" } };
    expect(canReviewBill(manager, ownHandOut, can)).toBe(false);
  });
  it("only someone senior to whoever handed it out and brought it (owner, 31 Oct)", () => {
    const inCharge = { uid: "i1", role: "inCharge" };
    const s = { id: "s2", ...newSettle({ ...p, by: { uid: "m2", role: "manager" } }, { date: "2026-10-11", billAmount: 82.5 }, cashier) };
    expect(canReviewBill(inCharge, s, can)).toBe(false);
    expect(canReviewBill({ uid: "m1", role: "manager" }, s, can)).toBe(false);
    expect(canReviewBill({ uid: "b1", role: "branchAdmin" }, s, can)).toBe(true);
    expect(billWaitsFor(inCharge, s)).toBe("Waits for branch admin or above.");
    const ownOwner = { ...s, by: { uid: "o1", role: "owner" }, payoutBy: { uid: "o1", role: "owner" } };
    expect(canReviewBill({ uid: "o1", role: "owner" }, ownOwner, can)).toBe(true);
    expect(approvesOwnBill({ role: "gm" })).toBe(true);
    // a manager's own up to the branch's limit (1 Nov), handed out by them or someone junior
    const mine = { billAmount: 80, by: { uid: "m2" }, payoutBy: { uid: "m2", role: "manager" } };
    expect(approvesOwnBill({ uid: "m2", role: "manager" }, mine)).toBe(true);
    expect(approvesOwnBill({ uid: "m2", role: "manager" }, { ...mine, billAmount: 120 })).toBe(false);
    expect(approvesOwnBill({ uid: "m2", role: "manager" }, { ...mine, billAmount: 120 }, 150)).toBe(true);
    expect(approvesOwnBill({ uid: "m2", role: "manager" }, { ...mine, payoutBy: { uid: "c1", role: "cashier" } })).toBe(true);
    expect(approvesOwnBill({ uid: "m2", role: "manager" }, { ...mine, payoutBy: { uid: "b1", role: "branchAdmin" } })).toBe(false);
    expect(approvesOwnBill({ uid: "i1", role: "inCharge" }, { ...mine, by: { uid: "i1" }, payoutBy: { uid: "i1", role: "inCharge" } })).toBe(false);
  });
  it("approving makes the cost; a correction keeps the original", () => {
    const s = { id: "s1", ...newSettle(p, { date: "2026-10-11", billAmount: 82.5, fields: { categoryId: "gas", category: "Cooking gas", costGroupId: "food", costGroup: "Food & stock", costKind: "expense" } }, cashier) };
    const plain = approveBill(s, {}, manager);
    expect(plain.cost).toMatchObject({ date: "2026-10-11", amount: 82.5, category: "Cooking gas", paidFromOffice: "front", meta: { type: "payout", payoutId: "p1", settleId: "s1" } });
    expect(plain.settle.review.original).toBeUndefined();
    expect(payoutCash({ ...s, ...plain.settle })).toBe(100); // the float back; the cost takes the bill
    const fixed = approveBill(s, { billAmount: 80, fields: { categoryId: "delivery", category: "Transport & delivery", costGroupId: "running", costGroup: "Running the business", costKind: "expense" } }, manager);
    expect(fixed.cost).toMatchObject({ amount: 80, category: "Transport & delivery" });
    expect(fixed.settle).toMatchObject({ billAmount: 80, change: 20, review: { original: { billAmount: 82.5, category: "Cooking gas" } } });
  });
  it("no bill paper: the cost carries an approved voucher", () => {
    const s = { id: "s1", ...newSettle(p, { date: "2026-10-11", billAmount: 50, voucherReason: "Market stall" }, cashier) };
    expect(approveBill(s, {}, manager).cost.voucher).toMatchObject({ status: "approved", reason: "Market stall", decidedBy: { uid: "m1" } });
    expect(rejectBill("Photo is blurry", manager)).toMatchObject({ status: "rejected", review: { note: "Photo is blurry" } });
  });
  it("a bill of many pages (PDFs) with a payment receipt: the cost keeps both, bill first", () => {
    const s = { id: "s1", ...newSettle(p, { date: "2026-10-11", billAmount: 50, files: ["b1.pdf", "b2.jpg"], receipts: ["r1.jpg"] }, cashier) };
    expect(s).toMatchObject({ attachments: ["b1.pdf", "b2.jpg"], receipts: ["r1.jpg"] });
    const { cost } = approveBill(s, {}, manager);
    expect(cost.attachments).toEqual(["b1.pdf", "b2.jpg", "r1.jpg"]);
    expect(cost.receipts).toEqual(["r1.jpg"]);
    expect(cost.fileURL).toBe("b1.pdf");
  });
  it("open ones by person, oldest first, late after two days", () => {
    const now = new Date("2026-10-12T12:00:00");
    const rows = openByPerson([
      { kind: "out", status: "open", amount: 50, to: { name: "Ali", staffId: "st1" }, createdAt: new Date("2026-10-12T10:00:00") },
      { kind: "out", status: "open", amount: 30, to: { name: "Ali", staffId: "st1" }, createdAt: new Date("2026-10-09T10:00:00") },
      { kind: "out", status: "open", amount: 20, to: { name: "Kumar" }, createdAt: new Date("2026-10-12T11:00:00") },
      { kind: "out", status: "billed", amount: 99, to: { name: "Ali", staffId: "st1" } },
    ], now);
    expect(rows.map((r) => [r.name, r.total, r.late])).toEqual([["Ali", 80, true], ["Kumar", 20, false]]);
    expect(rows[0].items[0].amount).toBe(30);
  });
});
