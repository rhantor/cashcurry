import { describe, expect, it } from "vitest";
import { byPeriodDesc, payslipCopy } from "@/lib/payroll/payslipCopy";

const slip = {
  staffId: "st1", staffName: "Ali", period: "2026-09",
  basicSalary: 1800, grossEarnings: 2000, netPay: 1750, totalDeductions: 250,
  totalEmployerCost: 2240, totalStatutoryEmployer: 240, totalStatutoryEmployee: 200,
  statutory: [{ key: "epf", name: "EPF", employeeAmt: 200, employerAmt: 240, employeeRate: 11, employerRate: 13 }],
  deductionMeta: { advances: [{ docId: "a1", index: 0, amount: 50 }], loans: [] },
  allowanceOverride: "100", loanOverride: null,
};

describe("a staff member's copy of their payslip", () => {
  it("keeps their pay and leaves out the employer's cost and payroll's working", () => {
    const c = payslipCopy(slip, { runId: "r1", status: "finalized" });
    expect(c).toMatchObject({ runId: "r1", status: "finalized", paidOn: null, netPay: 1750, grossEarnings: 2000, period: "2026-09" });
    expect(c).not.toHaveProperty("totalEmployerCost");
    expect(c).not.toHaveProperty("totalStatutoryEmployer");
    expect(c).not.toHaveProperty("deductionMeta");
    expect(c).not.toHaveProperty("allowanceOverride");
    expect(c.statutory).toEqual([{ key: "epf", name: "EPF", employeeAmt: 200, employeeRate: 11 }]);
  });
  it("records when it was paid", () => {
    expect(payslipCopy(slip, { runId: "r1", status: "paid", paidOn: "2026-10-01" })).toMatchObject({ status: "paid", paidOn: "2026-10-01" });
  });
  it("newest month first", () => {
    const list = [{ period: "2026-08" }, { period: "2026-10" }, { period: "2026-09" }].sort(byPeriodDesc);
    expect(list.map((s) => s.period)).toEqual(["2026-10", "2026-09", "2026-08"]);
  });
});
