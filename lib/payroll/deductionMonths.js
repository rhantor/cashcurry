// lib/payroll/deductionMonths.js — which salary an advance can be taken back from.
// Pure. Salaries are paid after the month ends, so on 8 Nov October's pay may
// still be open, and an advance given that day can come off it (owner, 8 Nov).
// Once a month's payroll is finalized or paid nothing can come off it any more:
// an instalment left in that month would never be taken.

const MONTHS_AHEAD = 3;

/** "2026-11" + 1 → "2026-12" */
export const shiftMonth = (ym, n) => {
  const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

/** Can this month's salary still take an advance? runs: [{ period, status }] */
export const salaryOpen = (runs = [], period) => !runs.some((r) => r.period === period && ["finalized", "paid"].includes(r.status));

/**
 * The months to offer for an advance dated `date` ("YYYY-MM-DD"): that month
 * and the next three, and last month when `back` and its salary is still open.
 * `back` is for an advance that takes effect at once: one waiting for approval
 * could still be waiting when that salary closes.
 */
export function deductionMonths(date, runs = [], { back = false } = {}) {
  const month = String(date || "").slice(0, 7);
  if (!month) return [];
  const last = shiftMonth(month, -1);
  const ahead = Array.from({ length: MONTHS_AHEAD + 1 }, (_, i) => shiftMonth(month, i));
  return back && salaryOpen(runs, last) ? [last, ...ahead] : ahead;
}
