// A small, made-up company for local development and demos.
//
// Two branches, seven days ending today, round numbers. Every record is built
// from the EVENTS list below, and the guide's expected figures are computed
// from the same list with plain arithmetic — so the guide says what the app
// must show (tests/finance checks that it does).
//
// No real client data. Dates are relative to the day you seed.
import fs from "node:fs";
import path from "node:path";
import { addDays, format, startOfDay } from "date-fns";

export const COMPANY_ID = "demo-company";
export const KL = "demo-kl";
export const PJ = "demo-pj";

const BRANCHES = {
  // KL trades past midnight (day ends 05:00); PJ closes before midnight.
  [KL]: { name: "Demo Branch KL", code: "DKL", address: "1 Jalan Demo, Kuala Lumpur", openingCash: 1000, dayCutoffTime: "05:00" },
  [PJ]: { name: "Demo Branch PJ", code: "DPJ", address: "2 Jalan Contoh, Petaling Jaya", openingCash: 200, dayCutoffTime: "" },
};

const TENDERS = [
  { key: "cash", label: "Cash", order: 1, banked: false, includeInTotal: true, enabled: true, requireProof: false },
  { key: "card", label: "Card", order: 2, banked: true, includeInTotal: true, enabled: true, requireProof: false },
  { key: "qr", label: "QR", order: 3, banked: true, includeInTotal: true, enabled: true, requireProof: false },
  { key: "grab", label: "Grab", order: 4, banked: false, includeInTotal: true, enabled: true, requireProof: false, delivery: true },
];

// role, username, display name, branch
const USERS = [
  ["owner", "owner", "Demo Owner", null],
  ["gm", "gm", "Demo General Manager", null],
  ["branchAdmin", "kl_admin", "KL Branch Admin", KL],
  ["manager", "kl_manager", "KL Manager", KL],
  ["accountant", "kl_accountant", "KL Accountant", KL],
  ["supervisor", "kl_supervisor", "KL Supervisor", KL],
  ["cashier", "kl_cashier", "KL Cashier", KL],
  ["branchAdmin", "pj_admin", "PJ Branch Admin", PJ],
];

const STAFF = [
  { id: "staff-ali", branchId: KL, firstName: "Ali", lastName: "Hassan", department: "kitchen", basicSalary: "1800" },
  { id: "staff-siti", branchId: KL, firstName: "Siti", lastName: "Aminah", department: "front", basicSalary: "1200" },
  { id: "staff-kumar", branchId: KL, firstName: "Kumar", lastName: "Raj", department: "front", basicSalary: "1500" },
  { id: "staff-rahim", branchId: PJ, firstName: "Rahim", lastName: "Yusof", department: "kitchen", basicSalary: "1600" },
];

// Day 1 … Day 7 (Day 7 = the day you seed).
// sale: [cash, card, qr, grab]
const EVENTS = [
  { day: 1, branch: KL, sale: [500, 300, 150, 100] },
  { day: 1, branch: KL, cost: { amount: 120, from: "front", method: "cash", category: "Inventory", text: "Vegetables from the market" } },
  { day: 2, branch: KL, sale: [600, 350, 200, 0] },
  { day: 2, branch: KL, cost: { amount: 800, from: "back", method: "bank_transfer", category: "Rent", text: "Shop rent (part payment)" } },
  { day: 3, branch: KL, sale: [450, 250, 100, 150] },
  { day: 3, branch: KL, cost: { amount: 80, from: "front", method: "cash", category: "Utilities", text: "Gas cylinder" } },
  { day: 3, loan: { from: KL, to: PJ, amount: 500, text: "PJ is short of cash for a supplier" } },
  { day: 4, branch: KL, sale: [700, 400, 200, 100] },
  { day: 4, branch: KL, advance: { staff: "staff-ali", amount: 100, text: "Family need" } },
  { day: 5, branch: KL, sale: [550, 300, 150, 50] },
  { day: 5, branch: KL, cost: { amount: 200, from: "front", method: "cash", category: "Inventory", text: "Chicken" } },
  { day: 5, branch: KL, deposit: { amount: 1500, bank: "Maybank" } },
  { day: 6, branch: KL, sale: [800, 500, 250, 200] },
  { day: 6, branch: KL, cost: { amount: 300, from: "back", method: "online", category: "Inventory", text: "Meat supplier (online transfer)" } },
  { day: 6, repayment: { from: PJ, to: KL, amount: 200, method: "cash" } },
  { day: 7, branch: KL, sale: [650, 450, 200, 150] },
  { day: 7, branch: KL, withdrawal: { amount: 300, category: "Staff Salary", text: "Cash for Siti's salary" } },
  { day: 7, branch: KL, salary: { staff: "staff-siti", amount: 1200 } },
  // Open requests: no money has moved, so they change no figure below.
  { day: 7, branch: KL, request: { kind: "advance", staff: "staff-kumar", amount: 150, status: "pending", by: "kl_cashier", text: "Rent due" } },
  { day: 6, branch: KL, request: { kind: "staffLoan", staff: "staff-siti", amount: 600, months: 6, status: "approved", by: "kl_supervisor", approver: "kl_manager", text: "Family wedding" } },
  ...[1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, branch: PJ, sale: [200, 100, 0, 0] })),
  { day: 2, branch: PJ, cost: { amount: 50, from: "front", method: "cash", category: "Utilities", text: "Cleaning supplies" } },
];

