// Fast path (monthly totals + this month's records) must equal the full
// download, figure for figure. Runs on the demo company always, and on the
// real backup when it is on this machine.
import { describe, it, expect } from "vitest";
import { buildLedger } from "@/lib/finance/ledger";
import { DATE_FIELD, dayKey } from "@/lib/finance/rules";
import { summarizeMonth, carriedInto, summariesCover, loanCountsByMonth, monthOf, monthBounds, ENGINE_VERSION } from "@/lib/finance/monthly";
import { buildDemoCompany } from "@/scripts/local/demo/demoCompany.mjs";
import { hasBackup, loadBackup, monthsCovered } from "./dataset";

const cents = (v) => Math.round((Number(v) || 0) * 100) / 100;
const KEYS = ["totalSales", "cashSales", "bankedSales", "costCash", "costBank", "salaryCash", "salaryBank", "advance", "staffLoanGiven", "deposit", "withdrawal", "loanCashDelta", "deliveryTotal"];

/** A branch's records in the ledger's shape. */
function branchRecords(dataset, b) {
  return {
    sales: b.cols.sales || [], costs: b.cols.costs || [], advances: b.cols.advances || [],
    staffLoans: b.cols.loans || [], deposits: b.cols.deposits || [], withdrawals: b.cols.cashWithdrawals || [],
    salaries: b.cols.salaries || [], payouts: b.cols.payouts || [],
    loanActivities: (dataset.companyCols.loans || []).filter((l) => l.status === "approved"),
  };
}

/** What the dashboard's queries fetch for a period starting in `month`. */
function fetchedFrom(records, month) {
  const day = `${month}-01`;
  const out = { loanActivities: records.loanActivities };
  for (const col of Object.keys(DATE_FIELD)) {
    const byDate = records[col].filter((r) => (dayKey(r?.[DATE_FIELD[col]]) || "") >= day);
    const byPaid = ["advances", "staffLoans"].includes(col)
      ? records[col].filter((r) => (dayKey(r?.paidOut?.date) || "") >= day)
      : [];
    out[col] = [...new Set([...byDate, ...byPaid])];
  }
  return out;
}

function compare(dataset, label, months) {
  for (const b of dataset.branches) {
    const records = branchRecords(dataset, b);
    const summaries = months.map((month) => summarizeMonth({ branchId: b.id, settings: b.settings, records, month }));

    for (const month of months) {
      const { from: first, to: last } = monthBounds(month);
      // a whole month, and a mid-month range (balance carried to the 1st, then days to `from`)
      for (const [from, to] of [[first, last], [`${month}-10`, `${month}-20`]]) {
        const full = buildLedger({ branchId: b.id, settings: b.settings, records, from, to });
        const fast = buildLedger({
          branchId: b.id, settings: b.settings, records: fetchedFrom(records, month), from, to,
          carriedIn: carriedInto(month, { settings: b.settings, summaries }),
        });
        const pick = (l) => ({
          cash: cents(l.closing.cash), bank: cents(l.closing.bank),
          broughtForward: cents(l.broughtForward.cash),
          ...Object.fromEntries(KEYS.map((k) => [k, cents(l.totals[k])])),
        });
        expect({ label, branch: b.id, from, to, ...pick(fast) }).toEqual({ label, branch: b.id, from, to, ...pick(full) });
      }
    }
  }
}

describe("monthly totals give the same answer as the full download", () => {
  it("demo company, every month", () => {
    const demo = buildDemoCompany(new Date(2026, 9, 15, 10));
    compare(demo.dataset, "demo", ["2026-09", "2026-10", "2026-11"]);
  });

  it.skipIf(!hasBackup())("real backup, every branch and month", () => {
    const data = loadBackup();
    compare(data, "backup", monthsCovered(data));
  });
});

describe("the safety check", () => {
  const demo = buildDemoCompany(new Date(2026, 9, 15, 10));
  const b = demo.dataset.branches[0];
  const records = branchRecords(demo.dataset, b);
  const months = ["2026-09", "2026-10"];
  const summaries = months.map((month) => summarizeMonth({ branchId: b.id, settings: b.settings, records, month }));
  const countsBefore = (month) => ({
    ...Object.fromEntries(Object.keys(DATE_FIELD).map((col) => [col, records[col].filter((r) => (monthOf(r[DATE_FIELD[col]]) || "9999") < month).length])),
    loanActivities: Object.entries(loanCountsByMonth(records.loanActivities, b.id, b.settings)).filter(([m]) => m < month).reduce((n, [, c]) => n + c, 0),
  });

  it("trusts complete, current summaries", () => {
    expect(summariesCover("2026-11", { summaries, countsBefore: countsBefore("2026-11") })).toBe(true);
  });

  it("refuses when a month's summary is missing (records it never saw)", () => {
    expect(summariesCover("2026-11", { summaries: summaries.filter((s) => s.period !== "2026-10"), countsBefore: countsBefore("2026-11") })).toBe(false);
  });

  it("refuses summaries made by older rules", () => {
    const old = summaries.map((s) => ({ ...s, engineVersion: ENGINE_VERSION - 1 }));
    expect(summariesCover("2026-11", { summaries: old, countsBefore: countsBefore("2026-11") })).toBe(false);
  });

  it("refuses when the server counts a record the summaries did not see", () => {
    const counts = countsBefore("2026-11");
    expect(summariesCover("2026-11", { summaries, countsBefore: { ...counts, costs: counts.costs + 1 } })).toBe(false);
  });

  it("refuses when a loan between branches is missing from the summaries", () => {
    const counts = countsBefore("2026-11");
    expect(summariesCover("2026-11", { summaries, countsBefore: { ...counts, loanActivities: counts.loanActivities + 1 } })).toBe(false);
  });
});
