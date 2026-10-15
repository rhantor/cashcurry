// Monthly totals: one summary per branch per month, computed by the same
// engine as every screen (buildLedger), so a dashboard can add up past months
// instead of downloading every record ever entered.
//
// Kept honest two ways:
//  - engineVersion: summaries made by older rules are not trusted (bump it
//    whenever lib/finance changes what a figure means — the goldens will say)
//  - counts: how many records each summary saw, by the same date field the
//    database is queried on (DATE_FIELD). A dashboard compares their sum with
//    a server-side count before relying on them; any mismatch → fall back to
//    the full download.
import { addMonths, format, lastDayOfMonth, parseISO } from "date-fns";
import { buildLedger } from "./ledger";
import { DATE_FIELD, dayKey, openingBalances } from "./rules";

/** Bump when the money rules change meaning (stored summaries become stale). */
export const ENGINE_VERSION = 1;

export const monthOf = (day) => (dayKey(day) || "").slice(0, 7);

export function monthBounds(month) {
  const first = parseISO(`${month}-01`);
  return { from: `${month}-01`, to: format(lastDayOfMonth(first), "yyyy-MM-dd") };
}

export const nextMonth = (month) => format(addMonths(parseISO(`${month}-01`), 1), "yyyy-MM");

// Records → which collection they came from, for counting. (The ledger calls
// cash withdrawals `withdrawals` and the branch loans collection `staffLoans`.)
const COUNTED = ["sales", "costs", "advances", "staffLoans", "deposits", "withdrawals", "salaries"];

/**
 * The summary document for one branch-month.
 * `records` may hold more than the month (e.g. the whole history); only the
 * month is summarised.
 */
export function summarizeMonth({ branchId, settings, records, month }) {
  const { from, to } = monthBounds(month);
  // carriedIn at zero: we want the month's own movements, not a balance.
  const l = buildLedger({ branchId, settings, records, from, to, carriedIn: { day: from, cash: 0, bank: 0 } });
  const t = l.totals;
  const counts = {};
  for (const col of COUNTED) {
    const field = DATE_FIELD[col];
    counts[col] = (records?.[col] || []).filter((r) => monthOf(r?.[field]) === month).length;
  }
  return {
    period: month,
    branchId,
    engineVersion: ENGINE_VERSION,
    cashChange: round(t.cashChange),
    bankChange: round(t.bankChange),
    totals: Object.fromEntries(Object.entries(t).filter(([, v]) => typeof v === "number").map(([k, v]) => [k, round(v)])),
    tenders: Object.fromEntries(Object.entries(t.tenders).map(([k, v]) => [k, round(v)])),
    counts,
  };
}

/**
 * The balance at the start of `month`, from the branch's opening balances and
 * the summaries of every earlier month.
 */
export function carriedInto(month, { settings, summaries }) {
  const opening = openingBalances(settings);
  let cash = opening.cash;
  let bank = opening.bank;
  for (const s of summaries || []) {
    if (s.period >= month) continue;
    cash += s.cashChange || 0;
    bank += s.bankChange || 0;
  }
  return { day: `${month}-01`, cash: round(cash), bank: round(bank) };
}

/**
 * Can these summaries stand in for every record dated before `month`?
 * `countsBefore` = server-side counts of each collection's records dated
 * before the month (same DATE_FIELD). True only when every summary was made
 * by the current engine and together they saw exactly that many records.
 */
export function summariesCover(month, { summaries, countsBefore }) {
  const earlier = (summaries || []).filter((s) => s.period < month);
  if (earlier.some((s) => s.engineVersion !== ENGINE_VERSION)) return false;
  for (const col of COUNTED) {
    const seen = earlier.reduce((n, s) => n + (s.counts?.[col] || 0), 0);
    if (seen !== (countsBefore?.[col] ?? NaN)) return false;
  }
  return true;
}

function round(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}
