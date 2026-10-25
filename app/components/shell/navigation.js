// The app's navigation: the sidebar, the phone's bottom bar and the Ctrl+K
// search. One list for every role — what a role sees is decided by
// lib/authz/permissions.js (canOpen), the same check the page guard uses, so
// the menu never offers a page that then says "not for you".
// `section` groups items in the sidebar; `icon` names map to lucide icons in
// app/components/ui/icons.js.
import { can, canOpen, isCompanyRole as isCompany } from "@/lib/authz/permissions";

export const sidebarItems = [
  { label: "Company Dashboard", section: "Overview", icon: "MdOutlineSpaceDashboard", path: "/company/dashboard" },
  { label: "Dashboard", companyLabel: "Branch Dashboard", section: "Overview", icon: "MdOutlineSpaceDashboard", path: "/dashboard" },
  { label: "Daily Cash Tracker", section: "Overview", icon: "MdOutlineAccountBalanceWallet", path: "/cash-tracker" },

  {
    label: "Entries",
    section: "Daily work",
    icon: "GrTransaction",
    children: [
      { label: "Sales Entry", path: "/entry-data/sales-entry" },
      { label: "Cost Entry", path: "/entry-data/cost-entry" },
      { label: "Cash to Bank", path: "/entry-data/deposit-entry" },
      { label: "Bank to Cash", path: "/entry-data/cash-withdraw" },
      { label: "Advance Entry", path: "/entry-data/advance-entry" },
      { label: "Salaries Entry", path: "/entry-data/salary-entry" },
    ],
  },
  // Money handed out of the till and the bills that come back (4.10)
  { label: "Pay-outs", section: "Daily work", icon: "payouts", path: "/payouts" },
  { label: "Requested Panel", section: "Daily work", icon: "MdOutlineRequestPage", path: "/requested-panel" },
  // Their own requests — for those who ask but don't approve.
  { label: "My Requests", section: "Daily work", icon: "MdOutlineFactCheck", path: "/supervisor-panel", hideIf: "advances.approve" },
  { label: "Issues", section: "Daily work", icon: "MdOutlineReportProblem", path: "/issues" },
  // Checklists, tasks given, notes and performance (4.11)
  { label: "Tasks", section: "Daily work", icon: "tasks", path: "/tasks" },
  {
    label: "Attendance",
    section: "Daily work",
    icon: "MdOutlineCalendarMonth",
    children: [
      { label: "Attendance Log", path: "/attendance-log" },
      { label: "Open Kiosk", path: "/kiosk" },
    ],
  },

  {
    label: "Purchases",
    section: "Money",
    icon: "MdShoppingCart",
    children: [
      { label: "Order Guides", path: "/purchases/order-guides" },
      { label: "Purchase Orders", path: "/purchases/purchase-orders" },
      { label: "New Vendor Bill", path: "/purchases/new-bill" },
      { label: "Due Bills", path: "/purchases/due-bills" },
      { label: "Payments", path: "/purchases/payments" },
      { label: "Vendors", path: "/purchases/vendors" },
      { label: "Items Catalog", path: "/purchases/items" },
      { label: "Purchase Report", path: "/purchases/reports" },
    ],
  },
  {
    label: "Loans",
    section: "Money",
    icon: "MdAttachMoney",
    children: [
      { label: "Staff Loan Tracker", path: "/staff-loans" },
      { label: "Request Loan", path: "/loans/request-loan", branchOnly: true },
      { label: "Loan Updates", path: "/loans/loan-updates" },
      { label: "Loan Summary", path: "/loans/loan-summary" },
    ],
  },
  {
    label: "Payroll",
    section: "Money",
    icon: "MdOutlinePayments",
    children: [
      { label: "Run Payroll", path: "/payroll" },
      { label: "Payroll History", path: "/payroll/history" },
    ],
  },

  {
    label: "Reports",
    section: "Reports",
    icon: "MdOutlineBarChart",
    children: [
      { label: "Summary", path: "/reports" },
      { label: "Yearly Summary", path: "/reports/yearly-summary" },
      { label: "Sales Report", path: "/reports/sales-report" },
      { label: "Cost Report", path: "/reports/cost-report" },
      { label: "Advance Report", path: "/reports/advance-report" },
      { label: "Cash to Bank Report", path: "/reports/deposit-report" },
      { label: "Bank to Cash Report", path: "/reports/withdrawal-report" },
      { label: "Salaries Report", path: "/reports/salary-report" },
      { label: "Staff Loan Report", path: "/reports/staff-loan-report" },
    ],
  },

  { label: "Staff Management", section: "Team", icon: "MdPeopleOutline", path: "/staff-management" },

  { label: "Branch Settings", section: "Admin", icon: "IoSettingsSharp", path: "/branch-settings" },
  {
    label: "Settings",
    section: "Admin",
    icon: "IoSettingsSharp",
    path: "/settings",
    children: [
      { label: "Branch Management", path: "/branches/branch-management" },
      { label: "User Management", path: "/settings/user-management" },
    ],
  },
  { label: "Audit Log", section: "Admin", icon: "MdOutlineManageSearch", path: "/audit-log" },
  { label: "Audit Log", section: "Admin", icon: "MdOutlineManageSearch", path: "/branch-audit" },

  {
    label: "Tools",
    section: "More",
    icon: "MdAppRegistration",
    children: [
      { label: "Reservation Receipt", path: "/tools/reservation-receipt" },
      { label: "Invoice Generator", path: "/tools/invoice-generator" },
      { label: "Appointment Letter", path: "/tools/appointment-letter" },
    ],
  },
  { label: "Support", section: "More", icon: "MdOutlineSupportAgent", path: "/support" },
];

