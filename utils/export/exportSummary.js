/* eslint-disable no-useless-escape */
import { format, parseISO } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { aggregateLoanMovements } from "@/utils/finance/loanAgg";

/* ----------------------- tiny helpers ----------------------- */
const num = (v) => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const isZeroish = (v) => Math.abs(num(v)) < 1e-9;

const fmtComma = (v, digits = 2) => {
  const n = num(v);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};
const dashOrComma = (v, digits = 2) =>
  isZeroish(v) ? "-" : fmtComma(v, digits);

const tryFormatDate = (d, pattern = "dd/MM/yyyy") => {
  if (!d) return "";
  try { if (d instanceof Date) return format(d, pattern); } catch { /* */ }
  try { const dt = new Date(d); if (!isNaN(dt)) return format(dt, pattern); } catch { /* */ }
  try { return format(parseISO(d), pattern); } catch { /* */ }
  return String(d);
};
const safeFilePart = (s) =>
  String(s || "all").replace(/[^\w\-]+/g, "_").toLowerCase();

const normMode = (meta = {}) => {
  const s = String(meta.modeLabel || meta.mode || "").toLowerCase();
  if (s.includes("back")) return "back";
  if (s.includes("front")) return "front";
  return "all";
};

/* --------- counterparty inference for loan/repayment rows ---------- */
const extractCounterparty = (row) => {
  const direct = row?.counterpartyName || row?.counterparty || row?.to || row?.from || row?.party;
  if (direct) return String(direct);
  const label = String(row?.label || "");
  const m =
    label.match(/\bto\s+([A-Za-z0-9 .,'&()-]+)/i) ||
    label.match(/\bfrom\s+([A-Za-z0-9 .,'&()-]+)/i) ||
    label.match(/\bwith\s+([A-Za-z0-9 .,'&()-]+)/i) ||
    label.match(/\bfor\s+([A-Za-z0-9 .,'&()-]+)/i);
  if (m?.[1]) return m[1].trim();
  return "";
};

/* ================= KPIs ================= */
const deriveModeKpis = (
  rows,
  periodTotals,
  periodDeposits,
  periodWithdrawals,
  _periodRepaySums,
  tenderDefs,
  meta = {}
) => {
  const mode = normMode(meta);
  const daily = rows.filter((r) => r.type === "daily");

  const totalSales = daily.reduce((s, r) => s + num(r.totalSales), 0);
  const cashKey =
    tenderDefs.find(
      (t) => t.key === "cash" || String(t.label || "").toLowerCase().trim() === "cash"
    )?.key || "cash";
  const cashSales = daily.reduce((s, r) => s + num(r.tenders?.[cashKey]), 0);
  const nonCashSales = totalSales - cashSales;

  const deposits = num(periodDeposits);
  const withdrawals = num(periodWithdrawals);

  const ext = meta?.externalKpis || {};
  // Use bankBalance (renamed from bankExpected)
  const bankBalance = Number.isFinite(+ext.bankBalance)
    ? +ext.bankBalance
    : deposits - withdrawals;

  const frontCost = daily.reduce((s, r) => s + num(r.costCash), 0);
  const backCost = daily.reduce((s, r) => s + num(r.costBank), 0);
  const allCost = frontCost + backCost || daily.reduce((s, r) => s + num(r.cost), 0);

  const loanAgg = aggregateLoanMovements(rows, {
    alwaysIncludeDaily: meta?.loanKpi?.alwaysIncludeDaily === true,
  });

  const totalAdvance = daily.reduce((s, r) => s + num(r.advance), 0);
  const totalSalaryCash = daily.reduce((s, r) => s + num(r.salaryCash), 0);
  const lastDaily = daily[daily.length - 1];
  const cashInHandEnd = lastDaily?.runningCash ?? "";
  const bankBalanceEnd = lastDaily?.runningBank ?? "";

  if (mode === "front") {
    return [
      { label: "Total Sales",             value: totalSales },
      { label: "Cash Sales",              value: cashSales },
      { label: "Non-Cash Sales",          value: nonCashSales },
      { label: "Advance (Cash)",          value: totalAdvance },
      { label: "Salary (Cash)",           value: totalSalaryCash },
      { label: "Cost (Cash)",             value: frontCost },
      { label: "Loan Given",             value: loanAgg.loanGiven },
      { label: "Loan Received",          value: loanAgg.loanReceived },
      { label: "Repay In (All)",         value: loanAgg.repayInAll },
      { label: "Repay Out (All)",        value: loanAgg.repayOutAll },
      { label: "Deposits",               value: deposits },
      { label: "Withdrawals",            value: withdrawals },
      { label: "Outstanding Owed To Us", value: loanAgg.outstandingAsLender },
      { label: "Outstanding We Owe",     value: loanAgg.outstandingAsBorrower },
      { label: "Cash in Hand (End)",     value: cashInHandEnd },
    ];
  }

  if (mode === "back") {
    return [
      { label: "Total Sales",            value: totalSales },
      { label: "Deposits",               value: deposits },
      { label: "Withdrawals",            value: withdrawals },
      { label: "Bank Balance",           value: bankBalance },
      { label: "Cost (Bank)",            value: backCost },
      { label: "Repay In (Bank)",        value: loanAgg.repayInBank },
      { label: "Repay Out (Bank)",       value: loanAgg.repayOutBank },
      { label: "Outstanding Owed To Us", value: loanAgg.outstandingAsLender },
      { label: "Outstanding We Owe",     value: loanAgg.outstandingAsBorrower },
      { label: "Bank Balance (End)",     value: bankBalanceEnd },
    ];
  }

  // mode === "all"
  return [
    { label: "Total Sales",            value: totalSales },
    { label: "Cash Sales",             value: cashSales },
    { label: "Non-Cash Sales",         value: nonCashSales },
    { label: "Deposits",               value: deposits },
    { label: "Withdrawals",            value: withdrawals },
    { label: "Bank Balance",           value: bankBalance },
    { label: "Advance (Cash)",         value: totalAdvance },
    { label: "Salary (Cash)",          value: totalSalaryCash },
    { label: "Cost (Cash)",            value: frontCost },
    { label: "Cost (Bank)",            value: backCost },
    { label: "Cost (All)",             value: allCost },
    { label: "Loan Given",             value: loanAgg.loanGiven },
    { label: "Loan Received",          value: loanAgg.loanReceived },
    { label: "Repay In (All)",         value: loanAgg.repayInAll },
    { label: "Repay Out (All)",        value: loanAgg.repayOutAll },
    { label: "Outstanding Owed To Us", value: loanAgg.outstandingAsLender },
    { label: "Outstanding We Owe",     value: loanAgg.outstandingAsBorrower },
    { label: "Cash in Hand (End)",     value: cashInHandEnd },
    { label: "Bank Balance (End)",     value: bankBalanceEnd },
  ];
};

/* ================= Column spec for Summary Table ================= */
const buildSummaryColumnSpec = (tenderDefs = [], meta = {}) => {
  const hiddenCols = meta.hiddenCols || {};
  const showRepayCashCols = meta.showRepayCashCols !== false;
  const showRepayBankCols = meta.showRepayBankCols !== false;
  const mode = normMode(meta);

  const visibleTenders = tenderDefs.filter((t) => {
    if ((t.key === "cash" || String(t.label || "").toLowerCase() === "cash") && hiddenCols.cash)
      return false;
    return true;
  });

  const costHeaders =
    mode === "front" ? ["Cost (Cash)"] :
    mode === "back"  ? ["Cost (Bank)"] :
    ["Cost (Cash)", "Cost (Bank)"];

  // Match UI: Cash in Hand hidden in back mode, Bank Balance hidden in front mode
  const showCashInHand = mode !== "back";
  const showBankBalance = mode !== "front";

  const headers = [
    "Date",
    ...visibleTenders.map((t) => t.label || t.key),
    "Advance",
    ...costHeaders,
    "Salary (Cash)",
    "Loan Given",
    "Loan Received",
    ...(showRepayCashCols ? ["Repay In (Cash)", "Repay Out (Cash)"] : []),
    ...(showRepayBankCols ? ["Repay In (Bank)", "Repay Out (Bank)"] : []),
    "Deposit",
    "Withdrawal",
    "Total Sales",
    ...(showCashInHand ? ["Cash in Hand"] : []),
    ...(showBankBalance ? ["Bank Balance"] : []),
    "Sales Notes",
  ];

  // Column group info for PDF header coloring
  const tenderLabels = new Set(visibleTenders.map((t) => t.label || t.key));
  const expenseCols = new Set(["Advance", ...costHeaders, "Salary (Cash)"]);
  const loanCols = new Set([
    "Loan Given", "Loan Received",
    "Repay In (Cash)", "Repay Out (Cash)",
    "Repay In (Bank)", "Repay Out (Bank)",
  ]);
  const bankCols = new Set(["Deposit", "Withdrawal"]);
  const summaryCols = new Set(["Total Sales", "Cash in Hand", "Bank Balance"]);

  const getColGroup = (h) => {
    if (tenderLabels.has(h)) return "tender";
    if (expenseCols.has(h)) return "expense";
    if (loanCols.has(h)) return "loan";
    if (bankCols.has(h)) return "bank";
    if (summaryCols.has(h)) return "summary";
    return "other";
  };

  const indexMap = new Map(headers.map((h, i) => [h, i]));
  return {
    headers,
    indexMap,
    visibleTenders,
    showRepayCashCols,
    showRepayBankCols,
    showCashInHand,
    showBankBalance,
    getColGroup,
    mode,
  };
};

/* ================= Column spec for Detail Table ================= */
const buildDetailColumnSpec = () => {
  const headers = ["Date", "Party", "Description", "Amount"];
  const indexMap = new Map(headers.map((h, i) => [h, i]));
  return { headers, indexMap };
};

/* ================= Row builder for Summary Table ================= */
const buildSummaryRow = (row, spec) => {
  if (row.type !== "balance" && row.type !== "daily") return null;

  const out = new Array(spec.headers.length).fill("");
  const set = (key, value) => {
    if (!spec.indexMap.has(key)) return;
    out[spec.indexMap.get(key)] = value;
  };

  if (row.type === "balance") {
    set("Date", row.label || "Balance from Last Summary");
    set("Cash in Hand", dashOrComma(row.runningCash));
    set("Bank Balance", dashOrComma(row.runningBank));
  } else if (row.type === "daily") {
    set("Date", tryFormatDate(row.date, "dd-MMM"));

    const tendersObj = row.tenders || {};
    spec.visibleTenders.forEach((t) => {
      set(t.label || t.key, dashOrComma(tendersObj[t.key] ?? 0));
    });

    set("Advance", dashOrComma(row.advance));

    if (spec.mode === "front") {
      set("Cost (Cash)", dashOrComma(row.costCash ?? (isZeroish(row.costBank) ? row.cost : 0)));
    } else if (spec.mode === "back") {
      set("Cost (Bank)", dashOrComma(row.costBank ?? 0));
    } else {
      set("Cost (Cash)", dashOrComma(row.costCash ?? 0));
      set("Cost (Bank)", dashOrComma(row.costBank ?? 0));
    }

    set("Salary (Cash)",     dashOrComma(row.salaryCash));
    set("Loan Given",        dashOrComma(row.loanGiven));
    set("Loan Received",     dashOrComma(row.loanReceived));
    set("Repay In (Cash)",   dashOrComma(row.repayCashIn));
    set("Repay Out (Cash)",  dashOrComma(row.repayCashOut));
    set("Repay In (Bank)",   dashOrComma(row.repayBankIn));
    set("Repay Out (Bank)",  dashOrComma(row.repayBankOut));
    set("Deposit",           dashOrComma(row.deposit));
    set("Withdrawal",        dashOrComma(row.withdrawal));
    set("Total Sales",       dashOrComma(row.totalSales));
    set("Cash in Hand",      dashOrComma(row.runningCash));
    set("Bank Balance",      dashOrComma(row.runningBank));
    set("Sales Notes",       row.salesNotesText || "");
  }
  return out;
};

/* ================= Period Totals row builder ================= */
const buildPeriodTotalsRow = (rows, spec, periodTotals, periodDeposits, periodWithdrawals, periodRepaySums) => {
  const daily = rows.filter((r) => r.type === "daily");
  const sum = (key) => daily.reduce((s, r) => s + num(r[key] || 0), 0);
  const lastDaily = daily[daily.length - 1];

  const r = new Array(spec.headers.length).fill("");
  const set = (key, value) => {
    if (!spec.indexMap.has(key)) return;
    r[spec.indexMap.get(key)] = value;
  };

  set("Date", "Period Totals");
  spec.visibleTenders.forEach((t) => {
    set(t.label || t.key, dashOrComma(periodTotals?.[t.key]));
  });
  set("Advance",          dashOrComma(sum("advance")));
  set("Cost (Cash)",      dashOrComma(sum("costCash")));
  set("Cost (Bank)",      dashOrComma(sum("costBank")));
  set("Salary (Cash)",    dashOrComma(sum("salaryCash")));
  set("Loan Given",       dashOrComma(sum("loanGiven")));
  set("Loan Received",    dashOrComma(sum("loanReceived")));
  set("Repay In (Cash)",  dashOrComma(periodRepaySums?.cashIn));
  set("Repay Out (Cash)", dashOrComma(periodRepaySums?.cashOut));
  set("Repay In (Bank)",  dashOrComma(periodRepaySums?.bankIn));
  set("Repay Out (Bank)", dashOrComma(periodRepaySums?.bankOut));
  set("Deposit",          dashOrComma(periodDeposits));
  set("Withdrawal",       dashOrComma(periodWithdrawals));
  set("Total Sales",      dashOrComma(daily.reduce((s, x) => s + num(x.totalSales), 0)));
  set("Cash in Hand",     dashOrComma(lastDaily?.runningCash));
  set("Bank Balance",     dashOrComma(lastDaily?.runningBank));
  return r;
};

/* ================= Detail Row Builder ================= */
const buildDetailRow = (row, spec) => {
  if (["balance", "daily", "salesNote"].includes(row.type)) return null;

  const out = new Array(spec.headers.length).fill("");
  const set = (key, value) => {
    if (!spec.indexMap.has(key)) return;
    out[spec.indexMap.get(key)] = value;
  };

  set("Date",        tryFormatDate(row.date, "dd-MMM"));
  set("Party",       extractCounterparty(row));
  const baseDesc = row.label || row.type;
  set("Description", row.type === 'loan' && row.reason ? `${baseDesc} — ${row.reason}` : baseDesc);
  set("Amount",      dashOrComma(row.amount));
  return out;
};

/* ===================== LEDGER HELPERS ===================== */

const isCashMethodExport = (method) => {
  const x = String(method || '').trim().toLowerCase();
  if (!x || x === 'cash (forced)') return true;
  return /(cash|hand\s*cash|cash-in-hand|voucher|petty)/i.test(x);
};

/**
 * Build ordered ledger entries matching the physical book format.
 * Entry types:
 *   'start'  – first row (period total), shown bold, no running-total row below
 *   'entry'  – each transaction, followed by a yellow running-total row
 *   'final'  – "Hand In Cash / Bank Balance" label + highlighted amount
 */
const buildLedgerEntries = (rows, tenderDefs, side) => {
  const balanceRow   = rows.find(r => r.type === 'balance');
  const dailyRows    = rows.filter(r => r.type === 'daily');
  const depositRows  = rows.filter(r => r.type === 'deposit');
  const withdrawRows = rows.filter(r => r.type === 'withdraw');
  const loanRows     = rows.filter(r => r.type === 'loan');
  const repayRows    = rows.filter(r => r.type === 'repayment');

  const entries = [];

  if (side === 'cash') {
    const cashKey = tenderDefs.find(
      t => t.key === 'cash' || String(t.label || '').toLowerCase().trim() === 'cash'
    )?.key || 'cash';
    const cashSales   = dailyRows.reduce((s, r) => s + num(r.tenders?.[cashKey] ?? 0), 0);
    const openingCash = num(balanceRow?.runningCash ?? 0);

    // --- Order matches physical book ---
    // 1. "Cash" = period cash sales total (start row, no running-total below)
    let running = cashSales;
    entries.push({ type: 'start', label: 'Cash', value: cashSales });

    // 2. Balance from last summary (+)
    if (!isZeroish(openingCash)) {
      running += openingCash;
      entries.push({ type: 'entry', label: 'Balance from Last Summary', sign: '+', amount: openingCash, balance: running });
    }

    // 3. Advance + Cost Cash combined (-)
    const totalAdvance  = dailyRows.reduce((s, r) => s + num(r.advance  ?? 0), 0);
    const totalCostCash = dailyRows.reduce((s, r) => s + num(r.costCash ?? 0), 0);
    const advCost = totalAdvance + totalCostCash;
    if (!isZeroish(advCost)) {
      running -= advCost;
      entries.push({ type: 'entry', label: 'Advance + Cost', sign: '-', amount: advCost, balance: running });
    }

    // 4. Individual transfers from back office / withdrawals (+)
    withdrawRows.forEach(w => {
      running += num(w.amount);
      entries.push({ type: 'entry', label: 'Transfer from Back Office', sign: '+', amount: num(w.amount), balance: running, date: w.date });
    });

    // 5. Salary per day (-)
    dailyRows.filter(r => !isZeroish(r.salaryCash ?? 0)).forEach(r => {
      running -= num(r.salaryCash);
      entries.push({ type: 'entry', label: 'Salary', sign: '-', amount: num(r.salaryCash), balance: running, date: r.date });
    });

    // 6. Individual loans given (-)
    loanRows.filter(r => r.role === 'lender').forEach(r => {
      running -= num(r.amount);
      entries.push({ type: 'entry', label: r.label || 'Loan Given', sign: '-', amount: num(r.amount), balance: running, date: r.date });
    });

    // 7. Loans received (+)
    loanRows.filter(r => r.role === 'borrower').forEach(r => {
      running += num(r.amount);
      entries.push({ type: 'entry', label: r.label || 'Loan Received', sign: '+', amount: num(r.amount), balance: running, date: r.date });
    });

    // 8. Cash repayments paid (-)
    repayRows.filter(r => r.role === 'borrower' && isCashMethodExport(r.method)).forEach(r => {
      running -= num(r.amount);
      entries.push({ type: 'entry', label: r.label || 'Repayment Paid', sign: '-', amount: num(r.amount), balance: running, date: r.date });
    });

    // 9. Cash repayments received (+)
    repayRows.filter(r => r.role === 'lender' && isCashMethodExport(r.method)).forEach(r => {
      running += num(r.amount);
      entries.push({ type: 'entry', label: r.label || 'Repayment Received', sign: '+', amount: num(r.amount), balance: running, date: r.date });
    });

    // 10. Deposits to bank (-)
    depositRows.forEach(d => {
      running -= num(d.amount);
      entries.push({ type: 'entry', label: 'Cash Deposit to Bank', sign: '-', amount: num(d.amount), balance: running, date: d.date });
    });

    const lastDaily = dailyRows[dailyRows.length - 1];
    entries.push({ type: 'final', label: 'Hand In Cash', balance: lastDaily?.runningCash ?? running });

  } else {
    // Bank side
    const cashKey = tenderDefs.find(t => t.key === 'cash' || String(t.label || '').toLowerCase() === 'cash')?.key || 'cash';
    const bankedTenders = tenderDefs.filter(t => t.banked);

    // Period banked sales total
    let totalBankedSales = 0;
    if (bankedTenders.length > 0) {
      bankedTenders.forEach(t => {
        totalBankedSales += dailyRows.reduce((s, r) => s + num(r.tenders?.[t.key] ?? 0), 0);
      });
    } else {
      totalBankedSales = dailyRows.reduce((s, r) => {
        const t = r.tenders || {};
        return s + Object.entries(t).reduce((ts, [k, v]) => ts + (k !== cashKey ? num(v) : 0), 0);
      }, 0);
    }

    const openingBank = num(balanceRow?.runningBank ?? 0);
    let running = totalBankedSales;

    // 1. Banked sales start row
    const startLabel = bankedTenders.length === 1
      ? `${bankedTenders[0].label || bankedTenders[0].key} Sales`
      : 'Banked Sales';
    entries.push({ type: 'start', label: startLabel, value: totalBankedSales });

    // Show each banked tender type as separate start rows when multiple exist
    if (bankedTenders.length > 1) {
      entries.length = 0; // reset — show individual tenders instead
      running = 0;
      let firstDone = false;
      bankedTenders.forEach(t => {
        const total = dailyRows.reduce((s, r) => s + num(r.tenders?.[t.key] ?? 0), 0);
        if (!isZeroish(total)) {
          if (!firstDone) {
            entries.push({ type: 'start', label: `${t.label || t.key} Sales`, value: total });
            running = total;
            firstDone = true;
          } else {
            running += total;
            entries.push({ type: 'entry', label: `${t.label || t.key} Sales`, sign: '+', amount: total, balance: running });
          }
        }
      });
    }

    // 2. Opening bank balance (+)
    if (!isZeroish(openingBank)) {
      running += openingBank;
      entries.push({ type: 'entry', label: 'Opening Bank Balance', sign: '+', amount: openingBank, balance: running });
    }

    // 3. Cash deposits (+)
    depositRows.forEach(d => {
      running += num(d.amount);
      entries.push({ type: 'entry', label: 'Cash Deposit', sign: '+', amount: num(d.amount), balance: running, date: d.date });
    });

    // 4. Repayments received via bank (+)
    repayRows.filter(r => r.role === 'lender' && !isCashMethodExport(r.method)).forEach(r => {
      running += num(r.amount);
      entries.push({ type: 'entry', label: r.label || 'Repayment Received', sign: '+', amount: num(r.amount), balance: running, date: r.date });
    });

    // 5. Bank costs (-)
    const totalCostBank = dailyRows.reduce((s, r) => s + num(r.costBank ?? 0), 0);
    if (!isZeroish(totalCostBank)) {
      running -= totalCostBank;
      entries.push({ type: 'entry', label: 'Bank Costs', sign: '-', amount: totalCostBank, balance: running });
    }

    // 6. Transfers to front office / withdrawals (-)
    withdrawRows.forEach(w => {
      running -= num(w.amount);
      entries.push({ type: 'entry', label: 'Transfer to Front Office', sign: '-', amount: num(w.amount), balance: running, date: w.date });
    });

    // 7. Repayments paid via bank (-)
    repayRows.filter(r => r.role === 'borrower' && !isCashMethodExport(r.method)).forEach(r => {
      running -= num(r.amount);
      entries.push({ type: 'entry', label: r.label || 'Repayment Paid', sign: '-', amount: num(r.amount), balance: running, date: r.date });
    });

    const lastDaily = dailyRows[dailyRows.length - 1];
    entries.push({ type: 'final', label: 'Bank Balance', balance: lastDaily?.runningBank ?? running });
  }

  return entries;
};

/* ─────────────────── Ledger period label helper ─────────────────── */
const buildLedgerPeriod = (meta) => {
  const label = meta.filterText || 'All Data';
  try {
    const from = meta.filterDateFrom ? format(
      meta.filterDateFrom instanceof Date ? meta.filterDateFrom : new Date(meta.filterDateFrom),
      'do MMMM yyyy'
    ) : null;
    const to = meta.filterDateTo ? format(
      meta.filterDateTo instanceof Date ? meta.filterDateTo : new Date(meta.filterDateTo),
      'do MMMM yyyy'
    ) : null;
    if (from && to) return `${label} (${from} to ${to})`;
  } catch { /* fall through */ }
  return label;
};

/* ─────────────────── Excel Ledger Sheet ─────────────────── */
const addLedgerToExcel = (wb, rows, tenderDefs, meta, mode) => {
  const currency = meta.currency || 'RM';
  const branch   = meta.branchName || '-';
  const period   = buildLedgerPeriod(meta);

  const buildSheet = (entries, title) => {
    const data = [];
    // Header
    data.push([`${title}  —  ${branch}`]);
    data.push([period]);
    data.push([]);
    data.push(['Description', 'Amount', 'Date / Notes']);
    data.push([]);

    entries.forEach(e => {
      if (e.type === 'start') {
        // Period total — bold label, amount in col B (no balance col)
        data.push([e.label, fmtComma(e.value), '']);
      } else if (e.type === 'entry') {
        const signedLabel = `${e.label}  (${e.sign})`;
        data.push([signedLabel, fmtComma(e.amount), e.date ? tryFormatDate(e.date) : '']);
        // Running balance row — blank label, balance in col B
        data.push(['', fmtComma(e.balance), '']);
        data.push([]);   // blank spacer
      } else if (e.type === 'final') {
        data.push([]);
        data.push([e.label, '', '']);
        data.push([currency, fmtComma(e.balance), '']);
      }
    });

    data.push([]);
    data.push([]);
    data.push(['Prepared By  ___________________________', '', 'Checked By  ___________________________']);

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 46 }, { wch: 18 }, { wch: 32 }];
    return ws;
  };

  if (mode !== 'back')  XLSX.utils.book_append_sheet(wb, buildSheet(buildLedgerEntries(rows, tenderDefs, 'cash'), 'CASH STATEMENT'), 'Cash Ledger');
  if (mode !== 'front') XLSX.utils.book_append_sheet(wb, buildSheet(buildLedgerEntries(rows, tenderDefs, 'bank'), 'BANK STATEMENT'), 'Bank Ledger');
};

/* ─────────────────── PDF Ledger Page ─────────────────── */
const addLedgerToPDF = (doc, rows, tenderDefs, meta, M, mode) => {
  const currency  = meta.currency || 'RM';
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageH     = doc.internal.pageSize.getHeight();
  const contentW  = pageWidth - M.left - M.right;

  // Amount column right-edge — roughly 45% into content (matches reference layout)
  const xAmtR  = M.left + Math.min(contentW * 0.45, 130);
  // Date/notes starts just after amount
  const xDateL = xAmtR + 6;
  // Row heights
  const RH = 6.5;   // item row
  const BH = 6.5;   // balance row

  const BALANCE_BG = [235, 235, 235];  // light grey for running-balance rows
  const FINAL_BG   = [220, 235, 220];  // light green for final Hand In Cash / Bank Balance
  const ORANGE   = [204, 60, 0];
  const BLACK    = [20, 20, 20];
  const GREY     = [90, 90, 90];

  const drawFooter = () => {
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text(`Page ${doc.getNumberOfPages()}`, M.left, pageH - 5);
    doc.setTextColor(...BLACK);
  };

  const ensureSpace = (needed, y) => {
    if (y + needed > pageH - M.bottom - 2) {
      drawFooter();
      doc.addPage();
      return M.top;
    }
    return y;
  };

  const renderPage = (entries, title) => {
    doc.addPage();
    let y = M.top;

    // ── Title ──
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...BLACK);
    doc.text(title, M.left, y);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    const sub = `${meta.branchName || ''}  ·  ${buildLedgerPeriod(meta)}`.trim().replace(/^\s*·\s*/, '');
    if (sub) doc.text(sub, pageWidth - M.right, y, { align: 'right' });
    y += 5;

    doc.setDrawColor(50);
    doc.setLineWidth(0.6);
    doc.line(M.left, y, pageWidth - M.right, y);
    doc.setLineWidth(0.1);
    y += 7;

    // ── Entries ──
    entries.forEach(e => {
      if (e.type === 'start') {
        // Period total line — bold, no yellow row below
        y = ensureSpace(RH + 2, y);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...BLACK);
        doc.text(e.label, M.left, y);
        doc.text(fmtComma(e.value), xAmtR, y, { align: 'right' });
        doc.setFont(undefined, 'normal');
        y += RH + 1;

      } else if (e.type === 'entry') {
        const isDed = e.sign === '-';
        // Ensure room for item + balance row
        y = ensureSpace(RH + BH + 2, y);

        // Item row
        doc.setFontSize(9.5);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(...(isDed ? ORANGE : BLACK));
        doc.text(e.label, M.left, y);
        doc.text(fmtComma(e.amount), xAmtR, y, { align: 'right' });
        if (e.date) {
          doc.setTextColor(...GREY);
          doc.text(tryFormatDate(e.date, 'dd MMM yyyy'), xDateL, y);
        }
        y += RH;

        // Running-balance row
        doc.setFillColor(...BALANCE_BG);
        doc.rect(M.left, y - 4.5, contentW, BH, 'F');
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...BLACK);
        doc.text(fmtComma(e.balance), xAmtR, y, { align: 'right' });
        doc.setFont(undefined, 'normal');
        y += BH + 1;

      } else if (e.type === 'final') {
        y = ensureSpace(RH * 2 + 20, y);
        y += 3;

        // "Hand In Cash" / "Bank Balance" label
        doc.setFontSize(10.5);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...BLACK);
        doc.text(e.label, M.left, y);
        doc.setFont(undefined, 'normal');
        y += RH + 1;

        // Final balance row with currency prefix
        doc.setFillColor(...FINAL_BG);
        doc.rect(M.left, y - 4.5, contentW, BH + 1, 'F');
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...BLACK);
        doc.text(currency, M.left + 2, y);
        doc.text(fmtComma(e.balance), xAmtR, y, { align: 'right' });
        doc.setFont(undefined, 'normal');
        y += BH + 10;
      }
    });

    // ── Signature section ──
    const sigY = Math.min(y + 4, pageH - M.bottom - 14);
    const sigLen = 55;
    doc.setDrawColor(60);
    doc.setLineWidth(0.5);
    doc.line(M.left,                       sigY, M.left + sigLen,                       sigY);
    doc.line(pageWidth - M.right - sigLen, sigY, pageWidth - M.right,                   sigY);
    doc.setLineWidth(0.1);
    doc.setFontSize(8.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...GREY);
    doc.text('Prepared By', M.left, sigY + 5);
    doc.text('Checked By',  pageWidth - M.right - sigLen, sigY + 5);

    drawFooter();
  };

  if (mode !== 'back')  renderPage(buildLedgerEntries(rows, tenderDefs, 'cash'), 'CASH STATEMENT');
  if (mode !== 'front') renderPage(buildLedgerEntries(rows, tenderDefs, 'bank'), 'BANK STATEMENT');
};

/* ================= Excel ================= */
export const exportSummaryToExcel = (
  rows,
  _kpis,
  periodTotals,
  _periodTotalSales,
  periodDeposits,
  periodWithdrawals,
  periodRepaySums,
  tenderDefs,
  meta = {}
) => {
  try {
    if (!rows?.length) return alert("No data!");

    meta = { ...meta, externalKpis: _kpis };

    const spec = buildSummaryColumnSpec(tenderDefs, meta);
    const wb = XLSX.utils.book_new();
    const includeDetailRows = meta.includeDetailRows !== false;

    // --- Summary sheet ---
    const summaryData = [spec.headers];
    rows.map((r) => buildSummaryRow(r, spec)).filter(Boolean).forEach((arr) => summaryData.push(arr));

    // Period Totals row (all modes)
    summaryData.push(
      buildPeriodTotalsRow(rows, spec, periodTotals, periodDeposits, periodWithdrawals, periodRepaySums)
    );

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary["!cols"] = spec.headers.map((h) => {
      if (h === "Date") return { wch: 22 };
      if (h === "Sales Notes") return { wch: 60 };
      return { wch: 14 };
    });
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    // --- Details sheet ---
    if (includeDetailRows) {
      const detailSpec = buildDetailColumnSpec();
      const detailRows = rows.map((r) => buildDetailRow(r, detailSpec)).filter(Boolean);
      if (detailRows.length > 0) {
        const wsDetail = XLSX.utils.aoa_to_sheet([detailSpec.headers, ...detailRows]);
        wsDetail["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 40 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, wsDetail, "Details");
      }
    }

    // --- KPIs sheet ---
    const kpis = deriveModeKpis(rows, periodTotals, periodDeposits, periodWithdrawals, periodRepaySums, tenderDefs, meta);
    const wsKpi = XLSX.utils.aoa_to_sheet([
      ["Label", "Value"],
      ...kpis.map((k) => [k.label, dashOrComma(k.value)]),
    ]);
    wsKpi["!cols"] = [{ wch: 40 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsKpi, "KPIs");

    // --- Ledger sheet(s) ---
    addLedgerToExcel(wb, rows, tenderDefs, meta, normMode(meta));

    const safeName = safeFilePart(meta.filterText || "summary");
    XLSX.writeFile(wb, `summary_${safeName}.xlsx`);
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
};

/* ================ KPI color helper (PDF) ================ */
const kpiTone = (label) => {
  const L = String(label || "").toLowerCase();
  const isIncome =
    L.includes("sales") || L.includes("deposit") ||
    (L.includes("repay in") && !L.includes("out")) ||
    L.includes("loan received") || L.includes("cash in hand") ||
    L.includes("bank balance");
  const isExpense =
    L.includes("cost") || L.includes("withdrawal") ||
    L.includes("advance") || L.includes("salary") ||
    L.includes("loan given") ||
    (L.includes("repay out") && !L.includes("in")) ||
    L.includes("we owe");
  if (isIncome) return "income";
  if (isExpense) return "expense";
  return "neutral";
};

const toneFill = (tone) => {
  switch (tone) {
    case "income":  return [232, 247, 236]; // light green
    case "expense": return [254, 240, 240]; // light red
    default:        return [233, 244, 255]; // light blue
  }
};

// Column group → header fill color (matches UI table)
const COL_GROUP_FILL = {
  tender:  [209, 250, 229],   // emerald-100
  expense: [254, 226, 226],   // rose-100
  loan:    [254, 243, 199],   // amber-100
  bank:    [219, 234, 254],   // blue-100
  summary: [226, 232, 240],   // slate-200
  other:   [243, 244, 246],   // gray-100
};

/* ================= PDF ================= */
export const exportSummaryToPDF = (
  rows,
  _kpis,
  periodTotals,
  _periodTotalSales,
  periodDeposits,
  periodWithdrawals,
  periodRepaySums,
  tenderDefs,
  meta = {}
) => {
  try {
    if (!rows?.length) return alert("No data!");

    meta = { ...meta, externalKpis: _kpis };

    const summarySpec = buildSummaryColumnSpec(tenderDefs, meta);
    const detailSpec = buildDetailColumnSpec();
    const includeDetailRows = meta.includeDetailRows !== false;

    const colCount = summarySpec.headers.length;
    const forceA3 = meta.forceA3 === true;
    const forceA4 = meta.forceA4 === true;
    const pageFormat = forceA4 ? "a4" : forceA3 ? "a3" : colCount > 14 ? "a3" : "a4";

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: pageFormat });
    const M = { left: 14, right: 14, top: 14, bottom: 12 };
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - M.left - M.right;
    let y = M.top;

    const hr = (yy, color = 225) => {
      doc.setDrawColor(color);
      doc.line(M.left, yy, pageWidth - M.right, yy);
    };
    const footer = (data) => {
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${doc.getNumberOfPages()}`,
        data.settings.margin.left,
        doc.internal.pageSize.height - 6
      );
    };

    // ---------- Page 1: Header + KPIs ----------
    const title      = meta.title       || "Summary Report";
    const company    = meta.companyName || "-";
    const branch     = meta.branchName  || "-";
    const modeLabel  = meta.modeLabel   || "All";
    const generated  = meta.generatedAt || new Date().toLocaleString();

    // Resolve actual date range string
    const fmtD = (d) => tryFormatDate(d, "dd/MM/yyyy");
    const dateFrom = meta.filterDateFrom ? fmtD(meta.filterDateFrom) : null;
    const dateTo   = meta.filterDateTo   ? fmtD(meta.filterDateTo)   : null;
    const dateRangeStr = dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : (meta.filterText || "All Data");
    // If label carries extra context (e.g. "April 2026") prepend it when it differs from the bare range
    const labelContext = meta.filterText && meta.filterText !== "All Data" && meta.filterText !== dateRangeStr
      ? `${meta.filterText}  (${dateRangeStr})`
      : dateRangeStr;

    // Title — plain bold text, no background
    doc.setTextColor(20);
    doc.setFontSize(15);
    doc.setFont(undefined, "bold");
    doc.text(title, M.left, y + 5);
    doc.setFont(undefined, "normal");
    y += 10;

    hr(y);
    y += 5;

    // Meta info in two columns
    doc.setTextColor(60);
    doc.setFontSize(9);
    const leftCol  = [`Company: ${company}`, `Branch: ${branch}`, `Mode: ${modeLabel}`];
    const rightCol = [`Period: ${labelContext}`, `Generated: ${generated}`];
    leftCol.forEach((line, i)  => doc.text(line, M.left, y + i * 4.5));
    rightCol.forEach((line, i) => doc.text(line, M.left + contentWidth / 2, y + i * 4.5));
    y += Math.max(leftCol.length, rightCol.length) * 4.5 + 4;

    hr(y);
    y += 6;

    // ---------- KPI Grid ----------
    const kpis = deriveModeKpis(rows, periodTotals, periodDeposits, periodWithdrawals, periodRepaySums, tenderDefs, meta);

    const perRow = contentWidth / 3 > 70 ? 3 : 2;
    const gap = 5;
    const cardW = (contentWidth - gap * (perRow - 1)) / perRow;
    const cardH = 18;

    doc.setFontSize(9);
    kpis.forEach((k, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const cx = M.left + col * (cardW + gap);
      const cy = y + row * (cardH + gap);

      const [r, g, b] = toneFill(kpiTone(k.label));
      doc.setDrawColor(210);
      doc.setFillColor(r, g, b);
      doc.roundedRect(cx, cy, cardW, cardH, 2.2, 2.2, "FD");

      doc.setTextColor(90);
      doc.setFontSize(8);
      doc.text(String(k.label), cx + 4, cy + 5.5);

      doc.setTextColor(20);
      doc.setFontSize(11);
      doc.setFont(undefined, "bold");
      doc.text(dashOrComma(k.value), cx + 4, cy + 13);
      doc.setFont(undefined, "normal");
    });

    const rowsCount = Math.ceil(kpis.length / perRow);
    y += rowsCount * (cardH + gap) + 6;

    // ---------- Page 2: Summary Table ----------
    doc.addPage();
    y = M.top;

    // Section title
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.setFont(undefined, "bold");
    doc.text("Daily Summary", M.left, y);
    doc.setFont(undefined, "normal");
    y += 6;

    const summaryBody = rows.map((r) => buildSummaryRow(r, summarySpec)).filter(Boolean);
    summaryBody.push(
      buildPeriodTotalsRow(rows, summarySpec, periodTotals, periodDeposits, periodWithdrawals, periodRepaySums)
    );

    autoTable(doc, {
      startY: y,
      head: [summarySpec.headers],
      body: summaryBody,
      theme: "grid",
      styles: {
        fontSize: 7.5,
        cellPadding: 1,
        overflow: "linebreak",
        valign: "middle",
        lineWidth: 0.1,
      },
      headStyles: {
        fontSize: 7.5,
        textColor: 30,
        lineWidth: 0.2,
        halign: "center",
        valign: "bottom",
        minCellHeight: 10,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      margin: { top: M.top, bottom: M.bottom, left: M.left, right: M.right },
      columnStyles: {
        0: { cellWidth: 20 },
        [summarySpec.headers.length - 1]: { cellWidth: 35 }, // Sales Notes
      },
      didParseCell: (data) => {
        if (data.section === "head") {
          const h = summarySpec.headers[data.column.index];
          const group = summarySpec.getColGroup(h);
          const [r, g, b] = COL_GROUP_FILL[group] || COL_GROUP_FILL.other;
          data.cell.styles.fillColor = [r, g, b];
        }
        if (data.section === "body") {
          const isDate = data.column.index === summarySpec.indexMap.get("Date");
          const isNotes = data.column.index === summarySpec.indexMap.get("Sales Notes");
          data.cell.styles.halign = isDate || isNotes ? "left" : "right";

          // Bold + blue background for Period Totals row
          const isTotal = data.row.index === summaryBody.length - 1;
          if (isTotal) {
            data.cell.styles.fillColor = [219, 234, 254];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      didDrawPage: footer,
    });

    // ---------- Page 3: Detail Transactions ----------
    const detailBody = rows.map((r) => buildDetailRow(r, detailSpec)).filter(Boolean);

    if (includeDetailRows && detailBody.length > 0) {
      doc.addPage();
      y = M.top;

      doc.setFontSize(11);
      doc.setTextColor(30);
      doc.setFont(undefined, "bold");
      doc.text("Detailed Transactions", M.left, y);
      doc.setFont(undefined, "normal");
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [detailSpec.headers],
        body: detailBody,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 1, overflow: "linebreak", valign: "middle", lineWidth: 0.1 },
        headStyles: {
          fontSize: 8,
          fillColor: [226, 232, 240],
          textColor: 30,
          lineWidth: 0.2,
          halign: "center",
          valign: "bottom",
          minCellHeight: 10,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [250, 251, 252] },
        margin: { top: M.top, bottom: M.bottom, left: M.left, right: M.right },
        columnStyles: {
          0: { cellWidth: 20, halign: "left" },
          1: { cellWidth: 35, halign: "left" },
          2: { cellWidth: contentWidth - 20 - 35 - 20, halign: "left" },
          3: { cellWidth: 20, halign: "right" },
        },
        didDrawPage: footer,
      });
    }

    // ---------- Ledger page(s) ----------
    addLedgerToPDF(doc, rows, tenderDefs, meta, M, normMode(meta));

    const safeName = safeFilePart(meta.filterText || "summary");
    doc.save(`summary_${safeName}.pdf`);
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
};

/* -------- Human-friendly filter text -------- */
export const makeFilterText = (filterType, dateRange = {}, selectedMonth = "") => {
  try {
    switch (filterType) {
      case "last7days":  return "Last 7 Days";
      case "thisMonth":
      case "monthly":    return "This Month";
      case "lastMonth":  return "Last Month";
      case "weekly":     return "This Week";
      case "range":
        if (dateRange?.from && dateRange?.to)
          return `${tryFormatDate(dateRange.from)} - ${tryFormatDate(dateRange.to)}`;
        return "Custom Range";
      case "month":
        if (selectedMonth) {
          const [y, m] = selectedMonth.split("-").map(Number);
          if (y && m) return format(new Date(y, m - 1, 1), "MMMM yyyy");
        }
        return "By Month";
      case "all": return "All Data";
      default:    return "All Data";
    }
  } catch {
    return "All Data";
  }
};

export default { exportSummaryToExcel, exportSummaryToPDF, makeFilterText };
