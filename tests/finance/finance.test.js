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
import { format } from "date-fns";
import {
  summary, summaryForMonth, branchDashboard, companyDashboard, monthFilter,
  summaryDetail, branchCharts, companyCharts,
  branchDataSource,
} from "./run";

/** Compare with a recorded golden file, or record it under `test:golden:update`. */
function matchGolden(file, actual) {
  if (process.env.CC_UPDATE_GOLDEN === "1") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(actual, null, 2) + "\n");
    return;
  }
  if (!fs.existsSync(file)) {
    throw new Error(`No golden file at ${file}. Create it with \`npm run test:golden:update\`.`);
  }
  const golden = JSON.parse(fs.readFileSync(file, "utf8"));
  const changes = diffPaths(golden, actual);
  if (changes.length) {
    // Readable list of every figure that moved, plus the full actual output.
    const actualFile = file.replace(/\.json$/, ".actual.json");
    fs.writeFileSync(actualFile, JSON.stringify(actual, null, 2) + "\n");
    throw new Error(
      `${changes.length} recorded figure(s) changed (full output: ${path.basename(actualFile)}):\n` +
        changes.slice(0, 60).join("\n") +
        (changes.length > 60 ? `\n… and ${changes.length - 60} more` : "")
    );
  }
}

/** "branches › X › 2026-01 › summary › kpis › handInCash: 10 → 12" for each difference. */
function diffPaths(a, b, at = []) {
  if (Object.is(a, b)) return [];
  const isObj = (v) => v && typeof v === "object";
  if (!isObj(a) || !isObj(b)) return [`${at.join(" › ")}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].flatMap((k) => diffPaths(a[k], b[k], [...at, k]));
}
import { presetFilter } from "@/utils/dashboard/dateFilters";
import { buildDemoCompany, KL as DEMO_KL, PJ as DEMO_PJ } from "@/scripts/local/demo/demoCompany.mjs";
import { setLedgerMode, fetched } from "./fakeBackend";

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
vi.mock("@/lib/redux/api/payoutsApiSlice", rtk);
vi.mock("@/lib/redux/api/branchSettingsApiSlice", rtk);
vi.mock("@/lib/redux/api/branchApiSlice", rtk);
vi.mock("@/lib/redux/api/loanApiSlice", rtk);
vi.mock("@/lib/redux/api/authApiSlice", rtk);
vi.mock("@/lib/redux/api/summaryApiSlice", rtk);
vi.mock("@/lib/redux/api/recordQueries", async () => (await import("./fakeBackend")).since);
vi.mock("firebase/firestore", async () => (await import("./fakeBackend")).firestore);
vi.mock("@/lib/firebase", () => ({ db: {} }));
// The signed-in user, as the session would report it: an owner of the dataset's company.
vi.mock("@/lib/session", async () => {
  const fb = await import("./fakeBackend");
  return { getSessionUser: () => ({ uid: "test-owner", role: "owner", companyId: fb.currentCompanyId() }) };
});
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

  // The loan query used to return only the newest 100 records, so once a
  // company passed 100 loans/repayments the older ones fell out of cash.
  it("counts every loan between branches, not just the newest 100", async () => {
    const many = Array.from({ length: 150 }, (_, i) => ({
      id: `M${i}`, type: "loan", status: "approved", amount: 10,
      requestFromBranchId: "B", requestedToBranchId: "A",
      createdAt: new Date(2026, 8, 1, 12, 0, i).toISOString(), // all on 1 Sep
    }));
    const busy = { ...example, companyCols: { loans: [...example.companyCols.loans, ...many] } };
    // A lent 150 × RM 10 more than in the plain example.
    expect(summaryForMonth(busy, "A", "2026-09").handInCash).toBe(880 - 1500);
    expect(branchDashboard(busy, "A", monthFilter("2026-09")).handInCash).toBe(880 - 1500);
    expect((await companyDashboard(busy, monthFilter("2026-09"))).estCashOnHand).toBe(880 + 150);
  });

  // Roadmap 1.4 — an advance or staff loan moves money only when it has been
  // approved AND paid out, on the day it was paid, from where it was paid.
  describe("requested → approved → paid", () => {
    const withA = (extra) => ({
      ...example,
      branches: example.branches.map((b) =>
        b.id === "A" ? { ...b, cols: { ...b.cols, advances: [...b.cols.advances, ...(extra.advances || [])], loans: extra.loans || [] } } : b
      ),
    });
    const cashIn = (data, month = "2026-09") => summaryForMonth(data, "A", month);

    it("a request that is pending, rejected, or approved but not paid moves no money", () => {
      const data = withA({
        advances: [
          { id: "p", date: "2026-09-16", amount: 500, status: "pending", paidOut: null },
          { id: "r", date: "2026-09-16", amount: 500, status: "rejected" }, // older record, no paidOut field
          { id: "u", date: "2026-09-16", amount: 500, status: "approved", paidOut: null },
        ],
        loans: [{ id: "sl", date: "2026-09-16", amount: 900, status: "approved", paidOut: null }],
      });
      expect(cashIn(data).handInCash).toBe(880);
      expect(branchDashboard(data, "A", monthFilter("2026-09")).handInCash).toBe(880);
    });

    it("money moves on the day it is paid, not the day it was requested", () => {
      const data = withA({
        advances: [{ id: "x", date: "2026-08-20", amount: 300, status: "approved", paidOut: { date: "2026-09-17", from: "front" } }],
      });
      expect(cashIn(data, "2026-08").handInCash).toBe(1070); // August untouched
      expect(cashIn(data).handInCash).toBe(880 - 300);
    });

    it("paid from the bank reduces the bank, not the till", () => {
      const data = withA({
        advances: [{ id: "b", date: "2026-09-17", amount: 200, status: "approved", paidOut: { date: "2026-09-17", from: "back" } }],
        loans: [{ id: "sl", date: "2026-09-17", amount: 400, status: "approved", paidOut: { date: "2026-09-17", from: "back" } }],
      });
      const s = cashIn(data);
      expect(s.handInCash).toBe(880);
      expect(s.bankBalance).toBe(300 - 200 - 400);
    });

    it("a paid staff loan reduces cash like an advance", () => {
      const data = withA({ loans: [{ id: "sl", date: "2026-09-18", amount: 250, status: "approved", paidOut: { date: "2026-09-18", from: "front" } }] });
      expect(cashIn(data).handInCash).toBe(880 - 250);
    });

    it("a leave request is never money, even with an amount", () => {
      const data = withA({ advances: [{ id: "l", date: "2026-09-16", amount: 2, advanceType: "medical", status: "approved" }] });
      expect(cashIn(data).handInCash).toBe(880);
    });

    it("older records with no paid-out field keep counting on their own date when approved", () => {
      // The example's RM 40 advance is such a record — it is in the 880 above.
      const data = withA({ advances: [{ id: "old", date: "2026-09-16", amount: 60, status: "closed" }] });
      expect(cashIn(data).handInCash).toBe(880 - 60);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Demo company (npm run local:seed): the app must show exactly what the
// walkthrough in .local/DEMO_GUIDE.md promises, day by day.
// ─────────────────────────────────────────────────────────────────────────────
describe("demo company matches its walkthrough", () => {
  const demo = buildDemoCompany(new Date(2026, 9, 15, 10)); // Day 7 = 15 Oct 2026
  const { dataset, days, expected } = demo;

  for (const branchId of [DEMO_KL, DEMO_PJ]) {
    it(`${branchId}: summary cash in hand at the end of every day`, () => {
      for (let d = 1; d <= 7; d++) {
        const s = summary(dataset, branchId, { filterType: "range", dateRange: { from: days[1], to: days[d] } });
        expect({ day: d, cash: s.handInCash, bank: s.bankBalance })
          .toEqual({ day: d, cash: expected[branchId].byDay[d].cash, bank: expected[branchId].byDay[d].bank });
      }
    });

    it(`${branchId}: dashboard and summary for the whole week`, () => {
      const range = { filterType: "range", dateRange: { from: days[1], to: days[7] } };
      const s = summary(dataset, branchId, range);
      const dash = branchDashboard(dataset, branchId, presetFilter("week", new Date(2026, 9, 15, 10)));
      expect(s).toMatchObject({ handInCash: expected[branchId].handInCash, totalSales: expected[branchId].totalSales });
      expect(dash).toMatchObject({ handInCash: expected[branchId].handInCash, bankExpected: expected[branchId].bank, totalSales: expected[branchId].totalSales });
    });
  }

  it("company dashboard", async () => {
    const c = await companyDashboard(dataset, presetFilter("week", new Date(2026, 9, 15, 10)));
    expect(c).toMatchObject({ estCashOnHand: expected.company.handInCash, effectiveBankedAfterWithdrawals: expected.company.bank });
  });
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

    matchGolden(goldenFile, actual);
  });

  // Everything else those screens show: the summary report's day-by-day rows
  // and period totals (also what its PDF/Excel exports print), and the chart
  // series on both dashboards.
  it("matches the recorded report rows and chart data", async () => {
    const actual = { branches: {}, company_charts: {} };
    for (const b of data.branches) {
      const perMonth = {};
      for (const m of months) {
        perMonth[m] = {
          summary: summaryDetail(data, b.id, { filterType: "month", selectedMonth: m, dateRange: {} }),
          branch_charts: branchCharts(data, b.id, monthFilter(m)),
        };
      }
      actual.branches[nameOf(b)] = perMonth;
    }
    for (const m of months) actual.company_charts[m] = await companyCharts(data, monthFilter(m));

    matchGolden(goldenFile.replace(/\.json$/, ".detail.json"), actual);
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

  it("company cash and bank equal the sum of every branch's summary", async () => {
    const r2 = (v) => Math.round(v * 100) / 100;
    for (const m of months) {
      const branchSummaries = data.branches.map((b) => summaryForMonth(data, b.id, m));
      const company = await companyDashboard(data, monthFilter(m));
      expect({ month: m, cash: company.estCashOnHand, bank: company.effectiveBankedAfterWithdrawals }).toEqual({
        month: m,
        cash: r2(branchSummaries.reduce((s, x) => s + x.handInCash, 0)),
        bank: r2(branchSummaries.reduce((s, x) => s + x.bankBalance, 0)),
      });
    }
  });

  // Roadmap 1.1: "Last 7 / 30 Days" used to start at the current time of day,
  // which dropped the first day's cash from the dashboard (RM 3,295.95 for
  // the anchored branch on this date).
  describe.skipIf(!anchors?.last7DaysBug)("rolling presets match the summary for the same dates", () => {
    const presets = { week: 7, days30: 30 };
    for (const [preset, days] of Object.entries(presets)) {
      // Both the old filter shape (time of day kept) and the new one (presetFilter).
      it(`${preset}, filter as built by the dashboard`, () => {
        const { branchId, now: nowIso } = anchors.last7DaysBug;
        const now = new Date(nowIso);
        const firstDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
        const range = { from: format(firstDay, "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
        const sum = summary(data, branchId, { filterType: "range", dateRange: range });
        const timeOfDay = branchDashboard(data, branchId, { from: new Date(+now - (days - 1) * 864e5), to: now, preset });
        const fromPreset = branchDashboard(data, branchId, presetFilter(preset, now));
        expect(timeOfDay.handInCash).toBe(sum.handInCash);
        expect(fromPreset.handInCash).toBe(sum.handInCash);
      });
    }
  });
});

// Roadmap 2.3: the dashboards load earlier months as monthly summaries and
// only the period's months as records. Same figures and charts as the full
// download, for every branch, month and preset — with fewer records read.
describe("fast dashboards (monthly summaries) equal the full download", () => {
  const demo = buildDemoCompany(new Date(2026, 9, 15, 10));
  const sets = [["demo", demo.dataset, ["2026-10"]]];
  if (backupPresent) {
    const data = loadBackup();
    sets.push(["backup", data, monthsCovered(data)]);
  }
  const filtersFor = (month) => {
    const end = monthFilter(month).to;
    const day = new Date(end.getFullYear(), end.getMonth(), 20, 12);
    return [
      monthFilter(month),
      presetFilter("week", day),
      presetFilter("days30", day),
      { from: new Date(day.getFullYear(), day.getMonth() - 2, 10), to: day, preset: "custom" },
    ];
  };
  const both = async (fn) => {
    setLedgerMode("full");
    fetched.reset();
    const full = await fn();
    const fullReads = fetched.records;
    setLedgerMode("fast");
    fetched.reset();
    const fast = await fn();
    return { full, fast, fullReads, fastReads: fetched.records };
  };

  for (const [label, data, months] of sets) {
    it(`${label}: branch dashboards`, async () => {
      let fullReads = 0;
      let fastReads = 0;
      for (const b of data.branches) {
        for (const m of months) {
          for (const f of filtersFor(m)) {
            const r = await both(() => ({
              kpis: branchDashboard(data, b.id, f),
              charts: branchCharts(data, b.id, f),
            }));
            expect({ branch: b.id, from: f.from, ...r.fast }).toEqual({ branch: b.id, from: f.from, ...r.full });
            fullReads += r.fullReads;
            fastReads += r.fastReads;
          }
          expect(branchDataSource(data, b.id, monthFilter(m))).toBe("fast");
        }
      }
      if (label === "backup") expect(fastReads).toBeLessThan(fullReads);
    });

    it(`${label}: summary report (rows, totals and exports)`, async () => {
      for (const b of data.branches) {
        for (const m of months) {
          const range = { from: `${m}-10`, to: `${m}-20` };
          for (const fs of [{ filterType: "month", selectedMonth: m, dateRange: {} }, { filterType: "range", dateRange: range }]) {
            const r = await both(() => summaryDetail(data, b.id, fs));
            expect({ branch: b.id, ...fs, ...r.fast }).toEqual({ branch: b.id, ...fs, ...r.full });
          }
        }
      }
    });

    it(`${label}: company dashboard`, async () => {
      for (const m of months) {
        const r = await both(async () => ({
          kpis: await companyDashboard(data, monthFilter(m)),
          charts: await companyCharts(data, monthFilter(m)),
        }));
        expect({ month: m, ...r.fast }).toEqual({ month: m, ...r.full });
      }
    });
  }
});
