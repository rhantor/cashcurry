// lib/requests/model.js
// One way to look at every request someone at a branch raises — salary
// advances, staff loans and leave today; more types later (roadmap 4.2).
// Each type keeps its own collection (advances and staff loans feed the
// money engine, which must not change shape), and this file says what they
// share: who may ask, who approves, and where a request
// has got to. The Requested panel, My requests and the staff app all read
// requests through here.
//
// Pure — no Firebase. The steps a request goes through:
//
//   asked ──► approved ──► paid out (money only)
//      ├──► rejected
//      └──► cancelled by whoever asked, while it waits
//
// One approval is enough, from anyone who may approve (branch admin,
// manager, gm, super admin or the owner — decided 18 Oct 2026). The owner is
// told who approved and may approve too, but is never a required step.

import { can } from "@/lib/authz/permissions";
import { personName } from "@/lib/people";

/** The request types. `money` ones are paid out and repaid through payroll. */
export const REQUEST_TYPES = {
  advance: { label: "Salary advance", short: "Advance", money: true, collection: "advances" },
  staffLoan: { label: "Staff loan", short: "Loan", money: true, collection: "loans" },
  leave: { label: "Leave", short: "Leave", money: false, collection: "leaves" },
};

/** Kinds of leave. */
export const LEAVE_KINDS = [
  { value: "annual", label: "Annual leave" },
  { value: "medical", label: "Medical leave" },
  { value: "emergency", label: "Emergency leave" },
  { value: "unpaid", label: "Unpaid leave" },
  { value: "other", label: "Other" },
];
export const leaveKindLabel = (v) => LEAVE_KINDS.find((k) => k.value === v)?.label || "Leave";

/** Leave once shared the advances collection; those records are leave, never money. */
const OLD_LEAVE_TYPES = new Set(["medical", "annual", "leave"]);
export const isOldLeave = (advance) => OLD_LEAVE_TYPES.has(String(advance?.advanceType || "").toLowerCase());

const num = (v) => Number(v) || 0;

/** Waiting for a decision? */
export const isWaiting = (req) => req?.status === "pending";

/** May this role approve or reject requests? */
export const canDecide = (role) => can(role, "advances.approve");

/**
 * Where a request has got to, for lists and badges:
 * waiting | approved | paid | rejected | cancelled | closed.
 * Money requests are "approved" until paid out (paidOut null), then "paid";
 * older records with no paidOut field count as paid, like the money engine.
 */
export function stageOf(req) {
  const s = String(req.status || "").toLowerCase();
  if (s === "pending") return "waiting";
  if (s === "rejected" || s === "cancelled") return s;
  if (!REQUEST_TYPES[req.type]?.money) return s === "approved" ? "approved" : s || "approved";
  if (s === "closed") return "closed";
  return req.paidOut === null ? "approved" : "paid";
}

