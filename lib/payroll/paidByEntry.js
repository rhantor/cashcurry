// A payroll month already paid by hand (17 Nov 2026).
//
// Some months were paid and entered on the Salary Entry screen as one total,
// while the payroll run for the same month stayed "finalized". "Mark as paid"
// would add every slip as salary again — the month counted twice. Instead the
// run is marked paid *by that entry*: the run and the staff's payslips say
// paid, and no salary is added (the entry already moved the money).
//
// Pure — no React, no Firebase.

const num = (v) => Number(v) || 0;
const r2 = (v) => Math.round(num(v) * 100) / 100;
const clean = (v) => String(v || "").trim();

/** The month's salary entries made by hand, with what a person needs to pick one. */
export function byHandEntries(entries = []) {
  return entries
    .filter((s) => s.source !== "payroll")
    .map((s) => ({
      id: s.id,
      amount: r2(s.totalSalary ?? s.amount ?? s.netPay),
      paymentDate: clean(s.paymentDate || s.date),
      method: clean(s.payMethod || s.paymentMethod || s.paidMethod),
      note: clean(s.note || s.notes || s.description),
    }))
    .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
}

/** How the entry compares with the run's net pay: { diff, same } (same within 5 sen). */
export function entryMatch(entry, runNet) {
  const diff = r2(num(entry?.amount) - num(runNet));
  return { diff, same: Math.abs(diff) < 0.05 };
}

/**
 * Why this run can't be marked paid by this entry, or "" when it can.
 * payrollEntries: salary entries already written for this run by "Mark as paid".
 */
export function paidByEntryProblem({ run, entry, payrollEntries = [] }) {
  if (!run) return "This payroll wasn't found.";
  if (run.status !== "finalized") return "Finalize the payroll first.";
  if (!entry) return "That salary entry wasn't found.";
  if (entry.source === "payroll") return "That entry came from payroll itself, not the Salary Entry screen.";
  const month = entry.month || entry.period;
  if (month && run.period && month !== run.period) return "That salary entry is for another month.";
  if (payrollEntries.length) return "This payroll already added its slips as salary. Mark it paid the usual way.";
  return "";
}

/** The run's fields once it is paid by the entry. */
export function paidByEntryFields(entry, user = {}) {
  const e = byHandEntries([entry])[0] || {};
  return {
    status: "paid",
    paidBy: { uid: user.uid || "", username: user.username || "", name: user.name || user.username || "" },
    paymentMethod: e.method || "",
    paymentReference: `Paid by hand: Salary Entry${e.paymentDate ? ` of ${e.paymentDate}` : ""}`,
    paidOn: e.paymentDate || "",
    paidByEntry: { id: e.id || "", amount: e.amount || 0, paymentDate: e.paymentDate || "" },
    reopened: null,
  };
}
