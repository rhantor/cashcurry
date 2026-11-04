// lib/warranties/model.js
// What a warranty is and when to warn about it (owner, 4 Nov 2026). Entered
// with a new purchase in Cost Entry, or on Purchases → Warranties for something
// bought before. Warned about 15 and 7 days before it ends; someone then says
// it was renewed (a new date and paper) or won't be (no more reminders). Not
// money: no report reads it, and it stays when its cost changes. Pure.
import { daysBetween } from "../purchases/orders";

/** Days before the end that people are told, biggest first. */
export const REMIND_DAYS = [15, 7];

/** The form's quick lengths, in months. */
export const LENGTHS = [
  { months: 6, label: "6 months" },
  { months: 12, label: "1 year" },
  { months: 24, label: "2 years" },
  { months: 36, label: "3 years" },
];

/** Equipment gets the "Has warranty" switch in Cost Entry. */
export const offersWarranty = (category) => category?.id === "assets";

export const emptyWarranty = (startDate = "") => ({ itemName: "", serial: "", startDate, endsOn: "", vendorId: "", soldBy: "", soldByEmail: "", soldByPhone: "", note: "" });

/** "2026-11-30" + 3 months → "2027-02-28": the same day, or the month's last. */
export function addMonths(day, months) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ""))) return "";
  const [y, m, d] = day.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/** What's wrong with the form, by field; {} when it can be saved. */
export function warrantyProblems(form) {
  const problems = {};
  if (!String(form?.itemName || "").trim()) problems.itemName = "Say what was bought";
  if (!form?.endsOn) problems.endsOn = "Pick the day it ends";
  else if (form.startDate && form.endsOn <= form.startDate) problems.endsOn = "It must end after the day it was bought";
  const email = String(form?.soldByEmail || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.soldByEmail = "That doesn't look like an email";
  return problems;
}

/** The fields a warranty stores from the form, trimmed; `vendor` is the listed one picked, if any. */
export function warrantyFields(form, vendor) {
  return {
    itemName: String(form.itemName || "").trim(),
    serial: String(form.serial || "").trim(),
    startDate: form.startDate || "",
    endsOn: form.endsOn,
    vendorId: vendor?.id || "",
    soldBy: vendor ? vendor.name || vendor.vendorName || "" : String(form.soldBy || "").trim(),
    soldByEmail: String(form.soldByEmail || "").trim(),
    soldByPhone: String(form.soldByPhone || "").trim(),
    note: String(form.note || "").trim(),
  };
}

/**
 * A warranty brought back with a pay-out's bill waits on the bill, and becomes
 * a warranty when the bill is approved: its fields, from `settle.warranty`.
 */
export function warrantyFromBill(settle) {
  const w = settle?.warranty;
  if (!w?.itemName || !w?.endsOn) return null;
  return { ...w, startDate: w.startDate || settle.date || "", paperURL: w.paperURL || null };
}

/** Whole days until it ends: 0 on its last day, below 0 once it has ended. */
export const daysLeft = (w, today) => daysBetween(today, w.endsOn);

/** "stopped" (won't be renewed), "expired", "soon" (within the first warning) or "active". */
export function stateOf(w, today) {
  if (w.status === "notRenewing") return "stopped";
  const left = daysLeft(w, today);
  if (left < 0) return "expired";
  return left <= REMIND_DAYS[0] ? "soon" : "active";
}

/** "Ends today" / "1 day left" / "Ended 3 days ago" */
export function leftText(w, today) {
  const left = daysLeft(w, today);
  if (left === 0) return "Ends today";
  if (left > 0) return `${left} day${left === 1 ? "" : "s"} left`;
  return `Ended ${-left} day${left === -1 ? "" : "s"} ago`;
}

/**
 * The warning due today (15 or 7), or null. Each goes once per end date, and
 * if the bigger one was missed (entered late, a day the server was down) only
 * the one that applies now goes. `reminded` = { endsOn, step } is written by
 * the server; a renewal changes endsOn, which starts the warnings afresh.
 */
export function reminderDue(w, today) {
  if (stateOf(w, today) !== "soon") return null;
  const left = daysLeft(w, today);
  const step = [...REMIND_DAYS].reverse().find((d) => left <= d);
  const sent = w.reminded?.endsOn === w.endsOn ? w.reminded.step : null;
  return sent == null || step < sent ? step : null;
}

/** One message for a branch's warranties due a warning today. */
export function warrantyMessage(list = [], { today, branchName } = {}) {
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => daysLeft(a, today) - daysLeft(b, today));
  const one = (w) => `${w.itemName} · ${leftText(w, today).toLowerCase()} (${w.endsOn})`;
  return {
    title: `${sorted.length === 1 ? "Warranty ending" : `${sorted.length} warranties ending`} · ${branchName || ""}`.trim(),
    body: `${(sorted.length <= 3 ? sorted : sorted.slice(0, 2)).map(one).join("\n")}${sorted.length > 3 ? `\n…and ${sorted.length - 2} more` : ""}\nRenew?`,
  };
}

/** Soonest first; ones already ended next, then those not being renewed. */
export function sortWarranties(list = [], today) {
  const rank = { soon: 0, expired: 1, active: 2, stopped: 3 };
  return [...list].sort((a, b) => rank[stateOf(a, today)] - rank[stateOf(b, today)] || (a.endsOn < b.endsOn ? -1 : a.endsOn > b.endsOn ? 1 : 0));
}

/** How many of each, for the tiles. */
export function warrantyCounts(list = [], today) {
  const counts = { soon: 0, expired: 0, active: 0, stopped: 0 };
  for (const w of list) counts[stateOf(w, today)] += 1;
  return counts;
}

/** The changes when it was renewed: the old period goes into its history. */
export function renewalPatch(w, { endsOn, paperURL, by, now = new Date() }) {
  return {
    endsOn,
    status: "active",
    paperURL: paperURL || w.paperURL || null,
    history: [...(w.history || []), { endsOn: w.endsOn, paperURL: w.paperURL || null, renewedAt: now.toISOString(), renewedBy: by || "" }],
  };
}
