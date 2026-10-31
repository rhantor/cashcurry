// lib/authz/permissions.js
// Who may do what — the roles matrix from docs/ROLES.md (agreed 18 Oct 2026).
// The menu, the page guard (middleware.js), checks inside pages and the
// rules tests all read this file; firestore.rules is written to match it and
// tests-rules/matrix.test.js fails if the two ever drift apart.
//
// No Firebase imports: middleware.js runs on the edge and loads this file.

import { ROLES } from "./roles";

const {
  owner, superAdmin, gm, branchAdmin, manager, inCharge, accountant, supervisor, cashier, staff,
} = ROLES;

/** Roles that see every branch (and act in the branch they pick). */
export const COMPANY_ROLES = [owner, superAdmin, gm];
/** Roles tied to one branch. */
export const BRANCH_ROLES = [branchAdmin, manager, inCharge, accountant, supervisor, cashier];
/** Everyone who works in the back office (everyone but staff). */
export const OFFICE_ROLES = [...COMPANY_ROLES, ...BRANCH_ROLES];

const LEADS = [...COMPANY_ROLES, branchAdmin, manager]; // run the branch
const BOOKS = [...LEADS, accountant]; // keep the books

/**
 * Capability → roles. One row of the matrix each. Keep the names stable: the
 * rules tests and the menu refer to them.
 */
export const CAN = {
  // overview
  "dashboard.company": [...COMPANY_ROLES],
  "dashboard.branch": [...LEADS, inCharge, accountant],
  "reports.view": [...LEADS, inCharge, accountant],
  // the till's cash on the Requested panel — the cashier too, who hands it out but doesn't see the books (30 Oct)
  "cashInHand.view": [...LEADS, inCharge, accountant, cashier],

  // daily money
  "sales.enter": [...OFFICE_ROLES],
  "costs.enter": [...LEADS, inCharge, accountant],
  "cashBank.enter": [...BOOKS], // cash to bank, bank to cash, branch-to-branch loans
  "salaries.enter": [...BOOKS],

  // saved records (sales, costs, cash to bank, salaries…) after they are entered
  "records.edit": [...LEADS, inCharge, accountant, supervisor],
  "records.delete": [...LEADS],

  // advances and staff loans
  "advances.request": [...OFFICE_ROLES],
  "advances.payOut": [...LEADS, accountant, supervisor, cashier],
  "advances.approve": [...LEADS],

  // payroll and people
  "payroll.view": [...BOOKS],
  "payroll.manage": [...LEADS],
  "staff.view": [...LEADS, inCharge, accountant, supervisor, cashier], // names, to pick from
  "staff.pay": [...BOOKS], // pay, IC, bank details
  "staff.manage": [...LEADS],
  "attendance.view": [...LEADS, inCharge, supervisor],
  "attendance.manage": [...LEADS],
  "kiosk.open": [...LEADS, inCharge, supervisor],

  // purchases
  "purchases.order": [...LEADS, inCharge, accountant, supervisor], // guides, orders, receive goods
  "purchases.approve": [...LEADS, inCharge], // approve / reject purchase orders
  "purchases.bills": [...BOOKS], // vendor bills, paying them, payments, purchase report
  "catalog.view": [...BOOKS, inCharge, supervisor],
  "catalog.manage": [...BOOKS], // vendors and items

  // settings and admin
  "branchSettings.manage": [...LEADS],
  "moneySettings.manage": [owner, superAdmin, branchAdmin], // opening balances, currency, time zone, day end
  "company.manage": [owner, superAdmin], // company settings, branches, users
  "company.view": [owner, superAdmin, gm],
  "categories.manage": [owner, superAdmin, gm],
  "notifications.manage": [owner, superAdmin, gm, branchAdmin], // who gets which notifications (4.3)
  "chat.groups": [...LEADS], // make and manage chat groups (4.4); everyone chats
  "issues.raise": [...OFFICE_ROLES, staff], // report a problem (4.5)
  "issues.manage": [...LEADS, inCharge], // assign, close, reopen, delete issues
  "tasks.manage": [...LEADS, inCharge], // give tasks, see the team's, rate people (4.11); everyone has their own tasks and notes
  "tasks.team": [supervisor], // give tasks to their own team (staff whose record names them, or no one), hand tasks over — no rating
  "payouts.handOut": [...LEADS, inCharge, supervisor, cashier], // money out of the till for things to buy, and its bill (4.10)
  "costs.approve": [...LEADS, inCharge], // vouchers for costs with no invoice, pay-out bills (4.9, 4.10) — never their own
  "audit.company": [...COMPANY_ROLES],
  "audit.branch": [branchAdmin, manager],
  "tools.use": [...BOOKS],
  // reservation deposit receipts (Tools → Reservation Receipt, on main 25 Oct 2026): everyone at the
  // branch makes and sends them; marking one used / refunded / cancelled is for these — or whoever made it
  "reservations.receipt": [...OFFICE_ROLES],
  "reservations.manage": [...LEADS, inCharge, accountant, supervisor],
  "support.use": [...OFFICE_ROLES],

  // the staff app
  "staffApp.use": [staff],
};

