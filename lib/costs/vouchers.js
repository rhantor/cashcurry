// lib/costs/vouchers.js — a cost with no invoice (roadmap 4.9, owner 16 Oct):
// it is saved with a voucher — why there's no invoice — and someone in charge
// approves it: branch admin, manager or in-charge (and the company roles above
// them). Nobody approves their own. The money already left the till or bank
// when the cost was saved, so approving changes no figure; it is the record
// that someone checked.
//
//   cost.voucher = { status: "pending" | "approved" | "rejected",
//                    reason, by: { uid, name }, at,
//                    decidedBy?: { uid, name }, decidedAt?, note? }
import { can } from "@/lib/authz/permissions";

/** Why a cost may have no invoice — picked when saving one. */
export const NO_INVOICE_REASONS = [
  "Market or street stall — no receipts",
  "Receipt lost",
  "Paid to a person (not a shop)",
  "Small item — no receipt given",
];

const who = (u) => ({ uid: u?.uid || null, name: [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.username || u?.email || "" });

export const voucherOf = (cost) => cost?.voucher || null;
export const isWaitingVoucher = (cost) => voucherOf(cost)?.status === "pending";

/** A new cost's voucher. */
export function newVoucher(user, reason, now = new Date()) {
  return { status: "pending", reason: String(reason || "").trim(), by: who(user), at: now };
}

/** May this person approve or reject this voucher? Never their own. */
export function canDecideVoucher(user, cost) {
  if (!isWaitingVoucher(cost) || !user?.uid) return false;
  if (!can(user.role, "costs.approve")) return false;
  const maker = cost.voucher?.by?.uid || cost.createdBy?.uid;
  return maker !== user.uid;
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
  if (v.status === "approved") return `Voucher approved by ${v.decidedBy?.name || "a manager"}`;
  if (v.status === "invoiced") return `Invoice added after the voucher was sent back${v.note ? ` (“${v.note}”)` : ""}`;
  if (v.status === "rejected") return `Voucher sent back by ${v.decidedBy?.name || "a manager"}${v.note ? `: ${v.note}` : ""}`;
  return "No invoice — voucher waiting for approval";
}
