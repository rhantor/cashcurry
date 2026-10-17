// Two kinds of entry land in the audit log: record changes written by the
// database trigger ({ actorName, action: "created" | "updated" | "deleted",
// collection, before, after }) and events written by the app through
// createAuditLog ({ username, action: "UPDATE_ADVANCE", details }). This puts
// both in the first shape so the log reads the same for each.

const VERB = { ADD: "created", CREATE: "created", NEW: "created", UPDATE: "updated", EDIT: "updated", CHANGE: "updated", PAY: "updated", MARK: "updated", APPROVE: "updated", REJECT: "updated", DELETE: "deleted", REMOVE: "deleted" };
const THING = { ADVANCE: "advances", SALARY: "salaries", LOAN: "loans", PAYROLL: "payroll", COST: "costs", SALE: "sales", SALES: "sales", BILL: "vendorBills", STAFF: "staff" };

const words = (s) => s.toLowerCase().replace(/_/g, " ");

export function normalizeLog(log) {
  const raw = String(log.action || "");
  const event = /^[A-Z_]+$/.test(raw);
  if (!event) return { ...log, actorName: log.actorName || log.username || "unknown" };
  const parts = raw.split("_");
  const action = VERB[parts[0]] || "event";
  const thing = parts.slice(1).map((p) => THING[p]).find(Boolean) || THING[parts[parts.length - 1]] || "";
  return {
    ...log,
    actorName: log.actorName || log.username || "unknown",
    action,
    collection: log.collection || thing,
    what: words(raw),
    branchName: log.branchName,
  };
}
