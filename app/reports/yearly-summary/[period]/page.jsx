"use client";
import React, { useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format, parseISO, lastDayOfMonth } from "date-fns";
import Button from "@/app/components/common/Button";
import useCurrency from "@/app/hooks/useCurrency";
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

  if (!valid) {
    return (
      <div className="p-6">
        <p className="text-gray-600">
          &ldquo;{String(period)}&rdquo; is not a valid month.
        </p>
        <button
          onClick={() => router.replace("/reports/yearly-summary")}
          className="mt-3 text-blue-600 hover:underline"
        >
          Back to Yearly Summary
        </button>
      </div>
    );
  }

  const { salesCols, siteCols, hqCols } = cols;

  return (
    <div className="p-4 md:p-6 statement-page">
      <style>{`
        @media print {
          @page {
            size: A3 landscape;
            margin: 8mm;
          }
          body * {
            visibility: hidden;
          }
          .statement-page,
          .statement-page * {
            visibility: visible;
          }
          .statement-page {
            position: absolute;
            inset: 0;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          /* Sticky offsets fight the print layout — flatten them. */
          .statement-scroll {
            overflow: visible !important;
          }
          .statement-table th,
          .statement-table td {
            position: static !important;
            font-size: 8px !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
        <div>
          <Link
            href="/reports/yearly-summary"
            className="no-print text-sm text-blue-600 hover:underline"
          >
            &larr; Back to Yearly Summary
          </Link>
          <h1 className="text-xl md:text-2xl font-bold capitalize mt-1">
            {companyName}
          </h1>
          <p className="text-gray-600 text-sm italic">
            {branchName || "Branch"} &mdash; Sales Statement for{" "}
            {monthTitle(period)}
          </p>
        </div>

        <div className="no-print flex items-center gap-2">
          <Button
            onClick={() => exportStatementToExcel(statementRows, totals, cols, exportMeta)}
            disabled={isLoading || !statementRows.length}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            Export Excel
          </Button>
          <Button
            onClick={() => exportStatementToPDF(statementRows, totals, cols, exportMeta)}
            disabled={isLoading || !statementRows.length}
            className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
          >
            Export PDF
          </Button>
          <Button
            onClick={() => window.print()}
            disabled={isLoading || !statementRows.length}
            variant="ghost"
          >
            Print
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-gray-500 p-6 text-center bg-white rounded-xl shadow-sm">
          Loading daily records&hellip;
        </div>
      ) : (
        <>
          <div className="statement-scroll bg-white border rounded-xl shadow-sm overflow-x-auto">
            <table className="statement-table w-full text-right text-xs whitespace-nowrap">
              <thead>
                {/* Band row */}
                <tr className="border-b border-gray-200">
                  <th className="sticky left-0 z-20 bg-gray-100 border-r" />
                  <th
                    colSpan={salesCols.length + 1}
                    className="py-2 px-2 text-center font-bold bg-green-100 border-r"
                  >
                    TOTAL SALES
                  </th>
                  <th
                    colSpan={siteCols.length + 4}
                    className="py-2 px-2 text-center font-bold bg-orange-100 border-r"
                  >
                    (SITE OFFICE) &mdash; FRONT
                  </th>
                  {hqCols.length > 0 && (
                    <th
                      colSpan={hqCols.length}
                      className="py-2 px-2 text-center font-bold bg-amber-100 border-r"
                    >
                      (HQ OFFICE) &mdash; BACK
                    </th>
                  )}
                  <th colSpan={3} className="bg-gray-100" />
                </tr>

                {/* Column row */}
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-700">
                  <th className="sticky left-0 z-20 bg-gray-100 py-2 px-2 text-left font-semibold border-r">
                    Date
                  </th>
                  {salesCols.map((c) => (
                    <th key={c.key} className="py-2 px-2 font-semibold">
                      {c.label}
                    </th>
                  ))}
                  <th className="py-2 px-2 font-semibold text-emerald-700 border-r">
                    Total Sales
                  </th>
                  {siteCols.map((c) => (
                    <th key={c.key} className="py-2 px-2 font-semibold">
                      {c.label}
                    </th>
                  ))}
                  <th className="py-2 px-2 font-semibold text-pink-700">Salary</th>
                  <th className="py-2 px-2 font-semibold text-cyan-700">Advances</th>
                  <th className="py-2 px-2 font-semibold text-cyan-700">
                    Staff Loans
                  </th>
                  <th className="py-2 px-2 font-semibold text-teal-700 border-r">
                    Loans Given
                  </th>
                  {hqCols.map((c, i) => (
                    <th
                      key={c.key}
                      className={`py-2 px-2 font-semibold${
                        i === hqCols.length - 1 ? " border-r" : ""
                      }`}
                    >
                      {c.label}
                    </th>
                  ))}
                  <th className="py-2 px-2 font-semibold text-orange-700">
                    Total Expenses
                  </th>
                  <th className="py-2 px-2 font-semibold">Net Income / Loss</th>
                  <th className="py-2 px-2 font-semibold text-left">Remarks</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {statementRows.map((r) => (
                  <tr key={r.date} className="hover:bg-blue-50/50">
                    <td className="sticky left-0 z-10 bg-white py-2 px-2 text-left font-medium border-r">
                      {format(parseISO(r.date), "d-MMM-yy")}
                    </td>
                    {salesCols.map((c) => (
                      <td key={c.key} className="py-2 px-2">
                        {money(r.sales[c.key])}
                      </td>
                    ))}
                    <td className="py-2 px-2 font-bold text-emerald-600 border-r">
                      {money(r.totalSales)}
                    </td>
                    {siteCols.map((c) => (
                      <td key={c.key} className="py-2 px-2">
                        {money(r.siteCosts[c.key])}
                      </td>
                    ))}
                    <td className="py-2 px-2 text-pink-600">{money(r.salary)}</td>
                    <td className="py-2 px-2 text-cyan-600">{money(r.advance)}</td>
                    <td className="py-2 px-2 text-cyan-600">
                      {money(r.staffLoan)}
                    </td>
                    <td className="py-2 px-2 text-teal-600 border-r">
                      {money(r.loansGiven)}
                    </td>
                    {hqCols.map((c, i) => (
                      <td
                        key={c.key}
                        className={`py-2 px-2${
                          i === hqCols.length - 1 ? " border-r" : ""
                        }`}
                      >
                        {money(r.hqCosts[c.key])}
                      </td>
                    ))}
                    <td className="py-2 px-2 font-bold text-orange-600">
                      {money(r.totalExpenses)}
                    </td>
                    <td
                      className={`py-2 px-2 font-bold ${
                        r.netIncome < 0 ? "text-red-600" : "text-gray-800"
                      }`}
                    >
                      {money(r.netIncome)}
                    </td>
                    <td className="py-2 px-2" />
                  </tr>
                ))}
              </tbody>

              <tfoot className="bg-green-50 border-t-2 border-gray-300 font-bold">
                <tr>
                  <td className="sticky left-0 z-10 bg-green-50 py-3 px-2 text-left border-r">
                    TOTAL
                  </td>
                  {salesCols.map((c) => (
                    <td key={c.key} className="py-3 px-2">
                      {currency} {money(totals.sales[c.key])}
                    </td>
                  ))}
                  <td className="py-3 px-2 text-emerald-700 border-r">
                    {currency} {money(totals.totalSales)}
                  </td>
                  {siteCols.map((c) => (
                    <td key={c.key} className="py-3 px-2">
                      {currency} {money(totals.siteCosts[c.key])}
                    </td>
                  ))}
                  <td className="py-3 px-2 text-pink-700">
                    {currency} {money(totals.salary)}
                  </td>
                  <td className="py-3 px-2 text-cyan-700">
                    {currency} {money(totals.advance)}
                  </td>
                  <td className="py-3 px-2 text-cyan-700">
                    {currency} {money(totals.staffLoan)}
                  </td>
                  <td className="py-3 px-2 text-teal-700 border-r">
                    {currency} {money(totals.loansGiven)}
                  </td>
                  {hqCols.map((c, i) => (
                    <td
                      key={c.key}
                      className={`py-3 px-2${
                        i === hqCols.length - 1 ? " border-r" : ""
                      }`}
                    >
                      {currency} {money(totals.hqCosts[c.key])}
                    </td>
                  ))}
                  <td className="py-3 px-2 text-orange-700">
                    {currency} {money(totals.totalExpenses)}
                  </td>
                  <td
                    className={`py-3 px-2 ${
                      totals.netIncome < 0 ? "text-red-700" : "text-gray-900"
                    }`}
                  >
                    {currency} {money(totals.netIncome)}
                  </td>
                  <td className="py-3 px-2" />
                </tr>
              </tfoot>
            </table>
          </div>

          {totals.totalExpenses - totals.salary - totals.loansGiven === 0 && (
            <p className="mt-3 text-sm text-gray-500">
              No cost entries recorded for {monthTitle(period)}.
            </p>
          )}

          <div className="mt-5 text-xs text-gray-600 leading-relaxed">
            <p className="font-bold underline">Please note:</p>
            {STATEMENT_FOOTNOTES.map((f) => (
              <p key={f} className="font-medium">
                {f}
              </p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
