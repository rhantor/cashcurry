// Salary changes (owner, 6 Nov 2026): a raise is entered once — the new basic
// (and allowance), from which month, and why — and the hourly and OT rates
// follow from it (basic ÷ the month's hours), instead of three fields typed by
// hand. Each change is kept on the person's private record (staffPrivate
// .payHistory), so payroll pays every month at the rate in force then, and
// "when did whose salary go up" is answered from the record. Pure.

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

/** The pay fields a change sets. */
export const PAY_KEYS = ["basicSalary", "allowance", "basicPerHour", "OTPerHour"];

/** The fields as they stand on a record: { basicSalary, allowance, basicPerHour, OTPerHour } (null when not set). */
export const payOf = (s = {}) => Object.fromEntries(PAY_KEYS.map((k) => [k, num(s[k])]));

/** The month's hours for this person: their own, else the branch's, else 208. */
export const hoursOf = (staff = {}, branchHours) => Number(staff.standardHours) || Number(branchHours) || 208;

/**
 * The rates for a new basic. The hourly rate is basic ÷ hours. The OT rate moves with it:
 * where it equalled the hourly rate it stays equal; where it was some other rate it keeps
 * its ratio to the hourly; where none was set none is set (payroll works it out).
 */
export function ratesFor(basic, hours, was = {}) {
  const perHour = hours > 0 ? r2(Number(basic) / hours) : null;
  const oldHour = num(was.basicPerHour);
  const oldOt = num(was.OTPerHour);
  let ot = null;
  if (oldOt !== null && perHour !== null) {
    ot = oldHour && Math.abs(oldOt - oldHour) > 0.009 ? r2(perHour * (oldOt / oldHour)) : perHour;
  }
  return { basicPerHour: perHour, OTPerHour: ot };
}

/**
 * One salary change. `staff` is the person as now (with their private fields);
 * `change` = { from: "YYYY-MM", basicSalary, allowance, basicPerHour?, OTPerHour?, note, by: { uid, name }, at }.
 * Returns { entry, patch }: the history entry, and the fields to save on staffPrivate
 * (the record shows the latest agreed pay; payroll picks the one in force per month).
 */
export function salaryChange(staff = {}, change = {}, branchHours) {
  if (!/^\d{4}-\d{2}$/.test(change.from || "")) throw new Error("Choose the month it starts from");
  const was = payOf(staff);
  const basic = num(change.basicSalary);
  if (!(basic > 0)) throw new Error("Enter the new basic");
  const hours = hoursOf(staff, branchHours);
  const auto = ratesFor(basic, hours, was);
  const now = {
    basicSalary: r2(basic),
    allowance: num(change.allowance) === null ? was.allowance : r2(change.allowance),
    basicPerHour: num(change.basicPerHour) ?? auto.basicPerHour,
    OTPerHour: num(change.OTPerHour) ?? auto.OTPerHour,
  };
  const entry = {
    from: change.from,
    was,
    now,
    hours,
    note: String(change.note || "").trim(),
    by: { uid: change.by?.uid || "", name: change.by?.name || "" },
    at: change.at || new Date().toISOString(),
  };
  const history = [...(Array.isArray(staff.payHistory) ? staff.payHistory : []), entry].sort((a, b) => a.from.localeCompare(b.from) || a.at.localeCompare(b.at));
  // the record shows the pay of the latest change, whichever month it starts
  const latest = history[history.length - 1];
  return { entry, patch: { ...latest.now, payHistory: history } };
}

/**
 * The person with the pay in force for `period` ("YYYY-MM"): the last change from that month
 * or before, else what was paid before the first change. No history: as they are.
 */
export function payFor(staff = {}, period = "") {
  const history = Array.isArray(staff.payHistory) ? [...staff.payHistory].sort((a, b) => a.from.localeCompare(b.from) || String(a.at).localeCompare(String(b.at))) : [];
  if (!history.length || !period) return staff;
  const inForce = history.filter((h) => h.from <= period).pop();
  const pay = inForce ? inForce.now : history[0].was;
  const out = { ...staff };
  for (const k of PAY_KEYS) {
    if (pay[k] === null || pay[k] === undefined) delete out[k];
    else out[k] = pay[k];
  }
  return out;
}

/** Every change across people, newest first: [{ staffId, name, ...entry, rise }]. */
export function changesList(people = []) {
  return people
    .flatMap((p) => (p.payHistory || []).map((h) => ({ staffId: p.id, name: p.name || `${p.firstName || ""} ${p.lastName || ""}`.replace(/\s+/g, " ").trim(), ...h, rise: r2((h.now?.basicSalary || 0) - (h.was?.basicSalary || 0)) })))
    .sort((a, b) => b.from.localeCompare(a.from) || String(b.at).localeCompare(String(a.at)));
}
