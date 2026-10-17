"use client";
import React, { useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format, parseISO, lastDayOfMonth } from "date-fns";
import { ArrowLeft, Download, FileSpreadsheet, FileText, Info, Printer } from "lucide-react";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { categoryLabel } from "@/app/entry-data/cost-entry/logic/constants";
import { Button, Card, CountUp, EmptyState, Menu, Skeleton, cn } from "@/app/components/ui";
import { useSummaryReportLogic } from "@/hook/useSummaryReportLogic";
import {
  buildStatementColumns,
  buildStatementRow,
  buildStatementTotals,
} from "./lib/buildStatementColumns";
import {
  exportStatementToExcel,
  exportStatementToPDF,
  monthTitle,
  STATEMENT_FOOTNOTES,
} from "@/utils/export/exportMonthlyStatement";

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * A month's statement: each day's sales by way of paying, the till's costs by
 * category, salaries, advances, staff loans and loans given, the bank's (HQ)
 * costs, total spent and what was left — the layout the accountant prints.
 * The columns come from ./lib/buildStatementColumns, shared with the exports.
 */
export default function MonthlyStatementPage() {
  const { period } = useParams();
  const router = useRouter();
  const currency = useCurrency();

  const valid = PERIOD_RE.test(String(period || ""));

  const range = useMemo(() => {
    if (!valid) return null;
    const first = parseISO(`${period}-01`);
    return {
      from: format(first, "yyyy-MM-dd"),
      to: format(lastDayOfMonth(first), "yyyy-MM-dd"),
    };
  }, [period, valid]);

  // Memoized so the hook's dateRange (and the whole derived chain) isn't
  // invalidated on every render by a fresh object literal.
  const filterState = useMemo(
    () => ({
      filterType: "range",
      dateRange: range || { from: "", to: "" },
    }),
    [range]
  );

  const { computed, branchName, companyName, isLoading } = useSummaryReportLogic(
    filterState,
    "all"
  );

  const dailyRows = useMemo(
    () => (computed?.rows || []).filter((r) => r.type === "daily"),
    [computed]
  );

  const cols = useMemo(
    () => buildStatementColumns(dailyRows, computed?.tenderDefs || []),
    [dailyRows, computed]
  );

  const statementRows = useMemo(
    () => dailyRows.map((r) => buildStatementRow(r, cols)),
    [dailyRows, cols]
  );

  const totals = useMemo(
    () => buildStatementTotals(statementRows, cols),
    [statementRows, cols]
  );

  const money = (v) =>
    Number(v || 0) === 0
      ? "-"
      : Number(v).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  const exportMeta = { period, branchName, companyName, currency };

  const cash = (v) => formatMoney(v, currency);

  if (!valid) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          title="That isn't a month"
          description={`“${String(period)}” can't be opened as a statement.`}
          action={<Button onClick={() => router.replace("/reports/yearly-summary")}>Back to the yearly summary</Button>}
        />
      </div>
    );
  }

  const { salesCols, siteCols, hqCols } = cols;
  const band = "px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider";
  const th = "px-3 py-2.5 font-semibold";
  const td = "px-3 py-2";
  const noCosts = !isLoading && totals.totalExpenses - totals.salary - totals.loansGiven === 0;

  return (
    <div className="statement-page mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
      <style>{`
        @media print {
          @page { size: A3 landscape; margin: 8mm; }
          body * { visibility: hidden; }
          .statement-page, .statement-page * { visibility: visible; }
          .statement-page { position: absolute; inset: 0; padding: 0 !important; max-width: none !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .statement-wrap { display: block !important; border: 0 !important; box-shadow: none !important; }
          .statement-scroll { overflow: visible !important; }
          .statement-table th, .statement-table td { position: static !important; font-size: 8px !important; }
        }
      `}</style>

      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/reports/yearly-summary" className="no-print inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
            <ArrowLeft className="size-4" /> Yearly summary
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-fg">{monthTitle(period)}</h1>
          <p className="text-sm text-muted">
            {branchName || "Branch"} · {companyName} · sales statement
          </p>
        </div>
        <Menu
          align="end"
          width={190}
          trigger={(p) => (
            <Button {...p} variant="secondary" icon={Download} disabled={isLoading || !statementRows.length} className="no-print">
              Export
            </Button>
          )}
          items={[
            { label: "Excel", icon: FileSpreadsheet, onSelect: () => exportStatementToExcel(statementRows, totals, cols, exportMeta) },
            { label: "PDF", icon: FileText, onSelect: () => exportStatementToPDF(statementRows, totals, cols, exportMeta) },
            { label: "Print", icon: Printer, onSelect: () => window.print() },
          ]}
        />
      </div>

      {isLoading ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24" rounded="rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-80" rounded="rounded-2xl" />
        </>
      ) : (
        <>
          {/* the month in three numbers */}
          <div className="no-print grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: "Sales", value: totals.totalSales, tone: "text-brand" },
              { label: "Spent", value: totals.totalExpenses, tone: "text-danger", note: "Costs, salaries, advances, loans" },
              { label: totals.netIncome < 0 ? "Loss" : "Left over", value: totals.netIncome, tone: totals.netIncome < 0 ? "text-danger" : "text-fg" },
            ].map((t) => (
              <Card key={t.label} className="p-4">
                <p className="text-xs font-semibold text-muted">{t.label}</p>
                <CountUp value={t.value} format={cash} className={cn("mt-1 block text-2xl font-bold tabular-nums tracking-tight", t.tone)} />
                {t.note && <p className="mt-0.5 text-[11px] text-subtle">{t.note}</p>}
              </Card>
            ))}
          </div>

          {/* phones: a line per day */}
          <Card className="no-print overflow-hidden p-0 md:hidden">
            <ul className="divide-y divide-line">
              {statementRows
                .filter((r) => r.totalSales || r.totalExpenses)
                .reverse()
                .map((r) => (
                  <li key={r.date} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="w-14 shrink-0">
                      <span className="block text-[11px] font-semibold uppercase text-muted">{format(parseISO(r.date), "EEE")}</span>
                      <span className="block font-bold text-fg">{format(parseISO(r.date), "d MMM")}</span>
                    </span>
                    <span className="min-w-0 flex-1 text-xs">
                      <span className="block text-brand">Sales {cash(r.totalSales)}</span>
                      {r.totalExpenses > 0 && <span className="block text-danger">Spent {cash(r.totalExpenses)}</span>}
                    </span>
                    <span className={cn("shrink-0 font-bold tabular-nums", r.netIncome < 0 ? "text-danger" : "text-fg")}>{cash(r.netIncome)}</span>
                  </li>
                ))}
            </ul>
            <p className="border-t border-line bg-surface-2/60 px-4 py-2.5 text-center text-xs text-muted">The full statement, with every column, is on a computer or in the export.</p>
          </Card>

          {/* the statement */}
          <div className="statement-wrap hidden overflow-hidden rounded-2xl border border-line bg-surface shadow-card md:block">
            <div className="statement-scroll overflow-x-auto">
              <table className="statement-table min-w-full whitespace-nowrap text-right text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-line">
                    <th className="sticky left-0 z-20 bg-surface-2" />
                    <th colSpan={salesCols.length + 1} className={cn(band, "bg-brand-soft text-brand")}>
                      Sales
                    </th>
                    <th colSpan={siteCols.length + 4} className={cn(band, "bg-warning-soft text-warning")}>
                      Till (site office)
                    </th>
                    {hqCols.length > 0 && (
                      <th colSpan={hqCols.length} className={cn(band, "bg-info-soft text-info")}>
                        Bank (HQ office)
                      </th>
                    )}
                    <th colSpan={3} className="bg-surface-2" />
                  </tr>
                  <tr className="border-b border-line bg-surface-2 text-muted">
                    <th className={cn(th, "sticky left-0 z-20 bg-surface-2 text-left")}>Day</th>
                    {salesCols.map((c) => (
                      <th key={c.key} className={th}>
                        {c.label}
                      </th>
                    ))}
                    <th className={cn(th, "text-brand")}>Total sales</th>
                    {siteCols.map((c) => (
                      <th key={c.key} className={th}>
                        {categoryLabel(c.label)}
                      </th>
                    ))}
                    <th className={th}>Salary</th>
                    <th className={th}>Advances</th>
                    <th className={th}>Staff loans</th>
                    <th className={th}>Loans given</th>
                    {hqCols.map((c) => (
                      <th key={c.key} className={th}>
                        {categoryLabel(c.label)}
                      </th>
                    ))}
                    <th className={cn(th, "text-danger")}>Total spent</th>
                    <th className={cn(th, "text-fg")}>Left / loss</th>
                    <th className={cn(th, "text-left")}>Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {statementRows.map((r) => {
                    const quiet = !r.totalSales && !r.totalExpenses;
                    return (
                      <tr key={r.date} className={cn("transition-colors hover:bg-surface-2/50", quiet && "text-subtle")}>
                        <td className={cn(td, "sticky left-0 z-10 bg-surface text-left font-semibold", quiet ? "text-subtle" : "text-fg")}>{format(parseISO(r.date), "EEE d MMM")}</td>
                        {salesCols.map((c) => (
                          <td key={c.key} className={td}>
                            {money(r.sales[c.key])}
                          </td>
                        ))}
                        <td className={cn(td, "font-bold text-brand")}>{money(r.totalSales)}</td>
                        {siteCols.map((c) => (
                          <td key={c.key} className={td}>
                            {money(r.siteCosts[c.key])}
                          </td>
                        ))}
                        <td className={td}>{money(r.salary)}</td>
                        <td className={td}>{money(r.advance)}</td>
                        <td className={td}>{money(r.staffLoan)}</td>
                        <td className={td}>{money(r.loansGiven)}</td>
                        {hqCols.map((c) => (
                          <td key={c.key} className={td}>
                            {money(r.hqCosts[c.key])}
                          </td>
                        ))}
                        <td className={cn(td, "font-bold text-danger")}>{money(r.totalExpenses)}</td>
                        <td className={cn(td, "font-bold", r.netIncome < 0 ? "text-danger" : "text-fg")}>{money(r.netIncome)}</td>
                        <td className={td} />
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-line bg-surface-2 font-bold">
                  <tr>
                    <td className={cn(td, "sticky left-0 z-10 bg-surface-2 py-3 text-left text-fg")}>Total</td>
                    {salesCols.map((c) => (
                      <td key={c.key} className={cn(td, "py-3")}>
                        {money(totals.sales[c.key])}
                      </td>
                    ))}
                    <td className={cn(td, "py-3 text-brand")}>{money(totals.totalSales)}</td>
                    {siteCols.map((c) => (
                      <td key={c.key} className={cn(td, "py-3")}>
                        {money(totals.siteCosts[c.key])}
                      </td>
                    ))}
                    <td className={cn(td, "py-3")}>{money(totals.salary)}</td>
                    <td className={cn(td, "py-3")}>{money(totals.advance)}</td>
                    <td className={cn(td, "py-3")}>{money(totals.staffLoan)}</td>
                    <td className={cn(td, "py-3")}>{money(totals.loansGiven)}</td>
                    {hqCols.map((c) => (
                      <td key={c.key} className={cn(td, "py-3")}>
                        {money(totals.hqCosts[c.key])}
                      </td>
                    ))}
                    <td className={cn(td, "py-3 text-danger")}>{money(totals.totalExpenses)}</td>
                    <td className={cn(td, "py-3", totals.netIncome < 0 ? "text-danger" : "text-fg")}>
                      {currency} {money(totals.netIncome)}
                    </td>
                    <td className={td} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {noCosts && <p className="text-sm text-muted">No costs recorded for {monthTitle(period)}.</p>}

          <div className="flex gap-2 rounded-2xl border border-line bg-surface-2/50 p-4 text-xs text-muted">
            <Info className="mt-0.5 size-4 shrink-0 text-subtle" />
            <div className="space-y-1">
              <p className="font-semibold text-fg">Please note</p>
              {STATEMENT_FOOTNOTES.map((f) => (
                <p key={f}>{f}</p>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
