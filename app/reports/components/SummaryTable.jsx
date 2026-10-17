"use client";
import { format, parseISO } from "date-fns";
import { NotebookPen } from "lucide-react";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { cn } from "@/app/components/ui";

// --- figures ---------------------------------------------------------------
const nonZero = (v) => isFinite(Number(v)) && Math.abs(Number(v)) >= 1e-9;
const plain = (v) => (nonZero(v) ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "–");
const dayText = (d, f = "dd MMM") => {
  if (!d) return "—";
  const dt = typeof d === "string" ? parseISO(d) : d;
  return !dt || isNaN(dt) ? "—" : format(dt, f);
};

// colour by what the money does: in, out, bank, loans
const INK = { in: "text-brand", out: "text-danger", bank: "text-info", loan: "text-warning", none: "text-fg" };
// a thin bar on the left marks the kind of line
const MARK = {
  balance: "before:bg-subtle",
  loan: "before:bg-warning",
  repayment: "before:bg-info",
  deposit: "before:bg-info",
  withdraw: "before:bg-danger",
  staffAdvance: "before:bg-danger",
  staffLoan: "before:bg-warning",
  total: "before:bg-brand",
};

// --- the values on one line (shared by the table and the phone cards) --------
const advanceOf = (row) => row.advance ?? (row.type === "staffAdvance" ? row.amount : null);
const loanGivenOf = (row) =>
  row.type === "daily" || row.type === "total"
    ? (row.loanGiven || 0) + (row.staffLoanGiven || 0) || null
    : row.type === "loan" && row.role === "lender"
      ? row.amount
      : row.type === "staffLoan"
        ? row.amount
        : null;
const loanRecvOf = (row) => row.loanReceived ?? (row.type === "loan" && row.role === "borrower" ? row.amount : null);
// the engine's line names, in the words the app uses
const labelOf = (row) => (row.type === "deposit" ? "Cash to bank" : row.type === "withdraw" ? "Bank to cash" : row.label || row.type);
const depositOf = (row) => row.deposit ?? (row.type === "deposit" ? row.amount : null);
const withdrawalOf = (row) => row.withdrawal ?? (row.type === "withdraw" ? row.amount : null);

// --- computers: one wide table --------------------------------------------
const TH = ({ children, className = "" }) => <th className={cn("whitespace-nowrap px-3 py-2.5 text-right font-semibold", className)}>{children}</th>;
const TD = ({ children, className = "", colSpan }) => (
  <td colSpan={colSpan} className={cn("whitespace-nowrap px-3 py-2 text-right tabular-nums", className)}>
    {children}
  </td>
);
const Val = ({ v, ink = "none" }) => <span className={nonZero(v) ? INK[ink] : "text-subtle"}>{plain(v)}</span>;

function Header({ ctx }) {
  const { tenderDefs, hiddenCols, showRepayCash, showRepayBank, costCols, showBankBalance } = ctx;
  const group = "bg-surface-2 text-[11px] uppercase tracking-wide text-muted";
  return (
    <tr className={group}>
      <TH className="sticky left-0 z-20 bg-surface-2 text-left">Day</TH>
      {tenderDefs.map((t) => (!hiddenCols.cash || t.key !== "cash" ? <TH key={t.key}>{t.label || t.key}</TH> : null))}
      <TH>Advance</TH>
      {costCols.map((c) => (
        <TH key={c}>Cost ({c === "cash" ? "cash" : "bank"})</TH>
      ))}
      <TH>Salary</TH>
      <TH>Loan given</TH>
      <TH>Loan received</TH>
      {showRepayCash && (
        <>
          <TH>Repaid in (cash)</TH>
          <TH>Repaid out (cash)</TH>
        </>
      )}
      {showRepayBank && (
        <>
          <TH>Repaid in (bank)</TH>
          <TH>Repaid out (bank)</TH>
        </>
      )}
      <TH>Cash to bank</TH>
      <TH>Bank to cash</TH>
      <TH className="text-fg">Total sales</TH>
      {!hiddenCols.cashInHand && <TH className="text-brand">Cash in hand</TH>}
      {showBankBalance && <TH className="text-info">Bank balance</TH>}
      <TH className="text-left normal-case tracking-normal">Notes</TH>
    </tr>
  );
}

