// lib/payroll/salaryRows.js (also on main as utils/salaryRows.js, 25 Oct 2026)
// The salary report shows one line per salary payment. A manual entry is
// already one line for the month; a payroll run that was marked paid writes
// one entry per staff member (payroll_{runId}_{staffId}). Here those are
// folded back into one line per payroll run — with the staff inside it — so
// a month paid through payroll reads like any other month. Display only:
// nothing in the database changes.

const n = (v) => Number(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;
const clean = (v) => String(v || "").trim();

/** A staff record's name. */
export const staffRecordName = (s) =>
  clean([s?.firstName, s?.lastName].filter(Boolean).join(" ")) ||
  clean(s?.name) ||
  clean(s?.fullName);

/** The name to show for a payroll entry (after salaryRows has filled it in). */
export const salaryStaffName = (e) =>
  clean(e?.staffName) || clean(e?.name) || "Former staff";

/**
 * Salary entries → report rows: manual entries as they are, payroll entries
 * grouped by their run (or by month when an entry has no run id):
 * { id, source: "payroll-run", month, paymentDate, totalSalary, staffCount,
 *   staff: [entries, by name], staffNames, payrollRunId, createdBy }
 * staffNames: Map staffId → name (the branch's staff), for entries saved
 * without a name; else a name the same person has on another month's entry;
 * else "Former staff · <designation>".
 */
export function salaryRows(entries = [], { staffNames = new Map() } = {}) {
  const seen = new Map();
  for (const e of entries)
    if (e?.source === "payroll" && e.staffId && clean(e.staffName))
      seen.set(e.staffId, clean(e.staffName));
  const named = (e) => {
    const name =
      clean(e.staffName) ||
      staffNames.get(e.staffId) ||
      seen.get(e.staffId) ||
      `Former staff${e.designation ? ` · ${e.designation}` : ""}`;
    return name === e.staffName ? e : { ...e, staffName: name };
  };

  const rows = [];
  const runs = new Map();
  for (const e of entries) {
    if (e?.source !== "payroll") {
      rows.push(e);
      continue;
    }
    const key = e.payrollRunId || `month_${e.month || e.period || ""}`;
    if (!runs.has(key)) runs.set(key, []);
    runs.get(key).push(named(e));
  }
  for (const [key, list] of runs) {
    const staff = [...list].sort((a, b) =>
      salaryStaffName(a).localeCompare(salaryStaffName(b)),
    );
    const first = staff[0];
    // the run is paid on one day; if entries differ, show the latest
    const paymentDate =
      staff
        .map((s) => s.paymentDate || "")
        .sort()
        .pop() || "";
    rows.push({
      id: `run_${key}`,
      source: "payroll-run",
      payrollRunId: first.payrollRunId || "",
      month: first.month || first.period || "",
      paymentDate,
      totalSalary: r2(
        staff.reduce((s, x) => s + n(x.totalSalary ?? x.netPay), 0),
      ),
      staffCount: staff.length,
      staff,
      staffName: `Payroll · ${staff.length} staff`,
      staffNames: staff.map(salaryStaffName).join(", "),
      payMethod: first.payMethod || "",
      createdBy: first.createdBy || {},
    });
  }
  return rows;
}
