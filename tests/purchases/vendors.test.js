import { describe, expect, it } from "vitest";
import { billBalance, choosable, dueIn, duesTotal, isActive, payFirst, vendorDues } from "@/lib/purchases/vendors";

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