const uid = (username) => `demo-${username.replace(/_/g, "-")}`;
const emailOf = (username) => `${username.replace(/_/g, ".")}@demo.test`;
const money = (n) => n.toFixed(2);

/**
 * Build the demo company for the 7 days ending `today`.
 * Returns { dataset, root, days, expected }:
 *   dataset  — same shape as tests/finance/dataset.js
 *   root     — top-level users / usernames / entitlements
 *   days     — Day n → "yyyy-MM-dd"
 *   expected — per-branch running cash/bank by day, computed by hand rules
 */
export function buildDemoCompany(today = new Date()) {
  const day1 = startOfDay(addDays(today, -6));
  const dateOf = (d) => format(addDays(day1, d - 1), "yyyy-MM-dd");
  // Times of day on the demo branches' clock (Malaysia), whatever this machine's zone.
  const at = (d, hour = 14) => new Date(Date.parse(`${dateOf(d)}T00:00:00+08:00`) + hour * 3600e3).toISOString();
  const days = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, dateOf(d)]));
  const createdAt = at(0, 9);

  const userByName = Object.fromEntries(USERS.map(([role, username, name, branchId]) => [username, { role, username, name, branchId }]));
  const by = (username) => {
    const u = userByName[username];
    return { uid: uid(username), username, email: emailOf(username), role: u.role, companyId: COMPANY_ID, branchId: u.branchId };
  };
  const adminOf = { [KL]: "kl_admin", [PJ]: "pj_admin" };
  const staffName = (id) => {
    const s = STAFF.find((x) => x.id === id);
    return `${s.firstName} ${s.lastName}`;
  };

  const cols = { [KL]: {}, [PJ]: {} };
  const push = (branchId, col, doc) => (cols[branchId][col] ||= []).push(doc);
  const loans = [];
  let n = 0;
  const id = (prefix) => `${prefix}-${String(++n).padStart(3, "0")}`;

  for (const e of EVENTS) {
    const date = dateOf(e.day);
    if (e.sale) {
      const [cash, card, qr, grab] = e.sale;
      push(e.branch, "sales", {
        id: id("sale"), date,
        cash: money(cash), card: money(card), qr: money(qr), grab: money(grab),
        notes: { cash: "", card: "", qr: "", grab: "" },
        total: cash + card + qr + grab,
        tenderMeta: TENDERS.map(({ key, label, order, banked, includeInTotal, requireProof }) => ({ key, label, order, banked, includeInTotal, requireProof })),
        createdBy: by(e.branch === KL ? "kl_supervisor" : "pj_admin"),
        createdAt: at(e.day, 23),
      });
    }
    if (e.cost) {
      const c = e.cost;
      push(e.branch, "costs", {
        id: id("cost"), date, amount: c.amount, category: c.category, description: c.text,
        paidFromOffice: c.from, paidMethod: c.method,
        isFrontOffice: c.from === "front", isBackOffice: c.from === "back",
        createdBy: by(adminOf[e.branch]), createdAt: at(e.day),
      });
    }
    if (e.advance) {
      const a = e.advance;
      const month = date.slice(0, 7);
      push(e.branch, "advances", {
        id: id("adv"), staffId: a.staff, staffName: staffName(a.staff), amount: a.amount,
        advanceType: "salary", reason: a.text, date, deductionMonth: month,
        paidFromOffice: "front", status: "approved",
        repaymentInstallments: 1, repaymentPerInstallment: a.amount, remainingAmount: a.amount, totalPaid: 0,
        installments: [{ month, paidAt: null, status: "pending", amount: a.amount, index: 1 }],
        companyId: COMPANY_ID, branchId: e.branch, createdBy: by(adminOf[e.branch]), createdAt: at(e.day),
      });
    }
    if (e.request) {
      const q = e.request;
      const month = date.slice(0, 7);
      const common = {
        staffId: q.staff, staffName: staffName(q.staff), amount: q.amount, reason: q.text, date,
        paidFromOffice: "front", status: q.status, paidOut: null,
        ...(q.approver ? { approvedBy: { id: uid(q.approver), name: q.approver, role: userByName[q.approver].role } } : {}),
        companyId: COMPANY_ID, branchId: e.branch, createdBy: by(q.by), createdAt: at(e.day, 12),
      };
      if (q.kind === "advance") {
        push(e.branch, "advances", {
          id: id("req"), ...common, advanceType: "salary", deductionMonth: month,
          repaymentInstallments: 1, repaymentPerInstallment: q.amount, remainingAmount: q.amount, totalPaid: 0,
          installments: [{ month, paidAt: null, status: "pending", amount: q.amount, index: 1 }],
        });
      } else {
        const per = Math.round((q.amount / q.months) * 100) / 100;
        push(e.branch, "loans", {
          id: id("req"), ...common, source: "new", durationMonths: q.months, repaymentStartDate: null,
          installments: Array.from({ length: q.months }, (_, i) => ({ index: i + 1, month, amount: per, status: "pending", paidAt: null })),
          remainingAmount: q.amount, totalPaid: 0,
        });
      }
    }
    if (e.deposit) {
      push(e.branch, "deposits", {
        id: id("dep"), date, amount: money(e.deposit.amount), bankName: e.deposit.bank, traceNo: `DEMO${e.day}`,
        createdBy: by(adminOf[e.branch]), createdAt: at(e.day, 16),
      });
    }
    if (e.withdrawal) {
      const w = e.withdrawal;
      push(e.branch, "cashWithdrawals", {
        id: id("wd"), date, amount: w.amount, category: w.category, method: "Online Transfer",
        reference: "", notes: w.text, month: date.slice(0, 7),
        createdBy: by(adminOf[e.branch]), createdAt: at(e.day, 11),
      });
    }
    if (e.salary) {
      const s = e.salary;
      const paid = addDays(day1, e.day - 1);
      const prev = format(new Date(paid.getFullYear(), paid.getMonth() - 1, 1), "yyyy-MM");
      push(e.branch, "salaries", {
        id: id("sal"), staffId: s.staff, paymentDate: date, paymentMonth: prev, month: prev,
        monthStart: `${prev}-01`, monthEnd: format(new Date(paid.getFullYear(), paid.getMonth(), 0), "yyyy-MM-dd"),
        paidFromOffice: "front", paidMethod: "cash", totalSalary: s.amount, amount: s.amount,
        notes: `${staffName(s.staff)} — last month's salary, paid in cash`,
        createdBy: by(adminOf[e.branch]), createdAt: at(e.day, 18),
      });
    }
    if (e.loan) {
      const l = e.loan;
      loans.push({
        id: "loan-001", type: "loan", status: "approved",
        requestFromBranchId: l.to, requestedToBranchId: l.from,
        requestFrom: BRANCHES[l.to].name, requestedTo: BRANCHES[l.from].name,
        amount: l.amount, originalAmount: l.amount, remainingAmount: l.amount, offsetApplied: 0, reason: l.text,
        createdBy: by(adminOf[l.to]), requestedBy: by(adminOf[l.to]),
        approvedBy: { id: uid(adminOf[l.from]), name: adminOf[l.from], role: "branchAdmin", timestamp: at(e.day, 15) },
        createdAt: at(e.day), updatedAt: at(e.day, 15),
      });
    }
    if (e.repayment) {
      const r = e.repayment;
      const loan = loans.find((l) => l.requestFromBranchId === r.from && l.requestedToBranchId === r.to);
      loan.remainingAmount -= r.amount;
      loans.push({
        id: "repay-001", type: "repayment", status: "approved", loanId: loan.id,
        fromBranchId: r.from, toBranchId: r.to, amount: r.amount, paymentMethod: r.method,
        note: "Part repayment", requestedBy: by(adminOf[r.from]), approvedBy: by(adminOf[r.to]),
        createdAt: at(e.day), updatedAt: at(e.day, 15),
      });
    }
  }

  for (const s of STAFF) {
    push(s.branchId, "staff", {
      id: s.id, firstName: s.firstName, lastName: s.lastName, role: "staff", department: s.department,
      employmentType: "full-time", basicSalary: s.basicSalary, allowance: "0", fixedSalaryNoAttendance: true,
      startDate: "2026-01-01", nationality: "malaysian", country: "Malaysia", phone: "",
      companyId: COMPANY_ID, branchId: s.branchId, createdAt,
    });
  }

  // Monthly totals, as the rollup Cloud Functions keep them.
  for (const branchId of [KL, PJ]) {
    const months = {};
    const add = (date, field, amount) => {
      const m = (months[date.slice(0, 7)] ||= { id: date.slice(0, 7), period: date.slice(0, 7), companyId: COMPANY_ID, branchId });
      m[field] = (m[field] || 0) + amount;
      m[field.replace(/^total/, "").replace(/^./, (c) => c.toLowerCase()) + "Count"] =
        (m[field.replace(/^total/, "").replace(/^./, (c) => c.toLowerCase()) + "Count"] || 0) + 1;
    };
    const c = cols[branchId];
    (c.sales || []).forEach((x) => add(x.date, "totalSales", x.total));
    (c.costs || []).forEach((x) => add(x.date, "totalCosts", x.amount));
    (c.deposits || []).forEach((x) => add(x.date, "totalDeposits", Number(x.amount)));
    (c.cashWithdrawals || []).forEach((x) => add(x.date, "totalWithdrawals", x.amount));
    (c.advances || []).forEach((x) => add(x.date, "totalAdvances", x.amount));
    (c.salaries || []).forEach((x) => add(x.paymentDate, "totalSalaries", x.totalSalary));
    c.summaries = Object.values(months);
  }

  const settings = (branchId) => ({
    id: "settings", companyId: COMPANY_ID, branchId, createdAt,
    basic: {
      name: BRANCHES[branchId].name, code: BRANCHES[branchId].code, companyName: "Demo Curry House Sdn Bhd",
      phone: "", email: "", address: { line1: BRANCHES[branchId].address, city: "", state: "", postcode: "", country: "Malaysia" },
      timeZone: "Asia/Kuala_Lumpur",
    },
    attendance: { dayCutoffTime: BRANCHES[branchId].dayCutoffTime },
    financeSales: {
      currency: "MYR", openingBalance: BRANCHES[branchId].openingCash, openingBankBalance: 0,
      tax: { type: "SST", rate: 0 }, serviceCharge: 0, tenders: TENDERS,
    },
    loansFinance: { allowInterBranchLoans: true, maxLoanLimit: 5000, salaryAdvanceLimitPercent: 30 },
    reporting: { defaultDashboardMode: "front", defaultSummaryFilter: "thisMonth", bankedVsCashRule: "standard" },
    payroll: { otMultiplier: 1.5, statutoryDeductions: [] },
    staffRoles: { allowedRoles: ["manager", "cashier", "accountant"] },
    other: { enabled: true, notes: "" },
  });

  const branches = [KL, PJ].map((branchId) => {
    const s = settings(branchId);
    cols[branchId].settings = [s];
    cols[branchId].admins = USERS.filter(([role, , , b]) => role === "branchAdmin" && b === branchId).map(([role, username, name]) => ({
      id: uid(username), role, userName: username, fullName: name, email: emailOf(username), branchId, createdAt,
    }));
    return {
      id: branchId,
      doc: { id: branchId, name: BRANCHES[branchId].name, code: BRANCHES[branchId].code, address: BRANCHES[branchId].address, contact: "", email: "", note: "Demo data" },
      settings: s,
      cols: cols[branchId],
    };
  });

  const users = USERS.map(([role, username, name, branchId]) => ({
    id: uid(username), companyId: COMPANY_ID, role, userName: username, name, fullName: name,
    email: emailOf(username), ...(branchId ? { branchId } : {}), createdAt,
  }));

  const dataset = {
    companyId: COMPANY_ID,
    company: { id: COMPANY_ID, name: "Demo Curry House Sdn Bhd", ownerUid: uid("owner"), ownerEmail: emailOf("owner"), ownerUserName: "owner", createdAt },
    companyCols: {
      loans,
      users: users.filter((u) => !u.branchId).map(({ id, role, userName, email, createdAt: c }) => ({ id, role, userName, email, createdAt: c })),
    },
    branches,
  };

  const root = {
    users,
    usernames: users.map((u) => ({ id: u.userName, uid: u.id, userName: u.userName, email: u.email, companyId: COMPANY_ID, ...(u.branchId ? { branchId: u.branchId } : {}) })),
    entitlements: { id: COMPANY_ID, plan: "demo", note: "Local demo company", features: { pos: true, finance: true, inventory: true, kds: true, v2_connection: true }, trialEndsAt: null },
  };

  return { dataset, root, days, expected: expectedFigures(), events: EVENTS, branchNames: Object.fromEntries(Object.entries(BRANCHES).map(([k, v]) => [k, v.name])) };
}

