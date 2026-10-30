// Ops (30 Oct): today at a branch, on the phone — who is in. Pure, so the
// branch card and the GM's all-branches view count the same way, and tests
// can check it.
import { resolveStaffShift, shiftWindow } from "@/lib/attendance/shifts";
import { personName } from "@/lib/people";
import { addDays } from "@/lib/tasks/model";

const clock = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const atOf = (p) => (p?.timestamp?.seconds ? new Date(p.timestamp.seconds * 1000) : null);

// the order people are listed in: those to chase first, the away last
const ORDER = { late: 0, in: 1, due: 2, notIn: 3, out: 4, off: 5 };

/**
 * Who is in today, from the branch's staff list and today's kiosk punches
 * ({ staffId, type: "in" | "out", timestamp }).
 *  - in: their last punch is a clock-in (since: the first one; lateMin when
 *    after their shift's start — only when the branch runs shifts);
 *  - out: clocked out for the day (at: the last clock-out);
 *  - off: no punch and a day off or approved leave (`away(staffId, date)`);
 *  - late: no punch and their shift has started; due: it starts later;
 *  - notIn: no punch and no shift to go by.
 * Staff paid a flat amount with no attendance (owners) aren't listed.
 * → { rows: [{ id, name, staff, state, since?, at?, lateMin?, shiftStart?, reason? }], counts }
 */
export function onShift({ staff = [], punches = [], away = () => null, date, now = new Date(), settings = {} }) {
  const byStaff = new Map();
  for (const p of punches) {
    if (!p?.staffId || !atOf(p)) continue;
    if (!byStaff.has(p.staffId)) byStaff.set(p.staffId, []);
    byStaff.get(p.staffId).push(p);
  }
  const rows = staff
    .filter((s) => s && !s.fixedSalaryNoAttendance)
    .map((s) => {
      const base = { id: s.id, name: personName(s) || "Someone", staff: s };
      const mine = (byStaff.get(s.id) || []).sort((a, b) => atOf(a) - atOf(b));
      const shift = resolveStaffShift(s, settings);
      const win = shift ? shiftWindow(date, shift) : null;
      if (mine.length) {
        const last = mine[mine.length - 1];
        if (last.type === "out") return { ...base, state: "out", at: clock(atOf(last)) };
        const first = atOf(mine.find((p) => p.type === "in") || mine[0]);
        const lateMin = win && first > win.start ? Math.round((first - win.start) / 60000) : 0;
        return { ...base, state: "in", since: clock(first), lateMin };
      }
      const reason = away(s.id, date);
      if (reason) return { ...base, state: "off", reason };
      if (win) return { ...base, state: now >= win.start ? "late" : "due", shiftStart: shift.start };
      return { ...base, state: "notIn" };
    })
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.name.localeCompare(b.name));
  const counts = { in: 0, out: 0, off: 0, late: 0, due: 0, notIn: 0 };
  for (const r of rows) counts[r.state] += 1;
  return { rows, counts, expected: rows.length - counts.off };
}

/** The line under someone on the list: "In since 08:52 · 12 min late", "Day off", "Not in · due 09:00"… */
export function shiftText(row) {
  switch (row.state) {
    case "in":
      return `In since ${row.since}${row.lateMin > 0 ? ` · ${row.lateMin} min late` : ""}`;
    case "out":
      return `Clocked out ${row.at}`;
    case "off":
      return row.reason;
    case "late":
      return `Not in · due ${row.shiftStart}`;
    case "due":
      return `Starts ${row.shiftStart}`;
    default:
      return "Not in yet";
  }
}

/** "4 in · 1 off · 1 late" — the summary over the list (parts with nobody left out). */
export function shiftSummary(counts) {
  const parts = [
    [counts.in, "in"],
    [counts.late, "late"],
    [counts.notIn + counts.due, "not in yet"],
    [counts.out, "gone home"],
    [counts.off, "off"],
  ];
  return parts.filter(([n]) => n > 0).map(([n, w]) => `${n} ${w}`).join(" · ");
}

/**
 * Others away on any day of a leave asked for (the approver sees who else is
 * off then): [{ name, days: ["2026-11-02", …], reason }]. Up to 31 days looked at.
 */
export function alsoAway({ from, to, staffId }, staff = [], away = () => null) {
  if (!from) return [];
  const days = [];
  for (let d = from; d <= (to || from) && days.length < 31; d = addDays(d, 1)) days.push(d);
  const out = [];
  for (const s of staff) {
    if (!s || s.id === staffId) continue;
    const hits = days.map((d) => [d, away(s.id, d)]).filter(([, r]) => r);
    if (hits.length) out.push({ name: personName(s) || "Someone", days: hits.map(([d]) => d), reason: hits[0][1] });
  }
  return out.sort((a, b) => b.days.length - a.days.length || a.name.localeCompare(b.name));
}

// Only money advances count as owed — leave used to live in the same
// collection. "personal" is the staff form's salary advance; "salary" and
// "emergency" come from the office. (The staff app counts with these too.)
export const MONEY_ADVANCE_TYPES = ["personal", "salary", "emergency"];

/**
 * What someone already owes the business, from the records an approver can
 * read: money advances approved and not yet taken back from pay
 * (remainingAmount, else the amount), and staff loans handed over and not
 * paid back yet (remainingAmount; a loan paid back is "closed"). Older records
 * with no pay-out trail count as handed over.
 */
export function owedBy(staffId, { advances = [], loans = [] } = {}) {
  if (!staffId) return { advance: 0, loan: 0, total: 0 };
  const advance = advances
    .filter((a) => a.staffId === staffId && a.status === "approved" && MONEY_ADVANCE_TYPES.includes(a.advanceType) && a.paidOut !== null)
    .reduce((s, a) => s + (Number(a.remainingAmount ?? a.amount) || 0), 0);
  const loan = loans
    .filter((l) => l.staffId === staffId && l.status === "approved" && l.paidOut !== null)
    .reduce((s, l) => s + (Number(l.remainingAmount) || 0), 0);
  return { advance, loan, total: advance + loan };
}
