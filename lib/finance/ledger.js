// Cash book for one branch over a period: the balance brought forward, every
// day's movements, and the running cash-in-hand and bank balance.
//
// Pure function — no React, no Firestore. The summary report, both
// dashboards, the cash tracker and the yearly statement read their money
// figures from here, so they cannot disagree.
import { addDays, format, parseISO } from "date-fns";
import {
  num, dayKey, saleDay, costDay, advanceDay, staffLoanDay, depositDay, withdrawalDay, salaryDay,
  isCashCost, isSalaryCash, isMigratedStaffLoan, salaryAmount, paidOutOf,
  tenderConfig, openingBalances, branchLoanMovements,
} from "./rules";

/**
 * @param {object} p
 * @param {string} p.branchId
 * @param {object} [p.settings]       branch settings (payment types, opening balances)
 * @param {object} p.records          { sales, costs, advances, staffLoans, deposits,
 *                                      salaries, withdrawals, loanActivities } — all
 *                                      of the branch's records, any dates
 * @param {string|Date} p.from        first day of the period
 * @param {string|Date} p.to          last day of the period (inclusive)
 * @param {object} [p.carriedIn]       { day, cash, bank }: the balance before `day`
 *                                      is already known (from monthly totals), so
 *                                      records dated before `day` are not needed
 *                                      and are ignored. `day` must be ≤ `from`.
 */
export function buildLedger({ branchId, settings, records, from, to, carriedIn = null }) {
  const fromKey = dayKey(from);
  const toKey = dayKey(to);
  const tenders = tenderConfig(settings);
  const opening = openingBalances(settings);
  const r = records || {};

  // Every record, put on its day once.
  const byDay = new Map();
  const bucket = (day) => {
    let b = byDay.get(day);
    if (!b) {
      b = {
        sales: [], costs: [], deposits: [], salaries: [], withdrawals: [], loans: [],
        // advances and staff loans, on the day they were paid out, by where from
        advancesTill: [], advancesBank: [], staffLoansTill: [], staffLoansBank: [],
      };
      byDay.set(day, b);
    }
    return b;
  };
  const place = (list, dayOf, into, keep = () => true) => {
    for (const x of list || []) {
      if (!keep(x)) continue;
      const d = dayOf(x);
      if (d) bucket(d)[into].push(x);
    }
  };
  place(r.sales, saleDay, "sales");
  place(r.costs, costDay, "costs");
  // Advances and staff loans move money only once paid out (requested →
  // approved → paid); see paidOutOf.
  const placePaid = (list, legacyDay, till, bank, keep = () => true) => {
    for (const x of list || []) {
      if (!keep(x)) continue;
      const paid = paidOutOf(x, legacyDay);
      if (paid) bucket(paid.day)[paid.fromTill ? till : bank].push(x);
    }
  };
  placePaid(r.advances, advanceDay, "advancesTill", "advancesBank");
  placePaid(r.staffLoans, staffLoanDay, "staffLoansTill", "staffLoansBank", (l) => !isMigratedStaffLoan(l));
  place(r.deposits, depositDay, "deposits");
  place(r.salaries, salaryDay, "salaries");
  place(r.withdrawals, withdrawalDay, "withdrawals");
  for (const m of branchLoanMovements(r.loanActivities, branchId)) bucket(m.day).loans.push(m);

  // Opening balance: everything dated before the period.
  const carriedDay = carriedIn ? dayKey(carriedIn.day) : null;
  let cash = carriedIn ? carriedIn.cash : opening.cash;
  let bank = carriedIn ? carriedIn.bank : opening.bank;
  for (const [day, b] of byDay) {
    if (!fromKey || day >= fromKey) continue;
    if (carriedDay && day < carriedDay) continue; // already in carriedIn
    const f = dayFigures(b, tenders);
    cash += f.cashChange;
    bank += f.bankChange;
  }
  const broughtForward = { cash, bank };

  // The period, day by day.
  const days = [];
  const totals = emptyTotals(tenders);
  if (fromKey && toKey && fromKey <= toKey) {
    for (let d = parseISO(fromKey); format(d, "yyyy-MM-dd") <= toKey; d = addDays(d, 1)) {
      const date = format(d, "yyyy-MM-dd");
      const b = byDay.get(date) || bucket(date);
      const f = dayFigures(b, tenders);
      cash += f.cashChange;
      bank += f.bankChange;
      days.push({ date, ...f, records: b, runningCash: cash, runningBank: bank });
      addTotals(totals, f, tenders);
    }
  }

  const deliveryTotal = tenders.deliveryKeys.reduce((s, k) => s + num(totals.tenders[k]), 0);
  const deliveryUnbanked = tenders.deliveryKeys.reduce((s, k) => s + (tenders.isBanked(k) ? 0 : num(totals.tenders[k])), 0);

  return {
    branchId,
    from: fromKey,
    to: toKey,
    tenders,
    opening,
    broughtForward,
    days,
    totals: { ...totals, deliveryTotal, deliveryUnbanked, deliveryBanked: deliveryTotal - deliveryUnbanked },
    closing: { cash, bank },
  };
}

