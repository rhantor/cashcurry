// A new vendor bill from a supervisor or in-charge waits for approval (owner,
// 13 Nov 2026). It is saved with status "waiting": not owed yet, not on the
// vendor's balance, not in stock, not in Due Bills. Someone who keeps the
// books (manager, accountant, branch admin, company roles) approves it, and
// only then does it become an unpaid bill and raise the vendor's balance; or
// sends it back ("rejected") with a reason. Bills the books add themselves,
// and bills raised by receiving goods on an approved purchase order, count at
// once as before. Pure rules here; the slice does the writes.

import { can } from "@/lib/authz/permissions";

export const WAITING = "waiting";
export const REJECTED = "rejected";

/** Does this bill count — owed, in stock, on the vendor's balance? */
export const counts = (bill) => !!bill && bill.status !== WAITING && bill.status !== REJECTED;

/** Only the bills that count. */
export const countedBills = (list) => (Array.isArray(list) ? list.filter(counts) : []);

/** Does a bill this role adds wait for approval? */
export const waitsForApproval = (role) => can(role, "purchases.billAdd") && !can(role, "purchases.bills");

/** May this role approve or send back a waiting bill? */
export const canDecideBill = (role) => can(role, "purchases.bills");

const MAX_REASON = 300;

/** Why a bill is sent back: needed, kept short. → { value } or { error }. */
export function cleanReason(text) {
  const value = String(text || "").trim().slice(0, MAX_REASON);
  if (!value) return { error: "Write why it is sent back." };
  return { value };
}

/** The line on a bill that is not owed yet, or "". */
export function approvalLine(bill) {
  if (bill?.status === WAITING) return `Waiting for approval${bill.createdBy?.name ? ` · added by ${bill.createdBy.name}` : ""}`;
  if (bill?.status === REJECTED) {
    const who = bill.approval?.by?.name;
    return `Sent back${who ? ` by ${who}` : ""}${bill.approval?.reason ? `: ${bill.approval.reason}` : ""}`;
  }
  return "";
}
