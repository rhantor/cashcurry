// A work month's salary entries split by where they came from: Payroll
// ("Mark as paid" writes one entry per staff, source "payroll") or entered by
// hand on the Salary Entry screen. No Firebase here, so tests can use it.

const num = (v) => Number(v) || 0;
const amountOf = (s) => num(s.totalSalary ?? s.amount ?? s.netPay);

/** { payroll: { count, total }, byHand: [{ id, amount, paymentDate }] } for one month's entries. */
export function splitSalaryMonth(entries = []) {
  const payroll = entries.filter((s) => s.source === "payroll");
  return {
    payroll: { count: payroll.length, total: payroll.reduce((n, s) => n + amountOf(s), 0) },
    byHand: entries.filter((s) => s.source !== "payroll").map((s) => ({ id: s.id, amount: amountOf(s), paymentDate: s.paymentDate || s.date || "" })),
  };
}
