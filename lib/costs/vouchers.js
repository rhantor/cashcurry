// lib/costs/vouchers.js — a cost with no invoice (roadmap 4.9, owner 16 Oct):
// it is saved with a voucher — why there's no invoice — and someone in charge
// approves it: someone more senior than whoever made it (owner, 31 Oct —
// lib/authz/permissions.js outranks). A company role's needs no one: it is
// approved as it is saved. Nobody approves their own. The money already left the till or bank
// when the cost was saved, so approving changes no figure; it is the record
// that someone checked.
//
//   cost.voucher = { status: "pending" | "approved" | "rejected",
//                    reason, by: { uid, name }, at,
//                    decidedBy?: { uid, name }, decidedAt?, note? }
import { DEFAULT_VOUCHER_LIMIT, can, checkedBy, isCompanyRole, outranks, selfApproves } from "@/lib/authz/permissions";

/** Why a cost may have no invoice — picked when saving one. */
export const NO_INVOICE_REASONS = [
  "Market or street stall — no receipts",
  "Receipt lost",
  "Paid to a person (not a shop)",
  "Small item — no receipt given",
];

const who = (u) => ({ uid: u?.uid || null, name: [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.username || u?.email || "", role: u?.role || "" });

export const voucherOf = (cost) => cost?.voucher || null;
export const isWaitingVoucher = (cost) => voucherOf(cost)?.status === "pending";

/**
 * A new cost's voucher. Approved as it is saved (`auto`) for a company role,
 * and for a manager or branch admin up to the branch's limit (`amount`,
 * `limit` — lib/authz/permissions.js selfApproves).
 */
export function newVoucher(user, reason, { amount = 0, limit = DEFAULT_VOUCHER_LIMIT } = {}, now = new Date()) {
  const v = { status: "pending", reason: String(reason || "").trim(), by: who(user), at: now };
  return selfApproves(user?.role, amount, limit) ? { ...v, status: "approved", decidedBy: who(user), decidedAt: now, auto: true } : v;
}

/** What the no-invoice box says about who approves it. */
export function voucherHint(role, limit = DEFAULT_VOUCHER_LIMIT, money = (v) => String(v)) {
  if (isCompanyRole(role)) return "It is saved with your reason — no approval needed.";
  if (selfApproves(role, 0, limit)) return `Up to ${money(limit)} it needs no approval; above that, ${checkedBy([role])} approves it.`;
  return `It is saved with a voucher; ${checkedBy([role])} approves it.`;
}

/** The voucher's maker, and their role (from the voucher; for older ones the cost's createdBy, else `roleOf(uid)`). */
export function voucherMaker(cost, roleOf = () => "") {
  const by = cost?.voucher?.by || {};
  const uid = by.uid || cost?.createdBy?.uid || null;
  const saved = cost?.createdBy?.uid === uid ? cost?.createdBy?.role : "";
  return { uid, role: by.role || saved || roleOf(uid) || "" };
}

/** May this person approve or reject this voucher? Never their own; only someone senior to its maker. */
export function canDecideVoucher(user, cost, roleOf) {
  if (!isWaitingVoucher(cost) || !user?.uid) return false;
  if (!can(user.role, "costs.approve")) return false;
  const maker = voucherMaker(cost, roleOf);
  if (maker.uid === user.uid && !isCompanyRole(user.role)) return false;
  return outranks(user.role, [maker.role]);
}

/** Why this person can't decide it, in words (for the inbox). */
export function voucherWaitsFor(user, cost, roleOf) {
  const maker = voucherMaker(cost, roleOf);
  if (maker.uid === user?.uid) return "Your own voucher — someone senior approves it.";
  return `Waits for ${checkedBy([maker.role])}.`;
}

export function approveVoucherPatch(user, now = new Date()) {
  return { "voucher.status": "approved", "voucher.decidedBy": who(user), "voucher.decidedAt": now, "voucher.note": null };
}

export function rejectVoucherPatch(user, note, now = new Date()) {
  return { "voucher.status": "rejected", "voucher.decidedBy": who(user), "voucher.decidedAt": now, "voucher.note": String(note || "").trim() };
}

/** Sent back: try again with a better reason (back to waiting). */
export function resubmitVoucherPatch(user, reason, now = new Date()) {
  return { "voucher.status": "pending", "voucher.reason": String(reason || "").trim(), "voucher.by": who(user), "voucher.at": now, "voucher.decidedBy": null, "voucher.decidedAt": null };
}

/**
 * Sent back, and the invoice turned up after all: the cost gets its invoice
 * and the voucher is closed as "invoiced" (kept, so the history shows).
 */
export function invoiceAddedPatch(user, fileURL, cost, now = new Date()) {
  const attachments = [fileURL, ...(Array.isArray(cost?.attachments) ? cost.attachments.filter((u) => u !== fileURL) : [])];
  return { fileURL, attachments, "voucher.status": "invoiced", "voucher.invoicedBy": who(user), "voucher.invoicedAt": now };
}

/** A voucher sent back to this person, waiting for them to fix it. */
export const isSentBackTo = (cost, uid) => cost?.voucher?.status === "rejected" && (cost.voucher.by?.uid || cost.createdBy?.uid) === uid;

/** Words for the voucher's state. */
export function voucherText(cost) {
  const v = voucherOf(cost);
  if (!v) return "";
  if (v.status === "approved") return v.auto ? `No invoice — saved by ${v.by?.name || "a company manager"}, no approval needed` : `Voucher approved by ${v.decidedBy?.name || "a manager"}`;
  if (v.status === "invoiced") return `Invoice added after the voucher was sent back${v.note ? ` (“${v.note}”)` : ""}`;
  if (v.status === "rejected") return `Voucher sent back by ${v.decidedBy?.name || "a manager"}${v.note ? `: ${v.note}` : ""}`;
  return "No invoice — voucher waiting for approval";
}