/**
 * What the app should show, worked out from EVENTS with the business rules
 * written as plainly as possible:
 *   cash: + cash sales, − front-office costs, − advances, − deposits,
 *         + withdrawals, − cash salaries, − loans given, + loans received,
 *         ± cash repayments
 *   bank: + card & QR sales, + deposits, − withdrawals, − back-office costs
 */
function expectedFigures() {
  const out = {};
  for (const branchId of [KL, PJ]) {
    let cash = BRANCHES[branchId].openingCash;
    let bank = 0;
    let sales = 0;
    let grab = 0;
    const byDay = {};
    for (let d = 1; d <= 7; d++) {
      for (const e of EVENTS.filter((x) => x.day === d)) {
        if (e.branch === branchId) {
          if (e.sale) { const [c, card, qr, g] = e.sale; cash += c; bank += card + qr; sales += c + card + qr + g; grab += g; }
          if (e.cost) e.cost.from === "front" ? (cash -= e.cost.amount) : (bank -= e.cost.amount);
          if (e.advance) cash -= e.advance.amount;
          if (e.deposit) { cash -= e.deposit.amount; bank += e.deposit.amount; }
          if (e.withdrawal) { cash += e.withdrawal.amount; bank -= e.withdrawal.amount; }
          if (e.salary) cash -= e.salary.amount;
        }
        if (e.loan) { if (e.loan.from === branchId) cash -= e.loan.amount; if (e.loan.to === branchId) cash += e.loan.amount; }
        if (e.repayment) { if (e.repayment.from === branchId) cash -= e.repayment.amount; if (e.repayment.to === branchId) cash += e.repayment.amount; }
      }
      byDay[d] = { cash, bank };
    }
    out[branchId] = { opening: BRANCHES[branchId].openingCash, byDay, handInCash: cash, bank, totalSales: sales, grabNotYetReceived: grab };
  }
  out.company = { handInCash: out[KL].handInCash + out[PJ].handInCash, bank: out[KL].bank + out[PJ].bank };
  return out;
}

