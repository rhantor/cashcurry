/* eslint-disable no-useless-escape */
import { format, parseISO, startOfWeek, endOfWeek, subDays } from "date-fns";

/**
 * Summary math & helpers
 * - Pure functions with explicit inputs
 * - Deterministic date math using yyyy-MM-dd strings for comparisons
 * - Mirrors your original logic 1:1 (cash/bank rules, loans/repayments)
 */

/** ----------------------------- tiny helpers ----------------------------- */
const N = (v) => (v ? Number(v) : 0);

const tsToMs = (v) => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (v?.seconds) return v.seconds * 1000; // Firestore TS
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? 0 : ms;
};

const asYmd = (dLike) => {
  const d = typeof dLike === "string" ? parseISO(dLike) : dLike;
  return format(d, "yyyy-MM-dd");
};

const safeParseMs = (v) => {
  const ms = typeof v === "string" ? Date.parse(v) : tsToMs(v);
  return Number.isNaN(ms) ? Date.now() : ms;
};

/** salary */
const pickSalaryDate = (s) => {
  const prefer =
    s.paymentDate ||
    s.date ||
    s.payDate ||
    s.createdAt ||
    s.monthEnd ||
    s.month;
  return asYmd(new Date(safeParseMs(prefer)));
};
const getSalaryAmount = (s) =>
  N(s.totalSalary ?? s.amount ?? s.total ?? s.total_amount ?? 0);

/** withdrawals */
const pickWithdrawDate = (w) => {
  const prefer = w.date || w.withdrawDate || w.createdAt;
  return asYmd(new Date(safeParseMs(prefer)));
};
const getWithdrawAmount = (w) => N(w.amount);

/** loan/repay */
const isCashMethod = (m) => {
  const x = String(m || "")
    .trim()
    .toLowerCase();
  if (!x) return true;
  return /(cash|hand\s*cash|cash-in-hand|voucher|petty)/i.test(x);
};
const pickActivityDate = (e) => {
  const prefer =
    e.payDate || e.paymentDate || e.repayDate || e.loanDate || e.date;
  const msPref = Date.parse(prefer || "");
  if (!Number.isNaN(msPref)) return format(new Date(msPref), "yyyy-MM-dd");
  const ms =
    tsToMs(e.createdAt) || tsToMs(e.updatedAt) || Date.parse(e.date || "");
  return format(new Date(ms || Date.now()), "yyyy-MM-dd");
};

/** costs */
const isCashCost = (c) => {
  const office = String(c?.paidFromOffice || "").toLowerCase();
  const method = String(c?.paidMethod || c?.method || "").toLowerCase();
  return office === "front" || method === "cash";
};
const isBankCost = (c) => !isCashCost(c);

/** advances — default to cash (front) for backward compatibility */
const isAdvanceCash = (a) =>
  String(a?.paidFromOffice || "front").toLowerCase() !== "back";

