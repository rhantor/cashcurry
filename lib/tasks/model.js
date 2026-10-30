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
//   items [text] — a checklist (30 Oct): every line answered OK or Problem to finish;
//   the answers go with the tick (done.items / the day's check .items: [{ text, ok, note }])
//   issueId — made from an issue given to someone (30 Oct): id "issue_{issueId}", a
//   one-off that follows the issue (done when it is resolved, open again if reopened)
//   rota { [weekday 0–6]: { uid, name, role } } — a repeating task's usual person each
//   weekday (31 Oct); a day with no one is the assignee's. Set by whoever leads it;
//   rotaSince ("yyyy-MM-dd") — it counts from that day (earlier days stay the assignee's)
//   covers { ["yyyy-MM-dd"]: { uid, name, role } } — one day given to someone else
//   doers [uid] — everyone it can fall to (assignee, rota, covers): lists and rules read it
//   /comments/{id} { byUid, byName, text, photos, createdAt } — questions and answers
// companies/{c}/branches/{b}/taskChecks/{taskId}_{date}
//   one tick of a repeating task for one day: taskId, assigneeUid, teamLeadUid, date, doneOn, by, photos, note, items, createdAt,
//   doerUid — who was on duty that day (31 Oct; older ticks: the assignee)
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
// - Who does a repeating task on a day (31 Oct): that day's cover, else the
//   rota's person for the weekday, else the assignee. On their weekly day off
//   (staff record daysOff) or approved leave it falls to whoever leads it —
//   the supervisor, who gives the day to someone or does it — and never counts
//   as missed for the one away.

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

/**
 * Messages on a task this person hasn't seen: someone else wrote after they
 * last opened it. reads: { [taskId]: when they last opened it (ms) }.
 */
