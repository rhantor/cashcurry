// utils/finance/loanAgg.js
// Shared loan aggregation logic used by LoanSummarySimple, Summary, and the exporter

const n = (v) => (typeof v === "string" ? parseFloat(v) || 0 : Number(v) || 0);

export const extractCounterpartyFromLoanLabel = (row = {}) => {
  if (row.counterparty) return String(row.counterparty).trim();
  const label = String(row.label || "").trim();
  if (!label) return "Unknown";
  const m1 = label.match(/\b(to|from)\s+([A-Za-z][\w .'-]{1,40})$/i);
  if (m1) return m1[2].trim();
  const m2 = label.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})$/);
  if (m2) return m2[1].trim();
  return "Unknown";
};

/**
 * Aggregate loans/repayments from:
 * - daily rows (type === 'daily') with loanGiven/loanReceived/repay* fields
 * - itemized rows (type === 'loan' or 'repayment')
 *
 * To avoid double counting, if itemized rows exist we ignore the daily rollups
 * unless opts.alwaysIncludeDaily === true.
 */
export const aggregateLoanMovements = (rows = [], opts = {}) => {
  const { alwaysIncludeDaily = false } = opts || {};

  const hasItemizedLoans = rows.some((r) => r?.type === "loan");
  const hasItemizedRepays = rows.some((r) => r?.type === "repayment");

  const useDailyLoans = alwaysIncludeDaily || !hasItemizedLoans;
  const useDailyRepays = alwaysIncludeDaily || !hasItemizedRepays;

  const agg = {
    loanGiven: 0, // we lent out
    loanReceived: 0, // we borrowed
    repayInCash: 0,
    repayOutCash: 0,
    repayInBank: 0,
    repayOutBank: 0,
    people: {}, // { name: { given, received, repayIn, repayOut } }
  };

  const bump = (name) => {
    if (!agg.people[name])
      agg.people[name] = { given: 0, received: 0, repayIn: 0, repayOut: 0 };
    return agg.people[name];
  };

  rows.forEach((r) => {
    if (r?.type === "daily") {
      if (useDailyLoans) {
        agg.loanGiven += n(r.loanGiven);
        agg.loanReceived += n(r.loanReceived);
      }
      if (useDailyRepays) {
        agg.repayInCash += n(r.repayCashIn);
        agg.repayOutCash += n(r.repayCashOut);
        agg.repayInBank += n(r.repayBankIn);
        agg.repayOutBank += n(r.repayBankOut);
      }
      return;
    }

    if (r?.type === "loan") {
      const who = extractCounterpartyFromLoanLabel(r);
      if (r.role === "lender") {
        agg.loanGiven += n(r.amount);
        bump(who).given += n(r.amount);
      } else if (r.role === "borrower") {
        agg.loanReceived += n(r.amount);
        bump(who).received += n(r.amount);
      }
      return;
    }

    if (r?.type === "repayment") {
      const who = extractCounterpartyFromLoanLabel(r);
      const amt = n(r.amount);
      const method = String(r.method || r.paymentMethod || "").toLowerCase();
      const isCash = method.includes("cash");

      if (r.role === "lender") {
        if (isCash) agg.repayInCash += amt;
        else agg.repayInBank += amt;
        bump(who).repayIn += amt;
      } else if (r.role === "borrower") {
        if (isCash) agg.repayOutCash += amt;
        else agg.repayOutBank += amt;
        bump(who).repayOut += amt;
      }
    }
  });

  agg.repayInAll = agg.repayInCash + agg.repayInBank;
  agg.repayOutAll = agg.repayOutCash + agg.repayOutBank;
  // Outstanding “owed to us” (we're lender) vs “we owe” (we're borrower)
  agg.outstandingAsLender = agg.loanGiven - agg.repayInAll;
  agg.outstandingAsBorrower = agg.loanReceived - agg.repayOutAll;

  agg.peopleRows = Object.entries(agg.people).map(([name, v]) => ({
    name,
    given: n(v.given),
    received: n(v.received),
    repaidToUs: n(v.repayIn),
    weRepaid: n(v.repayOut),
    outstandingAsLender: n(v.given) - n(v.repayIn),
    outstandingAsBorrower: n(v.received) - n(v.repayOut),
  }));

  return agg;
};
