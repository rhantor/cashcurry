// Two kinds of entry land in the audit log: record changes written by the
// database trigger ({ actorName, action: "created" | "updated" | "deleted",
// collection, before, after }) and events written by the app through
// createAuditLog ({ username, action: "UPDATE_ADVANCE", details }). This puts
// both in the first shape so the log reads the same for each.
import { actorFromChange } from "./actor.js";

const VERB = { ADD: "created", CREATE: "created", NEW: "created", UPDATE: "updated", EDIT: "updated", CHANGE: "updated", PAY: "updated", MARK: "updated", APPROVE: "updated", REJECT: "updated", DELETE: "deleted", REMOVE: "deleted" };
const THING = { ADVANCE: "advances", SALARY: "salaries", LOAN: "loans", PAYROLL: "payroll", COST: "costs", SALE: "sales", SALES: "sales", BILL: "vendorBills", STAFF: "staff", LEAVE: "leave", REQUEST: "requests" };

/** What each kind of record is called on screen. */
export const AREA_LABELS = {
  sales: "Sales",
  costs: "Costs",
  salaries: "Salaries",
  loans: "Loans",
  vendorBills: "Vendor bills",
  advances: "Advances",
  payroll: "Payroll",
  staff: "Staff",
  leave: "Leave",
  requests: "Requests",
};

const words = (s) => s.toLowerCase().replace(/_/g, " ");

// What the person did, in the past tense: "APPROVE_REQUEST" → "Approved".
const DID = { ADD: "Added", CREATE: "Added", NEW: "Added", UPDATE: "Changed", EDIT: "Changed", CHANGE: "Changed", PAY: "Paid out", MARK: "Marked paid", APPROVE: "Approved", REJECT: "Rejected", DELETE: "Deleted", REMOVE: "Deleted", FINALIZE: "Finalized", REVERT: "Reverted", SAVE: "Saved" };

/**
 * Older event texts named records by their database id ("Paid out advance
 * SYrvF6Ap6zWealVu8SJi on …", "(Run ID: …)"). Ids mean nothing to a reader.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function cleanDetails(text = "") {
  return String(text)
    .replace(/\s*\((?:run )?id:\s*[A-Za-z0-9_-]+\)/gi, "")
    .replace(/\s*\bid:\s*[A-Za-z0-9_-]{6,}/gi, "")
    // a bare 20-character database id ("SYrvF6Ap6zWealVu8SJi"): letters with digits and capitals
    .replace(/\s+\b(?=[A-Za-z0-9]{20}\b)(?=[A-Za-z0-9]*[0-9])(?=[A-Za-z0-9]*[A-Z])[A-Za-z0-9]{20}\b/g, "")
    .replace(/\bRejectd\b/g, "Rejected")
    .replace(/\bCanceld\b/g, "Cancelled")
    // "2026-10-20" → "20 Oct 2026"
    .replace(/\b(\d{4})-(\d\d)-(\d\d)\b/g, (_m, y, mo, d) => `${Number(d)} ${MONTHS[Number(mo) - 1] || mo} ${y}`)
    .replace(/\s+([.,])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
const named = (n) => (n && n !== "unknown" && n !== "System" ? n : "");

// "Approved salary advance for ali (500)" → advances
function areaOfRequest(details = "") {
  if (/advance/i.test(details)) return "advances";
  if (/loan/i.test(details)) return "loans";
  if (/leave/i.test(details)) return "leave";
  return "requests";
}

export function normalizeLog(log) {
  const raw = String(log.action || "");
  const event = /^[A-Z_]+$/.test(raw);
  if (!event) {
    // The trigger now records the signed-in account (actorFrom "account");
    // older entries guessed from the record, so read the record again.
    const fromRecord = log.actorFrom === "account" ? null : actorFromChange(log);
    return { ...log, actorName: named(log.actorFrom === "account" && log.actorName) || fromRecord?.name || named(log.actorName) || "unknown" };
  }
  const parts = raw.split("_");
  const action = VERB[parts[0]] || "event";
  let thing = parts.slice(1).map((p) => THING[p]).find(Boolean) || THING[parts[parts.length - 1]] || "";
  if (thing === "requests") thing = areaOfRequest(log.details);
  return {
    ...log,
    actorName: named(log.actorName) || named(log.name) || named(log.username) || "unknown",
    action,
    collection: log.collection || thing,
    what: words(raw),
    did: DID[parts[0]] || words(raw),
    details: cleanDetails(log.details),
    branchName: log.branchName,
  };
}
