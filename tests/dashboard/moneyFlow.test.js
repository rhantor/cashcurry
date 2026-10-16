// The dashboard's "Where the money went" bridge must add up to the cards:
// cash steps from the start balance to cash in hand, bank steps to the
// period's bank change. If a money rule gains a term, this fails until the
// bridge shows it too.
import { describe, it, expect } from "vitest";
import { buildLedger } from "@/lib/finance/ledger";
import { bankSteps, cashSteps } from "@/app/components/dashboard/charts/MoneyFlow";
import { buildDemoCompany, KL, PJ } from "@/scripts/local/demo/demoCompany.mjs";

const demo = buildDemoCompany(new Date(2026, 9, 15, 10));
const ledgerOf = (branchId, from, to) => {
  const b = demo.dataset.branches.find((x) => x.id === branchId);
  return buildLedger({
    branchId,
    settings: b.settings,
    records: {
      sales: b.cols.sales, costs: b.cols.costs, advances: b.cols.advances, staffLoans: b.cols.loans,
      deposits: b.cols.deposits, salaries: b.cols.salaries, withdrawals: b.cols.cashWithdrawals,
      loanActivities: demo.dataset.companyCols.loans,
    },
    from,
    to,
  });
};
const sum = (list) => list.reduce((n, s) => n + s.value, 0);
const round = (v) => Math.round(v * 100) / 100;

describe("money flow bridge", () => {
  for (const branchId of [KL, PJ]) {
    for (const [from, to] of [[demo.days[1], demo.days[7]], [demo.days[4], demo.days[6]]]) {
      it(`${branchId} ${from}…${to}: steps add up to the cards`, () => {
        const l = ledgerOf(branchId, from, to);
        const flow = { broughtForward: l.broughtForward, totals: l.totals, closing: l.closing };

        const cash = cashSteps(flow);
        expect(round(cash.start.value + sum(cash.steps))).toBe(round(cash.end.value));
        expect(cash.end.value).toBe(l.closing.cash);

        const bank = bankSteps(flow);
        expect(round(sum(bank.steps))).toBe(round(bank.end.value));
        expect(bank.end.value).toBe(l.totals.bankChange);
      });
    }
  }
});
