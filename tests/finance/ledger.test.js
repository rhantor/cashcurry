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
