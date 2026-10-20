// lib/tasks/model.js
// Tasks and performance (roadmap 4.11, decided 20 Oct 2026). Pure — no
// Firebase; firestore.rules enforces the same.
//
// companies/{c}/branches/{b}/tasks/{id}
//   title, details, priority ("normal" | "urgent"), needsPhoto,
//   assignee { uid, name, role }, assigneeUid,
//   createdBy { uid, name, role }, creatorUid,
//   repeat: null — once, by `dueDate` ("yyyy-MM-dd" or null)
//         | { every: "day" } | { every: "week", days: [0–6, Sunday = 0] } | { every: "month", day: 1–31 },
//   startDate ("yyyy-MM-dd": a repeating task counts from here), active (false = stopped),
//   status ("open" | "done") and done { by, at, date, photos, note } — one-off tasks only
// companies/{c}/branches/{b}/taskChecks/{taskId}_{date}
//   one tick of a repeating task for one day: taskId, assigneeUid, date, by, photos, note, createdAt
// companies/{c}/branches/{b}/ratings/{yyyy-MM}_{uid}
//   a manager's stars (1–5) and a word for someone's month: uid, name, month, stars, note, by
// companies/{c}/users/{uid}/notes/{id}
//   the person's own notes, seen by no one else: title, body, items [{ text, done }], pinned, color
//
// - Owner, super admin, gm, branch admin, manager and in-charge give tasks and rate.
// - Whoever has a task marks it done (with a photo if it asks for one).
// - A day's task is on time if ticked that business day, late if ticked after,
//   missed if never; a one-off is late if done after its due date.

import { can } from "../authz/permissions";

export const canManageTasks = (role) => can(role, "tasks.manage");

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const NOTE_COLORS = ["plain", "yellow", "green", "blue", "pink"];

const parse = (d) => {
  const [y, m, day] = String(d).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
};
const iso = (dt) => dt.toISOString().slice(0, 10);
export const addDays = (d, n) => {
  const dt = parse(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return iso(dt);
};
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Does a repeating task fall on this day? (A month's 31st falls on its last day in short months.) */
export function occursOn(task, date) {
  const r = task?.repeat;
  if (!r || task.active === false) return false;
  if (task.startDate && date < task.startDate) return false;
  if (task.stoppedOn && date >= task.stoppedOn) return false;
  const dt = parse(date);
  if (r.every === "day") return true;
  if (r.every === "week") return (r.days || []).includes(dt.getUTCDay());
  if (r.every === "month") {
    const last = daysInMonth(dt.getUTCFullYear(), dt.getUTCMonth() + 1);
    return dt.getUTCDate() === Math.min(Number(r.day) || 1, last);
  }
  return false;
}

/** "Every day", "Mon, Thu", "Every month on the 1st", "Once, by 22 Oct". */
export function repeatText(task, dayLabel = (d) => d) {
  const r = task?.repeat;
  if (!r) return task?.dueDate ? `By ${dayLabel(task.dueDate)}` : "Once";
  if (r.every === "day") return "Every day";
  if (r.every === "week") {
    const days = [...(r.days || [])].sort();
    if (days.length === 7) return "Every day";
    if (days.join() === "1,2,3,4,5") return "Weekdays";
    return `Every ${days.map((d) => WEEKDAYS[d]).join(", ")}`;
  }
  const n = Number(r.day) || 1;
  const th = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `Every month on the ${n}${th}`;
}

export const checkId = (taskId, date) => `${taskId}_${date}`;

/**
 * One person's list for a day: repeating tasks that fall on it (ticked or
 * not), and one-off tasks still open (overdue ones first) or done that day.
 * checks: { [checkId]: check }. Returns [{ task, kind: "repeat" | "once", done, check?, overdue, late }].
 */
export function dayList(tasks, checks, date, today = date) {
  const out = [];
  for (const t of tasks) {
    if (t.repeat) {
      if (!occursOn(t, date)) continue;
      const c = checks[checkId(t.id, date)];
      out.push({ task: t, kind: "repeat", done: !!c, check: c, overdue: false, late: !!c && c.doneOn > date });
    } else if (t.status !== "done") {
      // open one-offs show on today's list (and on their due day when looking ahead)
      if (date !== today && t.dueDate !== date) continue;
      out.push({ task: t, kind: "once", done: false, overdue: !!t.dueDate && t.dueDate < today, late: false });
    } else if (t.done?.date === date) {
      out.push({ task: t, kind: "once", done: true, overdue: false, late: !!t.dueDate && t.done.date > t.dueDate });
    }
  }
  const rank = (x) => (x.done ? 3 : x.overdue ? 0 : x.task.priority === "urgent" ? 1 : 2);
  return out.sort((a, b) => rank(a) - rank(b) || String(a.task.title).localeCompare(String(b.task.title)));
}

/**
 * How someone did over [from, to] (inclusive "yyyy-MM-dd"), counting only days
 * up to `today`: every repeating day and every one-off due (or done) in the
 * period. { given, onTime, late, missed, open, score } — score is the share done
 * on time, a late one counting half; null when nothing was due yet.
 */
export function performance(tasks, checks, uid, { from, to, today }) {
  const end = to < today ? to : today;
  let onTime = 0;
  let late = 0;
  let missed = 0;
  let open = 0;
  for (const t of tasks) {
    if (t.assigneeUid !== uid) continue;
    if (t.repeat) {
      for (let d = from; d <= end; d = addDays(d, 1)) {
        if (!occursOn(t, d)) continue;
        const c = checks[checkId(t.id, d)];
        if (!c) d < today ? missed++ : open++;
        else c.doneOn > d ? late++ : onTime++;
      }
    } else {
      const doneOn = t.status === "done" ? t.done?.date : null;
      const due = t.dueDate || null;
      const inPeriod = (doneOn && doneOn >= from && doneOn <= to) || (!doneOn && due && due >= from && due <= to);
      if (!inPeriod) continue;
      if (doneOn) due && doneOn > due ? late++ : onTime++;
      else due < today ? missed++ : open++;
    }
  }
  const counted = onTime + late + missed;
  return { given: counted + open, onTime, late, missed, open, score: counted ? Math.round(((onTime + late / 2) / counted) * 100) : null };
}

/** The month a day is in, and its first and last day. */
export function monthOf(date) {
  const m = String(date).slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  return { month: m, from: `${m}-01`, to: `${m}-${String(daysInMonth(y, mo)).padStart(2, "0")}` };
}

export const ratingId = (month, uid) => `${month}_${uid}`;

/** What's wrong with a task before saving it, by field; {} when fine. */
export function checkTask(t) {
  const e = {};
  if (!String(t.title || "").trim()) e.title = "What needs doing?";
  if (!t.assignee?.uid) e.assignee = "Who does it?";
  if (t.repeat?.every === "week" && !(t.repeat.days || []).length) e.repeat = "Pick at least one day";
  if (t.repeat?.every === "month" && !(Number(t.repeat.day) >= 1 && Number(t.repeat.day) <= 31)) e.repeat = "A day of the month, 1–31";
  return e;
}