export function unreadOn(task, reads, uid) {
  const last = task?.lastCommentAt?.toMillis ? task.lastCommentAt.toMillis() : task?.lastCommentAt?.seconds ? task.lastCommentAt.seconds * 1000 : 0;
  if (!last || !task.commentCount || task.lastCommentByUid === uid) return false;
  const seen = reads?.[task.id];
  const seenMs = seen?.toMillis ? seen.toMillis() : seen?.seconds ? seen.seconds * 1000 : Number(seen) || 0;
  return last > seenMs;
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

// ── duty: who does a repeating task on a day (31 Oct) ────────────────────────

export const weekdayOf = (date) => parse(date).getUTCDay();

/** Does the task have a rota (someone named for at least one weekday)? */
export const hasRota = (task) => Object.values(task?.rota || {}).some((p) => p?.uid);

/** Everyone a task can fall to — the assignee, the rota's people, the covers' — for the `doers` field. */
export function doersOf(task) {
  const uids = [task?.assigneeUid, ...Object.values(task?.rota || {}).map((p) => p?.uid), ...Object.values(task?.covers || {}).map((p) => p?.uid)];
  return [...new Set(uids.filter(Boolean))];
}

/** Covers kept on a task: from a week back on (older ones are history in the ticks). */
export const freshCovers = (covers, today) => Object.fromEntries(Object.entries(covers || {}).filter(([d, p]) => p?.uid && d >= addDays(today, -CATCH_UP_DAYS)));

/**
 * When is someone away? From the branch's staff records (daysOff: weekdays,
 * Sunday = 0, from daysOffSince when set; the record's uid or linked office login) and approved leave
 * ({ staffId, from, to, halfDay, status }). A half day doesn't count.
 * → (uid, date) => "Day off" | "On leave" | null
 */
export function awayFrom({ staff = [], leaves = [] } = {}) {
  const byUid = new Map();
  const uidOfStaff = new Map();
  for (const s of staff) {
    for (const uid of [s.uid, s.officeUid].filter(Boolean)) {
      byUid.set(uid, offDays(s));
      uidOfStaff.set(s.id, uid);
    }
  }
  for (const l of leaves) {
    const span = leaveSpan(l);
    const uid = span && (uidOfStaff.get(l.staffId) || l.uid || null);
    if (!uid) continue;
    if (!byUid.has(uid)) byUid.set(uid, offDays());
    byUid.get(uid).leave.push(span);
  }
  return (uid, date) => reasonOn(uid && byUid.get(uid), date);
}

/**
 * The same by staff record — for everyone on the branch's staff list, with a
 * login or not (who is in today, 30 Oct). → (staffId, date) => reason | null
 */
export function awayByStaff({ staff = [], leaves = [] } = {}) {
  const byId = new Map(staff.map((s) => [s.id, offDays(s)]));
  for (const l of leaves) {
    const span = leaveSpan(l);
    if (span && byId.has(l.staffId)) byId.get(l.staffId).leave.push(span);
  }
  return (staffId, date) => reasonOn(staffId && byId.get(staffId), date);
}

const offDays = (s = {}) => ({ daysOff: (s.daysOff || []).map(Number), since: s.daysOffSince || "", leave: [] });
// an approved, whole-day leave's [from, to]; else null
const leaveSpan = (l) => {
  const from = l?.from || l?.date;
  return String(l?.status || "").toLowerCase() === "approved" && !l.halfDay && from ? [from, l.to || from] : null;
};
const reasonOn = (p, date) => {
  if (!p) return null;
  if (p.leave.some(([a, b]) => date >= a && date <= b)) return "On leave";
  if (p.daysOff.includes(weekdayOf(date)) && date >= p.since) return "Day off";
  return null;
};

const nobodyAway = () => null;

/**
 * Who does a repeating task on `date`:
 * { uid, name, role, via: "cover" | "rota" | "assignee" | "lead", away? }
 * via "lead": the usual person is away (away: { uid, name, reason }) and the
 * day sits with whoever leads it — its supervisor, else whoever gave it —
 * until they give it to someone (a cover). `name` is unknown then (null).
 */
export function dutyOn(task, date, away = nobodyAway) {
  const cover = task?.covers?.[date];
  if (cover?.uid) return { ...cover, via: "cover" };
  const rota = date >= (task?.rotaSince || "") ? task?.rota?.[weekdayOf(date)] : null;
  const usual = rota?.uid ? { ...rota, via: "rota" } : { ...(task?.assignee || {}), uid: task?.assigneeUid, via: "assignee" };
  const reason = away(usual.uid, date);
  if (!reason) return usual;
  const lead = [task.teamLeadUid, task.creatorUid].find((u) => u && u !== usual.uid);
  if (!lead) return usual; // no one else to hold it
  return { uid: lead, name: null, role: null, via: "lead", away: { uid: usual.uid, name: usual.name || "", reason } };
}

/**
 * Each repeating task due on `date` and who does it — not done first, then
 * those waiting for someone (the usual person is away), then by title.
 * → [{ task, duty, done }] ("Who does what today" on Tasks and Ops)
 */
export function dutyRows(tasks, checks, date, away = nobodyAway) {
  return (tasks || [])
    .filter((t) => t.repeat && occursOn(t, date))
    .map((t) => ({ task: t, duty: dutyOn(t, date, away), done: !!checks?.[checkId(t.id, date)] }))
    .sort((a, b) => Number(a.done) - Number(b.done) || Number(b.duty.via === "lead") - Number(a.duty.via === "lead") || String(a.task.title).localeCompare(String(b.task.title)));
}

/** How many of those wait for someone: the usual person is away and no one has it yet. */
export const dutyGaps = (rows) => rows.filter((r) => r.duty.via === "lead" && !r.done).length;

/**
 * May this person say who does a repeating task day by day (its rota, a
 * day's cover)? Management; a supervisor given it or leading it.
 */
export const canSetDuty = (task, user) =>
  !!task?.repeat && task.active !== false && !!user?.uid &&
  (canManageTasks(user.role) || (canTeamTasks(user.role) && (task.assigneeUid === user.uid || task.teamLeadUid === user.uid)));

/** "Mon–Fri Ali · Sat Kumar": the rota in a line, weekdays with the same person run together. */
export function rotaText(task) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const runs = [];
  for (const d of order) {
    const p = task?.rota?.[d];
    const name = p?.uid ? (p.name || "Someone").split(" ")[0] : null;
    const last = runs[runs.length - 1];
    if (name && last && last.name === name && order.indexOf(last.to) === order.indexOf(d) - 1) last.to = d;
    else if (name) runs.push({ name, from: d, to: d });
  }
  return runs.map((r) => `${WEEKDAYS[r.from]}${r.to !== r.from ? `–${WEEKDAYS[r.to]}` : ""} ${r.name}`).join(" · ");
}

