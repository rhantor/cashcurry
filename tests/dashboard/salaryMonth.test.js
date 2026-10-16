// A month's salaries split by where they came from, so neither Salary Entry
// nor Payroll's "Mark as paid" counts the same month twice.
import { describe, it, expect } from "vitest";
import { splitSalaryMonth } from "@/lib/payroll/splitSalaryMonth";

describe("splitSalaryMonth", () => {
  it("separates payroll slips from salaries entered by hand", () => {
    const s = splitSalaryMonth([
      { id: "payroll_r1_a", source: "payroll", netPay: 1800, amount: 1800 },
      { id: "payroll_r1_b", source: "payroll", netPay: 1200.5, amount: 1200.5 },
      { id: "x", totalSalary: 500, amount: 500, paymentDate: "2026-04-20" },
    ]);
    expect(s.payroll).toEqual({ count: 2, total: 3000.5 });
    expect(s.byHand).toEqual([{ id: "x", amount: 500, paymentDate: "2026-04-20" }]);
  });

  it("an empty month has nothing either way", () => {
    expect(splitSalaryMonth([])).toEqual({ payroll: { count: 0, total: 0 }, byHand: [] });
  });

  it("older hand entries with only `amount` and `date` still count", () => {
    expect(splitSalaryMonth([{ id: "y", amount: "250", date: "2026-08-10" }]).byHand).toEqual([{ id: "y", amount: 250, paymentDate: "2026-08-10" }]);
  });
});