/** ----------------------------- tenders ----------------------------- */
export const deriveTenders = (settings) => {
  const list = settings?.financeSales?.tenders || [];
  const tenderDefs = list
    .filter((t) => t.enabled !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const tenderKeys = tenderDefs.map((t) => t.key);
  const tenderByKey = new Map(tenderDefs.map((t) => [t.key, t]));
  const isBankedTender = (key) => !!tenderByKey.get(key)?.banked;
  const includeInTotal = (key) =>
    tenderByKey.get(key)?.includeInTotal !== false;

  // Delivery set: explicit `delivery` flags else fallback to {grab, foodpanda}
  const deliveryKeys = (() => {
    const explicit = tenderDefs.filter((t) => t.delivery).map((t) => t.key);
    if (explicit.length) return explicit;
    const fallback = ["grab", "foodpanda"].filter((k) => tenderByKey.has(k));
    return fallback;
  })();

  return {
    tenderDefs,
    tenderKeys,
    tenderByKey,
    isBankedTender,
    includeInTotal,
    deliveryKeys,
  };
};

/** ----------------------------- date range & badge ----------------------------- */
export const makeFilterText = (
  filterType,
  dateRange = {},
  selectedMonth = ""
) => {
  const ddmmyyyy = (d) => {
    const dt = d instanceof Date ? d : new Date(d);
    return format(dt, "dd/MM/yyyy");
  };
  switch (filterType) {
    case "last7days":
      return "Last 7 Days";
    case "thisMonth":
    case "monthly":
      return "This Month";
    case "lastMonth":
      return "Last Month";
    case "weekly":
      return "This Week";
    case "range":
      return dateRange?.from && dateRange?.to
        ? `${ddmmyyyy(dateRange.from)} - ${ddmmyyyy(dateRange.to)}`
        : "Custom Range";
    case "month": {
      if (!selectedMonth) return "By Month";
      const [y, m] = selectedMonth.split("-").map(Number);
      if (!y || !m) return "By Month";
      return format(new Date(y, m - 1, 1), "MMMM yyyy");
    }
    default:
      return "All Data";
  }
};

/**
 * @returns {{ from: Date, to: Date, badge: string }}
 */
export const resolveDateRange = (filterState, datasets) => {
  const {
    sales = [],
    costs = [],
    advances = [],
    deposits = [],
    salaries = [],
    withdrawals = [],
    normalized = [],
  } = datasets || {};
  const today = new Date();

  const parseYyyyMm = (ym) => {
    const [y, m] = (ym || "").split("-").map(Number);
    if (!y || !m) return null;
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    return { from: first, to: last };
  };

  let from = subDays(today, 6);
  let to = today;

  switch (filterState.filterType) {
    case "all": {
      const dates = [];
      sales.forEach((s) => s?.date && dates.push(s.date));
      costs.forEach((c) => c?.date && dates.push(c.date));
      advances.forEach((a) => a?.date && dates.push(a.date));
      deposits.forEach((d) => d?.date && dates.push(d.date));
      (salaries || []).forEach((s) => dates.push(pickSalaryDate(s)));
      (withdrawals || []).forEach((w) => dates.push(pickWithdrawDate(w)));
      normalized.forEach((x) => x?.dateStr && dates.push(x.dateStr));
      if (dates.length) {
        dates.sort();
        from = parseISO(dates[0]);
        to = parseISO(dates[dates.length - 1]);
      }
      break;
    }
    case "weekly": {
      from = startOfWeek(today, { weekStartsOn: 1 });
      to = endOfWeek(today, { weekStartsOn: 1 });
      break;
    }
    case "monthly":
    case "thisMonth": {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = today;
      break;
    }
    case "lastMonth": {
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      to = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    }
    case "month": {
      const picked = parseYyyyMm(filterState.selectedMonth);
      if (picked) ({ from, to } = picked);
      break;
    }
    case "range": {
      from = filterState.dateRange.from
        ? parseISO(filterState.dateRange.from)
        : from;
      to = filterState.dateRange.to ? parseISO(filterState.dateRange.to) : to;
      break;
    }
    case "last7days":
    default:
      from = subDays(today, 6);
      to = today;
  }

  return {
    from,
    to,
    badge: makeFilterText(
      filterState.filterType,
      { from, to },
      filterState.selectedMonth
    ),
  };
};

/** ----------------------------- normalize loans/repay ----------------------------- */
const normalizeLoanActivities = (loanActs, branchId) =>
  (loanActs || [])
    .map((e) => {
      const typ = String(e.type || "").toLowerCase(); // "loan" | "repayment"
      const from = e._fromBranchId ?? e.fromBranchId ?? e.requestFromBranchId;
      const to = e._toBranchId ?? e.toBranchId ?? e.requestedToBranchId;
      const rawMethod = String(e.paymentMethod || e.method || "").toLowerCase();
      const dateStr = pickActivityDate(e);

      let role;
      if (to === branchId) role = "lender";
      else if (from === branchId) role = "borrower";

      let cashDelta = 0;
      let bankDelta = 0;
      const amt = N(e.amount);

      if (typ === "loan") {
        // Loan is always cash (by your convention)
        if (role === "lender") cashDelta -= amt;
        else if (role === "borrower") cashDelta += amt;
      } else if (typ === "repayment") {
        const cash = isCashMethod(rawMethod);
        if (role === "lender") {
          if (cash) cashDelta += amt;
          else bankDelta += amt;
        } else if (role === "borrower") {
          if (cash) cashDelta -= amt;
          else bankDelta -= amt;
        }
      }

      return {
        id: e.id,
        type: typ,
        amount: amt,
        paymentMethod: typ === "loan" ? "cash (forced)" : rawMethod || "-",
        fromBranchId: from,
        toBranchId: to,
        dateStr,
        role,
        cashDelta,
        bankDelta,
      };
    })
    .filter((x) => x.role && x.dateStr);

/** ----------------------------- notes helpers ----------------------------- */
const extractSalesNotes = (sale, keys) => {
  const out = {};
  if (sale?.notes && typeof sale.notes === "object") {
    keys.forEach((k) => {
      const v = sale.notes[k];
      if (v && String(v).trim()) (out[k] ||= []).push(String(v).trim());
    });
  }
  keys.forEach((k) => {
    const v = sale?.[`${k}Note`];
    if (v && String(v).trim()) (out[k] ||= []).push(String(v).trim());
  });
  return out;
};
const mergeNotes = (acc, next) => {
  const out = { ...acc };
  Object.entries(next || {}).forEach(([k, arr]) => {
    if (!arr?.length) return;
    out[k] = [...(out[k] || []), ...arr];
  });
  return out;
};

/** ----------------------------- core compute ----------------------------- */
/**
 * @param {Object} input structured inputs
 * @returns {{ rows: any[], kpis: any, periodTotals: Record<string, number>, periodTotalSales:number, periodDeposits:number, periodWithdrawals:number, periodRepaySums:any, tenderDefs:any[] }}
 */
export function computeSummary(input) {
  const {
    settings,
    branchId,
    getBranchName, // (id) => name
    filterState,
    sales = [],
    costs = [],
    advances = [],
    deposits = [],
    salaries = [],
    withdrawals = [],
    loanActs = [],
  } = input;

  // Tenders & flags
  const {
    tenderDefs,
    tenderKeys,
    tenderByKey,
    isBankedTender,
    includeInTotal,
    deliveryKeys,
  } = deriveTenders(settings);

  // Normalize loan/repay
  const normalized = normalizeLoanActivities(loanActs, branchId);

  // Date range + badge
  const { from, to } = resolveDateRange(filterState, {
    sales,
    costs,
    advances,
    deposits,
    salaries,
    withdrawals,
    normalized,
  });
  const fromStr = asYmd(from);
  const toStr = asYmd(to);
  const inRange = (d) => d >= fromStr && d <= toStr;

  // Opening cash (before range)
  const preSalesCash = sales
    .filter((s) => s.date < fromStr)
    .reduce((sum, s) => sum + N(s.cash), 0);
  const preCostsCash = costs
    .filter((c) => c.date < fromStr && isCashCost(c))
    .reduce((sum, c) => sum + N(c.amount), 0);
  const preSalariesCash = (salaries || [])
    .filter((s) => pickSalaryDate(s) < fromStr)
    .reduce((sum, s) => sum + getSalaryAmount(s), 0);
  const preAdvances = advances
    .filter((a) => a.date < fromStr && isAdvanceCash(a))
    .reduce((sum, a) => sum + N(a.amount), 0);
  const preDeposits = deposits
    .filter((d) => d.date < fromStr)
    .reduce((s, d0) => s + N(d0.amount), 0);
  const preActsCashDelta = normalized
    .filter((x) => x.dateStr < fromStr)
    .reduce((s, x) => s + (x.cashDelta || 0), 0);
  const preWithdrawals = (withdrawals || [])
    .filter((w) => pickWithdrawDate(w) < fromStr)
    .reduce((s, w) => s + getWithdrawAmount(w), 0);

  let runningCash =
    preSalesCash -
    preCostsCash -
    preSalariesCash -
    preAdvances +
    preActsCashDelta -
    preDeposits +
    preWithdrawals;

  // Date list inclusive
  const days =
    Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const allDates = Array.from({ length: days }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    return format(d, "yyyy-MM-dd");
  });

  // Period trackers
  let periodDeposits = 0;
  let periodWithdrawals = 0;
  let totalCostFront = 0;
  let totalCostBack = 0;
  let periodBankLoanDelta = 0;
  let periodRepayCashIn = 0;
  let periodRepayCashOut = 0;
  let periodRepayBankIn = 0;
  let periodRepayBankOut = 0;
  let periodTotalSales = 0;
  const periodTotals = Object.fromEntries(tenderKeys.map((k) => [k, 0]));
  const rows = [];

  rows.push({
    type: "balance",
    label: "Balance from Last Summary",
    runningCash,
    date: fromStr,
  });

  allDates.forEach((d) => {
    const dailySales = sales.filter((s) => s.date === d);
    const dailyCosts = costs.filter((c) => c.date === d);
    const dailyAdvances = advances.filter((a) => a.date === d);
    const dailyDeposits = deposits.filter((dep) => dep.date === d);
    const dailySalaries = (salaries || []).filter(
      (s) => pickSalaryDate(s) === d
    );
    const dailyWithdrawals = (withdrawals || []).filter(
      (w) => pickWithdrawDate(w) === d
    );
    const dailyActs = normalized.filter((x) => x.dateStr === d);
    const dailyLoans = dailyActs.filter((x) => x.type === "loan");
    const dailyRepays = dailyActs.filter((x) => x.type === "repayment");

    // Day tender totals
    const tendersForDay = Object.fromEntries(
      tenderKeys.map((k) => [k, dailySales.reduce((s, x) => s + N(x[k]), 0)])
    );

    const cashVal = N(tendersForDay.cash);
    // Split advances: salary advances vs staff loans (tagged with _source:'staffLoan')
    const dailySalaryAdvances = dailyAdvances.filter(a => a._source !== 'staffLoan');
    const dailyStaffLoans     = dailyAdvances.filter(a => a._source === 'staffLoan');
    const advance        = dailySalaryAdvances.filter(isAdvanceCash).reduce((s, x) => s + N(x.amount), 0);
    const staffLoanGiven = dailyStaffLoans.filter(isAdvanceCash).reduce((s, x) => s + N(x.amount), 0);
    const deposit = dailyDeposits.reduce((s, x) => s + N(x.amount), 0);
    const costCash = dailyCosts
      .filter(isCashCost)
      .reduce((s, x) => s + N(x.amount), 0);
    const costBank = dailyCosts
      .filter(isBankCost)
      .reduce((s, x) => s + N(x.amount), 0);
    const salaryAmt = dailySalaries.reduce((s, x) => s + getSalaryAmount(x), 0);
    const salaryCash = salaryAmt; // always cash
    const salaryBank = 0;
    const withdrawalAmt = dailyWithdrawals.reduce(
      (s, x) => s + getWithdrawAmount(x),
      0
    );

    // Loans & Repay splits
    const loanGiven = dailyLoans
      .filter((l) => l.role === "lender")
      .reduce((s, x) => s + N(x.amount), 0);
    const loanReceived = dailyLoans
      .filter((l) => l.role === "borrower")
      .reduce((s, x) => s + N(x.amount), 0);

    const repayCashIn = dailyRepays
      .filter((r) => r.role === "lender" && isCashMethod(r.paymentMethod))
      .reduce((s, r) => s + N(r.amount), 0);
    const repayCashOut = dailyRepays
      .filter((r) => r.role === "borrower" && isCashMethod(r.paymentMethod))
      .reduce((s, r) => s + N(r.amount), 0);
    const repayBankIn = dailyRepays
      .filter((r) => r.role === "lender" && !isCashMethod(r.paymentMethod))
      .reduce((s, r) => s + N(r.amount), 0);
    const repayBankOut = dailyRepays
      .filter((r) => r.role === "borrower" && !isCashMethod(r.paymentMethod))
      .reduce((s, r) => s + N(r.amount), 0);

    const totalSales = tenderKeys.reduce(
      (sum, k) => sum + (includeInTotal(k) ? N(tendersForDay[k]) : 0),
      0
    );

    const dailyActsCashDelta = dailyActs.reduce(
      (s, x) => s + (x.cashDelta || 0),
      0
    );
    const dailyActsBankDelta = dailyActs.reduce(
      (s, x) => s + (x.bankDelta || 0),
      0
    );

    // Notes
    const notesByTender = dailySales.reduce(
      (acc, s) => mergeNotes(acc, extractSalesNotes(s, tenderKeys)),
      {}
    );
    const salesNotesText = tenderKeys
      .filter((k) => notesByTender[k]?.length)
      .map((k) => {
        const label = tenderByKey.get(k)?.label || k;
        return `${label}: ${notesByTender[k].join(" | ")}`;
      })
      .join(" • ");

    // Running cash
    runningCash =
      runningCash +
      cashVal -
      costCash -
      salaryCash -
      advance -
      staffLoanGiven -
      deposit +
      dailyActsCashDelta +
      withdrawalAmt;

    // Period trackers
    if (inRange(d)) {
      periodDeposits += deposit;
      periodWithdrawals += withdrawalAmt;
      totalCostFront += costCash + salaryCash;
      totalCostBack += costBank + salaryBank;
      tenderKeys.forEach((k) => (periodTotals[k] += N(tendersForDay[k])));
      periodBankLoanDelta += dailyActsBankDelta;
      periodRepayCashIn += repayCashIn;
      periodRepayCashOut += repayCashOut;
      periodRepayBankIn += repayBankIn;
      periodRepayBankOut += repayBankOut;
      periodTotalSales += totalSales;
    }

    // Daily rollup
    rows.push({
      type: "daily",
      date: d,
      tenders: tendersForDay,
      advance,
      staffLoanGiven,
      cost: costCash + costBank + salaryCash + salaryBank,
      costCash: costCash + salaryCash,
      costBank: costBank + salaryBank,
      salary: salaryCash + salaryBank,
      salaryCash,
      salaryBank,
      loanGiven,
      loanReceived,
      repayCashIn,
      repayCashOut,
      repayBankIn,
      repayBankOut,
      deposit,
      withdrawal: withdrawalAmt,
      totalSales,
      runningCash,
      salesNotesByTender: notesByTender,
      salesNotesText,
    });

    if (salesNotesText) {
      rows.push({
        type: "salesNote",
        date: d,
        label: `Sales Notes (${d})`,
        notesByTender,
        notesText: salesNotesText,
        runningCash,
      });
    }

    // Detail rows: loans
    dailyLoans.forEach((l) => {
      const counterparty =
        l.role === "lender"
          ? getBranchName(l.toBranchId)
          : getBranchName(l.fromBranchId);
      rows.push({
        type: "loan",
        date: d,
        label:
          l.role === "lender"
            ? `Loan Provided to ${counterparty} (${d})`
            : `Loan Received from ${counterparty} (${d})`,
        amount: N(l.amount),
        role: l.role,
        method: l.paymentMethod,
        counterparty,
        fromBranchId: l.fromBranchId,
        toBranchId: l.toBranchId,
        runningCash,
      });
    });

    // Detail rows: repayments
    dailyRepays.forEach((r) => {
      const counterparty =
        r.role === "lender"
          ? getBranchName(r.fromBranchId)
          : getBranchName(r.toBranchId);
      rows.push({
        type: "repayment",
        date: d,
        label:
          r.role === "lender"
            ? `Repayment Received from (${counterparty}) (${
                r.paymentMethod || "-"
              }) (${d})`
            : `Repayment Paid to (${counterparty}) (${
                r.paymentMethod || "-"
              }) (${d})`,
        amount: N(r.amount),
        role: r.role,
        method: r.paymentMethod || "-",
        counterparty,
        fromBranchId: r.fromBranchId,
        toBranchId: r.toBranchId,
        runningCash,
      });
    });

    // Detail rows: salary advances
    dailySalaryAdvances.filter(isAdvanceCash).forEach((a) => {
      rows.push({
        type: "staffAdvance",
        date: d,
        label: `Staff Advance${a.staffName ? ` — ${a.staffName}` : ""}`,
        amount: N(a.amount),
        runningCash,
      });
    });

    // Detail rows: staff loans
    dailyStaffLoans.filter(isAdvanceCash).forEach((l) => {
      rows.push({
        type: "staffLoan",
        date: d,
        label: `Staff Loan${l.staffName ? ` — ${l.staffName}` : ""}`,
        amount: N(l.amount),
        runningCash,
      });
    });

    // Detail rows: deposits
    dailyDeposits.forEach((dep) => {
      rows.push({
        type: "deposit",
        date: d,
        label: `Cash Deposit (${d})`,
        amount: N(dep.amount),
        runningCash,
      });
    });

    // Detail rows: withdrawals
    dailyWithdrawals.forEach((wd) => {
      rows.push({
        type: "withdraw",
        date: d,
        label: `Cash Withdrawal (${d})`,
        amount: N(wd.amount),
        runningCash,
      });
    });
  });

  // KPIs
  const handInCash = runningCash;
  const bankedSum = tenderKeys.reduce(
    (s, k) => s + (isBankedTender(k) ? N(periodTotals[k]) : 0),
    0
  );
  const bankExpected =
    bankedSum +
    periodDeposits +
    periodBankLoanDelta -
    periodWithdrawals -
    totalCostBack;
  const foodDelivery = deliveryKeys.reduce(
    (s, k) => s + N(periodTotals[k] ?? 0),
    0
  );
  const netTotal = handInCash + bankExpected + foodDelivery;

  return {
    rows,
    kpis: {
      totalSales: periodTotalSales,
      handInCash,
      bankExpected,
      netTotal,
      foodDelivery,
      totalCostFront,
      totalCostBack,
    },
    periodTotals,
    periodTotalSales,
    periodDeposits,
    periodWithdrawals,
    periodRepaySums: {
      cashIn: periodRepayCashIn,
      cashOut: periodRepayCashOut,
      bankIn: periodRepayBankIn,
      bankOut: periodRepayBankOut,
    },
    tenderDefs, // keep column order + labels
    dateRange: { from, to },
  };
}
