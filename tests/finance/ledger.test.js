// The finance engine on its own (no React, no fakes).
import { describe, it, expect } from "vitest";
import { buildLedger } from "@/lib/finance/ledger";
import { dayKey, branchLoanMovements, branchTimeZone, loanActivityDay, tenderConfig } from "@/lib/finance/rules";
import { buildDemoCompany, KL, PJ } from "@/scripts/local/demo/demoCompany.mjs";

const demo = buildDemoCompany(new Date(2026, 9, 15, 10)); // Day 7 = 15 Oct 2026
const recordsOf = (branchId) => {
  const b = demo.dataset.branches.find((x) => x.id === branchId);
  return {
    settings: b.settings,
    records: {
      sales: b.cols.sales, costs: b.cols.costs, advances: b.cols.advances, staffLoans: b.cols.loans,
      deposits: b.cols.deposits, salaries: b.cols.salaries, withdrawals: b.cols.cashWithdrawals,
      loanActivities: demo.dataset.companyCols.loans,
    },
  };
};
const round = (v) => Math.round(v * 100) / 100;

describe("buildLedger on the demo company", () => {
  for (const branchId of [KL, PJ]) {
    it(`${branchId}: running cash and bank match the walkthrough every day`, () => {
      const l = buildLedger({ branchId, ...recordsOf(branchId), from: demo.days[1], to: demo.days[7] });
      expect(l.days.map((d) => d.date)).toEqual(Object.values(demo.days));
      l.days.forEach((d, i) => {
        const want = demo.expected[branchId].byDay[i + 1];
        expect({ day: i + 1, cash: round(d.runningCash), bank: round(d.runningBank) }).toEqual({ day: i + 1, ...want });
      });
      expect(round(l.closing.cash)).toBe(demo.expected[branchId].handInCash);
      expect(round(l.totals.totalSales)).toBe(demo.expected[branchId].totalSales);
    });
  }

  it("a period starting mid-week brings the earlier days forward", () => {
    const l = buildLedger({ branchId: KL, ...recordsOf(KL), from: demo.days[4], to: demo.days[7] });
    expect(l.broughtForward.cash).toBe(demo.expected[KL].byDay[3].cash);
    expect(l.broughtForward.bank).toBe(demo.expected[KL].byDay[3].bank);
    expect(l.closing.cash).toBe(demo.expected[KL].handInCash);
  });

  it("a loan between branches cancels out company-wide", () => {
    const kl = buildLedger({ branchId: KL, ...recordsOf(KL), from: demo.days[1], to: demo.days[7] });
    const pj = buildLedger({ branchId: PJ, ...recordsOf(PJ), from: demo.days[1], to: demo.days[7] });
    expect(kl.totals.loanCashDelta + pj.totals.loanCashDelta).toBe(0);
    expect(kl.closing.cash + pj.closing.cash).toBe(demo.expected.company.handInCash);
  });

  it("Grab is a sale but not yet in the bank", () => {
    const l = buildLedger({ branchId: KL, ...recordsOf(KL), from: demo.days[1], to: demo.days[7] });
    expect(l.totals.deliveryTotal).toBe(demo.expected[KL].grabNotYetReceived);
    expect(l.totals.deliveryUnbanked).toBe(demo.expected[KL].grabNotYetReceived);
  });
});

