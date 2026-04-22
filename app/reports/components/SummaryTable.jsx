/* eslint-disable react/prop-types */
import React from "react";
import { format, parseISO } from "date-fns";
import useCurrency from "@/app/hooks/useCurrency";

// --- 1. Static Utils (Pure Functions) ---
const fmt = (v) => {
  const n = Number(v);
  return isFinite(n) && Math.abs(n) >= 1e-9
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "-";
};
const fmtRMFactory = (currency) => (v) => {
  const s = fmt(v);
  return s === "-" ? "-" : `${currency} ${s}`;
};
const fmtRM = (v, currency) => {
  const s = fmt(v);
  return s === "-" ? "-" : `${currency || 'RM'} ${s}`;
};
const renderDate = (d) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? parseISO(d) : d;
  return !dt || isNaN(dt) ? "—" : format(dt, "dd-MMM");
};
const nonZero = (v) => isFinite(Number(v)) && Math.abs(Number(v)) >= 1e-9;

// --- 2. Shared Sub-Components ---
const Badge = ({ children, color = "slate" }) => (
  <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border ml-2 bg-${color}-50 border-${color}-200 text-${color}-700`}>
    {children}
  </span>
);

const SalesNotes = ({ text, details }) => {
  if (!text) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex items-start gap-2 text-xs text-slate-700 text-left">
      <span title={text}>📝</span>
      <div>
        <div className="max-w-[12rem] truncate" title={text}>{text}</div>
        <details className="mt-1">
          <summary className="cursor-pointer text-emerald-700 hover:underline">View</summary>
          <div className="mt-1 rounded border bg-amber-50 p-2 text-amber-900 shadow-sm min-w-[200px] z-50 relative">
            {Object.entries(details || {}).map(([k, arr]) => (
              <div key={k} className="mb-1">
                <strong className="capitalize">{k}:</strong> {arr.join(", ")}
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
};

// --- 3. Desktop Sub-Components ---
const TH = ({ children, className = "" }) => (
  <th className={`p-2 border whitespace-nowrap ${className}`}>{children}</th>
);
const TD = ({ children, className = "", colSpan }) => (
  <td colSpan={colSpan} className={`p-2 border whitespace-nowrap text-xs ${className}`}>{children}</td>
);

const DesktopHeader = ({ ctx }) => {
  const { tenderDefs, hiddenCols, showRepayCash, showRepayBank, costCols, showBankBalance } = ctx;
  return (
    <tr className="text-[11px] uppercase tracking-wide">
      <TH className="sticky left-0 z-20 bg-slate-100 text-slate-600">Date</TH>
      {tenderDefs.map(t => (!hiddenCols.cash || t.key !== 'cash'
        ? <TH key={t.key} className="bg-emerald-50 text-emerald-800">{t.label || t.key}</TH>
        : null))}
      <TH className="bg-rose-50 text-rose-800">Advance</TH>
      {costCols.map(c => <TH key={c} className="bg-rose-50 text-rose-800">Cost ({c === 'cash' ? 'Cash' : 'Bank'})</TH>)}
      <TH className="bg-rose-50 text-rose-800">Salary</TH>
      <TH className="hidden md:table-cell bg-amber-50 text-amber-800">Loan Given</TH>
      <TH className="hidden md:table-cell bg-amber-50 text-amber-800">Loan Recv</TH>
      {showRepayCash && <>
        <TH className="hidden md:table-cell bg-amber-50 text-amber-800">Repay In (Cash)</TH>
        <TH className="hidden md:table-cell bg-amber-50 text-amber-800">Repay Out (Cash)</TH>
      </>}
      {showRepayBank && <>
        <TH className="hidden md:table-cell bg-amber-50 text-amber-800">Repay In (Bank)</TH>
        <TH className="hidden md:table-cell bg-amber-50 text-amber-800">Repay Out (Bank)</TH>
      </>}
      <TH className="bg-blue-50 text-blue-800">Deposit</TH>
      <TH className="bg-blue-50 text-blue-800">Withdrawal</TH>
      <TH className="bg-slate-100 text-slate-800 font-bold">Total Sales</TH>
      {!hiddenCols.cashInHand && <TH className="bg-emerald-100 text-emerald-900 font-bold">Cash in Hand</TH>}
      {showBankBalance && <TH className="bg-blue-100 text-blue-900 font-bold">Bank Balance</TH>}
      <TH className="bg-slate-50 text-slate-500 text-left normal-case tracking-normal">Notes</TH>
    </tr>
  );
};

// Left border color per row type for quick visual scanning
const ROW_TYPE_BORDER = {
  balance:     "border-l-4 border-l-slate-400",
  loan:        "border-l-4 border-l-amber-400",
  repayment:   "border-l-4 border-l-blue-400",
  deposit:     "border-l-4 border-l-emerald-400",
  withdraw:    "border-l-4 border-l-rose-400",
  total:       "border-l-4 border-l-blue-600",
  staffAdvance:"border-l-4 border-l-rose-400",
  staffLoan:   "border-l-4 border-l-amber-500",
};

const DesktopRow = ({ row, ctx, isBalance, isTotal }) => {
  const { tenderDefs, hiddenCols, showRepayCash, showRepayBank, costCols, showBankBalance } = ctx;

  if (row.type === 'salesNote') {
    return (
      <tr className="bg-amber-50">
        <TD colSpan={100} className="text-left text-amber-900">
          <div className="font-semibold flex gap-2"><span>📝</span> {row.label}</div>
          <div className="whitespace-pre-wrap pl-6">{row.notesText}</div>
        </TD>
      </tr>
    );
  }

  // Balance row: condensed — only show label + running balances, no empty cells
  if (isBalance) {
    let midCols = 0;
    tenderDefs.forEach(t => { if (!hiddenCols.cash || t.key !== 'cash') midCols++; });
    // Advance(1) + Costs + Salary(1) + LoanGiven(1) + LoanRecv(1) + Deposit(1) + Withdrawal(1) + TotalSales(1)
    midCols += 7 + costCols.length;
    if (showRepayCash) midCols += 2;
    if (showRepayBank) midCols += 2;
    return (
      <tr className="bg-slate-50 border-y-2 border-slate-200">
        <TD className={`sticky left-0 z-10 bg-slate-50 font-bold text-slate-700 py-3 ${ROW_TYPE_BORDER.balance}`}>
          {row.label}
        </TD>
        <TD colSpan={midCols} className="text-center text-slate-400 italic text-[11px] bg-slate-50">
          — prior period —
        </TD>
        {!hiddenCols.cashInHand && (
          <TD className="font-bold text-emerald-700 bg-emerald-50">
            {fmtRM(row.runningCash, ctx.currency)}
          </TD>
        )}
        {showBankBalance && (
          <TD className="font-bold text-blue-700 bg-blue-50">
            {fmtRM(row.runningBank, ctx.currency)}
          </TD>
        )}
        <TD className="bg-slate-50" />
      </tr>
    );
  }

  const bg = isTotal
    ? "bg-blue-50 font-bold"
    : row.type === 'repayment'    ? "bg-blue-50"
    : row.type === 'loan'         ? "bg-amber-50"
    : row.type === 'deposit'      ? "bg-emerald-50"
    : row.type === 'withdraw'     ? "bg-rose-50"
    : row.type === 'staffAdvance' ? "bg-rose-50"
    : row.type === 'staffLoan'    ? "bg-amber-50"
    : "bg-white";

  const borderClass = ROW_TYPE_BORDER[row.type] || "";

  const Val = ({ v, rm }) => <span>{rm ? fmtRM(v, ctx.currency) : fmt(v)}</span>;

  return (
    <tr className={`${bg} text-center`}>
      {/* Date / Label — left border indicates row type */}
      <TD className={`sticky left-0 z-10 text-left ${bg} ${borderClass}`}>
        {isTotal || row.type !== 'daily' ? row.label || row.type : renderDate(row.date)}
        {row.method && <Badge>{row.method}</Badge>}
      </TD>

      {/* Tenders (green = inflow) */}
      {tenderDefs.map(t => {
        if (hiddenCols.cash && t.key === 'cash') return null;
        const v = row.tenders?.[t.key] ?? (isTotal ? row[t.key] : null);
        return <TD key={t.key} className="text-emerald-700"><Val v={v} /></TD>;
      })}

      {/* Expenses (red = outflow) */}
      <TD className="text-rose-600">
        <Val v={row.advance ?? (row.type === 'staffAdvance' ? row.amount : null)} />
      </TD>
      {costCols.map(c => <TD key={c} className="text-rose-600"><Val v={c === 'cash' ? row.costCash : row.costBank} /></TD>)}
      <TD className="text-rose-700"><Val v={row.salaryCash} /></TD>

      {/* Loans — inter-branch + staff loans both show here */}
      <TD className="hidden md:table-cell text-amber-700">
        <Val v={
          row.type === 'daily' || isTotal
            ? ((row.loanGiven || 0) + (row.staffLoanGiven || 0)) || null
            : row.type === 'loan'      && row.role === 'lender' ? row.amount
            : row.type === 'staffLoan' ? row.amount
            : null
        } rm />
      </TD>
      <TD className="hidden md:table-cell text-amber-600">
        <Val v={row.loanReceived ?? (row.type === 'loan' && row.role === 'borrower' ? row.amount : null)} rm />
      </TD>

      {/* Repayments */}
      {showRepayCash && <>
        <TD className="hidden md:table-cell text-emerald-700"><Val v={row.repayCashIn} rm /></TD>
        <TD className="hidden md:table-cell text-rose-600"><Val v={row.repayCashOut} rm /></TD>
      </>}
      {showRepayBank && <>
        <TD className="hidden md:table-cell text-emerald-700"><Val v={row.repayBankIn} rm /></TD>
        <TD className="hidden md:table-cell text-rose-600"><Val v={row.repayBankOut} rm /></TD>
      </>}

      {/* Bank movements */}
      <TD className="text-blue-700"><Val v={row.deposit ?? (row.type === 'deposit' ? row.amount : null)} rm /></TD>
      <TD className="text-rose-600"><Val v={row.withdrawal ?? (row.type === 'withdraw' ? row.amount : null)} rm /></TD>

      {/* Totals */}
      <TD className="font-semibold"><Val v={row.totalSales} /></TD>
      {!hiddenCols.cashInHand && <TD className="font-semibold text-emerald-700"><Val v={row.runningCash} /></TD>}
      {showBankBalance && <TD className="font-semibold text-blue-700"><Val v={row.runningBank} rm={isTotal} /></TD>}

      <TD>
        {row.type === 'daily' && <SalesNotes text={row.salesNotesText} details={row.salesNotesByTender} />}
      </TD>
    </tr>
  );
};

// --- 4. Mobile Sub-Components ---
const MobileLine = ({ label, value, ctx, tone = "neutral", rm = true }) => {
  if (!nonZero(value) && value !== '-') return null;
  const colors = { neutral: "text-slate-800", in: "text-green-700", out: "text-red-700" };
  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{label}</span>
      <span className={`font-medium ${colors[tone]}`}>{rm ? fmtRM(value, ctx?.currency) : fmt(value)}</span>
    </div>
  );
};

const MOBILE_CARD_STYLE = {
  balance:   "border-l-4 border-l-slate-400 bg-slate-50",
  total:     "border-l-4 border-l-blue-600 bg-blue-50 font-bold",
  loan:      "border-l-4 border-l-amber-400 bg-amber-50",
  repayment: "border-l-4 border-l-blue-400 bg-blue-50",
  deposit:   "border-l-4 border-l-emerald-400 bg-emerald-50",
  withdraw:  "border-l-4 border-l-rose-400 bg-rose-50",
};

const MobileCard = ({ row, ctx }) => {
  const { tenderDefs, costCols, hiddenCols } = ctx;
  const isNote = row.type === 'salesNote';
  const isDaily = row.type === 'daily';
  const isBal = row.type === 'balance';

  if (isNote) return (
    <div className="rounded-lg border bg-amber-50 p-3 shadow-sm text-amber-900">
      <div className="font-semibold flex gap-2">📝 {row.label}</div>
      <div className="mt-1 text-sm whitespace-pre-wrap">{row.notesText}</div>
    </div>
  );

  const cardStyle = MOBILE_CARD_STYLE[row.type] || "bg-white";

  return (
    <div className={`rounded-lg border p-3 shadow-sm ${cardStyle}`}>
      <div className="flex justify-between items-center mb-2">
        <div className="font-semibold capitalize">
          {isDaily ? renderDate(row.date) : row.label || row.type}
          {row.method && <Badge>{row.method}</Badge>}
        </div>
        <div className="flex gap-3">
          {!hiddenCols.cashInHand && row.runningCash !== undefined && (
            <div className="text-xs text-slate-500">Cash: <span className="font-medium text-emerald-700">{fmtRM(row.runningCash, ctx.currency)}</span></div>
          )}
          {ctx.showBankBalance && row.runningBank !== undefined && (
            <div className="text-xs text-slate-500">Bank: <span className="font-medium text-blue-700">{fmtRM(row.runningBank, ctx.currency)}</span></div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        {row.totalSales > 0 && <MobileLine ctx={ctx} label="Total Sales" value={row.totalSales} rm={false} />}
        <MobileLine ctx={ctx} label="Deposit" value={row.deposit} tone="in" />
        <MobileLine ctx={ctx} label="Withdrawal" value={row.withdrawal} tone="out" />
        <MobileLine ctx={ctx} label="Advance" value={row.advance ?? (row.type === 'staffAdvance' ? row.amount : null)} tone="out" />
        {costCols.map(c => <MobileLine key={c} ctx={ctx} label={`Cost (${c})`} value={c==='cash'?row.costCash:row.costBank} tone="out" />)}
        <MobileLine ctx={ctx} label="Salary" value={row.salaryCash} tone="out" />

        <MobileLine ctx={ctx} label="Loan Given"
          value={row.type === 'daily' || row.type === 'total'
            ? ((row.loanGiven || 0) + (row.staffLoanGiven || 0)) || null
            : row.type === 'staffLoan' ? row.amount
            : row.loanGiven}
          tone="out" />
        <MobileLine ctx={ctx} label="Loan Recv" value={row.loanReceived} tone="in" />
        
        {ctx.showRepayCash && <><MobileLine ctx={ctx} label="Repay In (Cash)" value={row.repayCashIn} tone="in" /><MobileLine ctx={ctx} label="Repay Out (Cash)" value={row.repayCashOut} tone="out" /></>}
        {ctx.showRepayBank && <><MobileLine ctx={ctx} label="Repay In (Bank)" value={row.repayBankIn} tone="in" /><MobileLine ctx={ctx} label="Repay Out (Bank)" value={row.repayBankOut} tone="out" /></>}
        
        {!isDaily && !isBal && <MobileLine ctx={ctx} label="Amount" value={row.amount} tone={row.direction === 'out' || row.role==='lender' ? 'out' : 'in'} />}
      </div>

      {isDaily && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-slate-500">Tender breakdown</summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {tenderDefs.map(t => (!hiddenCols.cash || t.key !== 'cash') && (
               <MobileLine key={t.key} ctx={ctx} label={t.label} value={row.tenders?.[t.key]} rm={false} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

// --- 5. Main Component ---
export default function SummaryTable({
  tenderDefs = [],
  summaryRows = [],
  mode,
  periodTotals = {},
  periodTotalSales = 0,
  periodDeposits = 0,
  periodWithdrawals = 0,
  periodRepaySums = {},
  hiddenCols = { cash: false, cashInHand: false },
  showRepayCashCols = true,
  showRepayBankCols = true,
}) {
  const currency = useCurrency();
  const ctx = {
    tenderDefs,
    hiddenCols,
    currency,
    showRepayCash: showRepayCashCols,
    showRepayBank: showRepayBankCols,
    costCols: mode === "front" ? ["cash"] : mode === "back" ? ["bank"] : ["cash", "bank"],
    showBankBalance: mode !== "front",
  };
  const dailyRows = summaryRows.filter(r => r.type === 'daily');
  const sumField = (key) => dailyRows.reduce((s, r) => s + Number(r[key] || 0), 0);
  const lastDailyRow = dailyRows[dailyRows.length - 1];

  const periodTotalsRow = {
    type: 'total',
    label: 'Period Totals',
    ...periodTotals,
    advance:         sumField('advance'),
    staffLoanGiven:  sumField('staffLoanGiven'),
    costCash:        sumField('costCash'),
    costBank:        sumField('costBank'),
    salaryCash:      sumField('salaryCash'),
    loanGiven:       sumField('loanGiven'),
    loanReceived:    sumField('loanReceived'),
    deposit:      periodDeposits,
    withdrawal:   periodWithdrawals,
    repayCashIn:  periodRepaySums.cashIn,
    repayCashOut: periodRepaySums.cashOut,
    repayBankIn:  periodRepaySums.bankIn,
    repayBankOut: periodRepaySums.bankOut,
    totalSales:   periodTotalSales || sumField('totalSales'),
    runningCash:  lastDailyRow?.runningCash,
    runningBank:  lastDailyRow?.runningBank,
  };

  return (
    <>
      <div className="hidden md:block overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full border-collapse text-xs sm:text-sm">
          <thead><DesktopHeader ctx={ctx} /></thead>
          <tbody>
            {summaryRows.map((row, i) => (
              <DesktopRow key={i} row={row} ctx={ctx} isBalance={row.type === 'balance'} />
            ))}
            <DesktopRow row={periodTotalsRow} ctx={ctx} isTotal />
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-2">
        {summaryRows.map((row, i) => <MobileCard key={i} row={row} ctx={ctx} />)}
        <MobileCard row={periodTotalsRow} ctx={ctx} />
      </div>
    </>
  );
}