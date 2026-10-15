// Finance safety net.
//
// Runs the app's real money hooks — summary report (useSummaryReportLogic),
// branch dashboard (useBranchData), company dashboard (useCompanyData) — with
// Firebase replaced by in-memory data.
//
// 1. "cash rules": a small hand-made branch whose every figure is worked out
//    by hand below. Always runs.
// 2. "golden": the full company backup (../backup_saffron_empire, or
//    CC_BACKUP_DIR). Every branch × month must match the recorded figures in
//    __golden__/, the dashboards must agree with the summary report, and the
//    company total must equal the sum of the branches. Skipped if the backup
//    isn't on this machine.
//
// A golden mismatch means a change moved real money figures. Only update the
// goldens (`npm run test:golden:update`) when that change is intended and
// explained in the commit.
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasBackup, loadBackup, monthsCovered, backupDir } from "./dataset";
import { summary, summaryForMonth, branchDashboard, companyDashboard, monthFilter } from "./run";

// ── data layer → fakeBackend ────────────────────────────────────────────────
// (vi.mock calls are hoisted to the top of the file, so the factory is too.)
const { rtk } = vi.hoisted(() => ({ rtk: async () => (await import("./fakeBackend")).rtk }));
vi.mock("@/lib/redux/api/salesApiSlice", rtk);
vi.mock("@/lib/redux/api/costApiSlice", rtk);
vi.mock("@/lib/redux/api/AdvanceApiSlice", rtk);
vi.mock("@/lib/redux/api/staffLoanApiSlice", rtk);
vi.mock("@/lib/redux/api/depositApiSlice", rtk);
vi.mock("@/lib/redux/api/salaryApiSlice", rtk);
vi.mock("@/lib/redux/api/cashWithdrawApiSlice", rtk);
vi.mock("@/lib/redux/api/branchSettingsApiSlice", rtk);
vi.mock("@/lib/redux/api/branchApiSlice", rtk);
vi.mock("@/lib/redux/api/loanApiSlice", rtk);
vi.mock("@/lib/redux/api/authApiSlice", rtk);
vi.mock("firebase/firestore", async () => (await import("./fakeBackend")).firestore);
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/utils/export/exportSummary", () => ({ makeFilterText: () => "" }));
vi.mock("@/utils/useResolvedCompanyBranch", async () => {
  const fb = await import("./fakeBackend");
  return {
    default: () => ({
      ready: true,
      companyId: fb.currentCompanyId(),
      branchId: fb.currentBranchId(),
      isCompany: false,
      setActiveBranch: () => {},
    }),
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Cash rules on a hand-made example
// ─────────────────────────────────────────────────────────────────────────────
const TENDERS = [
  { key: "cash", label: "Cash", order: 1, banked: false, includeInTotal: true },
  { key: "card", label: "Card", order: 2, banked: true, includeInTotal: true },
  { key: "grab", label: "Grab", order: 3, banked: false, includeInTotal: true },
];
const sale = (id, date, cash, card, grab) => ({
  id, date, cash: String(cash), card: String(card), grab: String(grab),
  total: cash + card + grab, tenderMeta: TENDERS,
});

// Branch A (opening cash RM 1,000) lends to branch B. Everything in Sep 2026
// except one August sale, which only affects September's opening balance.
const example = {
  companyId: "co",
  company: { id: "co", name: "Example Sdn Bhd" },
  companyCols: {
    loans: [
      { id: "L1", type: "loan", status: "approved", amount: 250,
        requestFromBranchId: "B", requestedToBranchId: "A", createdAt: "2026-09-19T04:00:00.000Z" },
      { id: "R1", type: "repayment", status: "approved", amount: 100, paymentMethod: "cash",
        fromBranchId: "B", toBranchId: "A", date: "2026-09-20" },
    ],
  },
  branches: [
    {
      id: "A",
      doc: { id: "A", name: "Branch A" },
      settings: { id: "settings", financeSales: { openingBalance: 1000, tenders: TENDERS } },
      cols: {
        sales: [sale("s0", "2026-08-31", 70, 0, 0), sale("s1", "2026-09-10", 500, 300, 100)],
        costs: [
          { id: "c1", date: "2026-09-11", amount: 100, paidFromOffice: "front", paidMethod: "cash" },
          { id: "c2", date: "2026-09-12", amount: 50, paidFromOffice: "back", paidMethod: "bank_transfer" },
        ],
        // createdAt as real entries have it: the company dashboard dates
        // salaries by createdAt, the summary by paymentDate (roadmap 1.2).
        salaries: [
          { id: "p1", paymentDate: "2026-09-15", createdAt: "2026-09-15T06:00:00.000Z", totalSalary: 200, amount: 200, paidFromOffice: "front" },
          { id: "p2", paymentDate: "2026-09-15", createdAt: "2026-09-15T06:00:00.000Z", totalSalary: 150, amount: 150, payMethod: "bank" },
        ],
        advances: [{ id: "a1", date: "2026-09-16", amount: 40, status: "approved" }],
        deposits: [{ id: "d1", date: "2026-09-17", amount: 300 }],
        cashWithdrawals: [{ id: "w1", date: "2026-09-18", amount: 100 }],
      },
    },
    {
      id: "B",
      doc: { id: "B", name: "Branch B" },
      settings: { id: "settings", financeSales: { openingBalance: 0, tenders: TENDERS } },
      cols: {},
    },
  ],
};

describe("cash rules (hand-made example)", () => {
  // Hand in cash for A, September:
  //   1,000 opening + 70 August cash sale          = 1,070 brought forward
  //   + 500 cash sales                             (card and Grab never touch the till)
  //   − 100 front-office cost                      (back-office cost is paid from bank)
  //   − 200 cash salary                            (bank salary doesn't touch the till)
  //   −  40 advance
  //   − 300 deposited to bank
  //   + 100 withdrawn from bank
  //   − 250 lent to branch B
  //   + 100 repayment received in cash
  //   = 880
  // Bank for A: + 300 card + 300 deposit − 100 withdrawal − 50 back cost − 150 bank salary = 300
  // Net total = 880 cash + 300 bank + 100 Grab not yet received = 1,280
  it("summary report", () => {
    const s = summaryForMonth(example, "A", "2026-09");
    expect(s).toMatchObject({
      handInCash: 880,
      bankBalance: 300,
      netTotal: 1280,
      totalSales: 900,
      totalCashSales: 500,
      totalBankedSales: 300,
      foodDelivery: 100,
      totalCostFront: 100,
      totalCostBack: 50,
      totalAdvances: 40,
      totalLoanGiven: 250,
      periodDeposits: 300,
      periodWithdrawals: 100,
    });
  });

  it("borrowing branch: +250 loan received − 100 cash repayment = 150", () => {
    expect(summaryForMonth(example, "B", "2026-09").handInCash).toBe(150);
  });

  it("branch dashboard agrees with the summary report", () => {
    const d = branchDashboard(example, "A", monthFilter("2026-09"));
    expect(d).toMatchObject({ handInCash: 880, bankExpected: 300, totalSales: 900, totalCostsFront: 100, totalCostsBack: 50 });
  });

  it("company dashboard = sum of branches (loans between branches cancel out)", async () => {
    const c = await companyDashboard(example, monthFilter("2026-09"));
    expect(c.estCashOnHand).toBe(880 + 150);
    expect(c.effectiveBankedAfterWithdrawals).toBe(300);
  });

  // Roadmap 1.4 — money should move only when a request is approved AND paid.
  it.todo("a pending or rejected advance does not reduce hand in cash");
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Golden figures from the company backup
// ─────────────────────────────────────────────────────────────────────────────
const backupPresent = hasBackup();

describe.skipIf(!backupPresent)(`golden figures (${backupDir()})`, () => {
  const data = backupPresent ? loadBackup() : null;
  const months = backupPresent ? monthsCovered(data) : [];
  const nameOf = (b) => (b.doc.name || b.id).trim();
  // Real client figures: kept in the git-ignored __golden__ folder, never in
  // this (public) file.
  const goldenDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "__golden__");
  const goldenFile = path.join(goldenDir, `${data?.companyId}.json`);
  // Hand-verified figures, maintained by hand — `test:golden:update` never
  // rewrites them, so regenerating goldens cannot quietly change them.
  const anchorsFile = path.join(goldenDir, `${data?.companyId}.anchors.json`);
  const anchors = backupPresent && fs.existsSync(anchorsFile) ? JSON.parse(fs.readFileSync(anchorsFile, "utf8")) : null;

  it("matches the recorded golden figures for every branch and month", async () => {
    const actual = { company: data.company.name, months, branches: {}, company_dashboard: {} };
    for (const b of data.branches) {
      const perMonth = {};
      for (const m of months) {
        perMonth[m] = {
          summary: summaryForMonth(data, b.id, m),
          branch_dashboard: branchDashboard(data, b.id, monthFilter(m)),
        };
      }
      actual.branches[nameOf(b)] = perMonth;
    }
    for (const m of months) actual.company_dashboard[m] = await companyDashboard(data, monthFilter(m));

    if (process.env.CC_UPDATE_GOLDEN === "1") {
      fs.mkdirSync(path.dirname(goldenFile), { recursive: true });
      fs.writeFileSync(goldenFile, JSON.stringify(actual, null, 2) + "\n");
      return;
    }
    if (!fs.existsSync(goldenFile)) {
      throw new Error(`No golden file at ${goldenFile}. Create it with \`npm run test:golden:update\`.`);
    }
    expect(actual).toEqual(JSON.parse(fs.readFileSync(goldenFile, "utf8")));
  });

  it.skipIf(!anchors)("anchors: hand-verified figures", async () => {
    for (const { branchId, month, handInCash } of anchors.branchCash) {
      expect({ branchId, month, handInCash: summaryForMonth(data, branchId, month).handInCash })
        .toEqual({ branchId, month, handInCash });
    }
    for (const [month, cash] of Object.entries(anchors.companyCashEndOf)) {
      expect({ month, cash: (await companyDashboard(data, monthFilter(month))).estCashOnHand })
        .toEqual({ month, cash });
    }
  });

  it("branch dashboard 'This Month' equals the summary report, every branch and month", () => {
    for (const b of data.branches) {
      for (const m of months) {
        const s = summaryForMonth(data, b.id, m);
        const d = branchDashboard(data, b.id, monthFilter(m));
        expect({ branch: nameOf(b), month: m, handInCash: d.handInCash })
          .toEqual({ branch: nameOf(b), month: m, handInCash: s.handInCash });
      }
    }
  });

  it("company cash on hand equals the sum of every branch's summary", async () => {
    for (const m of months) {
      const total = data.branches.reduce((sum, b) => sum + summaryForMonth(data, b.id, m).handInCash, 0);
      const company = await companyDashboard(data, monthFilter(m));
      expect({ month: m, cash: company.estCashOnHand }).toEqual({ month: m, cash: Math.round(total * 100) / 100 });
    }
  });

  // KNOWN BUG — roadmap 1.1. "Last 7 Days" starts the range at the current
  // time of day, so the first day's cash drops out of the dashboard. Remove
  // `.fails` when 1.1 is fixed.
  it.skipIf(!anchors?.last7DaysBug).fails("branch dashboard 'Last 7 Days' equals the summary for the same dates", () => {
    const { branchId, now: nowIso, from, to } = anchors.last7DaysBug;
    const now = new Date(nowIso); // local time, as Filters.jsx builds the preset
    const dash = branchDashboard(data, branchId, { from: new Date(+now - 6 * 864e5), to: now, preset: "week" });
    const sum = summary(data, branchId, { filterType: "range", dateRange: { from, to } });
    expect(dash.handInCash).toBe(sum.handInCash);
  });
});
