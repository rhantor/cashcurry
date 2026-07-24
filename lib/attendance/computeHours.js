// Single source of truth for turning attendance punches into worked / basic /
// OT hours. Used by the Attendance Log (timecard export + monthly summary) and,
// from Phase 4, the payroll importer — so every screen agrees on the numbers.
//
// Dates are derived from LOCAL time, not UTC. The old inline logic used
// `new Date(...).toISOString()`, which shifts the calendar day for anyone east
// or west of UTC (e.g. an early-morning punch in Malaysia/UTC+8 rolled to the
// previous day). All day bucketing here uses local date parts.
//
// When shift templates are enabled and the staff member has one, hours are
// measured against the SHIFT (see lib/attendance/shifts.js) instead of a flat
// daily limit. Without a shift the original behaviour is preserved exactly.

import { resolveStaffShift, shiftLabel, shiftRules, shiftWindow } from "./shifts";

// Local YYYY-MM-DD (never UTC).
export function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Today's date string in local time — the correct default for "today".
export const todayLocalStr = () => toLocalDateStr(new Date());

// Which attendance day a punch belongs to, honoring the branch's day-cutoff
// (shifts before the cutoff roll to the previous day — e.g. a 2am punch on a
// night shift counts for the day before).
export function getAttendanceDate(timestamp, cutoffTime = "00:00") {
  if (!timestamp?.seconds) return null;
  const date = new Date(timestamp.seconds * 1000);
  const [ch, cm] = String(cutoffTime || "00:00").split(":").map(Number);
  const cutoff = new Date(date);
  cutoff.setHours(ch || 0, cm || 0, 0, 0);
  const effective = date < cutoff ? new Date(date.getTime() - 86400000) : date;
  return toLocalDateStr(effective);
}

