import { describe, expect, it } from "vitest";
import { billBalance, choosable, dayOf, dueIn, duesTotal, isActive, itemPrices, payFirst, scorecard, statement, vendorDues } from "@/lib/purchases/vendors";

const today = "2026-10-22";
const bills = [
  { vendorId: "rice", total: 500, paid: 200, dueDate: "2026-10-12" }, // 10 days late, 300
  { vendorId: "rice", balance: 450, dueDate: "2026-10-20" }, // 2 days late
  { vendorId: "rice", balance: 100, dueDate: "2026-10-25" }, // due in 3
  { vendorId: "oil", balance: 80, dueDate: "2026-10-22" }, // due today
  { vendorId: "oil", balance: 70, dueDate: "2026-11-15" }, // later
  { vendorId: "gas", balance: 60 }, // no due date
  { vendorId: "gas", balance: 0, dueDate: "2026-10-01" }, // nothing left
  { vendorId: "gas", balance: 40, status: "paid" },
];

describe("what each supplier is owed, and when", () => {
  it("balance from the bill, or total − paid", () => {
    expect(billBalance({ total: 500, paid: 200 })).toBe(300);
    expect(billBalance({ balance: 12.345 })).toBe(12.35);
    expect(dueIn({ dueDate: "2026-10-25" }, today)).toBe(3);
    expect(dueIn({}, today)).toBeNull();
  });
  it("overdue, due this week, next due", () => {
    const d = vendorDues(bills, today);
    expect(d.rice).toEqual({ owed: 850, bills: 3, overdue: 750, overdueBills: 2, dueWeek: 100, dueWeekBills: 1, oldestLate: 10, nextDue: "2026-10-25" });
    expect(d.oil).toMatchObject({ owed: 150, overdue: 0, dueWeek: 80, dueWeekBills: 1, nextDue: "2026-10-22" });
    expect(d.gas).toMatchObject({ owed: 60, bills: 1, overdue: 0, dueWeek: 0, nextDue: "" });
  });
  it("added up, and who to pay first", () => {
    const d = vendorDues(bills, today);
    expect(duesTotal(d)).toEqual({ owed: 1060, overdue: 750, overdueVendors: 1, dueWeek: 180, dueWeekVendors: 2 });
    const order = [{ id: "gas" }, { id: "oil" }, { id: "rice" }, { id: "none" }].sort((a, b) => payFirst(d)(b) - payFirst(d)(a)).map((v) => v.id);
    expect(order).toEqual(["rice", "oil", "gas", "none"]);
  });
});

describe("vendors in use", () => {
  it("no flag = in use; inactive ones are not offered unless already chosen", () => {
    const vs = [{ id: "a" }, { id: "b", active: false }, { id: "c", active: true }];
    expect(isActive(vs[0])).toBe(true);
    expect(choosable(vs).map((v) => v.id)).toEqual(["a", "c"]);
    expect(choosable(vs, "b").map((v) => v.id)).toEqual(["a", "b", "c"]);
  });
});


describe("how a supplier delivers", () => {
  const line = (req, got) => ({ requestedQty: req, receivedQty: got });
  const orders = [
    { status: "Received", sentAt: "2026-10-01T03:00:00.000Z", deliverBy: "2026-10-02", receivedAt: { seconds: Date.parse("2026-10-02T05:00:00") / 1000 }, receivedItems: [line(10, 10)] },
    { status: "Received", sentAt: "2026-10-05T03:00:00.000Z", deliverBy: "2026-10-06", receivedAt: { seconds: Date.parse("2026-10-09T05:00:00") / 1000 }, receivedItems: [line(10, 8)] },
    { status: "Received", receivedItems: [line(5, 5)] }, // before sending was recorded
    { status: "Sent", deliverBy: "2026-10-20" }, // late
    { status: "Approved" },
    { status: "Cancelled" },
  ];
  it("on time, came short, days it takes, open and late", () => {
    expect(scorecard(orders, "2026-10-22")).toEqual({ open: 2, late: 1, received: 3, onTime: 1, onTimeOf: 2, onTimePct: 50, short: 1, shortPct: 33, avgDays: 2.5, avgOf: 2 });
    expect(scorecard([], "2026-10-22")).toMatchObject({ onTimePct: null, shortPct: null, avgDays: null });
  });
  it("dates as days", () => {
    expect(dayOf("2026-10-02")).toBe("2026-10-02");
    expect(dayOf(null)).toBe("");
    expect(dayOf(new Date(2026, 9, 2, 13))).toBe("2026-10-02");
  });
});

describe("what we buy from them", () => {
  const bills = [
    { invoiceDate: "2026-10-20", items: [{ itemId: "rice", name: "Rice", unit: "bag", receivedQty: 20, finalPrice: 56 }] },
    { invoiceDate: "2026-10-01", items: [{ itemId: "rice", name: "Rice", unit: "bag", receivedQty: 10, finalPrice: 55 }, { itemId: "oil", name: "Oil", unit: "tin", receivedQty: 8, finalPrice: 15 }] },
    { invoiceDate: "2026-10-10", items: [{ itemId: "rice", name: "Rice", receivedQty: 5, finalPrice: 55 }, { itemId: "x", receivedQty: 0, finalPrice: 9 }] },
  ];
  it("per item: times, quantity, last price and the change from the one before, newest first", () => {
    const r = itemPrices(bills);
    expect(r.map((i) => i.key)).toEqual(["rice", "oil"]);
    expect(r[0]).toMatchObject({ times: 3, qty: 35, last: { price: 56, date: "2026-10-20" }, prev: { price: 55, date: "2026-10-10" }, change: 1.8 });
    expect(r[1]).toMatchObject({ times: 1, prev: null, change: null });
  });
});

describe("a supplier's statement", () => {
  const bills = [
    { invoiceNo: "A", invoiceDate: "2026-09-20", total: 300, paymentHistory: [{ amount: 300, paymentDate: "2026-10-03", paidMethod: "cash" }] },
    { invoiceNo: "B", invoiceDate: "2026-10-05", total: 500, paymentHistory: [{ amount: 200, paidAtClient: "2026-10-05T09:00:00.000Z", paidMethod: "bank_transfer" }] },
    { invoiceNo: "C", invoiceDate: "2026-11-02", total: 100 },
  ];
  it("what was owed before, each bill and payment with the balance, and the totals", () => {
    const s = statement(bills, "2026-10-01", "2026-10-31");
    expect(s.opening).toBe(300);
    expect(s.rows.map((r) => [r.date, r.kind, r.ref, r.debit, r.credit, r.balance])).toEqual([
      ["2026-10-03", "payment", "Paid · A · cash", 0, 300, 0],
      ["2026-10-05", "bill", "B", 500, 0, 500],
      ["2026-10-05", "payment", "Paid · B · bank transfer", 0, 200, 300],
    ]);
    expect(s).toMatchObject({ billed: 500, paid: 500, closing: 300 });
    expect(statement(bills).closing).toBe(400);
  });
});
