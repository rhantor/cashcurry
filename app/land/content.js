// The sales landing's words (7 Nov 2026): for restaurant owners who don't use
// Cash Curry yet. Kept apart from the page so it can move to its own site later.
// Every number in the pictures is made up (the Demo Curry House).

// How to reach us: set on Vercel, so no phone number sits in this public repo.
// WhatsApp in international form without "+" (e.g. 60123456789).
export const CONTACT = {
  whatsapp: (process.env.NEXT_PUBLIC_SALES_WHATSAPP || "").replace(/\D/g, ""),
  email: process.env.NEXT_PUBLIC_SALES_EMAIL || "",
};

export const DEMO_TEXT = "Hi, I'd like to see a demo of Cash Curry for my restaurant.";

export const FEATURES = [
  {
    id: "finance",
    kicker: "Finance & reports",
    title: "Know where every ringgit went, the same night.",
    body: "Sales, costs and cash are entered once, at the branch, and every report reads the same figures. No more end-of-month spreadsheet hunt.",
    points: [
      "Daily sales by cash, card, QR and delivery apps",
      "Cash in the drawer against what it should be, every day",
      "Cash to bank and bank to cash, so the bank balance adds up",
      "Bills and pay-outs with the receipt photo attached",
      "Approved by someone senior to the person who made it",
      "Sales, cost, purchase and salary reports; every branch on one dashboard",
    ],
  },
  {
    id: "payroll",
    kicker: "Payroll & staff",
    title: "Payroll from the hours they actually worked.",
    body: "Staff clock in at the kiosk with their own PIN. At month end the hours, overtime, advances and loan instalments are already there.",
    points: [
      "Attendance kiosk on any tablet, a 4-digit PIN each",
      "Monthly basic by the hour, fixed salary, or part-time hourly",
      "Advances and loans taken off in instalments, nothing forgotten",
      "Payslips as PDF, and an advance report with notes",
      "Salary changes from a chosen month, with the history kept",
      "Add a new hire in seconds; they send their IC and details on a link",
    ],
  },
  {
    id: "staff-app",
    kicker: "Staff app",
    title: "Your team asks, reports and checks in from their phone.",
    body: "An Android app and an iPhone home-screen app. Requests reach the right supervisor straight away, and nothing gets lost in a group chat.",
    points: [
      "Sign in with phone number and PIN; fingerprint on Android",
      "Leave, advance and loan requests with a clear yes or no",
      "Daily tasks and checklists, with a rota for days off",
      "Report a broken fridge with a photo; follow it to fixed",
      "Chat with the team and the office",
      "Their own pay, attendance and what they still owe",
    ],
  },
  {
    id: "purchases",
    kicker: "Purchases & orders",
    title: "Order the same way every week, pay what you received.",
    body: "Order guides for each supplier, purchase orders that turn into bills, and reminders before a warranty or a payment runs out.",
    points: [
      "Items catalog with units and the last price paid",
      "Order guides per supplier, so ordering takes a minute",
      "Purchase orders, received with the real price on the day",
      "Vendor bills and due bills, paid with the slip attached",
      "Warranty reminders for chillers, ovens and the rest",
    ],
  },
];

export const STEPS = [
  { n: "01", title: "We set you up", body: "Your company, branches, staff and suppliers go in with you, on a call or at the restaurant." },
  { n: "02", title: "The team signs in", body: "Managers on the web, staff on the app, the kiosk on a tablet by the door." },
  { n: "03", title: "Day one, real numbers", body: "The first day-end is entered that night, and the dashboard shows it." },
];

export const TRUST = [
  { title: "Your data stays yours", body: "Each company sees only its own branches. Staff see only their own pay." },
  { title: "Every change is logged", body: "Who entered, edited or approved what, and when, in the audit log." },
  { title: "Roles that fit a kitchen", body: "Owner, manager, cashier, supervisor, staff: each sees the screens for their job." },
  { title: "Many branches, one view", body: "Each branch keeps its own time zone, day cut-off and currency." },
];
