// lib/payroll/payslipCopy.js — each staff member's own copy of a payslip
// (roadmap 4.6). Staff may not read payroll runs (their headers carry the
// branch's totals), so finalizing a run also writes
// staffPrivate/{staffId}/payslips/{runId}, marking it paid later and removing
// it when the run is reverted (payrollRunApiSlice).

/** What a staff member sees of their slip: their pay, never the employer's cost. */
export const STAFF_SLIP_FIELDS = [
  "staffName", "designation", "department", "period",
  "basicSalary", "allowance", "salaryMode", "standardHours", "workingDays",
  "workedHours", "workedDays", "otHours", "phHours", "phDays",
  "basePay", "otPay", "phPay", "bonus", "otherEarnings", "grossEarnings", "absentAmount",
  "statutory", "totalStatutoryEmployee",
  "advanceAmt", "loanAmt", "advanceDue", "loanDue", "penalty", "otherDeductions", "totalDeductions",
  "netPay",
  "otherEarningsNote", "otherDeductionsNote", "bonusNote", "penaltyNote", "loanNote", "extraNote",
];

/**
 * The staff member's copy of `slip` for run `runId`.
 * status: "finalized" | "paid"; paidOn: "YYYY-MM-DD" once paid.
 */
export function payslipCopy(slip, { runId, status, paidOn = null }) {
  const copy = { runId, status, paidOn };
  for (const k of STAFF_SLIP_FIELDS) if (slip?.[k] !== undefined) copy[k] = slip[k];
  // The employer's share of each deduction stays with payroll.
  if (Array.isArray(copy.statutory)) {
    copy.statutory = copy.statutory.map((d) => {
      const own = { ...d };
      delete own.employerAmt;
      delete own.employerRate;
      return own;
    });
  }
  return copy;
}

/** Newest first: by period ("YYYY-MM"), then run. */
export const byPeriodDesc = (a, b) =>
  String(b.period || "").localeCompare(String(a.period || "")) || String(b.runId || "").localeCompare(String(a.runId || ""));
