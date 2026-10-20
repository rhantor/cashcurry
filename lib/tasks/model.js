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
//   status ("open" | "done") and done { by, at, date, photos, note } — one-off tasks only,
//   teamLeadUid — the supervisor whose team does it (from the staff record, or who
//   handed it over), via [{ uid, name }] — who passed it on, in order
//   /comments/{id} { byUid, byName, text, photos, createdAt } — questions and answers
// companies/{c}/branches/{b}/taskChecks/{taskId}_{date}
//   one tick of a repeating task for one day: taskId, assigneeUid, teamLeadUid, date, doneOn, by, photos, note, createdAt
// companies/{c}/branches/{b}/ratings/{yyyy-MM}_{uid}
//   a manager's stars (1–5) and a word for someone's month: uid, name, month, stars, note, by
// companies/{c}/users/{uid}/notes/{id}
//   the person's own notes, seen by no one else: title, body, items [{ text, done }], pinned, color
//
// - Owner, super admin, gm, branch admin, manager and in-charge give tasks and rate.
// - A supervisor gives tasks to their team — staff whose record names them as
//   supervisor (or names no one) — sees the team's work, and hands on a task
//   given to them to someone in the team. They don't rate.
// - Questions go in the task's own thread, to whoever gave it and leads the team.
// - Whoever has a task marks it done (with a photo if it asks for one).
// - A day's task is on time if ticked that business day, late if ticked after,
//   missed if never; a one-off is late if done after its due date.

import { can } from "../authz/permissions";

export const canManageTasks = (role) => can(role, "tasks.manage");
/** A supervisor: gives tasks to their own team only. */
export const canTeamTasks = (role) => can(role, "tasks.team");
/** May give tasks at all (to anyone, or to their team). */
export const canGiveTasks = (role) => canManageTasks(role) || canTeamTasks(role);

/**
 * A supervisor's team: the logins of staff whose record names them, or names
 * no supervisor. staff: the branch's staff records ({ uid, supervisorUid }).
 */
export const teamOf = (staff, supervisorUid) =>
  staff.filter((s) => s.uid && (!s.supervisorUid || s.supervisorUid === supervisorUid)).map((s) => s.uid);

/** Who leads the work of `assigneeUid`: their staff record's supervisor, or none. */
export const leadOf = (staff, assigneeUid) => staff.find((s) => s.uid && s.uid === assigneeUid)?.supervisorUid || null;

/** "KL Manager → Rahim → Ali": who gave it, who passed it on, who has it. */
export function chainText(task) {
  const names = [task?.createdBy?.name, ...(task?.via || []).map((v) => v.name), task?.assignee?.name].filter(Boolean);
  return names.filter((n, i) => n !== names[i - 1]).join(" → ");
}

/** May this person hand the task on to their team? A supervisor, with a task that is theirs and not finished. */
export const canHandOver = (task, user) =>
  !!user?.uid && canTeamTasks(user.role) && task?.assigneeUid === user.uid && task.status !== "done" && task.active !== false;

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

export const CATCH_UP_DAYS = 7; // a missed day can still be ticked (late) this long after
export const AHEAD_DAYS = 7; // "This week": what is coming up to this many days ahead

/**
 * One person's tasks as a to-do list, from `today`:
 *   late     — days missed in the last week (still tickable, counted late) and overdue one-offs
 *   today    — today's checklist and one-offs due today (done ones too)
 *   tomorrow — tomorrow's checklist and one-offs due tomorrow
 *   week     — one-offs due within a week, and the next day of a weekly or monthly task
 *   later    — one-offs due after that;  anytime — one-offs with no due day
 * Each item: { task, kind: "repeat" | "once", date, done, check?, canTick }.
 * Daily tasks show only today and tomorrow, so the list doesn't fill up with them.
 */
export function agenda(tasks, checks, today) {
  const out = { late: [], today: [], tomorrow: [], week: [], later: [], anytime: [] };
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, AHEAD_DAYS);
  const item = (task, kind, date, extra = {}) => ({ task, kind, date, done: false, canTick: kind === "once" || (date && date <= today), ...extra });
  for (const t of tasks) {
    if (t.repeat) {
      for (let i = CATCH_UP_DAYS; i >= 1; i--) {
        const d = addDays(today, -i);
        if (occursOn(t, d) && !checks[checkId(t.id, d)]) out.late.push(item(t, "repeat", d));
      }
      if (occursOn(t, today)) {
        const c = checks[checkId(t.id, today)];
        out.today.push(item(t, "repeat", today, { done: !!c, check: c }));
      }
      if (occursOn(t, tomorrow)) out.tomorrow.push(item(t, "repeat", tomorrow));
      if (t.repeat.every !== "day") {
        for (let d = addDays(today, 2); d <= weekEnd; d = addDays(d, 1)) {
          if (occursOn(t, d)) {
            out.week.push(item(t, "repeat", d));
            break; // its next day is enough
          }
        }
      }
    } else if (t.status === "done") {
      if (t.done?.date === today) out.today.push(item(t, "once", t.dueDate || today, { done: true }));
    } else if (!t.dueDate) out.anytime.push(item(t, "once", null));
    else if (t.dueDate < today) out.late.push(item(t, "once", t.dueDate));
    else if (t.dueDate === today) out.today.push(item(t, "once", today));
    else if (t.dueDate === tomorrow) out.tomorrow.push(item(t, "once", tomorrow));
    else if (t.dueDate <= weekEnd) out.week.push(item(t, "once", t.dueDate));
    else out.later.push(item(t, "once", t.dueDate));
  }
  const byDate = (a, b) =>
    Number(a.done) - Number(b.done) ||
    String(a.date || "").localeCompare(String(b.date || "")) ||
    Number(b.task.priority === "urgent") - Number(a.task.priority === "urgent") ||
    String(a.task.title).localeCompare(String(b.task.title));
  for (const k of Object.keys(out)) out[k].sort(byDate);
  return out;
}