export const STAGES = {
  waiting: { label: "Waiting", tone: "warning" },
  approved: { label: "Approved", tone: "info" },
  paid: { label: "Paid out", tone: "brand" },
  closed: { label: "Repaid", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/**
 * What `who` ({ role, uid, staffId }) may do with a request now:
 * approve / reject, cancel (their own, still waiting), payOut.
 */
export function actionsFor(req, who = {}) {
  const out = [];
  // for themselves: an office login linked to its staff record (30 Oct) never approves its own
  const forMe = isForSelf(req, who);
  if (isWaiting(req) && canDecide(who.role) && !forMe) out.push("approve", "reject");
  const mine = (who.uid && req.createdBy?.uid === who.uid) || forMe;
  if (isWaiting(req) && mine) out.push("cancel");
  if (REQUEST_TYPES[req.type]?.money && stageOf(req) === "approved" && can(who.role, "advances.payOut")) out.push("payOut");
  return out;
}

/**
 * Is it for the person themselves — an office login linked to the staff
 * record it is for (30 Oct)? Then it is only ever a request: someone else
 * approves it (the rules say the same).
 */
export const isForSelf = (req, user) => !!user?.staffId && !!req?.staffId && req.staffId === user.staffId;

/** Who did it, as stored on a request: { uid, name, role, at }. */
export const stampFor = (user, now = new Date().toISOString()) => ({
  uid: user?.uid || "",
  name: personName(user) || user?.username || "",
  role: user?.role || "",
  at: now,
});

/**
 * The fields to write when `user` approves. Money stays unpaid (paidOut
 * null) until someone pays it out.
 */
export function approvalPatch(req, user, now) {
  if (!isWaiting(req)) throw new Error("This request has already been decided");
  if (!canDecide(user?.role)) throw new Error("You can't approve requests");
  if (isForSelf(req, user)) throw new Error("This one is for you — someone else approves it");
  const stamp = stampFor(user, now);
  return {
    approvals: [...(req.approvals || []), stamp],
    status: "approved",
    approvedBy: { id: stamp.uid, name: stamp.name, role: stamp.role, timestamp: now || stamp.at },
    ...(REQUEST_TYPES[req.type]?.money ? { paidOut: req.paidOut ?? null } : {}),
  };
}

export function rejectPatch(req, user, reason = "", now) {
  if (!isWaiting(req)) throw new Error("This request has already been decided");
  if (!canDecide(user?.role)) throw new Error("You can't reject requests");
  return { status: "rejected", rejectedBy: stampFor(user, now), rejectReason: reason || "" };
}

export function cancelPatch(req, user, now) {
  if (!isWaiting(req)) throw new Error("Only a request still waiting can be cancelled");
  return { status: "cancelled", cancelledBy: stampFor(user, now) };
}

/**
 * The status and trail for a new request: waiting — or, entered by someone
 * who may approve, approved at once.
 */
export function newRequestFields(req, user, now) {
  const base = { status: "pending", approvals: [], ...(REQUEST_TYPES[req.type]?.money ? { paidOut: null } : {}) };
  // an approver gives it at once — except to themselves (req.staffId: who it is for)
  return canDecide(user?.role) && !isForSelf(req, user) ? { ...base, ...approvalPatch({ ...req, ...base }, user, now) } : base;
}

// ── leave days ───────────────────────────────────────────────────────────────

/** Calendar days from `from` to `to` (YYYY-MM-DD), both counted; half a day if asked. */
export function leaveDays(from, to, halfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || "")) return 0;
  const end = /^\d{4}-\d{2}-\d{2}$/.test(to || "") ? to : from;
  const d = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
  if (d < 1) return 0;
  return halfDay && d === 1 ? 0.5 : d;
}

// ── one shape for lists ──────────────────────────────────────────────────────

/** A record from any request collection, in the shape lists use. */
export function toRequest(type, doc) {
  const t = isOldLeave(doc) && type === "advance" ? "leave" : type;
  const r = {
    ...doc,
    type: t,
    legacyLeave: t === "leave" && type === "advance", // still in the advances collection
    staffName: doc.staffName || doc.staff?.name || doc.name || "",
    askedAt: doc.createdAt?.seconds ? new Date(doc.createdAt.seconds * 1000).toISOString() : doc.createdAt || doc.date || "",
  };
  if (t === "leave") {
    r.leaveKind = doc.leaveKind || (type === "advance" ? String(doc.advanceType || "").toLowerCase() : "other");
    r.from = doc.from || doc.date || "";
    r.to = doc.to || r.from;
    r.days = doc.days ?? leaveDays(r.from, r.to);
    r.amount = 0;
  } else {
    r.amount = num(doc.amount);
  }
  return r;
}

/** The collection type a request is stored under (old leave sits in advances). */
export const sourceOf = (req) => (req.legacyLeave ? "advance" : req.type);

/** Newest first. */
export const byNewest = (a, b) => String(b.askedAt).localeCompare(String(a.askedAt));