function Row({ row, ctx, isTotal }) {
  const { tenderDefs, hiddenCols, showRepayCash, showRepayBank, costCols, showBankBalance, money } = ctx;
  const first = cn(
    "sticky left-0 z-10 text-left relative before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full",
    MARK[isTotal ? "total" : row.type] || "before:bg-transparent"
  );

  if (row.type === "salesNote") {
    return (
      <tr className="bg-warning-soft/60">
        <TD colSpan={100} className="text-left text-fg">
          <span className="inline-flex items-start gap-2 whitespace-pre-wrap text-xs">
            <NotebookPen className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <span>
              <b className="font-semibold">{row.label}</b> · {row.notesText}
            </span>
          </span>
        </TD>
      </tr>
    );
  }

  if (row.type === "balance") {
    let mid = 0;
    tenderDefs.forEach((t) => {
      if (!hiddenCols.cash || t.key !== "cash") mid++;
    });
    mid += 7 + costCols.length + (showRepayCash ? 2 : 0) + (showRepayBank ? 2 : 0);
    return (
      <tr className="bg-surface-2/60">
        <TD className={cn(first, "bg-surface-2 font-semibold text-fg")}>Brought forward</TD>
        <TD colSpan={mid} className="text-center text-xs italic text-subtle">
          from before {dayText(row.date, "d MMM yyyy")}
        </TD>
        {!hiddenCols.cashInHand && <TD className="font-semibold text-brand">{money(row.runningCash)}</TD>}
        {showBankBalance && <TD className="font-semibold text-info">{money(row.runningBank)}</TD>}
        <TD />
      </tr>
    );
  }

  const daily = row.type === "daily";
  const bg = isTotal ? "bg-surface-2" : daily ? "bg-surface" : "bg-surface-2/30";
  return (
    <tr className={cn(bg, isTotal ? "font-bold" : daily ? "" : "text-xs")}>
      <TD className={cn(first, bg, daily || isTotal ? "font-semibold text-fg" : "pl-6 text-muted")}>
        {isTotal ? "Period total" : daily ? dayText(row.date, "EEE dd MMM") : labelOf(row)}
        {row.method && <span className="ml-2 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">{row.method}</span>}
      </TD>
      {tenderDefs.map((t) => {
        if (hiddenCols.cash && t.key === "cash") return null;
        return (
          <TD key={t.key}>
            <Val v={row.tenders?.[t.key] ?? (isTotal ? row[t.key] : null)} ink="in" />
          </TD>
        );
      })}
      <TD>
        <Val v={advanceOf(row)} ink="out" />
      </TD>
      {costCols.map((c) => (
        <TD key={c}>
          <Val v={c === "cash" ? row.costCash : row.costBank} ink="out" />
        </TD>
      ))}
      <TD>
        <Val v={row.salaryCash} ink="out" />
      </TD>
      <TD>
        <Val v={loanGivenOf(row)} ink="loan" />
      </TD>
      <TD>
        <Val v={loanRecvOf(row)} ink="loan" />
      </TD>
      {showRepayCash && (
        <>
          <TD>
            <Val v={row.repayCashIn} ink="in" />
          </TD>
          <TD>
            <Val v={row.repayCashOut} ink="out" />
          </TD>
        </>
      )}
      {showRepayBank && (
        <>
          <TD>
            <Val v={row.repayBankIn} ink="in" />
          </TD>
          <TD>
            <Val v={row.repayBankOut} ink="out" />
          </TD>
        </>
      )}
      <TD>
        <Val v={depositOf(row)} ink="bank" />
      </TD>
      <TD>
        <Val v={withdrawalOf(row)} ink="out" />
      </TD>
      <TD className="font-semibold">
        <Val v={row.totalSales} />
      </TD>
      {!hiddenCols.cashInHand && <TD className="font-semibold text-brand">{row.runningCash !== undefined ? plain(row.runningCash) : ""}</TD>}
      {showBankBalance && <TD className="font-semibold text-info">{row.runningBank !== undefined ? plain(row.runningBank) : ""}</TD>}
      <TD className="max-w-[14rem] truncate text-left text-xs text-muted" title={row.salesNotesText || undefined}>
        {daily && row.salesNotesText ? row.salesNotesText : ""}
      </TD>
    </tr>
  );
}

// --- phones: a card per day, the day's other movements inside it ------------
function Line({ label, value, ink = "none", money }) {
  if (!nonZero(value)) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-muted">{label}</span>
      <span className={cn("font-medium tabular-nums", INK[ink])}>{money(value)}</span>
    </div>
  );
}

