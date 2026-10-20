// lib/notify/model.js
// Who is told what (roadmap 4.3, decided 18 Oct 2026). Pure — no Firebase:
// the Cloud Functions (functions/notify.cjs, bundled from lib/notify/server.js)
// and the settings screens both read it.
//
// - A request sent → told at once (those chosen for "New requests").
// - A request approved or rejected → whoever asked, the staff member it is
//   for, and those chosen for "Decisions" (the owner sees who approved).
// - Approved money waiting to be paid out → those chosen for "To pay out".
// - Sales and costs → one summary a day, never one push per entry.
//
// Owner, super admin, gm and branch admin choose who gets each kind, per
// branch (settings/notifications). Until they do, the defaults below apply.
// Anyone may still mute a kind for themselves.

import { can, canOpen, isCompanyRole, normalizeRole } from "../authz/permissions";

// Each kind: `defaultFor` — who gets it until a branch chooses; `canGet` —
// who may get it at all: those who can open what it links to and act on it
// (the roles matrix). A branch can't add anyone else, and someone chosen
// before who no longer fits (e.g. their role changed) stops getting it.
export const NOTIFY_TYPES = {
  "requests.new": {
    label: "New requests",
    hint: "An advance, staff loan or leave is asked for",
    canGet: (role) => can(role, "advances.approve"),
    defaultFor: (role) => can(role, "advances.approve"),
  },
  "requests.decided": {
    label: "Decisions",
    hint: "Someone approves or rejects a request — and who it was",
    canGet: (role) => can(role, "advances.approve"),
    // everyone who runs the branch, not only the company roles (20 Oct)
    defaultFor: (role) => can(role, "advances.approve"),
  },
  "requests.payout": {
    label: "To pay out",
    hint: "Approved money waiting to be handed over",
    canGet: (role) => can(role, "advances.payOut") && canOpen(role, "/entry-data/advance-entry"),
    defaultFor: (role) => ["branchAdmin", "accountant", "supervisor", "cashier"].includes(normalizeRole(role)),
  },
  "purchases.approval": {
    label: "Purchase orders",
    hint: "A purchase order waits for approval",
    canGet: (role) => can(role, "purchases.approve"),
    defaultFor: (role) => ["owner", "superAdmin", "gm", "branchAdmin", "manager"].includes(normalizeRole(role)) && can(role, "purchases.approve"),
  },
  "costs.approval": {
    label: "Bills & vouchers",
    hint: "A pay-out bill, or a cost with no invoice, waits for approval",
    // everyone who approves them, the GM and super admin included; the owner
    // (many branches, busy) only if a branch adds them in its settings
    canGet: (role) => can(role, "costs.approve"),
    defaultFor: (role) => can(role, "costs.approve") && normalizeRole(role) !== "owner",
  },
  "issues.new": {
    label: "New issues",
    hint: "Someone reports a problem at the branch",
    canGet: (role) => canOpen(role, "/issues"),
    defaultFor: (role) => can(role, "issues.manage"),
  },
  "daily.sales": {
    label: "Daily sales",
    hint: "One summary of the day's sales",
    canGet: (role) => canOpen(role, "/reports"),
    defaultFor: (role) => isCompanyRole(role),
  },
  "daily.costs": {
    label: "Daily costs",
    hint: "One summary of the day's costs",
    canGet: (role) => canOpen(role, "/reports"),
    defaultFor: (role) => isCompanyRole(role),
  },
};
export const TYPE_KEYS = Object.keys(NOTIFY_TYPES);

/** Default time of the daily summary (branch clock) — for the business day before. */
export const DEFAULT_DAILY_AT = "09:00";

/** Who may choose who gets notifications. */
export const canManageNotifications = (role) => can(role, "notifications.manage");

/** The people of a branch: company-wide users plus that branch's office users (staff are told only about their own requests). */
export function branchPeople(users = [], branchId) {
  return users.filter((u) => u?.uid && normalizeRole(u.role) !== "staff" && (isCompanyRole(u.role) || u.branchId === branchId));
}

/**
 * Who gets `type` at a branch: the uids chosen in the branch's settings, or
 * the default roles when nothing has been chosen for that type. Only people
 * who belong to the branch count (someone moved away stops getting them).
 */
export function recipientsFor(type, { config, people }) {
  const chosen = config?.recipients?.[type];
  const list = Array.isArray(chosen) ? people.filter((p) => chosen.includes(p.uid)) : people.filter((p) => NOTIFY_TYPES[type]?.defaultFor(p.role));
  return [...new Set(list.filter((p) => mayGet(type, p.role)).map((p) => p.uid))];
}

/** May someone in this role get this kind at all? (Unknown kinds: no.) */
export const mayGet = (type, role) => !!NOTIFY_TYPES[type] && (NOTIFY_TYPES[type].canGet ? NOTIFY_TYPES[type].canGet(role) : true);

/** Drop those who muted this type for themselves. prefs: { [uid]: { muted: [types] } } */
export const withoutMuted = (uids, type, prefs = {}) => uids.filter((u) => !(prefs[u]?.muted || []).includes(type));

// ── requests ─────────────────────────────────────────────────────────────────

const KIND = { advance: "advance", staffLoan: "staff loan", leave: "leave" };
const statusOf = (d) => String(d?.status || "").toLowerCase();

