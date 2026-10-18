// lib/requests/model.js
// One way to look at every request someone at a branch raises — salary
// advances, staff loans and leave today; more types later (roadmap 4.2).
// Each type keeps its own collection (advances and staff loans feed the
// money engine, which must not change shape), and this file says what they
// share: who may ask, who approves and in how many steps, and where a request
// has got to. The Requested panel, My requests and the staff app all read
// requests through here.
//
// Pure — no Firebase. The steps a request goes through:
//
//   asked ──► approved by the branch ──► (approved by the owner) ──► paid out
//      └──► rejected        └──► cancelled by whoever asked, while waiting
//
// The owner step is only for money above the branch's limit
// (settings.requests.ownerApprovalAbove; 0 or empty = never). Leave has no
// pay-out step. firestore.rules enforces the same: an advance or loan above
// the limit can only become "approved" by a company role.

import { can, isCompanyRole } from "@/lib/authz/permissions";
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

/** The branch's approval policy from its settings document. */
export function approvalPolicy(settings) {
  return { ownerApprovalAbove: num(settings?.requests?.ownerApprovalAbove) };
}

/** The approval steps a request needs, in order: ["branch"] or ["branch", "owner"]. */
export function stepsFor(req, policy = {}) {
  const t = REQUEST_TYPES[req?.type];
  const limit = num(policy.ownerApprovalAbove);
  // the request itself says so once the branch has sent it on — for those
  // who can't read the branch's settings (staff)
  const sentOn = req.awaiting === "owner" || (req.approvals || []).some((a) => a.step === "owner");
  return sentOn || (t?.money && limit > 0 && num(req.amount) > limit) ? ["branch", "owner"] : ["branch"];
}

/** Steps already approved, from the trail (older records approved in one go have none). */
const doneSteps = (req) => (req.approvals || []).map((a) => a.step);

/** The step waiting for a decision, or null when nothing is waiting. */
export function waitingStep(req, policy) {
  if (req.status !== "pending") return null;
  const done = doneSteps(req);
  return stepsFor(req, policy).find((s) => !done.includes(s)) || null;
}

/** May this role decide that step? Branch step: an approver; owner step: a company role. */
export function canDecideStep(role, step) {
  if (!step || !can(role, "advances.approve")) return false;
  return step === "branch" || isCompanyRole(role);
}

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
 * approve / reject (their step), cancel (their own, still waiting), payOut.
 */
export function actionsFor(req, who = {}, policy) {
  const out = [];
  const step = waitingStep(req, policy);
  if (step && canDecideStep(who.role, step)) out.push("approve", "reject");
  const mine = (who.uid && req.createdBy?.uid === who.uid) || (who.staffId && req.staffId === who.staffId);
  if (req.status === "pending" && mine && !(req.approvals || []).length) out.push("cancel");
  if (REQUEST_TYPES[req.type]?.money && stageOf(req) === "approved" && can(who.role, "advances.payOut")) out.push("payOut");
  return out;
}

/** Who did it, as stored on a request: { uid, name, role, at }. */
export const stampFor = (user, now = new Date().toISOString()) => ({
  uid: user?.uid || "",
  name: personName(user) || user?.username || "",
  role: user?.role || "",
  at: now,
});

/**
 * The fields to write when `user` approves the waiting step. The last step
 * makes it approved (money: paidOut stays null until someone pays it out);
 * an earlier one only records the approval and who is next.
 */
export function approvalPatch(req, user, policy, now) {
  const step = waitingStep(req, policy);
  if (!step) throw new Error("Nothing is waiting for approval");
  if (!canDecideStep(user?.role, step)) throw new Error(step === "owner" ? "This one needs the owner's approval" : "You can't approve requests");
  const approvals = [...(req.approvals || []), { step, ...stampFor(user, now) }];
  const next = waitingStep({ ...req, approvals }, policy);
  if (next) return { approvals, awaiting: next };
  const stamp = stampFor(user, now);
  return {
    approvals,
    awaiting: null,
    status: "approved",
    approvedBy: { id: stamp.uid, name: stamp.name, role: stamp.role, timestamp: now },
    ...(REQUEST_TYPES[req.type]?.money ? { paidOut: req.paidOut ?? null } : {}),
  };
}

export function rejectPatch(req, user, policy, reason = "", now) {
  const step = waitingStep(req, policy);
  if (!step || !canDecideStep(user?.role, step)) throw new Error("You can't reject this request");
  const stamp = stampFor(user, now);
  return { status: "rejected", awaiting: null, rejectedBy: { ...stamp, step }, rejectReason: reason || "" };
}

export function cancelPatch(req, user, now) {
  if (req.status !== "pending") throw new Error("Only a request still waiting can be cancelled");
  return { status: "cancelled", awaiting: null, cancelledBy: stampFor(user, now) };
}

/**
 * The status and trail for a new request. Someone who may approve and enters
 * it themselves approves the branch step at once; if it also needs the
 * owner (or they can't approve) it waits.
 */
export function newRequestFields(req, user, policy, now) {
  const base = { status: "pending", approvals: [], awaiting: "branch", ...(REQUEST_TYPES[req.type]?.money ? { paidOut: null } : {}) };
  if (!can(user?.role, "advances.approve")) return base;
  const asked = { ...req, ...base };
  let patch = {};
  let cur = asked;
  // approve every step this user may decide, in order
  for (let s = waitingStep(cur, policy); s && canDecideStep(user.role, s); s = waitingStep(cur, policy)) {
    patch = { ...patch, ...approvalPatch(cur, user, policy, now) };
    cur = { ...asked, ...patch };
  }
  return { ...base, ...patch };
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
