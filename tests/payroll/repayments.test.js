import { describe, expect, it } from "vitest";
import { calcPayroll } from "@/utils/payrollCalculations";
import { allocateTaken, applyRepayment } from "@/lib/payroll/repayments";

const staff = { basicSalary: 1000, salaryMode: "days", workingDays: 26 };
const fullMonth = { workedDays: 26 };

describe("calcPayroll — advance and loan never take more than the pay", () => {
  it("takes everything when the pay covers it", () => {
    const c = calcPayroll(staff, { ...fullMonth, advanceAmt: 300, loanAmt: 200 });
    expect(c.advanceAmt).toBe(300);
    expect(c.loanAmt).toBe(200);
    expect(c.netPay).toBe(500);
  });

  it("advance first, then loan, out of what is left", () => {
    const c = calcPayroll(staff, { ...fullMonth, penalty: 100, advanceAmt: 700, loanAmt: 500 });
    expect(c.advanceAmt).toBe(700);
    expect(c.loanAmt).toBe(200);
    expect(c.loanDue).toBe(500);
    expect(c.totalDeductions).toBe(1000);
    expect(c.netPay).toBe(0);
  });

  it("takes nothing when other deductions already use the whole pay", () => {
    const c = calcPayroll(staff, { ...fullMonth, otherDeductions: 1200, advanceAmt: 100, loanAmt: 100 });
    expect(c.advanceAmt).toBe(0);
    expect(c.loanAmt).toBe(0);
    expect(c.netPay).toBe(0);
  });
});

describe("allocateTaken", () => {
  const items = [
    { docId: "a", index: 1, amount: 100 },
    { docId: "b", index: 2, amount: 150 },
  ];
  it("fills in order and drops what gets nothing", () => {
    expect(allocateTaken(items, 120)).toEqual([
      { docId: "a", index: 1, amount: 100, due: 100 },
      { docId: "b", index: 2, amount: 20, due: 150 },
    ]);
    expect(allocateTaken(items, 80)).toEqual([{ docId: "a", index: 1, amount: 80, due: 100 }]);
    expect(allocateTaken(items, 0)).toEqual([]);
  });
  it("puts an extra amount on the last one", () => {
    expect(allocateTaken(items, 300).map((i) => i.amount)).toEqual([100, 200]);
  });
});

describe("applyRepayment", () => {
  const loan = [
    { index: 1, month: "2026-09", amount: 100, status: "paid", paidAt: "x" },
    { index: 2, month: "2026-10", amount: 100, status: "pending", paidAt: null },
    { index: 3, month: "2026-11", amount: 100, status: "pending", paidAt: null },
  ];
  const now = "2026-10-31T00:00:00.000Z";

  it("full payment marks it paid", () => {
    const r = applyRepayment(loan, 2, 100, { amount: 300, now });
    expect(r.installments[1]).toMatchObject({ month: "2026-10", status: "paid", paidAt: now });
    expect(r.totalPaid).toBe(200);
    expect(r.remainingAmount).toBe(100);
    expect(r.allPaid).toBe(false);
  });

  it("part payment: pays what was taken and carries the rest after the last month", () => {
    const r = applyRepayment(loan, 2, 40, { amount: 300, now });
    expect(r.installments.map((i) => [i.index, i.month, i.amount, i.status])).toEqual([
      [1, "2026-09", 100, "paid"],
      [2, "2026-10", 40, "paid"],
      [3, "2026-11", 100, "pending"],
      [4, "2026-12", 60, "pending"],
    ]);
    expect(r.totalPaid).toBe(140);
    expect(r.remainingAmount).toBe(160);
  });

  it("paying extra takes it off the last instalments", () => {
    const r = applyRepayment(loan, 2, 200, { amount: 300, now });
    expect(r.installments.map((i) => [i.month, i.amount, i.status])).toEqual([
      ["2026-09", 100, "paid"],
      ["2026-10", 200, "paid"],
    ]);
    expect(r.allPaid).toBe(true);
    expect(r.remainingAmount).toBe(0);
  });

  it("does nothing to an instalment already paid", () => {
    expect(applyRepayment(loan, 1, 100, { amount: 300, now })).toBeNull();
  });
});