/**
 * What changed on a request, as the events to tell people about:
 *   "new"      — asked (created waiting)
 *   "approved" / "rejected" — decided
 *   "payout"   — approved money, not yet paid (also when created approved but unpaid)
 *   "paid"     — paid out
 * A request entered as already approved and paid (a manager giving it on the
 * spot) is news to nobody but the decision-watchers.
 */
export function requestEvents(before, after) {
  if (!after) return [];
  const was = before ? statusOf(before) : null;
  const now = statusOf(after);
  const out = [];
  if (!before && now === "pending") out.push("new");
  if (now !== was && (now === "approved" || now === "rejected") && (was === "pending" || was === null)) out.push(now);
  const unpaidNow = now === "approved" && after.paidOut === null;
  const unpaidBefore = before && statusOf(before) === "approved" && before.paidOut === null;
  if (unpaidNow && !unpaidBefore) out.push("payout");
  if (before && !before.paidOut && after.paidOut) out.push("paid");
  return out;
}

const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "Someone";

/**
 * The message for one event on a request.
 * r: the request record (with type), money: amount → "RM 150.00", branchName.
 */
export function requestMessage(event, r, { money = (v) => String(v), branchName = "" } = {}) {
  const kind = KIND[r.type] || "request";
  const what = r.type === "leave" ? `${r.days || 1} day${r.days === 1 ? "" : "s"} of leave` : `${money(r.amount)} ${kind}`;
  const at = branchName ? ` · ${branchName}` : "";
  const by = r.approvedBy?.name || r.rejectedBy?.name || "";
  switch (event) {
    case "new":
      return { title: `New ${kind} request${at}`, body: `${r.staffName || "A staff member"} asks for ${what}${r.reason ? ` — “${r.reason}”` : ""}` };
    case "approved":
      return { title: `${kind[0].toUpperCase()}${kind.slice(1)} approved${at}`, body: `${by || "An approver"} approved ${what} for ${r.staffName || "a staff member"}` };
    case "rejected":
      return { title: `${kind[0].toUpperCase()}${kind.slice(1)} rejected${at}`, body: `${by || "An approver"} rejected ${what} for ${r.staffName || "a staff member"}${r.rejectReason ? ` — “${r.rejectReason}”` : ""}` };
    case "payout":
      return { title: `${kind[0].toUpperCase()}${kind.slice(1)} approved — to pay out${at}`, body: `${by ? `${by} approved ` : ""}${what} for ${r.staffName || "a staff member"} — hand it over and mark it paid` };
    case "paid":
      return { title: `Paid out${at}`, body: `${firstName(r.staffName)} has been given ${what}` };
    default:
      return null;
  }
}

/** The message to whoever asked / the staff member it is for. */
export function requesterMessage(event, r, { money = (v) => String(v) } = {}) {
  const kind = KIND[r.type] || "request";
  const what = r.type === "leave" ? "leave" : `${money(r.amount)} ${kind}`;
  if (event === "approved") return { title: "Request approved", body: `Your ${what} was approved${r.approvedBy?.name ? ` by ${r.approvedBy.name}` : ""}${r.type === "leave" ? "" : " — it will be handed over soon"}` };
  if (event === "rejected") return { title: "Request rejected", body: `Your ${what} was rejected${r.rejectReason ? ` — “${r.rejectReason}”` : ""}` };
  if (event === "paid") return { title: "Money handed over", body: `Your ${what} has been paid out` };
  return null;
}

/** Which notification type an event goes out as. */
export const EVENT_TYPE = { new: "requests.new", approved: "requests.decided", rejected: "requests.decided", payout: "requests.payout", paid: "requests.decided" };

/**
 * Where tapping it opens: the requester's own list, the panel while it waits,
 * or — once decided — where the request now lives (the panel is empty by then).
 */
export function requestLink(event, { forRequester = false, role, type } = {}) {
  if (forRequester) return normalizeRole(role) === "staff" ? "/requests" : "/supervisor-panel";
  if (event === "new") return "/requested-panel";
  if (type === "staffLoan") return "/staff-loans";
  if (type === "leave") return "/requested-panel";
  return "/entry-data/advance-entry";
}

// ── the daily summary ────────────────────────────────────────────────────────

/** "09:00" → 9. */
export const hourOf = (hhmm) => {
  const h = Number(String(hhmm || DEFAULT_DAILY_AT).split(":")[0]);
  return Number.isInteger(h) && h >= 0 && h < 24 ? h : 9;
};

/** The hour (0–23) it is now on a branch's clock. */
export function localHour(now, timeZone) {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: timeZone || "Asia/Kuala_Lumpur", hour: "2-digit", hourCycle: "h23" }).format(now);
  return Number(h);
}

/** The daily summary message for one person: sales and/or costs, as they chose. */
export function dailyMessage({ day, branchName, sales, costs, wants, money = (v) => String(v), dayLabel = day }) {
  const parts = [];
  if (wants.includes("daily.sales")) parts.push(`Sales ${money(sales)}`);
  if (wants.includes("daily.costs")) parts.push(`Costs ${money(costs)}`);
  if (!parts.length) return null;
  return { title: `${branchName || "Branch"} — ${dayLabel}`, body: parts.join(" · ") };
}