/** Today at a glance for one person: { total, done, late } (late = still-open late items). */
export function todayCount(tasks, checks, today) {
  const a = agenda(tasks, checks, today);
  return { total: a.today.length, done: a.today.filter((x) => x.done).length, late: a.late.length };
}

/**
 * How someone did over [from, to] (inclusive "yyyy-MM-dd"), counting only days
 * up to `today`: every repeating day and every one-off due (or done) in the
 * period. { given, onTime, late, missed, open, score, items } — score is the
 * share done on time, a late one counting half; null when nothing was due yet.
 * items: each one counted, [{ taskId, title, date, result: "onTime" | "late" |
 * "missed" | "open", doneOn }], oldest first — so "6 missed" can say which.
 */
export function performance(tasks, checks, uid, { from, to, today }) {
  const end = to < today ? to : today;
  const items = [];
  const add = (t, date, result, doneOn = null) => items.push({ taskId: t.id, title: t.title, date, result, doneOn });
  for (const t of tasks) {
    if (t.assigneeUid !== uid) continue;
    if (t.repeat) {
      for (let d = from; d <= end; d = addDays(d, 1)) {
        if (!occursOn(t, d)) continue;
        const c = checks[checkId(t.id, d)];
        if (!c) add(t, d, d < today ? "missed" : "open");
        else add(t, d, c.doneOn > d ? "late" : "onTime", c.doneOn);
      }
    } else {
      const doneOn = t.status === "done" ? t.done?.date : null;
      const due = t.dueDate || null;
      const inPeriod = (doneOn && doneOn >= from && doneOn <= to) || (!doneOn && due && due >= from && due <= to);
      if (!inPeriod) continue;
      if (doneOn) add(t, due || doneOn, due && doneOn > due ? "late" : "onTime", doneOn);
      else add(t, due, due < today ? "missed" : "open");
    }
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  const n = (r) => items.filter((x) => x.result === r).length;
  const onTime = n("onTime");
  const late = n("late");
  const missed = n("missed");
  const open = n("open");
  const counted = onTime + late + missed;
  return { given: items.length, onTime, late, missed, open, score: counted ? Math.round(((onTime + late / 2) / counted) * 100) : null, items };
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

// ── reminders ────────────────────────────────────────────────────────────────

/** Morning reminder time when a branch hasn't chosen one (branch clock). */
export const DEFAULT_MORNING_AT = "09:00";

/** Evening reminder when a branch hasn't chosen: two hours before its day ends ("00:00" → "22:00"). */
export function defaultEveningAt(dayEnds = "00:00") {
  const h = Number(String(dayEnds || "00:00").split(":")[0]) || 0;
  return `${String((h + 22) % 24).padStart(2, "0")}:00`;
}

const titles = (items, n = 2) => {
  const names = items.map((x) => x.task.title);
  return names.length > n ? `${names.slice(0, n).join(", ")} and ${names.length - n} more` : names.join(" and ");
};

/**
 * The reminder for one person, from their to-do list (agenda()):
 *   "morning" — what is on today (and how many are late)
 *   "evening" — what is still left today; nothing when all is done
 * { title, body } or null when there is nothing to say.
 */
export function reminderMessage(when, list, { branchName = "" } = {}) {
  const at = branchName ? ` · ${branchName}` : "";
  const left = list.today.filter((x) => !x.done);
  const late = list.late.length;
  const lateText = late ? ` · ${late} late` : "";
  if (when === "morning") {
    if (!list.today.length && !late) return null;
    if (!list.today.length) return { title: `Tasks waiting${at}`, body: `${late} late task${late === 1 ? "" : "s"}: ${titles(list.late)}` };
    return { title: `Today's tasks${at}`, body: `${list.today.length} task${list.today.length === 1 ? "" : "s"}: ${titles(list.today)}${lateText}` };
  }
  if (!left.length) return null;
  return { title: `Still to do today${at}`, body: `${left.length} task${left.length === 1 ? "" : "s"} left: ${titles(left)}${lateText}` };
}