/** Is this person on duty for the task that day? One-offs: whoever has it. */
const onDuty = (task, date, uid, away) => (task.repeat ? dutyOn(task, date, away).uid === uid : task.assigneeUid === uid);

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
 * checks: { [checkId]: check }. Returns [{ task, kind: "repeat" | "once", done, check?, overdue, late, duty? }].
 * With `uid` (and `away`), only what is theirs that day — the rota, covers and
 * days off decide (see dutyOn); without, every task given.
 */
export function dayList(tasks, checks, date, today = date, { uid = null, away = nobodyAway } = {}) {
  const out = [];
  for (const t of tasks) {
    if (uid && !onDuty(t, date, uid, away)) continue;
    if (t.repeat) {
      if (!occursOn(t, date)) continue;
      const c = checks[checkId(t.id, date)];
      out.push({ task: t, kind: "repeat", done: !!c, check: c, overdue: false, late: !!c && c.doneOn > date, duty: dutyOn(t, date, away) });
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
export function agenda(tasks, checks, today, { uid = null, away = nobodyAway } = {}) {
  const out = { late: [], today: [], tomorrow: [], week: [], later: [], anytime: [] };
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, AHEAD_DAYS);
  const item = (task, kind, date, extra = {}) => ({ task, kind, date, done: false, canTick: kind === "once" || (date && date <= today), ...extra });
  // a repeating task's day, if it is this person's (the day's duty goes with it)
  const mine = (t, d) => (uid ? onDuty(t, d, uid, away) : true);
  const day = (t, d, extra = {}) => item(t, "repeat", d, { duty: dutyOn(t, d, away), ...extra });
  for (const t of tasks) {
    if (t.repeat) {
      for (let i = CATCH_UP_DAYS; i >= 1; i--) {
        const d = addDays(today, -i);
        // a day already ticked is done, whoever did it
        if (occursOn(t, d) && !checks[checkId(t.id, d)] && mine(t, d)) out.late.push(day(t, d));
      }
      if (occursOn(t, today) && mine(t, today)) {
        const c = checks[checkId(t.id, today)];
        out.today.push(day(t, today, { done: !!c, check: c }));
      }
      if (occursOn(t, tomorrow) && mine(t, tomorrow)) out.tomorrow.push(day(t, tomorrow));
      if (t.repeat.every !== "day") {
        for (let d = addDays(today, 2); d <= weekEnd; d = addDays(d, 1)) {
          if (occursOn(t, d) && mine(t, d)) {
            out.week.push(day(t, d));
            break; // its next day is enough
          }
        }
      }
    } else if (uid && t.assigneeUid !== uid) {
      continue; // a one-off is only ever its assignee's
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

/** Today at a glance for one person: { total, done, late } (late = still-open late items). opts as agenda(). */
export function todayCount(tasks, checks, today, opts) {
  const a = agenda(tasks, checks, today, opts);
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
export function performance(tasks, checks, uid, { from, to, today, away = nobodyAway }) {
  const end = to < today ? to : today;
  const items = [];
  const add = (t, date, result, doneOn = null) => items.push({ taskId: t.id, title: t.title, date, result, doneOn });
  for (const t of tasks) {
    if (t.repeat) {
      for (let d = from; d <= end; d = addDays(d, 1)) {
        if (!occursOn(t, d)) continue;
        const c = checks[checkId(t.id, d)];
        // a ticked day counts for whoever was on duty then; an open one for whoever is now
        // (a day off moves it to the supervisor — never missed for the one away)
        const who = c ? c.doerUid || c.assigneeUid || t.assigneeUid : dutyOn(t, d, away).uid;
        if (who !== uid) continue;
        if (!c) add(t, d, d < today ? "missed" : "open");
        else add(t, d, c.doneOn > d ? "late" : "onTime", c.doneOn);
      }
    } else {
      if (t.assigneeUid !== uid) continue;
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

// ── checklists (30 Oct) ──────────────────────────────────────────────────────

export const MAX_ITEMS = 25;

/** A checklist as typed: trimmed lines, no blanks, at most MAX_ITEMS. */
export const cleanItems = (items) => (items || []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, MAX_ITEMS);

/** A task's checklist lines (none: []). */
export const itemsOf = (task) => cleanItems(task?.items);

/**
 * Are the answers enough to finish? Every line answered OK or Problem, and a
 * problem says what is wrong. answers: [{ ok: true | false | null, note }] by line.
 * → { ready, left (unanswered), problems, needNote (problems with no note) }
 */
export function checklistState(items, answers = []) {
  const list = cleanItems(items);
  let left = 0;
  let problems = 0;
  let needNote = 0;
  list.forEach((_, i) => {
    const a = answers[i];
    if (a?.ok === true) return;
    if (a?.ok === false) {
      problems++;
      if (!String(a.note || "").trim()) needNote++;
      return;
    }
    left++;
  });
  return { ready: left === 0 && needNote === 0, left, problems, needNote };
}

/** The answers as saved with the tick: [{ text, ok, note }]. */
export const answersFor = (items, answers = []) =>
  cleanItems(items).map((text, i) => ({ text, ok: answers[i]?.ok === true, note: answers[i]?.ok === false ? String(answers[i].note || "").trim() : "" }));

/** The lines marked Problem in a saved tick. */
export const problemsIn = (saved) => (saved || []).filter((x) => x && x.ok === false);

/** Ready-made checklists a manager can start from (and change). */
export const TEMPLATES = [
  {
    id: "opening",
    title: "Opening check",
    repeat: { every: "day" },
    needsPhoto: false,
    items: [
      "Tables and chairs clean and set",
      "Cutlery, plates and glasses clean and ready",
      "Hand basin clean, soap and tissue there",
      "Toilets clean, soap and tissue there",
      "Floor swept and mopped",
      "Fridges and chillers at the right temperature",
      "Today's reservations checked — team told",
      "Menus clean, specials board updated",
    ],
  },
  {
    id: "closing",
    title: "Closing check",
    repeat: { every: "day" },
    needsPhoto: true,
    items: [
      "Kitchen surfaces and stoves cleaned",
      "Gas turned off",
      "Food covered and put in the chiller",
      "Rubbish taken out",
      "Floor mopped",
      "Lights, fans and air-conditioning off",
      "Doors and windows locked",
    ],
  },
  {
    id: "toilet",
    title: "Toilet check",
    repeat: { every: "day" },
    needsPhoto: false,
    items: ["Floor dry and clean", "Toilet and basin clean", "Soap, tissue and paper towels filled", "Bin emptied"],
  },
  {
    id: "deepclean",
    title: "Weekly deep clean",
    repeat: { every: "week", days: [1] },
    needsPhoto: true,
    items: ["Fryer oil changed and fryer cleaned", "Exhaust hood and filters cleaned", "Chiller shelves wiped", "Store room tidied, expired stock out"],
  },
];

// ── tasks from issues (30 Oct) ───────────────────────────────────────────────

/** The task made from an issue has this id, so it is found (and moved) with the issue. */
export const issueTaskId = (issueId) => `issue_${issueId}`;

/** Where an issue opens: the office board, or the staff app's. */
export const issueHref = (task, role) => `${role === "staff" ? "/my-issues" : "/issues"}?i=${task.branchId}/${task.issueId}`;

/**
 * The task for an issue given to someone: a one-off by the issue's due day,
 * urgent if the issue is. `me` gave it; teamLeadUid = the person's supervisor.
 */
export function taskFromIssue(issue, person, { teamLeadUid = null } = {}) {
  return {
    title: `Fix: ${String(issue.title || "an issue").trim()}`,
    details: String(issue.details || "").trim(),
    priority: issue.priority === "urgent" ? "urgent" : "normal",
    needsPhoto: false,
    assignee: { uid: person.uid, name: person.name || "", role: person.role || "" },
    assigneeUid: person.uid,
    repeat: null,
    dueDate: issue.dueDate || null,
    startDate: null,
    teamLeadUid: teamLeadUid || null,
    issueId: issue.id,
  };
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
