// Single source of truth for turning attendance punches into worked / basic /
// OT hours. Used by the Attendance Log (timecard export + monthly summary) and,
// from Phase 4, the payroll importer — so every screen agrees on the numbers.
//
// Dates are derived from LOCAL time, not UTC. The old inline logic used
// `new Date(...).toISOString()`, which shifts the calendar day for anyone east
// or west of UTC (e.g. an early-morning punch in Malaysia/UTC+8 rolled to the
// previous day). All day bucketing here uses local date parts.

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

// Hours for one staff member on one day.
//   worked — actual clocked hours
//   basic  — up to the daily limit (full-time); all worked hours (part-time)
//   ot     — hours beyond the daily limit (full-time only)
//   bonus  — 1 if eligible for a paid break that day, else 0
//   total  — basic + ot (bonus already folded in) = worked + bonus
// The paid-break bonus fills remaining basic room first, spilling into OT.
export function computeDayHours({ dayPunches, staff }) {
  const { clockedMillis, pairs } = pairPunches(dayPunches);
  const worked = clockedMillis / 3600000;

  const dailyLimit = Number(staff.basicHoursPerDay) || 8;
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

  return { worked, basic, ot, bonus, total: basic + ot, pairs };
}

// Full breakdown for a staff member across a set of punches (any range).
// Returns per-day rows (sorted) and aggregate totals over worked days.
export function computeAttendance({ punches, staff, settings }) {
  const groups = {};
  (punches || []).forEach((p) => {
    const d = getAttendanceDate(p.timestamp, settings?.dayCutoffTime) || p.date;
    if (!d) return;
    (groups[d] = groups[d] || []).push(p);
  });

  const days = Object.keys(groups)
    .sort()
    .map((date) => ({ date, ...computeDayHours({ dayPunches: groups[date], staff }) }));

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
      }),
      { daysWorked: 0, worked: 0, basic: 0, ot: 0, bonus: 0, total: 0 }
    );

  return { days, totals };
}