// 24h clock label for a Firestore timestamp.
export function formatClock(ts) {
  if (!ts?.seconds) return "—";
  return new Date(ts.seconds * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Format hours per the branch setting (decimal "8.50" or "hh:mm" "08:30").
export function formatHours(hours, settings) {
  const h = Number(hours) || 0;
  if (settings?.hoursFormat === "hhmm") {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  return h.toFixed(2);
}

// Pair consecutive in→out punches for one day and sum the clocked time.
function pairPunches(dayPunches) {
  const sorted = [...dayPunches].sort(
    (a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0)
  );
  let clockedMillis = 0;
  const pairs = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    if (sorted[i].type === "in" && sorted[i + 1].type === "out") {
      clockedMillis +=
        (sorted[i + 1].timestamp.seconds - sorted[i].timestamp.seconds) * 1000;
      pairs.push({ in: formatClock(sorted[i].timestamp), out: formatClock(sorted[i + 1].timestamp) });
      i += 1;
    }
  }
  return { clockedMillis, pairs };
}

// Split worked hours into basic/OT against a daily limit, then fold in the
// paid-break bonus (fills remaining basic room first, spilling into OT).
function splitHours({ worked, staff, dailyLimit }) {
  const isFullTime = staff.employmentType !== "part-time";

  let basic = worked;
  let ot = 0;
  if (isFullTime) {
    basic = Math.min(worked, dailyLimit);
    ot = Math.max(0, worked - dailyLimit);
  }

  let bonus = 0;
  if (worked > 0 && staff.hasPaidBreak) {
    const meets =
      !staff.requireFullShiftForBreak ||
      worked >= (Number(staff.fullShiftHours) || 7.5);
    if (meets) bonus = 1;
  }

  if (bonus) {
    if (isFullTime && basic < dailyLimit) {
      const toBasic = Math.min(1, dailyLimit - basic);
      basic += toBasic;
      ot += 1 - toBasic;
    } else {
      ot += 1;
    }
  }

  return { basic, ot, bonus, total: basic + ot };
}

// Zeroed shift fields, so every day row has the same shape whether or not
// shifts are in play.
const NO_SHIFT_INFO = {
  shift: null, // "HH:mm–HH:mm" when the day was measured against a shift
  lateMinutes: 0,
  earlyMinutes: 0,
  earlyLeaveMinutes: 0,
  otApproval: "none", // 'none' | 'pending' | 'approved' | 'rejected'
  notes: [],
};

// Hours for one staff member on one day.
//   worked — payable clocked hours (clamped to the shift when one applies)
//   basic  — up to the daily limit (full-time); all worked hours (part-time)
//   ot     — hours beyond the daily limit (full-time only)
//   bonus  — 1 if eligible for a paid break that day, else 0
//   total  — basic + ot (bonus already folded in)
// Pass `shift` (+ `rules`, `otApproval`) to measure against a shift instead of
// the flat basicHoursPerDay.
export function computeDayHours({ dayPunches, staff, date, shift, rules, otApproval }) {
  const { clockedMillis, pairs } = pairPunches(dayPunches);

  const shiftResult = shift
    ? computeShiftDay({ dayPunches, staff, date, shift, rules, otApproval, clockedMillis })
    : null;
  if (shiftResult) return { ...shiftResult, pairs };

  const worked = clockedMillis / 3600000;
  const dailyLimit = Number(staff.basicHoursPerDay) || 8;
  return {
    worked,
    ...splitHours({ worked, staff, dailyLimit }),
    pairs,
    ...NO_SHIFT_INFO,
  };
}

// Shift-aware day. Returns null when the shift can't be applied (bad times, or
// a missing in/out punch) so the caller falls back to plain clocked hours.
//
// Arrival:  < earlyOtMinutes early → paid from shift start (no OT, not late)
//           ≥ earlyOtMinutes early → needs approval; approved pays from the
//                                    actual punch-in, otherwise from shift start
//           after shift start      → paid from the ACTUAL punch-in, flagged late
// Departure: within the grace window early → paid to shift end (full shift)
//            earlier than that              → paid to the actual punch-out
//            past shift end                 → automatic OT, no approval needed
function computeShiftDay({ dayPunches, staff, date, shift, rules, otApproval, clockedMillis }) {
  const win = shiftWindow(date, shift);
  if (!win) return null;

  const sorted = [...dayPunches].sort(
    (a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0)
  );
  const firstIn = sorted.find((p) => p.type === "in" && p.timestamp?.seconds);
  const lastOut = [...sorted].reverse().find((p) => p.type === "out" && p.timestamp?.seconds);
  if (!firstIn || !lastOut) return null;

  const inMs = firstIn.timestamp.seconds * 1000;
  const outMs = lastOut.timestamp.seconds * 1000;
  if (outMs <= inMs) return null;

  // Unpaid gaps (out → next in) inside the day, so mid-shift breaks still come
  // off the clamped span. Most staff don't punch out for their break, so the
  // shift's declared unpaid break applies too — take whichever is longer rather
  // than the sum, or someone who *did* punch out would be deducted twice.
  const punchedBreakMillis = Math.max(0, outMs - inMs - clockedMillis);
  const breakMillis = Math.max(punchedBreakMillis, win.unpaidBreakMinutes * 60000);

  const { earlyOtMinutes, earlyLeaveGraceMinutes } = rules || shiftRules(null);
  const startMs = win.start.getTime();
  const endMs = win.end.getTime();

  const earlyMinutes = Math.max(0, (startMs - inMs) / 60000);
  const lateMinutes = Math.max(0, (inMs - startMs) / 60000);
  const earlyLeaveMinutes = Math.max(0, (endMs - outMs) / 60000);

  const notes = [];

  // Arrival. max() gives "from shift start" when early and "from actual" when
  // late; an approved early-OT request pulls it back to the actual punch-in.
  let effectiveStart = Math.max(inMs, startMs);
  let approval = "none";
  if (earlyMinutes >= earlyOtMinutes) {
    approval = otApproval || "pending";
    if (approval === "approved") {
      effectiveStart = inMs;
      notes.push(`Early OT approved (+${Math.round(earlyMinutes)} min)`);
    } else if (approval === "rejected") {
      notes.push(`Early OT rejected (${Math.round(earlyMinutes)} min not paid)`);
    } else {
      notes.push(`Early OT pending approval (${Math.round(earlyMinutes)} min)`);
    }
  }
  if (lateMinutes > 0) notes.push(`Late ${Math.round(lateMinutes)} min`);

  // Departure.
  let effectiveEnd = outMs;
  if (earlyLeaveMinutes > 0 && earlyLeaveMinutes <= earlyLeaveGraceMinutes) {
    effectiveEnd = endMs;
    notes.push(`Left ${Math.round(earlyLeaveMinutes)} min early (within grace)`);
  } else if (earlyLeaveMinutes > earlyLeaveGraceMinutes) {
    notes.push(`Left ${Math.round(earlyLeaveMinutes)} min early`);
  } else if (outMs > endMs) {
    notes.push(`Stayed ${Math.round((outMs - endMs) / 60000)} min past shift end`);
  }

  const worked = Math.max(0, (effectiveEnd - effectiveStart - breakMillis) / 3600000);

  return {
    worked,
    ...splitHours({ worked, staff, dailyLimit: win.hours }),
    shift: shiftLabel(shift),
    lateMinutes,
    earlyMinutes,
    earlyLeaveMinutes: earlyLeaveMinutes > 0 ? earlyLeaveMinutes : 0,
    otApproval: approval,
    notes,
  };
}

// Full breakdown for a staff member across a set of punches (any range).
// Returns per-day rows (sorted) and aggregate totals over worked days.
//
// `otApprovals` maps a business day to the status of that day's early-OT
// request — { 'YYYY-MM-DD': 'approved' | 'rejected' | 'pending' }. Omit it and
// early arrivals beyond the threshold are simply treated as pending (unpaid).
export function computeAttendance({ punches, staff, settings, otApprovals }) {
  const groups = {};
  (punches || []).forEach((p) => {
    const d = getAttendanceDate(p.timestamp, settings?.dayCutoffTime) || p.date;
    if (!d) return;
    (groups[d] = groups[d] || []).push(p);
  });

  const shift = resolveStaffShift(staff, settings);
  const rules = shiftRules(settings);

  const days = Object.keys(groups)
    .sort()
    .map((date) => ({
      date,
      ...computeDayHours({
        dayPunches: groups[date],
        staff,
        date,
        shift,
        rules,
        otApproval: otApprovals?.[date],
      }),
    }));

  const totals = days
    .filter((d) => d.worked > 0)
    .reduce(
      (a, d) => ({
        daysWorked: a.daysWorked + 1,
        worked: a.worked + d.worked,
        basic: a.basic + d.basic,
        ot: a.ot + d.ot,
        bonus: a.bonus + d.bonus,
        total: a.total + d.total,
        lateDays: a.lateDays + (d.lateMinutes > 0 ? 1 : 0),
        lateMinutes: a.lateMinutes + d.lateMinutes,
        earlyLeaveMinutes: a.earlyLeaveMinutes + d.earlyLeaveMinutes,
        pendingOtDays: a.pendingOtDays + (d.otApproval === "pending" ? 1 : 0),
      }),
      {
        daysWorked: 0,
        worked: 0,
        basic: 0,
        ot: 0,
        bonus: 0,
        total: 0,
        lateDays: 0,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        pendingOtDays: 0,
      }
    );

  return { days, totals, shift };
}
