import { describe, expect, it } from "vitest";
import { calcPayroll } from "@/lib/payroll/calculations";
import { allocateTaken, applyRepayment, reverseRepayment } from "@/lib/payroll/repayments";

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

describe("reverseRepayment", () => {
  const now = "2026-10-31T00:00:00.000Z";
  const paid = (index, month, amount = 100) => ({ index, month, amount, status: "paid", paidAt: now });
  const due = (index, month, amount = 100) => ({ index, month, amount, status: "pending", paidAt: null });
  const undoOf = (installments, extra = {}) => ({ installments, totalPaid: 0, remainingAmount: 300, status: "approved", ...extra });

  it("puts back only this month when a later month has been repaid too", () => {
    const before = undoOf([due(1, "2026-07"), due(2, "2026-08"), due(3, "2026-09")]);
    const current = { amount: 300, installments: [paid(1, "2026-07"), paid(2, "2026-08"), due(3, "2026-09")] };
    const r = reverseRepayment(current, [{ index: 1, amount: 100, due: 100 }], before);
    expect(r.installments.map((i) => i.status)).toEqual(["pending", "paid", "pending"]);
    expect(r.totalPaid).toBe(100);
    expect(r.remainingAmount).toBe(200);
    expect(r.installments[0].paidAt).toBeNull();
  });

  it("reopens a closed loan", () => {
    const before = undoOf([paid(1, "2026-07"), due(2, "2026-08")], { totalPaid: 100, remainingAmount: 100 });
    const current = { amount: 200, status: "closed", installments: [paid(1, "2026-07"), paid(2, "2026-08")] };
    const r = reverseRepayment(current, [{ index: 2, amount: 100, due: 100 }], before);
    expect(r.status).toBe("approved");
    expect(r.remainingAmount).toBe(100);
  });

  it("undoes a carry-over from the snapshot when nothing was paid since", () => {
    const list = [due(1, "2026-07"), due(2, "2026-08")];
    const { installments } = applyRepayment(list, 1, 40, { amount: 200, now });
    expect(installments).toHaveLength(3);
    const r = reverseRepayment({ amount: 200, installments }, [{ index: 1, amount: 40, due: 100 }], undoOf(list, { remainingAmount: 200 }));
    expect(r.installments).toEqual(list);
    expect(r.remainingAmount).toBe(200);
  });

  it("refuses when this month changed the schedule and a later month was paid", () => {
    const list = [due(1, "2026-07"), due(2, "2026-08")];
    const first = applyRepayment(list, 1, 40, { amount: 200, now }).installments;
    const later = applyRepayment(first, 2, 100, { amount: 200, now }).installments;
    expect(reverseRepayment({ amount: 200, installments: later }, [{ index: 1, amount: 40, due: 100 }], undoOf(list))).toBeNull();
  });

  it("refuses an old snapshot once an earlier month was put back", () => {
    // August's snapshot says July was paid; July has since been reopened
    const before = undoOf([paid(1, "2026-07"), due(2, "2026-08"), due(3, "2026-09")]);
    const after = applyRepayment([due(1, "2026-07"), due(2, "2026-08"), due(3, "2026-09")], 2, 50, { amount: 300, now }).installments;
    expect(reverseRepayment({ amount: 300, installments: after }, [{ index: 2, amount: 50, due: 100 }], before)).toBeNull();
  });

  it("refuses when the instalment isn't paid any more", () => {
    const before = undoOf([due(1, "2026-07")]);
    expect(reverseRepayment({ amount: 100, installments: [due(1, "2026-07")] }, [{ index: 1, amount: 100, due: 100 }], before)).toBeNull();
  });

  it("handles a run's slip saved before due was recorded", () => {
    const before = undoOf([due(1, "2026-07")]);
    const r = reverseRepayment({ amount: 100, installments: [paid(1, "2026-07")] }, [{ index: 1, amount: 100 }], before);
    expect(r.installments[0].status).toBe("pending");
  });
});