/** How each role is written for people. */
export const ROLE_LABELS = {
  owner: "Owner", superAdmin: "Super admin", gm: "General manager",
  branchAdmin: "Branch admin", manager: "Manager", inCharge: "In charge",
  accountant: "Accountant", supervisor: "Supervisor", cashier: "Cashier", staff: "Staff",
};
/** Roles that can be given to a company user / a branch user (staff come from Staff management). */
export const COMPANY_ASSIGNABLE = [superAdmin, gm];
export const BRANCH_ASSIGNABLE = [branchAdmin, manager, inCharge, accountant, supervisor, cashier];
/** [{ value, label }] for a role picker; `current` stays listed if it isn't assignable (e.g. the owner). */
export const roleOptions = (roles, current) => {
  const cur = normalizeRole(current);
  const list = cur && !roles.includes(cur) ? [cur, ...roles] : roles;
  return list.map((value) => ({ value, label: ROLE_LABELS[value] || value }));
};
export const roleLabel = (role) => ROLE_LABELS[normalizeRole(role)] || role || "";

/** Old spellings still found in user records. */
const ALIASES = { superadmin: superAdmin, branchadmin: branchAdmin, incharge: inCharge };
export const normalizeRole = (role) => ALIASES[role] || ALIASES[String(role || "").toLowerCase()] || role || "";

/** Can this role do it? `can(user.role, "payroll.manage")`. */
export function can(role, capability) {
  const list = CAN[capability];
  if (!list) throw new Error(`Unknown capability: ${capability}`);
  return list.includes(normalizeRole(role));
}

/** Can this role do any of these? */
export const canAny = (role, capabilities) => capabilities.some((c) => can(role, c));

export const isCompanyRole = (role) => COMPANY_ROLES.includes(normalizeRole(role));

// ── who checks whose money (owner, 31 Oct) ───────────────────────────────────
// A voucher (a cost with no invoice) or a pay-out bill is checked by someone
// more senior than everyone who made it: in-charge's by a manager or above,
// a manager's by branch admin or a company role, branch admin's by a company
// role. Company roles need no one — theirs are approved as they save them —
// and may decide any. firestore.rules (approvalRank) mirrors this.
export const APPROVAL_RANK = { [owner]: 4, [superAdmin]: 4, [gm]: 4, [branchAdmin]: 3, [manager]: 2, [inCharge]: 1 };
export const approvalRank = (role) => APPROVAL_RANK[normalizeRole(role)] || 0;

/** May someone in `role` check money made by people in `makerRoles`? */
export function outranks(role, makerRoles = []) {
  if (isCompanyRole(role)) return true;
  const top = Math.max(0, ...makerRoles.map(approvalRank));
  return approvalRank(role) > top;
}

// A manager or branch admin's own up to the branch's limit needs no one either
// (owner, 1 Nov): small market buys don't wait. Above it, someone senior.
// The limit is a money setting (settings.financeSales.voucherLimit), so only
// owner, super admin and branch admin change it; firestore.rules reads the same.
export const DEFAULT_VOUCHER_LIMIT = 100;
export const SELF_LIMIT_ROLES = [manager, branchAdmin];
/** The branch's limit, from its settings (the default when not set). */
export function voucherLimit(settings) {
  const raw = settings?.financeSales?.voucherLimit;
  const v = Number(raw);
  return raw != null && raw !== "" && Number.isFinite(v) && v >= 0 ? v : DEFAULT_VOUCHER_LIMIT;
}
/** Is this person's own voucher or bill of `amount` approved as they save it? */
export function selfApproves(role, amount, limit = DEFAULT_VOUCHER_LIMIT) {
  if (isCompanyRole(role)) return true;
  return SELF_LIMIT_ROLES.includes(normalizeRole(role)) && Number(amount) <= Number(limit);
}

