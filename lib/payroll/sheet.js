// Who is on a month's salary sheet, and how a month paid before is shown
// (from main, 27-28 Oct 2026). Everyone on the staff list — or, for a month
// paid before, the staff paid then, with their salary terms then — unless the
// manager takes them off; others can be added. Kept on the run as
// sheetRemoved / sheetAdded.

/** The form inputs a saved slip (or a paid salary entry, which carries the slip) was made from. */
export function inputsFromSlip(slip) {
  return {
    workedHours: String(slip.workedHours ?? ""),
    workedDays: String(slip.workedDays ?? ""),
    otHours: String(slip.otHours ?? ""),
    phHours: String(slip.phHours ?? ""),
    phDays: String(slip.phDays ?? ""),
    allowanceOverride: String(slip.allowanceOverride ?? ""),
    bonus: String(slip.bonus ?? ""),
    bonusNote: slip.bonusNote || "",
    otherEarnings: String(slip.otherEarnings ?? ""),
    otherEarningsNote: slip.otherEarningsNote || "",
    penalty: String(slip.penalty ?? ""),
    penaltyNote: slip.penaltyNote || "",
    otherDeductions: String(slip.otherDeductions ?? ""),
    otherDeductionsNote: slip.otherDeductionsNote || "",
    loanOverride: slip.loanOverride != null ? String(slip.loanOverride) : "",
    loanNote: slip.loanNote || "",
    extraNote: slip.extraNote || "",
  };
}

/** What a run keeps of its sheet; nothing when no sheet was passed. */
export function sheetFields(sheet) {
  if (!sheet) return {};
  const ids = (a) => [...new Set((a || []).filter(Boolean).map(String))];
  return { sheetAdded: ids(sheet.added), sheetRemoved: ids(sheet.removed) };
}

/**
 * A staff member as they were paid in `entry` (their salary entry that month):
 * that month's basic, mode, hours/days, allowance, OT rate and EPF/SOCSO rates
 * over today's record, so later salary changes aren't applied backwards.
 * `now` is today's staff record, or undefined if they are no longer listed.
 */
export function staffAsPaid(entry, now, statutoryConfig = []) {
  const today = now || {};
  const num = (v, fallback) => (v === undefined || v === null || v === "" ? fallback : v);
  const otRate =
    parseFloat(entry.otHours) > 0 && parseFloat(entry.otPay) > 0
      ? parseFloat(entry.otPay) / parseFloat(entry.otHours)
      : null;
  let deductionSettings = today.deductionSettings;
  if (Array.isArray(entry.statutory)) {
    const paid = new Map(entry.statutory.map((d) => [d.key, d]));
    deductionSettings = { ...(today.deductionSettings || {}) };
    for (const d of statutoryConfig) {
      const p = paid.get(d.key);
      deductionSettings[d.key] = p
        ? { ...deductionSettings[d.key], enabled: true, employeeRateOverride: p.employeeRate, employerRateOverride: p.employerRate }
        : { ...deductionSettings[d.key], enabled: false };
    }
  }
  return {
    ...today,
    id: entry.staffId,
    ...(today.firstName || today.lastName || today.name ? {} : { name: entry.staffName || "Former staff" }),
    designation: entry.designation || today.designation || "",
    department: entry.department || today.department || "",
    basicSalary: num(entry.basicSalary, today.basicSalary),
    allowance: num(entry.allowance, today.allowance),
    salaryMode: entry.salaryMode || today.salaryMode,
    standardHours: num(entry.standardHours, today.standardHours),
    workingDays: num(entry.workingDays, today.workingDays),
    OTPerHour: otRate ?? today.OTPerHour,
    deductionSettings,
    notOnStaffList: !now,
  };
}

/** Who is on the sheet: the base without those taken off, then anyone added from the staff list. */
export function rosterOf(baseList = [], staffList = [], sheet = {}) {
  const removed = new Set(sheet.removed || []);
  const baseIds = new Set(baseList.map((s) => s.id));
  const byId = new Map(staffList.map((s) => [s.id, s]));
  const extra = [...new Set(sheet.added || [])]
    .filter((id) => !baseIds.has(id) && !removed.has(id) && byId.has(id))
    .map((id) => ({ ...byId.get(id), addedToSheet: true }));
  return [...baseList.filter((s) => !removed.has(s.id)), ...extra];
}

/** Everyone who could be on the sheet: the base, then anyone else on the staff list. */
export function sheetChoicesOf(baseList = [], staffList = []) {
  const ids = new Set(baseList.map((s) => s.id));
  return [
    ...baseList.map((staff) => ({ staff, inBase: true })),
    ...staffList.filter((s) => !ids.has(s.id)).map((staff) => ({ staff, inBase: false })),
  ];
}

/** The sheet after putting someone on it or taking them off. */
export function changeSheet(sheet, id, on, inBase) {
  const added = (sheet.added || []).filter((x) => x !== id);
  const removed = (sheet.removed || []).filter((x) => x !== id);
  if (on && !inBase) added.push(id);
  if (!on && inBase) removed.push(id);
  return { added, removed };
}
