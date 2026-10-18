// lib/issues/model.js
// Issues (roadmap 4.5): someone at a branch raises a problem — a broken
// fryer, a leak, stock gone bad, a customer complaint — with photos; it is
// given to someone, worked on and resolved, with its own discussion. Pure —
// no Firebase; firestore.rules enforces the same.
//
// companies/{c}/branches/{b}/issues/{id}
//   title, details, category, priority ("normal" | "urgent"),
//   status ("open" | "in_progress" | "resolved"), photos [{ url, path, name, type, size }],
//   reportedBy { uid, name, role }, assignedTo { uid, name, role } | null, dueDate,
//   resolution, resolvedBy, resolvedAt, watchers [uids], createdAt, updatedAt
//   /comments/{id} { byUid, byName, text, photos, kind: "comment" | "event", createdAt }
//
// - Everyone raises issues, staff included.
// - Owner, super admin, gm, branch admin, manager and in-charge assign them
//   (and a due date), change priority, close, reopen and delete them.
// - Whoever it's given to starts it and resolves it (with a note).
// - Whoever raised it can reopen it if it isn't fixed.
// - Office roles see the branch's issues; staff see the ones they raised or were given.

import { can, isCompanyRole } from "../authz/permissions";

export const CATEGORIES = [
  { value: "equipment", label: "Equipment", emoji: "🔧" },
  { value: "cleaning", label: "Cleaning & hygiene", emoji: "🧽" },
  { value: "stock", label: "Stock & supplies", emoji: "📦" },
  { value: "staff", label: "Staff & shifts", emoji: "👥" },
  { value: "customer", label: "Customer complaint", emoji: "🙋" },
  { value: "safety", label: "Safety", emoji: "⚠️" },
  { value: "other", label: "Other", emoji: "📝" },
];
export const categoryOf = (v) => CATEGORIES.find((c) => c.value === v) || CATEGORIES[CATEGORIES.length - 1];

export const STATUSES = {
  open: { label: "Open", tone: "warning" },
  in_progress: { label: "In progress", tone: "info" },
  resolved: { label: "Resolved", tone: "success" },
};

export const MAX_PHOTOS = 6;

/** May this role assign, re-prioritise, close, reopen and delete issues? */
export const canManageIssues = (role) => can(role, "issues.manage");

const isAssignee = (issue, uid) => !!uid && issue?.assignedTo?.uid === uid;
const isReporter = (issue, uid) => !!uid && issue?.reportedBy?.uid === uid;

/** Can this person see this issue? Office roles: their branch's (company roles: all); staff: theirs. */
export function canSeeIssue(issue, user) {
  if (!issue || !user?.uid) return false;
  if (isCompanyRole(user.role)) return true;
  if (user.role !== "staff" && user.branchId === issue.branchId) return true;
  return isReporter(issue, user.uid) || isAssignee(issue, user.uid);
}

/**
 * What `user` may do with an issue now:
 * assign, priority, start, resolve, reopen, delete.
 */
export function issueActions(issue, user) {
  const out = [];
  const manage = canManageIssues(user?.role);
  const mine = isAssignee(issue, user?.uid);
  if (manage) out.push("assign", "priority", "due");
  if (issue.status === "open" && (mine || manage)) out.push("start");
  if (issue.status !== "resolved" && (mine || manage)) out.push("resolve");
  if (issue.status === "resolved" && (manage || isReporter(issue, user?.uid))) out.push("reopen");
  if (manage) out.push("delete");
  return out;
}

/** Overdue: a due date passed and not resolved. today: "yyyy-MM-dd" */
export const isOverdue = (issue, today) => !!issue?.dueDate && issue.status !== "resolved" && issue.dueDate < today;

/** Sort for the board: urgent first, then overdue, then oldest. */
export function boardOrder(a, b, today) {
  const rank = (x) => (x.priority === "urgent" ? 0 : 2) + (isOverdue(x, today) ? -1 : 0);
  return rank(a) - rank(b) || String(a.createdAtISO || "").localeCompare(String(b.createdAtISO || ""));
}

/** Who to keep told about an issue: the reporter, the assignee and anyone who commented. */
export const watchersWith = (issue, ...uids) => [...new Set([...(issue?.watchers || []), ...uids.filter(Boolean)])];

/** The line written into the thread when something about the issue changes. */
export function eventText(kind, { by = "Someone", to, priority, due, note } = {}) {
  switch (kind) {
    case "assigned":
      return `${by} gave this to ${to}`;
    case "unassigned":
      return `${by} took it off ${to}`;
    case "started":
      return `${by} started working on it`;
    case "resolved":
      return `${by} marked it resolved${note ? ` — “${note}”` : ""}`;
    case "reopened":
      return `${by} reopened it${note ? ` — “${note}”` : ""}`;
    case "priority":
      return `${by} set the priority to ${priority === "urgent" ? "urgent" : "normal"}`;
    case "due":
      return due ? `${by} set it due ${due}` : `${by} removed the due date`;
    default:
      return "";
  }
}