/** Who may check it, in words: "a manager or above". */
export function checkedBy(makerRoles = []) {
  const top = Math.max(0, ...makerRoles.map(approvalRank));
  if (top >= 3) return "the GM, super admin or owner";
  if (top === 2) return "branch admin or above";
  if (top === 1) return "a manager or above";
  return "in-charge or above";
}

// ── pages ────────────────────────────────────────────────────────────────────
// Page → what it needs. The longest matching prefix wins, so
// /reports/yearly-summary/2026 is checked as /reports/yearly-summary.
// A page not listed is open to every office role, never to staff.
export const PAGES = {
  "/dashboard": "dashboard.branch",
  "/company/dashboard": "dashboard.company",
  "/cash-tracker": "reports.view",

  "/entry-data/sales-entry": "sales.enter",
  "/entry-data/cost-entry": "costs.enter",
  "/entry-data/deposit-entry": "cashBank.enter",
  "/entry-data/cash-withdraw": "cashBank.enter",
  "/entry-data/advance-entry": "advances.request",
  "/entry-data/salary-entry": "salaries.enter",

  "/reports": "reports.view",
  "/reports/salary-report": "payroll.view", // everyone's pay

  "/requested-panel": ["advances.approve", "costs.approve"], // in-charge: vouchers and bills only (4.9, 4.10)
  "/payouts": "payouts.handOut",
  "/supervisor-panel": ["advances.request"], // their own requests
  "/staff-loans": "advances.payOut",
  "/loans": "cashBank.enter", // branch-to-branch loans

  "/purchases/order-guides": "purchases.order",
  "/purchases/purchase-orders": "purchases.order",
  "/purchases/requisitions": "purchases.order",
  "/purchases/new-bill": "purchases.bills",
  "/purchases/due-bills": "purchases.bills",
  "/purchases/payments": "purchases.bills",
  "/purchases/reports": "purchases.bills",
  "/purchases/vendors": "catalog.view",
  "/purchases/items": "catalog.view",

  "/payroll": "payroll.manage",
  "/payroll/history": "payroll.view",
  "/staff-management": "staff.manage",
  "/attendance-log": "attendance.view",
  "/kiosk": "kiosk.open",

  "/branch-settings": "branchSettings.manage",
  "/settings": "company.view",
  "/branches": "company.view",
  "/audit-log": "audit.company",
  "/branch-audit": "audit.branch",

  "/tools": "tools.use",
  "/tools/reservation-receipt": "reservations.receipt",
  "/support": "support.use",

  "/staff-portal": "staffApp.use",
  "/requests": "staffApp.use",

  // chat (4.4) has its own workspace, for the office and staff alike
  "/messages": ["support.use", "staffApp.use"],

  // issues (4.5): the office board, and the staff portal's own page
  "/issues": "support.use",
  "/my-issues": "staffApp.use",

  // the staff app (4.6): payslips and pay so far
  "/my-pay": "staffApp.use",
  "/my-attendance": "staffApp.use",

  // tasks, checklists, notes and performance (4.11): everyone's own, the office and staff
  "/tasks": "support.use",
  // an office login's own pay and attendance (30 Oct)
  "/me": "support.use",
  // today at the branch on the phone (30 Oct): each part shows by the role's own capabilities
  "/ops": "support.use",
  "/my-tasks": "staffApp.use",
};

/** Pages anyone signed in may open (their own profile, the kit preview). */
const OPEN_PAGES = ["/profile", "/ui"];

const startsWith = (path, prefix) => path === prefix || path.startsWith(prefix + "/");

/** What a page needs: a capability, a list (any of), or null for "any office role". */
export function pageNeeds(pathname) {
  let best = null;
  for (const prefix of Object.keys(PAGES)) {
    if (startsWith(pathname, prefix) && (!best || prefix.length > best.length)) best = prefix;
  }
  return best ? PAGES[best] : null;
}

/** May this role open this page? */
export function canOpen(role, pathname) {
  const r = normalizeRole(role);
  if (!r) return false;
  if (pathname === "/" || OPEN_PAGES.some((p) => startsWith(pathname, p))) return true;
  const need = pageNeeds(pathname);
  if (!need) return OFFICE_ROLES.includes(r);
  return Array.isArray(need) ? need.some((c) => can(r, c)) : can(r, need);
}