/** One day's money movements from its records. */
function dayFigures(b, tenders) {
  const tenderAmounts = Object.fromEntries(tenders.keys.map((k) => [k, b.sales.reduce((s, x) => s + num(x[k]), 0)]));
  const totalSales = tenders.keys.reduce((s, k) => s + (tenders.countsInTotal(k) ? tenderAmounts[k] : 0), 0);
  const bankedSales = tenders.keys.reduce((s, k) => s + (tenders.isBanked(k) ? tenderAmounts[k] : 0), 0);
  const cashSales = b.sales.reduce((s, x) => s + num(x.cash), 0);

  const costCash = b.costs.filter(isCashCost).reduce((s, x) => s + num(x.amount), 0);
  const costBank = b.costs.filter((c) => !isCashCost(c)).reduce((s, x) => s + num(x.amount), 0);
  const salaryCash = b.salaries.filter(isSalaryCash).reduce((s, x) => s + salaryAmount(x), 0);
  const salaryBank = b.salaries.filter((s) => !isSalaryCash(s)).reduce((s, x) => s + salaryAmount(x), 0);
  const total = (list) => list.reduce((s, x) => s + num(x.amount), 0);
  const advance = total(b.advancesTill);
  const advanceBank = total(b.advancesBank);
  const staffLoanGiven = total(b.staffLoansTill);
  const staffLoanBank = total(b.staffLoansBank);
  const deposit = b.deposits.reduce((s, x) => s + num(x.amount), 0);
  const withdrawal = b.withdrawals.reduce((s, x) => s + num(x.amount), 0);

  const loans = b.loans.filter((x) => x.type === "loan");
  const repays = b.loans.filter((x) => x.type === "repayment");
  const sum = (list, pred) => list.filter(pred).reduce((s, x) => s + x.amount, 0);
  const isCashRepay = (x) => x.cashDelta !== 0 || x.bankDelta === 0;
  const loanCashDelta = b.loans.reduce((s, x) => s + x.cashDelta, 0);
  const loanBankDelta = b.loans.reduce((s, x) => s + x.bankDelta, 0);

  return {
    tenders: tenderAmounts,
    totalSales,
    bankedSales,
    cashSales,
    costCash,
    costBank,
    salaryCash,
    salaryBank,
    advance,
    advanceBank,
    staffLoanGiven,
    staffLoanBank,
    deposit,
    withdrawal,
    loanGiven: sum(loans, (x) => x.role === "lender"),
    loanReceived: sum(loans, (x) => x.role === "borrower"),
    repayCashIn: sum(repays, (x) => x.role === "lender" && isCashRepay(x)),
    repayCashOut: sum(repays, (x) => x.role === "borrower" && isCashRepay(x)),
    repayBankIn: sum(repays, (x) => x.role === "lender" && !isCashRepay(x)),
    repayBankOut: sum(repays, (x) => x.role === "borrower" && !isCashRepay(x)),
    loanCashDelta,
    loanBankDelta,
    // Cash in hand: + cash sales − till costs − cash salaries − advances and
    // staff loans from the till − deposits + withdrawals ± loans in cash.
    cashChange: cashSales - costCash - salaryCash - advance - staffLoanGiven - deposit + withdrawal + loanCashDelta,
    // Bank: + banked payment types + deposits − withdrawals − back-office
    // costs − bank salaries − advances and staff loans paid by transfer
    // ± loan repayments by transfer.
    bankChange: bankedSales + deposit - withdrawal - costBank - salaryBank - advanceBank - staffLoanBank + loanBankDelta,
  };
}

const SUMMED = [
  "totalSales", "bankedSales", "cashSales", "costCash", "costBank", "salaryCash", "salaryBank",
  "advance", "advanceBank", "staffLoanGiven", "staffLoanBank", "deposit", "withdrawal", "loanGiven", "loanReceived",
  "repayCashIn", "repayCashOut", "repayBankIn", "repayBankOut", "loanCashDelta", "loanBankDelta",
  "cashChange", "bankChange",
];

function emptyTotals(tenders) {
  return { ...Object.fromEntries(SUMMED.map((k) => [k, 0])), tenders: Object.fromEntries(tenders.keys.map((k) => [k, 0])) };
}

function addTotals(t, f, tenders) {
  for (const k of SUMMED) t[k] += f[k];
  for (const k of tenders.keys) t.tenders[k] += f.tenders[k];
}
