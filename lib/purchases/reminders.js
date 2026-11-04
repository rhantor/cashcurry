// lib/purchases/reminders.js
// Order reminders (owner, 4 Nov 2026): an order guide can say which days it is
// ordered, say vegetables every Monday. The people who buy are told the day
// before (or as set), and once more that morning, until an order is placed.
// Anyone can put it off or skip it, for the whole branch. Pure — no Firebase.
//
// On the guide:
//   reminder: { enabled, days: [1], before: 1, at: "18:00", since: "2026-11-04" }
//   reminderState: { snoozeDay, snoozedUntil (ms), skippedDay, by }
import { addDays, daysBetween } from "./orders";

/** Week days as the form shows them, Monday first; `d` is 0 for Sunday. */
export const WEEKDAYS = [
  { d: 1, short: "Mon", name: "Monday" },
  { d: 2, short: "Tue", name: "Tuesday" },
  { d: 3, short: "Wed", name: "Wednesday" },
  { d: 4, short: "Thu", name: "Thursday" },
  { d: 5, short: "Fri", name: "Friday" },
  { d: 6, short: "Sat", name: "Saturday" },
  { d: 0, short: "Sun", name: "Sunday" },
];
export const BEFORE_CHOICES = [
  { days: 0, label: "Same day" },
  { days: 1, label: "1 day before" },
  { days: 2, label: "2 days before" },
  { days: 3, label: "3 days before" },
];
export const SNOOZE_MORNING_HOUR = 9;
export const SNOOZES = [
  { key: "1h", label: "In 1 hour", hours: 1 },
  { key: "3h", label: "In 3 hours", hours: 3 },
  { key: "morning", label: "Tomorrow morning" },
];
export const newReminder = () => ({ enabled: true, days: [], before: 1, at: "18:00" });

const weekdayOf = (day) => new Date(`${day}T00:00:00Z`).getUTCDay();
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const nameOfDay = (d) => WEEKDAYS.find((w) => w.d === d)?.name || "";

/** "2026-11-09" → "Monday 9 Nov" */
export function dayLabel(day) {
  const [, m, d] = day.split("-").map(Number);
  return `${nameOfDay(weekdayOf(day))} ${d} ${MONTHS[m - 1]}`;
}

/** "18:00" → "6 PM" */
export function hourLabel(at) {
  const h = Number(String(at || "").split(":")[0]) || 0;
  return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
}

/** "Every Monday · told the day before at 6 PM" */
export function reminderText(r) {
  const named = WEEKDAYS.filter((w) => r?.days?.includes(w.d)).map((w) => (r.days.length > 2 ? w.short : w.name));
  const before = Number(r?.before) || 0;
  const when = before === 0 ? "the same day" : before === 1 ? "the day before" : `${before} days before`;
  return `Every ${named.join(", ")} · told ${when} at ${hourLabel(r?.at)}`;
}

/** The calendar day on a branch's clock, "2026-11-08". */
export function localDay(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** The first order day on or after `from`. */
function nextOrderDay(days, from) {
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i);
    if (days.includes(weekdayOf(d))) return d;
  }
  return null;
}

/** The order day before `day`. */
const prevOrderDay = (days, day) => {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(day, -i);
    if (days.includes(weekdayOf(d))) return d;
  }
  return null;
};

/**
 * The day orders start counting for `orderDay`. Between two order days, the
 * days nearer the next one count for it: for a weekly Monday order, Friday on.
 * An order on Tuesday is a late one for this Monday, and doesn't silence the
 * next. Never later than the reminder itself.
 */
function countsFrom(r, orderDay) {
  const gap = daysBetween(prevOrderDay(r.days, orderDay), orderDay);
  return addDays(orderDay, -Math.max(Math.floor(gap / 2), Number(r.before) || 0));
}

/** What's left of the orders once a reminder can read them: their guide, supplier, status and day. */
export function ordersForReminders(orders = [], timeZone) {
  return orders.map((o) => {
    const at = o.createdAt;
    const date = at instanceof Date ? at : typeof at?.toDate === "function" ? at.toDate() : typeof at?.seconds === "number" ? new Date(at.seconds * 1000) : null;
    return { id: o.id, poNo: o.poNo, orderGuideId: o.orderGuideId || "", vendorId: o.vendorId || "", status: o.status, day: date ? localDay(date, timeZone) : "" };
  });
}