function DayCard({ row, events, ctx }) {
  const { tenderDefs, hiddenCols, costCols, showRepayCash, showRepayBank, showBankBalance, money } = ctx;
  const isTotal = row.type === "total";
  return (
    <div className={cn("rounded-2xl border border-line p-4", isTotal ? "bg-surface-2" : "bg-surface")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-fg">{isTotal ? "Period total" : dayText(row.date, "EEE, d MMM")}</p>
          {nonZero(row.totalSales) && <p className="text-xs text-muted">Sales {money(row.totalSales)}</p>}
        </div>
        <div className="text-right text-xs">
          {!hiddenCols.cashInHand && row.runningCash !== undefined && (
            <p className="text-muted">
              Cash <b className="font-semibold tabular-nums text-brand">{money(row.runningCash)}</b>
            </p>
          )}
          {showBankBalance && row.runningBank !== undefined && (
            <p className="text-muted">
              Bank <b className="font-semibold tabular-nums text-info">{money(row.runningBank)}</b>
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 border-t border-line pt-2 text-sm">
        {tenderDefs.map((t) => (!hiddenCols.cash || t.key !== "cash" ? <Line key={t.key} label={t.label || t.key} value={row.tenders?.[t.key] ?? (isTotal ? row[t.key] : null)} ink="in" money={money} /> : null))}
        <Line label="Advance" value={advanceOf(row)} ink="out" money={money} />
        {costCols.map((c) => (
          <Line key={c} label={`Cost (${c})`} value={c === "cash" ? row.costCash : row.costBank} ink="out" money={money} />
        ))}
        <Line label="Salary" value={row.salaryCash} ink="out" money={money} />
        <Line label="Loan given" value={loanGivenOf(row)} ink="loan" money={money} />
        <Line label="Loan received" value={row.loanReceived} ink="loan" money={money} />
        {showRepayCash && (
          <>
            <Line label="Repaid in (cash)" value={row.repayCashIn} ink="in" money={money} />
            <Line label="Repaid out (cash)" value={row.repayCashOut} ink="out" money={money} />
          </>
        )}
        {showRepayBank && (
          <>
            <Line label="Repaid in (bank)" value={row.repayBankIn} ink="in" money={money} />
            <Line label="Repaid out (bank)" value={row.repayBankOut} ink="out" money={money} />
          </>
        )}
        <Line label="Cash to bank" value={row.deposit} ink="bank" money={money} />
        <Line label="Bank to cash" value={row.withdrawal} ink="out" money={money} />
      </div>

      {events.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-line pt-2 text-xs">
          {events.map((e, i) =>
            e.type === "salesNote" ? (
              <li key={i} className="flex gap-1.5 rounded-lg bg-warning-soft/60 px-2 py-1.5 text-fg">
                <NotebookPen className="mt-0.5 size-3.5 shrink-0 text-warning" />
                <span className="whitespace-pre-wrap">{e.notesText}</span>
              </li>
            ) : (
              <li key={i} className="flex justify-between gap-3 text-muted">
                <span className="truncate">{labelOf(e)}</span>
                <span className="shrink-0 font-medium tabular-nums text-fg">{money(e.amount)}</span>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * The day-by-day cash book: each day's sales by payment type, money out, loans,
 * moves between till and bank, and the running cash and bank. On computers a
 * wide table (the day column stays put while it scrolls); on phones a card a
 * day. The figures are the ledger's — this only lays them out.
 */
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
    money: (v) => formatMoney(v, currency),
    showRepayCash: showRepayCashCols,
    showRepayBank: showRepayBankCols,
    costCols: mode === "front" ? ["cash"] : mode === "back" ? ["bank"] : ["cash", "bank"],
    showBankBalance: mode !== "front",
  };
  const dailyRows = summaryRows.filter((r) => r.type === "daily");
  const sumField = (key) => dailyRows.reduce((s, r) => s + Number(r[key] || 0), 0);
  const last = dailyRows[dailyRows.length - 1];

  const totalRow = {
    type: "total",
    label: "Period Totals",
    ...periodTotals,
    advance: sumField("advance"),
    staffLoanGiven: sumField("staffLoanGiven"),
    costCash: sumField("costCash"),
    costBank: sumField("costBank"),
    salaryCash: sumField("salaryCash"),
    loanGiven: sumField("loanGiven"),
    loanReceived: sumField("loanReceived"),
    deposit: periodDeposits,
    withdrawal: periodWithdrawals,
    repayCashIn: periodRepaySums.cashIn,
    repayCashOut: periodRepaySums.cashOut,
    repayBankIn: periodRepaySums.bankIn,
    repayBankOut: periodRepaySums.bankOut,
    totalSales: periodTotalSales || sumField("totalSales"),
    runningCash: last?.runningCash,
    runningBank: last?.runningBank,
  };

  // phones: each day with the lines that follow it (loans, deposits, notes…)
  const days = [];
  for (const r of summaryRows) {
    if (r.type === "daily") days.push({ row: r, events: [] });
    // a day's deposits and withdrawals are already its "Cash to bank" / "Bank to cash" lines
    else if (r.type !== "balance" && r.type !== "deposit" && r.type !== "withdraw" && days.length) days[days.length - 1].events.push(r);
  }
  const opening = summaryRows.find((r) => r.type === "balance");

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface shadow-card md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-line">
              <Header ctx={ctx} />
            </thead>
            <tbody className="divide-y divide-line">
              {summaryRows.map((row, i) => (
                <Row key={i} row={row} ctx={ctx} />
              ))}
              <Row row={totalRow} ctx={ctx} isTotal />
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {opening && (
          <div className="flex items-center justify-between rounded-2xl border border-dashed border-line px-4 py-3 text-xs">
            <span className="font-semibold text-muted">Brought forward</span>
            <span className="space-x-3 text-right">
              {!hiddenCols.cashInHand && (
                <span className="text-muted">
                  Cash <b className="tabular-nums text-brand">{ctx.money(opening.runningCash)}</b>
                </span>
              )}
              {ctx.showBankBalance && (
                <span className="text-muted">
                  Bank <b className="tabular-nums text-info">{ctx.money(opening.runningBank)}</b>
                </span>
              )}
            </span>
          </div>
        )}
        {[...days].reverse().map((d) => (
          <DayCard key={d.row.date} row={d.row} events={d.events} ctx={ctx} />
        ))}
        <DayCard row={totalRow} events={[]} ctx={ctx} />
      </div>
    </>
  );
}
