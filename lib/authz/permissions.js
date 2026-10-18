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
  "audit.company": [...COMPANY_ROLES],
  "audit.branch": [branchAdmin, manager],
  "tools.use": [...BOOKS],
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

  "/requested-panel": "advances.approve",
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
  "/support": "support.use",
  "/branch-chat": "support.use",
  "/feeds": "support.use",

  "/staff-portal": "staffApp.use",
  "/requests": "staffApp.use",
  "/chat": "staffApp.use",
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