/** Write the demo in the backup folder layout that scripts/local/seed.mjs reads. */
export function writeBackupFolder(demo, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  const w = (p, data) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
  };
  const { dataset, root } = demo;
  w(path.join(dir, "company", "company.json"), dataset.company);
  for (const [name, rows] of Object.entries(dataset.companyCols)) w(path.join(dir, "company", `${name}.json`), rows);
  w(path.join(dir, "company", "root_users.json"), root.users);
  w(path.join(dir, "company", "root_usernames.json"), root.usernames);
  w(path.join(dir, "company", "root_entitlements.json"), root.entitlements);
  for (const b of dataset.branches) {
    const base = path.join(dir, "branches", b.doc.name);
    w(path.join(base, "branch.json"), b.doc);
    for (const [name, rows] of Object.entries(b.cols)) w(path.join(base, "data", `${name}.json`), rows);
  }
}

/** A walkthrough of the demo, day by day, with the figures to expect. */
export function demoGuide(demo) {
  const { days, expected, events, branchNames } = demo;
  const rm = (v) => `RM ${v.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const sign = (v) => (v >= 0 ? `+${rm(v)}` : `−${rm(-v)}`);
  const lines = [];
  for (const branchId of [KL, PJ]) {
    lines.push(`## ${branchNames[branchId]}`, "", `Opening cash: **${rm(expected[branchId].opening)}** · opening bank: RM 0.00`, "");
    lines.push("| Day | Date | What happened | Cash | Bank | Cash in hand after |", "|---|---|---|---|---|---|");
    for (let d = 1; d <= 7; d++) {
      const rows = [];
      for (const e of events.filter((x) => x.day === d)) {
        if (e.branch === branchId && e.sale) {
          const [c, card, qr, g] = e.sale;
          rows.push([`Sales ${rm(c + card + qr + g)} (cash ${c}, card ${card}, QR ${qr}, Grab ${g})`, sign(c), card + qr ? sign(card + qr) : ""]);
        }
        if (e.branch === branchId && e.cost) {
          const front = e.cost.from === "front";
          rows.push([`Cost: ${e.cost.text} (${front ? "paid from the till" : `back office, ${e.cost.method.replace("_", " ")}`})`, front ? sign(-e.cost.amount) : "", front ? "" : sign(-e.cost.amount)]);
        }
        if (e.branch === branchId && e.advance) rows.push([`Salary advance to Ali (${e.advance.text})`, sign(-e.advance.amount), ""]);
        if (e.branch === branchId && e.deposit) rows.push([`Cash deposited at ${e.deposit.bank}`, sign(-e.deposit.amount), sign(e.deposit.amount)]);
        if (e.branch === branchId && e.withdrawal) rows.push([`Cash withdrawn from bank (${e.withdrawal.text})`, sign(e.withdrawal.amount), sign(-e.withdrawal.amount)]);
        if (e.branch === branchId && e.salary) rows.push(["Salary paid to Siti in cash", sign(-e.salary.amount), ""]);
        if (e.loan?.from === branchId) rows.push([`Loan given to ${branchNames[e.loan.to]} (cash)`, sign(-e.loan.amount), ""]);
        if (e.loan?.to === branchId) rows.push([`Loan received from ${branchNames[e.loan.from]} (cash)`, sign(e.loan.amount), ""]);
        if (e.repayment?.from === branchId) rows.push([`Loan repayment paid to ${branchNames[e.repayment.to]} (cash)`, sign(-e.repayment.amount), ""]);
        if (e.repayment?.to === branchId) rows.push([`Loan repayment received from ${branchNames[e.repayment.from]} (cash)`, sign(e.repayment.amount), ""]);
      }
      rows.forEach(([what, cash, bank], i) => {
        const last = i === rows.length - 1;
        lines.push(`| ${i === 0 ? d : ""} | ${i === 0 ? days[d] : ""} | ${what} | ${cash} | ${bank} | ${last ? `**${rm(expected[branchId].byDay[d].cash)}**` : ""} |`);
      });
    }
    const open = events.filter((e) => e.branch === branchId && e.request);
    if (open.length) {
      lines.push("", "**Open requests — no money has moved, so they are not in the figures:**", "");
      for (const e of open) {
        const q = e.request;
        lines.push(`- Day ${e.day}: ${q.kind === "advance" ? "advance" : `staff loan (${q.months} months)`} of ${rm(q.amount)} for ${q.staff.replace("staff-", "").replace(/^./, (c) => c.toUpperCase())} — ${q.status === "pending" ? "waiting for approval (Requested Panel)" : "approved, waiting to be paid (Mark paid)"}`);
      }
    }
    const x = expected[branchId];
    lines.push("", `**After 7 days:** cash in hand **${rm(x.handInCash)}**, bank **${rm(x.bank)}**, total sales **${rm(x.totalSales)}**` +
      (x.grabNotYetReceived ? `, Grab still to be paid out **${rm(x.grabNotYetReceived)}**` : "") + ".", "");
  }
  lines.push("## Whole company", "", `Cash in hand **${rm(expected.company.handInCash)}** (the loan between branches cancels out), bank **${rm(expected.company.bank)}**.`, "");
  return lines.join("\n");
}
