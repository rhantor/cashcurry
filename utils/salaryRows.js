// utils/salaryRows.js
// The salary report shows one line per salary payment. A manual entry is
// already one line for the month; a payroll run that was marked paid writes
// one entry per staff member (payroll_{runId}_{staffId}). Here those are
// folded back into one line per payroll run — with the staff inside it — so
// a month paid through payroll reads like any other month. Display only:
// nothing in the database changes.

const n = (v) => Number(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;

const nameOf = (e) =>
  e.staffName || [e.firstName, e.lastName].filter(Boolean).join(" ") || e.name || e.staffId || "Staff";

/**
 * Salary entries → report rows: manual entries as they are, payroll entries
 * grouped by their run (or by month when an entry has no run id):
 * { id, source: "payroll-run", month, paymentDate, totalSalary, staffCount,
 *   staff: [entries, by name], staffNames, payrollRunId, createdBy }
 */
export function salaryRows(entries = []) {
  const rows = [];
  const runs = new Map();
  for (const e of entries) {
    if (e?.source !== "payroll") {
      rows.push(e);
      continue;
    }
    const key = e.payrollRunId || `month_${e.month || e.period || ""}`;
    if (!runs.has(key)) runs.set(key, []);
    runs.get(key).push(e);
  }
  for (const [key, list] of runs) {
    const staff = [...list].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
    const first = staff[0];
    // the run is paid on one day; if entries differ, show the latest
    const paymentDate = staff.map((s) => s.paymentDate || "").sort().pop() || "";
    rows.push({
      id: `run_${key}`,
      source: "payroll-run",
      payrollRunId: first.payrollRunId || "",
      month: first.month || first.period || "",
      paymentDate,
      totalSalary: r2(staff.reduce((s, x) => s + n(x.totalSalary ?? x.netPay), 0)),
      staffCount: staff.length,
      staff,
      staffName: `Payroll · ${staff.length} staff`,
      staffNames: staff.map(nameOf).join(", "),
      payMethod: first.payMethod || "",
      createdBy: first.createdBy || {},
    });
  }
  return rows;
}

export { nameOf as salaryStaffName };
