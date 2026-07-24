// Shift times.
//
// Each staff member has their own shift start/end (and optional unpaid break)
// on their staff record. Lateness and OT are measured against that shift
// instead of a flat basicHoursPerDay.
//
// Everything here is INERT unless `settings.shiftsEnabled` is on AND the staff
// member has both times filled in — `resolveStaffShift` returns null otherwise
// and the attendance engine keeps its original flat-hours behaviour.
// Shifts that cross midnight are supported; the punch is already bucketed to
// the right business day by `getAttendanceDate` + the day-cutoff setting.

// ≥ this many minutes early → the extra time is an OT request needing approval.
export const DEFAULT_EARLY_OT_MIN = 30;
// Leaving within this many minutes of shift end still pays the full shift.
export const DEFAULT_EARLY_LEAVE_GRACE_MIN = 5;

const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== "" && v !== null ? n : fallback;
};

// The two tunables, with defaults, from settings.attendance.
export function shiftRules(settings) {
  return {
    earlyOtMinutes: num(settings?.earlyOtMinutes, DEFAULT_EARLY_OT_MIN),
    earlyLeaveGraceMinutes: num(
      settings?.earlyLeaveGraceMinutes,
      DEFAULT_EARLY_LEAVE_GRACE_MIN
    ),
  };
}

// Branch-level master switch. Off = no shift rules anywhere, whatever the
// staff records say.
export function shiftsEnabled(settings) {
  return !!settings?.shiftsEnabled;
}

// "HH:mm" → minutes past midnight (null when unparseable).
// Note "00:00" is a VALID time that parses to 0 — callers must compare to null,
// not test truthiness.
export function parseTimeToMinutes(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// The shift stored on a staff record, or null when they don't have one set.
export function staffShift(staff) {
  if (!staff) return null;
  const start = parseTimeToMinutes(staff.shiftStart);
  const end = parseTimeToMinutes(staff.shiftEnd);
  if (start === null || end === null) return null;
  if (start === end) return null; // zero-length: treat as "not configured"
  return {
    start: staff.shiftStart,
    end: staff.shiftEnd,
    breakMinutes: num(staff.shiftBreakMinutes, 0),
  };
}

// The shift to measure a staff member against, or null when shifts don't apply
// to them. Fixed-salary/no-attendance staff (owners) are always exempt.
export function resolveStaffShift(staff, settings) {
  if (!shiftsEnabled(settings)) return null;
  if (!staff || staff.fixedSalaryNoAttendance) return null;
  return staffShift(staff);
}

// A shift whose end is at or before its start runs past midnight.
export function isOvernight(shift) {
  const s = parseTimeToMinutes(shift?.start);
  const e = parseTimeToMinutes(shift?.end);
  if (s === null || e === null) return false;
  return e <= s;
}

// Anchor a shift to one business day (local time, never UTC).
// Returns null when the shift's times are malformed, so callers can fall back.
//   start/end  — Date objects (end rolls to the next day when overnight)
//   spanHours  — clock length of the shift
//   hours      — paid length: span minus the unpaid break
export function shiftWindow(dateStr, shift) {
  const startMin = parseTimeToMinutes(shift?.start);
  const endMin = parseTimeToMinutes(shift?.end);
  if (startMin === null || endMin === null) return null;

  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return null;

  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  start.setMinutes(startMin);
  const end = new Date(y, m - 1, d, 0, 0, 0, 0);
  end.setMinutes(endMin);
  if (end <= start) end.setDate(end.getDate() + 1);

  const unpaidBreakMinutes = num(shift?.breakMinutes, 0);
  const spanHours = (end - start) / 3600000;

  return {
    start,
    end,
    spanHours,
    unpaidBreakMinutes,
    hours: Math.max(0, spanHours - unpaidBreakMinutes / 60),
  };
}

export function shiftLabel(shift) {
  if (!shift) return "";
  return `${shift.start}–${shift.end}${isOvernight(shift) ? " ⏭" : ""}`;
}

// Doc id for an early-OT request — one per staff per business day, so a repeated
// punch can never create a duplicate pending request.
export function otRequestId(staffId, date) {
  return `${staffId}_${date}`;
}