// ── helpers ──────────────────────────────────────────────────────────────────
export const isCompanyRole = isCompany;
const SECTION_ORDER = ["Overview", "Daily work", "Reports", "Money", "Team", "Admin", "More"];

// No role (signed out, or not known yet) → no menu at all, never every item.
const shows = (item, role) =>
  !!role &&
  (!item.path || canOpen(role, item.path)) &&
  !(item.hideIf && can(role, item.hideIf)) &&
  !(item.branchOnly && isCompany(role));

/** The sidebar for a role: [{ section, items }], children filtered too. */
export function navFor(role) {
  const company = isCompany(role);
  const items = sidebarItems
    .map((it) => (it.children ? { ...it, children: it.children.filter((c) => shows(c, role)) } : it))
    .filter((it) => (it.children ? it.children.length > 0 && (!it.path || shows(it, role)) : shows(it, role)))
    .map((it) => (company && it.companyLabel ? { ...it, label: it.companyLabel } : it));
  const sections = [];
  for (const it of items) {
    let s = sections.find((x) => x.section === it.section);
    if (!s) sections.push((s = { section: it.section, items: [] }));
    s.items.push(it);
  }
  return sections.sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section));
}

/** Every page a role can open, flat (for search), each once. */
export function pagesFor(role) {
  const out = [];
  for (const { section, items } of navFor(role)) {
    for (const it of items) {
      if (it.path) out.push({ label: it.label, path: it.path, icon: it.icon, section });
      for (const c of it.children || []) out.push({ label: c.label, path: c.path, icon: it.icon, section, parent: it.label });
    }
  }
  return out.filter((p, i) => out.findIndex((q) => q.path === p.path) === i);
}

/**
 * The menu page the address belongs to: the longest menu path it starts with
 * (so /reports/sales-report is "Sales Report", not "Summary" at /reports).
 */
export function currentPage(pathname, role) {
  if (pathname === "/") return { label: "Home", path: "/" };
  let best = null;
  for (const p of pagesFor(role)) {
    if ((pathname === p.path || pathname.startsWith(`${p.path}/`)) && (!best || p.path.length > best.path.length)) best = p;
  }
  return best;
}

// The phone's bottom bar: Home plus the first three of these the role can open.
const BOTTOM = [
  ["/company/dashboard", "Company"],
  ["/dashboard", "Dashboard"],
  ["/entry-data/sales-entry", "Sales"],
  ["/requested-panel", "Requests"],
  ["/supervisor-panel", "My requests"],
  ["/cash-tracker", "Cash"],
  ["/reports", "Summary"],
  ["/entry-data/advance-entry", "Advance"],
  ["/attendance-log", "Attendance"],
  ["/staff-loans", "Loans"],
];

export function bottomNavFor(role) {
  const pages = pagesFor(role);
  const picks = BOTTOM.map(([path, short]) => {
    const p = pages.find((x) => x.path === path);
    return p && { ...p, label: short };
  })
    .filter(Boolean)
    .slice(0, 3);
  return [{ label: "Home", path: "/", icon: "home" }, ...picks];
}
