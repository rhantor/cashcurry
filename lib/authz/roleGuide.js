// Settings → Roles (15 Nov 2026): the roles matrix in words, for people to
// read. Every row is a capability in lib/authz/permissions.js CAN; the screen
// ticks each role from can(), so it can never disagree with what the app does.

export const GUIDE_ROLES = ["owner", "superAdmin", "gm", "branchAdmin", "manager", "inCharge", "accountant", "supervisor", "cashier", "kiosk"];

export const ROLE_GUIDE = [
  {
    title: "Money",
    rows: [
      ["sales.enter", "Enter sales"],
      ["costs.enter", "Enter costs"],
      ["costs.approve", "Approve no-invoice costs and pay-out bills"],
      ["payouts.handOut", "Hand out pay-outs"],
      ["cashInHand.view", "See the till's cash"],
      ["cashBank.enter", "Cash to bank, bank to cash"],
      ["records.edit", "Fix a saved entry"],
      ["records.delete", "Delete a saved entry"],
    ],
  },
  {
    title: "Advances and pay",
    rows: [
      ["advances.request", "Ask for an advance or loan"],
      ["advances.approve", "Approve advances, loans and leave"],
      ["advances.payOut", "Hand over approved advances"],
      ["salaries.enter", "Enter salary payments"],
      ["payroll.view", "See payroll"],
      ["payroll.manage", "Run payroll"],
    ],
  },
  {
    title: "Reports",
    rows: [
      ["dashboard.company", "Company dashboard"],
      ["dashboard.branch", "Branch dashboard"],
      ["reports.view", "Reports and cash tracker"],
      ["audit.branch", "Branch audit log"],
    ],
  },
  {
    title: "Purchases",
    rows: [
      ["purchases.order", "Order guides, POs, receive goods"],
      ["purchases.approve", "Approve purchase orders"],
      ["purchases.billAdd", "Add a vendor bill"],
      ["purchases.bills", "Due bills and paying vendors"],
      ["inventory.count", "Count stock"],
      ["catalog.manage", "Vendors and items"],
    ],
  },
  {
    title: "People",
    rows: [
      ["staff.manage", "Staff records"],
      ["staff.pay", "Staff pay and bank details"],
      ["attendance.view", "Attendance log"],
      ["attendance.manage", "Fix punches"],
      ["kiosk.open", "Open the kiosk"],
    ],
  },
  {
    title: "Settings",
    rows: [
      ["branchSettings.manage", "Branch settings"],
      ["moneySettings.manage", "Money settings"],
      ["company.manage", "Users and branches"],
    ],
  },
];