describe("rules", () => {
  // dayKey is the device's day by design; this checks it from Malaysia.
  it.skipIf(process.env.TZ !== "Asia/Kuala_Lumpur")("dayKey keeps business dates and puts timestamps on the local day", () => {
    expect(dayKey("2026-09-12")).toBe("2026-09-12");
    expect(dayKey("2026-09-11T17:30:00.000Z")).toBe("2026-09-12"); // 1:30am in KL
    expect(dayKey({ seconds: Date.UTC(2026, 8, 11, 17, 30) / 1000 })).toBe("2026-09-12");
    expect(dayKey(null)).toBeNull();
  });

  it("a loan with only a creation time lands on the branch's day, whatever the device's clock", () => {
    const loan = { type: "loan", amount: 50, fromBranchId: "B", toBranchId: "A", createdAt: { seconds: Date.UTC(2026, 0, 31, 17, 30) / 1000 } };
    expect(loanActivityDay(loan)).toBe("2026-02-01"); // 1:30am in KL — Malaysia until a zone is set
    expect(loanActivityDay(loan, branchTimeZone({ basic: { timeZone: "Asia/Dhaka" } }))).toBe("2026-01-31"); // 11:30pm in Dhaka
    expect(branchLoanMovements([loan], "A")[0].day).toBe("2026-02-01");
  });

  it("a repayment paid by transfer moves bank, not cash", () => {
    const [m] = branchLoanMovements(
      [{ type: "repayment", amount: 100, fromBranchId: "B", toBranchId: "A", paymentMethod: "online", date: "2026-09-01" }],
      "A"
    );
    expect(m).toMatchObject({ role: "lender", cashDelta: 0, bankDelta: 100 });
  });

  it("a branch with no payment types configured falls back to the defaults", () => {
    const t = tenderConfig({});
    expect(t.keys).toContain("cash");
    expect(t.isBanked("card")).toBe(true);
    expect(t.countsInTotal("promotion")).toBe(false);
  });
});

describe("money out that is not a cost (4.9)", () => {
  const settings = { financeSales: { openingBalance: 1000, openingBankBalance: 500, tenders: [{ key: "cash" }] } };
  const day = "2026-10-10";
  const run = (costs) => buildLedger({ branchId: "b", settings, records: { sales: [], costs, advances: [], staffLoans: [], deposits: [], salaries: [], withdrawals: [], loanActivities: [] }, from: day, to: day });
  it("still leaves the till or bank, but is counted apart so profit can leave it out", () => {
    const l = run([
      { date: day, amount: 100, category: "Food & ingredients", costKind: "expense", paidFromOffice: "front" },
      { date: day, amount: 300, category: "Owner drawings", costKind: "notCost", paidFromOffice: "front" },
      { date: day, amount: 50, category: "New Purchases/Assets", paidFromOffice: "back", paidMethod: "card" }, // old record: equipment — a cost
    ]);
    expect(l.totals.costCash).toBe(400);
    expect(l.totals.costBank).toBe(50);
    expect(l.totals.notCost).toBe(300);
    expect(l.closing.cash).toBe(600);
    expect(l.closing.bank).toBe(450);
  });
});

describe("pay-outs and their bills (4.10)", () => {
  const settings = { financeSales: { openingBalance: 1000, openingBankBalance: 0, tenders: [{ key: "cash" }] } };
  const run = (payouts, costs = []) =>
    buildLedger({ branchId: "b", settings, records: { sales: [], costs, advances: [], staffLoans: [], deposits: [], salaries: [], withdrawals: [], loanActivities: [], payouts }, from: "2026-10-10", to: "2026-10-12" });
  const out = { kind: "out", date: "2026-10-10", amount: 100, status: "open" };
  const settle = (status) => ({ kind: "settle", date: "2026-10-11", floatAmount: 100, billAmount: 82.5, status });
  const cashByDay = (l) => l.days.map((d) => round(d.runningCash));

  it("handing out takes it from the till at once", () => {
    const l = run([out]);
    expect(cashByDay(l)).toEqual([900, 900, 900]);
    expect(l.totals.payout).toBe(100);
  });
  it("the bill back returns the change that day; not a cost until approved", () => {
    const l = run([{ ...out, status: "billed" }, settle("pending")]);
    expect(cashByDay(l)).toEqual([900, 917.5, 917.5]);
    expect(l.totals.costCash).toBe(0);
    expect(round(l.totals.payout)).toBe(82.5);
  });
  it("approved: the cost carries the bill, the till ends the same, nothing counted twice", () => {
    const cost = { date: "2026-10-11", amount: 82.5, category: "Cooking gas", costKind: "expense", paidFromOffice: "front", meta: { type: "payout" } };
    const l = run([{ ...out, status: "billed" }, settle("approved")], [cost]);
    expect(cashByDay(l)).toEqual([900, 917.5, 917.5]);
    expect(l.totals.costCash).toBe(82.5);
    expect(l.totals.payout).toBe(0);
  });
  it("a bill bigger than the float: the till pays the rest", () => {
    const l = run([{ ...out, status: "billed" }, { ...settle("pending"), billAmount: 120 }]);
    expect(cashByDay(l)).toEqual([900, 880, 880]);
  });
});
