// utils/dummyData.js (only the small fix below)
export const sidebarItems = {
  branchUser: [
    {
      label: 'Dashboard',
      icon: 'MdOutlineSpaceDashboard',
      path: '/dashboard',
      allowedRoles: ['accountant', 'manager', 'branchAdmin']
    }, // <-- fixed leading slash
    {
      label: 'Purchases',
      icon: 'MdShoppingCart',
      allowedRoles: ['manager', 'accountant', 'branchAdmin', 'supervisor'],
      children: [
        { label: 'Vendors', path: '/purchases/vendors', allowedRoles: ['manager', 'accountant', 'branchAdmin', 'supervisor'] },
        { label: 'Items Catalog', path: '/purchases/items', allowedRoles: ['manager', 'accountant', 'branchAdmin', 'supervisor'] },
        { label: 'Requisitions', path: '/purchases/requisitions', allowedRoles: ['manager', 'accountant', 'branchAdmin', 'supervisor'] },
        { label: 'New Bill', path: '/purchases/new-bill', allowedRoles: ['manager', 'accountant', 'branchAdmin', 'supervisor'] },
        { label: 'Due Bills', path: '/purchases/due-bills', allowedRoles: ['manager', 'accountant', 'branchAdmin'] },
        { label: 'Payments', path: '/purchases/payments', allowedRoles: ['manager', 'accountant', 'branchAdmin'] } // list of vendorPayments
      ]
    },
    {
      label: 'Entries',
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
      icon: 'MdOutlineRequestPage',
      path: '/requested-panel',
      allowedRoles: ['manager', 'branchAdmin']
    },
    {
      label: 'My Requested',
      icon: 'MdOutlineFactCheck',
      path: '/supervisor-panel',
      allowedRoles: ['supervisor']
    },
    /*
    {
      label: 'Feeds',
      icon: 'MdOutlineDynamicFeed',
      path: '/feeds',
      allowedRoles: ['manager', 'branchAdmin', 'accountant', 'supervisor']
    },
    */
    {
      label: 'Loans',
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
      icon: 'IoSettingsSharp',
      path: '/settings',
      allowedRoles: ['gm', 'owner']
    },
    {
      label: 'Audit Log',
      icon: 'MdOutlineManageSearch',
      path: '/branch-audit',
      allowedRoles: ['branchAdmin', 'manager']
    },
    {
      label: 'Branch Settings',
      icon: 'IoSettingsSharp',
      path: '/branch-settings',
      allowedRoles: ['branchAdmin', 'manager']
    },
    {
      label: 'Staff Management',
      icon: 'MdPeopleOutline',
      path: '/staff-management',
      allowedRoles: ['branchAdmin', 'manager']
    },
    {
      label: 'Payroll',
      icon: 'MdOutlinePayments',
      allowedRoles: ['branchAdmin', 'manager'],
      children: [
        { label: 'Run Payroll', path: '/payroll' },
        { label: 'Payroll History', path: '/payroll/history' }
      ]
    },

    /*
    {
      label: 'Work Media',
      icon: 'MdOutlineDynamicFeed',
      allowedRoles: ['branchAdmin', 'manager', 'supervisor'],
      children: [
        {
          label: 'Branch Chat',
          path: '/branch-chat',
          allowedRoles: ['branchAdmin', 'manager', 'supervisor']
        },
        {
          label: 'Attendance Kiosk',
          path: '/kiosk',
          allowedRoles: ['branchAdmin', 'manager']
        },
        {
          label: 'Attendance Log',
          path: '/attendance-log',
          allowedRoles: ['branchAdmin', 'manager', 'supervisor']
        }
      ]
    },
    */

    {
      label: 'Support',
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
      icon: 'MdOutlineSpaceDashboard',
      path: '/dashboard' // <-- fixed leading slash
    },
    {
      label: 'Company Dashboard',
      icon: 'MdOutlineSpaceDashboard',
      path: '/company/dashboard'
    },
    {
      label: 'Purchases',
      icon: 'MdShoppingCart',
      allowedRoles: ['gm', 'superAdmin', 'owner'],
      children: [
        { label: 'Vendors', path: '/purchases/vendors' },
        { label: 'Items Catalog', path: '/purchases/items' },
        { label: 'Requisitions', path: '/purchases/requisitions' },
        { label: 'New Bill', path: '/purchases/new-bill' },
        { label: 'Due Bills', path: '/purchases/due-bills' },
        { label: 'Payments', path: '/purchases/payments' } // list of vendorPayments
      ]
    },
    {
      label: 'Sales Report',
      icon: 'MdOutlineBarChart',
      path: '/reports/sales-report',
      allowedRoles: ['gm', 'superAdmin', 'owner']
    },
    {
      label: 'Cost Report',
      icon: 'MdOutlineAttachMoney',
      path: '/reports/cost-report',
      allowedRoles: ['gm', 'superAdmin', 'owner']
    },
    {
      label: 'Cash Deposit Report',
      icon: 'MdOutlineAccountBalanceWallet',
      path: '/reports/deposit-report',
      allowedRoles: ['gm', 'superAdmin', 'owner']
    },
    {
      label: 'Withdrawal Report',
      icon: 'MdOutlineMoneyOffCsred',
      path: '/reports/withdrawal-report',
      allowedRoles: ['gm', 'superAdmin', 'owner']
    },
    {
      label: 'Advance Report',
      icon: 'MdOutlineCalendarMonth',
      path: '/reports/advance-report',
      allowedRoles: ['gm', 'superAdmin', 'owner']
    },
    {
      label: 'Loans',
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
      icon: 'MdOutlineInsights',
      path: '/reports',
      allowedRoles: ['gm', 'superAdmin', 'owner']
    },
    {
      label: 'Yearly Summary',
      icon: 'MdOutlineCalendarToday',
      path: '/reports/yearly-summary',
      allowedRoles: ['gm', 'superAdmin', 'owner']
    },
    {
      label: 'Audit Log',
      icon: 'MdOutlineManageSearch',
      path: '/audit-log',
      allowedRoles: ['owner', 'gm', 'superAdmin']
    },
    {
      label: 'Settings',
      icon: 'IoSettingsSharp',
      path: '/settings',
      allowedRoles: ['gm', 'superAdmin', 'owner'],
      children: [
        { label: 'Branche Management', path: '/branches/branch-management' },
        { label: 'User Management', path: '/settings/user-management' }
      ]
    },
    /*
    {
      label: 'Work Media',
      icon: 'MdOutlineDynamicFeed',
      allowedRoles: ['gm', 'superAdmin', 'owner'],
      children: [
        { label: 'Branch Chat', path: '/branch-chat' },
        { label: 'Attendance Kiosk', path: '/kiosk' },
        { label: 'Attendance Log', path: '/attendance-log' }
      ]
    },
    */
    {
      label: 'Support',
      icon: 'MdOutlineSupportAgent',
      path: '/support'
    }
  ]
}
