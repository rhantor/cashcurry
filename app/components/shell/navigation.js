// The app's navigation: what each role sees in the sidebar, the phone's
// bottom bar and the Ctrl+K search. `section` groups items in the sidebar;
// `icon` names map to lucide icons in app/components/ui/icons.js.
export const sidebarItems = {
  branchUser: [
    {
      label: 'Dashboard',
      section: 'Overview',
      icon: 'MdOutlineSpaceDashboard',
      path: '/dashboard',
      allowedRoles: ['accountant', 'manager', 'branchAdmin']
    },
    {
      label: 'Purchases',
      section: 'Money',
      icon: 'MdShoppingCart',
      allowedRoles: ['manager', 'accountant', 'branchAdmin', 'supervisor'],
      children: [
        { label: 'Order Guides', path: '/purchases/order-guides', allowedRoles: ['manager', 'accountant', 'branchAdmin', 'supervisor'] },
        { label: 'Purchase Orders', path: '/purchases/purchase-orders', allowedRoles: ['manager', 'accountant', 'branchAdmin', 'supervisor'] },
        { label: 'New Vendor Bill', path: '/purchases/new-bill', allowedRoles: ['manager', 'accountant', 'branchAdmin', 'supervisor'] },
        { label: 'Due Bills', path: '/purchases/due-bills', allowedRoles: ['manager', 'accountant', 'branchAdmin'] },
        { label: 'Payments', path: '/purchases/payments', allowedRoles: ['manager', 'accountant', 'branchAdmin'] },
        { label: 'Vendors', path: '/purchases/vendors', allowedRoles: ['manager', 'accountant', 'branchAdmin', 'supervisor'] },
        { label: 'Items Catalog', path: '/purchases/items', allowedRoles: ['manager', 'accountant', 'branchAdmin', 'supervisor'] },
        { label: 'Purchase Report', path: '/purchases/reports', allowedRoles: ['manager', 'accountant', 'branchAdmin'] }
      ]
    },
    {
      label: 'Entries',
      section: 'Daily work',
      icon: 'GrTransaction',
      allowedRoles: [
        'cashier',
        'accountant',
        'manager',
        'supervisor',
        'branchAdmin'
      ],
      children: [
        {
          label: 'Sales Entry',
          path: '/entry-data/sales-entry',
          allowedRoles: ['accountant', 'manager', 'supervisor', 'branchAdmin']
        },
        {
          label: 'Cost Entry',
          path: '/entry-data/cost-entry',
          allowedRoles: ['manager', 'accountant', 'branchAdmin']
        },
        {
          label: 'Cash Deposit',
          path: '/entry-data/deposit-entry',
          allowedRoles: ['manager', 'accountant', 'branchAdmin']
        },
        {
          label: 'Cash Withdrawal',
          path: '/entry-data/cash-withdraw',
          allowedRoles: ['manager', 'accountant', 'branchAdmin']
        },
        {
          label: 'Advance Entry',
          path: '/entry-data/advance-entry',
          allowedRoles: [
            'cashier',
            'supervisor',
            'accountant',
            'manager',
            'branchAdmin'
          ]
        },
        {
          label: 'Salaries Entry',
          path: '/entry-data/salary-entry',
          allowedRoles: ['cashier', 'accountant', 'manager', 'branchAdmin']
        }
      ]
    },
    {
      label: 'Reports',
      section: 'Money',
      icon: 'MdOutlineBarChart',
      allowedRoles: ['manager', 'accountant', 'branchAdmin'],
      children: [
        { label: 'Sales Report', path: '/reports/sales-report' },
        { label: 'Cost Report', path: '/reports/cost-report' },
        { label: 'Advance Report', path: '/reports/advance-report' },
        { label: 'Deposit Report', path: '/reports/deposit-report' },
        { label: 'Withdrawal Report', path: '/reports/withdrawal-report' },
        { label: 'Salaries Report', path: '/reports/salary-report' },
        { label: 'Summary', path: '/reports' },
        { label: 'Yearly Summary', path: '/reports/yearly-summary' }
      ]
    },
    {
      label: 'Requested Panel',
      section: 'Daily work',
      icon: 'MdOutlineRequestPage',
      path: '/requested-panel',
      allowedRoles: ['manager', 'branchAdmin']
    },
    {
      label: 'My Requested',
      section: 'Daily work',
      icon: 'MdOutlineFactCheck',
      path: '/supervisor-panel',
      allowedRoles: ['supervisor']
    },
    {
      label: 'Loans',
      section: 'Money',
      icon: 'MdAttachMoney',
      allowedRoles: ['manager', 'branchAdmin', 'accountant'],
      children: [
        {
          label: 'Staff Loan Tracker',
          path: '/staff-loans',
          allowedRoles: ['accountant', 'manager', 'branchAdmin']
        },
        {
          label: 'Request Loan',
          path: '/loans/request-loan',
          allowedRoles: ['accountant', 'manager', 'branchAdmin']
        },
        {
          label: 'Loan Updates',
          path: '/loans/loan-updates',
          allowedRoles: ['manager', 'accountant', 'branchAdmin']
        },
        {
          label: 'Loan Summary',
          path: '/loans/loan-summary',
          allowedRoles: ['manager', 'accountant', 'branchAdmin']
        }
      ]
    },
    {
      label: 'Settings',
      section: 'Admin',
      icon: 'IoSettingsSharp',
      path: '/settings',
      allowedRoles: ['gm', 'owner']
    },
    {
      label: 'Audit Log',
      section: 'Admin',
      icon: 'MdOutlineManageSearch',
      path: '/branch-audit',
      allowedRoles: ['branchAdmin', 'manager']
    },
    {
      label: 'Branch Settings',
      section: 'Admin',
      icon: 'IoSettingsSharp',
      path: '/branch-settings',
      allowedRoles: ['branchAdmin', 'manager']
    },
    {
      label: 'Staff Management',
      section: 'Team',
      icon: 'MdPeopleOutline',
      path: '/staff-management',
      allowedRoles: ['branchAdmin', 'manager']
    },
    {
      label: 'Payroll',
      section: 'Money',
      icon: 'MdOutlinePayments',
      allowedRoles: ['branchAdmin', 'manager'],
      children: [
        { label: 'Run Payroll', path: '/payroll' },
        { label: 'Payroll History', path: '/payroll/history' }
      ]
    },

    {
      label: 'Attendance',
      section: 'Daily work',
      icon: 'MdOutlineCalendarMonth',
      // Keep these in sync with the /attendance-log and /kiosk policies in
      // middleware.js — a child with no allowedRoles is shown to everyone, which
      // would send unlisted roles straight to /unauthorized.
      allowedRoles: ['branchAdmin', 'manager', 'supervisor'],
      children: [
        { label: 'Attendance Log', path: '/attendance-log', allowedRoles: ['branchAdmin', 'manager', 'supervisor'] },
        { label: 'Open Kiosk', path: '/kiosk', allowedRoles: ['branchAdmin', 'manager', 'supervisor'] }
      ]
    },

    {
      label: 'Tools',
      section: 'More',
      icon: 'MdAppRegistration',
      allowedRoles: [
        'cashier',
        'accountant',
        'manager',
        'supervisor',
        'branchAdmin'
      ],
      children: [
        { label: 'Invoice Generator', path: '/tools/invoice-generator' },
        { label: 'Appointment Letter', path: '/tools/appointment-letter' }
      ]
    },
    {
      label: 'Support',
      section: 'More',
      icon: 'MdOutlineSupportAgent',
      path: '/support',
      allowedRoles: [
        'cashier',
        'accountant',
        'manager',
        'supervisor',
        'branchAdmin'
      ]
    }
  ],

  company: [
    {
      label: 'Branch Dashboard',
      section: 'Overview',
      icon: 'MdOutlineSpaceDashboard',
      path: '/dashboard' // <-- fixed leading slash
    },
    {
      label: 'Company Dashboard',
      section: 'Overview',
      icon: 'MdOutlineSpaceDashboard',
      path: '/company/dashboard'
    },
    {
      label: 'Daily Cash Tracker',
      section: 'Overview',
      icon: 'MdOutlineAccountBalanceWallet',
      path: '/cash-tracker',
      allowedRoles: ['gm', 'superAdmin', 'owner', 'branchAdmin', 'manager', 'accountant']
    },
    {
      label: 'Purchases',
      section: 'Money',
      icon: 'MdShoppingCart',
      allowedRoles: ['gm', 'superAdmin', 'owner'],
      children: [
        { label: 'Order Guides', path: '/purchases/order-guides' },
        { label: 'Purchase Orders', path: '/purchases/purchase-orders' },
        { label: 'New Vendor Bill', path: '/purchases/new-bill' },
        { label: 'Due Bills', path: '/purchases/due-bills' },
        { label: 'Payments', path: '/purchases/payments' },
        { label: 'Vendors', path: '/purchases/vendors' },
        { label: 'Items Catalog', path: '/purchases/items' },
        { label: 'Purchase Report', path: '/purchases/reports' }
      ]
    },
    {
      label: 'Sales Report',
      section: 'Reports',
      icon: 'MdOutlineBarChart',
      path: '/reports/sales-report',
      allowedRoles: ['gm', 'superAdmin', 'owner']
    },
    {
      label: 'Cost Report',
      section: 'Reports',
      icon: 'MdOutlineAttachMoney',
      path: '/reports/cost-report',
      allowedRoles: ['gm', 'superAdmin', 'owner']
    },
    {
      label: 'Cash Deposit Report',
      section: 'Reports',
      icon: 'MdOutlineAccountBalanceWallet',
      path: '/reports/deposit-report',
      allowedRoles: ['gm', 'superAdmin', 'owner']
    },
    {
      label: 'Withdrawal Report',
      section: 'Reports',
      icon: 'MdOutlineMoneyOffCsred',
      path: '/reports/withdrawal-report',
      allowedRoles: ['gm', 'superAdmin', 'owner']
    },
    {
      label: 'Advance Report',
      section: 'Reports',
      icon: 'MdOutlineCalendarMonth',
      path: '/reports/advance-report',
      allowedRoles: ['gm', 'superAdmin', 'owner']
    },
    {
      label: 'Loans',
      section: 'Money',
      icon: 'MdAttachMoney',
      allowedRoles: ['gm', 'superAdmin', 'owner'],
      children: [
        {
          label: 'Staff Loan Tracker',
          path: '/staff-loans',
          allowedRoles: ['gm', 'superAdmin', 'owner']
        },
        {
          label: 'Loan Updates',
          path: '/loans/loan-updates',
          allowedRoles: ['gm', 'superAdmin', 'owner']
        },
        {
          label: 'Loan Summary',
          path: '/loans/loan-summary',
          allowedRoles: ['gm', 'superAdmin', 'owner']
        }
      ]
    },
    {
      label: 'Reports (Summary)',
      section: 'Reports',
      icon: 'MdOutlineInsights',
      path: '/reports',
      allowedRoles: ['gm', 'superAdmin', 'owner']
    },
    {
      label: 'Yearly Summary',
      section: 'Reports',
      icon: 'MdOutlineCalendarToday',
      path: '/reports/yearly-summary',
      allowedRoles: ['gm', 'superAdmin', 'owner']
    },
    {
      label: 'Audit Log',
      section: 'Admin',
      icon: 'MdOutlineManageSearch',
      path: '/audit-log',
      allowedRoles: ['owner', 'gm', 'superAdmin']
    },
    {
      label: 'Settings',
      section: 'Admin',
      icon: 'IoSettingsSharp',
      path: '/settings',
      allowedRoles: ['gm', 'superAdmin', 'owner'],
      children: [
        { label: 'Branche Management', path: '/branches/branch-management' },
        { label: 'User Management', path: '/settings/user-management' }
      ]
    },
    {
      label: 'Attendance',
      section: 'Team',
      icon: 'MdOutlineCalendarMonth',
      allowedRoles: ['gm', 'superAdmin', 'owner'],
      children: [
        { label: 'Attendance Log', path: '/attendance-log' },
        { label: 'Open Kiosk', path: '/kiosk' }
      ]
    },
    {
      label: 'Tools',
      section: 'More',
      icon: 'MdAppRegistration',
      allowedRoles: ['gm', 'superAdmin', 'owner'],
      children: [
        { label: 'Invoice Generator', path: '/tools/invoice-generator' },
        { label: 'Appointment Letter', path: '/tools/appointment-letter' }
      ]
    },
    {
      label: 'Support',
      section: 'More',
      icon: 'MdOutlineSupportAgent',
      path: '/support'
    }
  ]
}

// ── helpers ──────────────────────────────────────────────────────────────────
const COMPANY_ROLES = ["owner", "gm", "superAdmin"];
export const isCompanyRole = (role) => COMPANY_ROLES.includes(role);
const SECTION_ORDER = ["Overview", "Daily work", "Reports", "Money", "Team", "Admin", "More"];
// No role (signed out, or not known yet) → no menu at all, never every item.
const allowed = (item, role) => !!role && (!item.allowedRoles || item.allowedRoles.includes(role));

/** The sidebar for a role: [{ section, items }], children filtered too. */
export function navFor(role) {
  const items = (isCompanyRole(role) ? sidebarItems.company : sidebarItems.branchUser)
    .filter((it) => allowed(it, role))
    .map((it) => (it.children ? { ...it, children: it.children.filter((c) => allowed(c, role)) } : it))
    .filter((it) => !it.children || it.children.length);
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