/**
 * The order placed for `orderDay`, if any: one from this guide, or one to its
 * supplier that came from no guide (raised by hand, ordered again). Not one
 * cancelled or rejected: then the reminder comes back.
 */
function orderFor(guide, orders, orderDay) {
  const r = guide.reminder;
  const from = countsFrom(r, orderDay);
  const until = addDays(countsFrom(r, nextOrderDay(r.days, addDays(orderDay, 1))), -1);
  return orders.find(
    (o) =>
      o.day >= from &&
      o.day <= until &&
      !["Cancelled", "Rejected"].includes(o.status) &&
      (o.orderGuideId === guide.id || (!o.orderGuideId && o.vendorId === guide.vendorId))
  ) || null;
}

/**
 * Where a guide's reminder stands, or null with none set.
 *   state: "placed" | "skipped" | "waiting" (not time yet) | "snoozed" | "due"
 *   orderDay: the order day it is about; order: the one placed for it
 *   missedDay: the last order day, if nothing was placed or skipped for it —
 *              said until orders start counting for the next one
 */
export function reminderStatus(guide, orders = [], { today, hour, nowMs }) {
  const r = guide?.reminder;
  if (!r?.enabled || !r.days?.length) return null;
  const s = guide.reminderState || {};
  const orderDay = nextOrderDay(r.days, today);
  const before = Number(r.before) || 0;
  const remindOn = addDays(orderDay, -before);
  const order = orderFor(guide, orders, orderDay);

  const prev = prevOrderDay(r.days, orderDay);
  const missedDay = today < countsFrom(r, orderDay) && prev >= (r.since || "") && s.skippedDay !== prev && !orderFor(guide, orders, prev) ? prev : null;

  const base = { orderDay, remindOn, order, missedDay };
  if (order) return { ...base, state: "placed" };
  if (s.skippedDay === orderDay) return { ...base, state: "skipped" };
  if (today < remindOn || (today === remindOn && hour < (Number(String(r.at).split(":")[0]) || 0))) return { ...base, state: "waiting" };
  if (s.snoozeDay === orderDay && Number(s.snoozedUntil) > nowMs) return { ...base, state: "snoozed", snoozedUntil: Number(s.snoozedUntil) };
  return { ...base, state: "due" };
}

/**
 * The server's hourly question: which reminders apply now? Each is a name the
 * server marks once sent; if any is new, one message goes. `morningHour` is the
 * branch's summary time, for the last reminder on the order day itself.
 */
export function reminderSlots(guide, orders, { today, hour, nowMs, morningHour }) {
  const st = reminderStatus(guide, orders, { today, hour, nowMs });
  if (st?.state !== "due") return [];
  const s = guide.reminderState || {};
  const slots = ["first"];
  if (today === st.orderDay && Number(guide.reminder.before) > 0 && hour >= morningHour) slots.push("morning");
  if (s.snoozeDay === st.orderDay && s.snoozedUntil) slots.push(`snooze-${s.snoozedUntil}`);
  return slots;
}

/** What's told. */
export function orderReminderMessage(guide, st, { branchName } = {}) {
  return {
    title: `Order reminder · ${branchName || ""}`.trim(),
    body: `${guide.name}${guide.vendorName ? ` from ${guide.vendorName}` : ""}: order for ${dayLabel(st.orderDay)}.`,
  };
}

/** Put off until later, for everyone at the branch. */
export function snoozePatch(orderDay, key, { nowMs, hour, by }) {
  const thisHour = Math.floor(nowMs / 3600e3) * 3600e3;
  const choice = SNOOZES.find((x) => x.key === key);
  const hours = choice?.hours || (24 - hour + SNOOZE_MORNING_HOUR) % 24 || 24;
  return { "reminderState.snoozeDay": orderDay, "reminderState.snoozedUntil": (choice?.hours ? nowMs : thisHour) + hours * 3600e3, "reminderState.by": by || "" };
}

/** No order this time, and no more reminders about it. */
export const skipPatch = (orderDay, by) => ({ "reminderState.skippedDay": orderDay, "reminderState.by": by || "" });

/** Changed their mind about a skip. */
export const unskipPatch = () => ({ "reminderState.skippedDay": null });

/** What saving the form writes. A new schedule starts clean. */
export function savedReminder(form, today) {
  return {
    reminder: { enabled: !!form.enabled, days: [...new Set(form.days)].sort(), before: Number(form.before) || 0, at: form.at || "18:00", since: today },
    reminderState: {},
  };
}
