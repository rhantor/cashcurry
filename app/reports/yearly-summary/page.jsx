"use client";
import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, Trophy } from "lucide-react";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { useBusinessToday } from "@/app/hooks/useRegion";
import { useSummaryReportLogic } from "@/hook/useSummaryReportLogic";
import { COLOR, ChartCard, Legend, TimeChart } from "@/app/components/dashboard/charts/kit";
import { Button, Card, CountUp, Skeleton, Tabs, cn, toast } from "@/app/components/ui";

// A month's total outflow, mirroring the monthly statement's definition of
// expenses: cost entries (front + back), salaries, advances/staff loans, and
// company loans given all leave the business the same way.
const monthExpenses = (s) =>
  Number(s.frontCost || 0) +
  Number(s.backCost || 0) +
  Number(s.totalSalaries || 0) +
  Number(s.totalAdvances || 0) +
  Number(s.loanGiven || 0);

const monthNet = (s) => Number(s.totalSales || 0) - monthExpenses(s);

const isEmptyMonth = (s) =>
  Number(s.totalSales || 0) === 0 && monthExpenses(s) === 0;

const SERIES = [
  { key: "sales", name: "Sales", color: COLOR.in, kind: "bar" },
  { key: "expenses", name: "Spent", color: COLOR.out, kind: "bar" },
  { key: "net", name: "Left over", color: COLOR.bank, kind: "line" },
];

/**
 * Yearly summary: a year month by month — sales, what was spent (costs,
 * salaries, advances, loans given) and what was left over — with the best
 * month, a chart, and each month opening its statement. Figures come from the
 * daily cash book (useSummaryReportLogic); this page only adds them up by month.
 */
export default function YearlySummaryPage() {
  const currency = useCurrency();
  const router = useRouter();
  const formatNum = (v) => formatMoney(v || 0, currency);
  const safeZero = (v) => (Number(v || 0) === 0 ? "–" : formatNum(v));
  const [layout, setLayout] = useState("simple");

  // 1. The year, on the branch's clock
  const today = useBusinessToday();
  const currentYear = Number(today.slice(0, 4));
  const thisMonth = today.slice(0, 7);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const firstYear = currentYear - 4;

  // 2. Fetch Data using the native summary logic (aggregates completely locally for the requested year)
  // Memoized so the hook's derived date range isn't invalidated every render by
  // a fresh object literal, which would re-run the whole year's aggregation.
  const filterState = useMemo(
    () => ({
      filterType: "range",
      dateRange: { from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` },
    }),
    [selectedYear]
  );

  const { computed, branchName, isLoading } = useSummaryReportLogic(
    filterState,
    "all"
  );

  // 3. Process daily rows into monthly rollups
  const localMonthlySummaries = useMemo(() => {
    if (!computed?.rows) return [];

    const map = {};
    computed.rows.forEach(r => {
      if (r.type !== "daily" || !r.date) return;

      const period = r.date.substring(0, 7); // yyyy-MM
      if (!map[period]) {
        map[period] = {
           id: period,
           period,
           totalSales: 0,
           frontCost: 0,
           backCost: 0,
           totalSalaries: 0,
           totalAdvances: 0,
           totalDeposits: 0,
           totalWithdrawals: 0,
           loanGiven: 0,
           loanReceived: 0,
           repayIn: 0,
           repayOut: 0
        };
      }

      map[period].totalSales += Number(r.totalSales || 0);
      map[period].frontCost += Number(r.costCash || 0);
      map[period].backCost += Number(r.costBank || 0);
      map[period].totalSalaries += Number(r.salary || 0);
      map[period].totalAdvances += Number(r.advance || 0) + Number(r.staffLoanGiven || 0);
      map[period].totalDeposits += Number(r.deposit || 0);
      map[period].totalWithdrawals += Number(r.withdrawal || 0);
      map[period].loanGiven += Number(r.loanGiven || 0);
      map[period].loanReceived += Number(r.loanReceived || 0);
      map[period].repayIn += Number(r.repayCashIn || 0) + Number(r.repayBankIn || 0);
      map[period].repayOut += Number(r.repayCashOut || 0) + Number(r.repayBankOut || 0);
    });

    return Object.values(map);
  }, [computed]);

  // 4. Force 12-Month Array
  const filteredSummaries = useMemo(() => {
    if (!selectedYear) return [];

    const allMonths = [];
    for (let i = 1; i <= 12; i++) {
       const monthStr = i.toString().padStart(2, "0");
       const period = `${selectedYear}-${monthStr}`;

       const found = localMonthlySummaries.find(s => s.period === period);

       if (found) {
          allMonths.push({ ...found, period });
       } else {
          allMonths.push({
             period,
             totalSales: 0,
             frontCost: 0,
             backCost: 0,
             totalSalaries: 0,
             totalAdvances: 0,
             totalDeposits: 0,
             totalWithdrawals: 0,
             loanGiven: 0,
             loanReceived: 0,
             repayIn: 0,
             repayOut: 0
          });
       }
    }
    return allMonths;
  }, [localMonthlySummaries, selectedYear]);

  // 5. Calculate Yearly Totals
  const yearlyTotals = useMemo(() => {
    return filteredSummaries.reduce((acc, s) => ({
      sales: acc.sales + Number(s.totalSales || 0),
      frontCost: acc.frontCost + Number(s.frontCost || 0),
      backCost: acc.backCost + Number(s.backCost || 0),
      salaries: acc.salaries + Number(s.totalSalaries || 0),
      advances: acc.advances + Number(s.totalAdvances || 0),
      deposits: acc.deposits + Number(s.totalDeposits || 0),
      withdrawals: acc.withdrawals + Number(s.totalWithdrawals || 0),
      loanGiven: acc.loanGiven + Number(s.loanGiven || 0),
      loanReceived: acc.loanReceived + Number(s.loanReceived || 0),
      repayIn: acc.repayIn + Number(s.repayIn || 0),
      repayOut: acc.repayOut + Number(s.repayOut || 0)
    }), { sales: 0, frontCost: 0, backCost: 0, salaries: 0, advances: 0, deposits: 0, withdrawals: 0, loanGiven: 0, loanReceived: 0, repayIn: 0, repayOut: 0 });
  }, [filteredSummaries]);

  const yearlyExpenses =
    yearlyTotals.frontCost +
    yearlyTotals.backCost +
    yearlyTotals.salaries +
    yearlyTotals.advances +
    yearlyTotals.loanGiven;
  const yearlyNet = yearlyTotals.sales - yearlyExpenses;
  const yearlyMargin = yearlyTotals.sales
    ? (yearlyNet / yearlyTotals.sales) * 100
    : 0;

  // 5b. Best / worst performing months (by net), ignoring months with no activity
  const { bestMonth, worstMonth } = useMemo(() => {
    let best = null;
    let worst = null;
    filteredSummaries.forEach((s) => {
      if (isEmptyMonth(s)) return;
      const net = monthNet(s);
      if (best === null || net > monthNet(best)) best = s;
      if (worst === null || net < monthNet(worst)) worst = s;
    });
    return { bestMonth: best, worstMonth: worst };
  }, [filteredSummaries]);

  // 5c. Chart data — one point per month
  const chartData = useMemo(
    () =>
      // months still to come stay empty, so the line stops at this month
      filteredSummaries.map((s) => {
        const ahead = s.period > thisMonth;
        return {
          month: format(parseISO(`${s.period}-01`), "MMM"),
          sales: ahead ? null : Number(s.totalSales || 0),
          expenses: ahead ? null : monthExpenses(s),
          net: ahead ? null : monthNet(s),
        };
      }),
    [filteredSummaries, thisMonth]
  );

  const monthLabelShort = (s) => (s ? format(parseISO(`${s.period}-01`), "MMMM") : "—");

  // 6. Export Excel — styled workbook (xlsx-js-style), lazy-loaded on click.
  const handleExportExcel = async () => {
    try {
      if (!filteredSummaries.length) return;

      const XLSX = (await import("xlsx-js-style")).default;

      const headers = [
        "Month",
        "Total Sales",
        "Cost (Front)",
        "Cost (Back)",
        "Salaries",
        "Advances",
        "Withdrawals",
        "Deposits",
        "Loan Given",
        "Loan Received",
        "Repay In",
        "Repay Out",
        "Net Income",
      ];
      const ncol = headers.length;

      const rowArr = (s) => [
        new Date(`${s.period}-02`).toLocaleString("default", {
          month: "long",
          year: "numeric",
        }),
        Number(s.totalSales || 0),
        Number(s.frontCost || 0),
        Number(s.backCost || 0),
        Number(s.totalSalaries || 0),
        Number(s.totalAdvances || 0),
        Number(s.totalWithdrawals || 0),
        Number(s.totalDeposits || 0),
        Number(s.loanGiven || 0),
        Number(s.loanReceived || 0),
        Number(s.repayIn || 0),
        Number(s.repayOut || 0),
        monthNet(s),
      ];

      const totalRow = [
        `TOTAL (${selectedYear})`,
        yearlyTotals.sales,
        yearlyTotals.frontCost,
        yearlyTotals.backCost,
        yearlyTotals.salaries,
        yearlyTotals.advances,
        yearlyTotals.withdrawals,
        yearlyTotals.deposits,
        yearlyTotals.loanGiven,
        yearlyTotals.loanReceived,
        yearlyTotals.repayIn,
        yearlyTotals.repayOut,
        yearlyNet,
      ];

      const title = `${branchName || "Branch"} — Yearly Summary ${selectedYear}`;
      const aoa = [
        [title],
        headers,
        ...filteredSummaries.map(rowArr),
        totalRow,
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      const R_HEADER = 1;
      const R_DATA0 = 2;
      const R_TOTAL = R_DATA0 + filteredSummaries.length;

      // Positive: comma-grouped. Negative: red with a minus. Zero: a dash.
      const MONEY_FMT = '#,##0.00;[Red]-#,##0.00;"-"';
      const FONT = "Calibri";
      const THIN = { style: "thin", color: { rgb: "D9D9D9" } };
      const border = { top: THIN, bottom: THIN, left: THIN, right: THIN };

      const setStyle = (r, c, s, z) => {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (!ws[ref]) ws[ref] = { t: "s", v: "" };
        ws[ref].s = s;
        if (z) ws[ref].z = z;
      };
      const isMoneyCol = (c) => c >= 1 && c <= ncol - 1;

      // Title banner
      setStyle(0, 0, {
        font: { name: FONT, bold: true, sz: 14, color: { rgb: "1F2937" } },
        alignment: { horizontal: "center" },
      });

      // Header row
      for (let c = 0; c < ncol; c += 1) {
        setStyle(R_HEADER, c, {
          font: { name: FONT, bold: true, sz: 10, color: { rgb: "212529" } },
          alignment: {
            horizontal: c === 0 ? "left" : "center",
            vertical: "center",
            wrapText: true,
          },
          fill: { fgColor: { rgb: "E9ECEF" } },
          border,
        });
      }

      // Data rows (zebra striped)
      for (let i = 0; i < filteredSummaries.length; i += 1) {
        const r = R_DATA0 + i;
        const zebra = i % 2 === 1;
        for (let c = 0; c < ncol; c += 1) {
          setStyle(
            r,
            c,
            {
              font: { name: FONT, sz: 10 },
              alignment: { horizontal: c === 0 ? "left" : "right" },
              fill: zebra ? { fgColor: { rgb: "F6F8FA" } } : undefined,
              border,
            },
            isMoneyCol(c) ? MONEY_FMT : undefined
          );
        }
      }

      // Total row
      for (let c = 0; c < ncol; c += 1) {
        setStyle(
          R_TOTAL,
          c,
          {
            font: { name: FONT, bold: true, sz: 10, color: { rgb: "14532D" } },
            alignment: { horizontal: c === 0 ? "left" : "right" },
            fill: { fgColor: { rgb: "C6E7C7" } },
            border: {
              ...border,
              top: { style: "medium", color: { rgb: "808080" } },
            },
          },
          isMoneyCol(c) ? MONEY_FMT : undefined
        );
      }

      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: ncol - 1 } }];
      ws["!cols"] = headers.map((h) => ({ wch: h === "Month" ? 18 : 14 }));
      ws["!rows"] = [];
      ws["!rows"][R_HEADER] = { hpt: 26 };
      ws["!freeze"] = {
        xSplit: 1,
        ySplit: R_DATA0,
        topLeftCell: "B3",
        activePane: "bottomRight",
        state: "frozen",
      };

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Yearly Summary ${selectedYear}`);
      XLSX.writeFile(
        wb,
        `${branchName || "Branch"}_Yearly_Summary_${selectedYear}.xlsx`
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to export Excel.");
    }
  };

  // the months that have happened (all twelve for a past year)
  const shownMonths = filteredSummaries.filter((s) => s.period <= thisMonth);
  const maxSales = Math.max(1, ...shownMonths.map((s) => Number(s.totalSales || 0)), ...shownMonths.map(monthExpenses));
  const year = Number(selectedYear);

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
      {/* the year */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface p-1 shadow-card">
          <button
            type="button"
            onClick={() => setSelectedYear(String(year - 1))}
            disabled={year <= firstYear}
            aria-label="Previous year"
            className="rounded-xl p-2 text-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-16 text-center text-base font-bold tabular-nums text-fg">{selectedYear}</span>
          <button
            type="button"
            onClick={() => setSelectedYear(String(year + 1))}
            disabled={year >= currentYear}
            aria-label="Next year"
            className="rounded-xl p-2 text-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <Button variant="secondary" icon={Download} onClick={handleExportExcel} disabled={isLoading || !filteredSummaries.length}>
          Excel
        </Button>
      </div>

      {isLoading ? (
        <>
          <Skeleton className="h-44" rounded="rounded-3xl" />
          <Skeleton className="h-72" rounded="rounded-2xl" />
        </>
      ) : (
        <>
          {/* the year in one card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0e5a4a] to-[#052a22] p-5 text-white shadow-card sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
              {year === currentYear ? `${selectedYear} so far` : selectedYear} · sales
            </p>
            <CountUp value={yearlyTotals.sales} format={formatNum} className="mt-1 block text-4xl font-bold tabular-nums tracking-tight" />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/10 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-white/70">Spent</p>
                <p className="text-lg font-bold tabular-nums">{formatNum(yearlyExpenses)}</p>
                <p className="text-[11px] text-white/60">Costs, salaries, advances, loans</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-white/70">Left over</p>
                <p className={cn("text-lg font-bold tabular-nums", yearlyNet < 0 && "text-[#ffd4c7]")}>{formatNum(yearlyNet)}</p>
                <p className="text-[11px] text-white/60">{yearlyMargin.toFixed(1)}% of sales</p>
              </div>
              <div className="col-span-2 rounded-2xl bg-white/10 px-3 py-2.5 sm:col-span-1">
                <p className="flex items-center gap-1 text-[11px] font-semibold text-white/70">
                  <Trophy className="size-3" /> Best month
                </p>
                <p className="text-lg font-bold">{monthLabelShort(bestMonth)}</p>
                <p className="text-[11px] text-white/60">
                  {bestMonth ? `${formatNum(monthNet(bestMonth))} left over` : "No activity yet"}
                  {worstMonth && worstMonth !== bestMonth ? ` · weakest ${monthLabelShort(worstMonth)}` : ""}
                </p>
              </div>
            </div>
          </div>

          <ChartCard title="Month by month" subtitle="Sales against what was spent; the line is what was left over" legend={SERIES.map((s) => ({ ...s, kind: s.kind === "line" ? "line" : "bar" }))}>
            <TimeChart data={chartData} xKey="month" currency={currency} height={260} zeroLine={chartData.some((d) => d.net < 0)} series={SERIES} />
          </ChartCard>

          {/* the months */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <h2 className="text-base font-semibold text-fg">Months</h2>
            <Tabs
              size="sm"
              value={layout}
              onChange={setLayout}
              tabs={[
                { value: "simple", label: "Simple" },
                { value: "table", label: "Full table" },
              ]}
            />
          </div>

          {layout === "simple" ? (
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-line px-4 py-2">
                <Legend items={SERIES.slice(0, 2)} />
                <span className="text-[11px] text-subtle">Tap a month for its statement</span>
              </div>
              <ul className="divide-y divide-line">
                {[...shownMonths].reverse().map((s) => {
                  const net = monthNet(s);
                  const empty = isEmptyMonth(s);
                  return (
                    <li key={s.period}>
                      <button
                        type="button"
                        onClick={() => router.push(`/reports/yearly-summary/${s.period}`)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/50"
                      >
                        <span className="w-12 shrink-0">
                          <span className="block text-base font-bold leading-tight text-fg">{format(parseISO(`${s.period}-01`), "MMM")}</span>
                          {s.period === thisMonth && <span className="block text-[10px] font-semibold uppercase text-brand">Now</span>}
                        </span>
                        {empty ? (
                          <span className="flex-1 text-xs text-subtle">Nothing recorded</span>
                        ) : (
                          <span className="min-w-0 flex-1 text-xs sm:hidden">
                            <span className="block text-brand">Sales {formatNum(s.totalSales)}</span>
                            <span className="block text-danger">Spent {formatNum(monthExpenses(s))}</span>
                          </span>
                        )}
                        {!empty && (
                          <span className="hidden min-w-0 flex-1 space-y-1 sm:block">
                            {[
                              ["sales", Number(s.totalSales || 0), COLOR.in],
                              ["spent", monthExpenses(s), COLOR.out],
                            ].map(([k, v, c]) => (
                              <span key={k} className="flex items-center gap-2">
                                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                                  <motion.span
                                    className="block h-full rounded-full"
                                    style={{ background: c }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(v / maxSales) * 100}%` }}
                                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                                  />
                                </span>
                                <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted">{formatNum(v)}</span>
                              </span>
                            ))}
                          </span>
                        )}
                        <span className="w-24 shrink-0 text-right">
                          <span className="block text-[11px] text-subtle">Left over</span>
                          <span className={cn("block text-sm font-bold tabular-nums", empty ? "text-subtle" : net < 0 ? "text-danger" : "text-fg")}>{empty ? "–" : formatNum(net)}</span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-subtle" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              <div className="overflow-x-auto">
                <table className="min-w-full whitespace-nowrap text-right text-sm tabular-nums">
                  <thead className="border-b border-line bg-surface-2 text-[11px] uppercase tracking-wide text-muted">
                    <tr>
                      {["Month", "Sales", "Cost (till)", "Cost (bank)", "Salaries", "Advances", "Bank to cash", "Cash to bank", "Loan given", "Loan received", "Repaid in", "Repaid out", "Left over"].map((h, i) => (
                        <th key={h} className={cn("px-3 py-2.5 font-semibold", i === 0 && "sticky left-0 z-10 bg-surface-2 text-left")}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredSummaries.map((s) => {
                      const net = monthNet(s);
                      const empty = isEmptyMonth(s);
                      return (
                        <tr key={s.period} onClick={() => router.push(`/reports/yearly-summary/${s.period}`)} className="cursor-pointer transition-colors hover:bg-surface-2/50">
                          <td className="sticky left-0 z-10 bg-surface px-3 py-2.5 text-left font-semibold text-fg">{format(parseISO(`${s.period}-01`), "MMM yy")}</td>
                          <td className="px-3 py-2.5 font-semibold text-brand">{safeZero(s.totalSales)}</td>
                          <td className="px-3 py-2.5 text-danger">{safeZero(s.frontCost)}</td>
                          <td className="px-3 py-2.5 text-danger">{safeZero(s.backCost)}</td>
                          <td className="px-3 py-2.5 text-danger">{safeZero(s.totalSalaries)}</td>
                          <td className="px-3 py-2.5 text-danger">{safeZero(s.totalAdvances)}</td>
                          <td className="px-3 py-2.5 text-info">{safeZero(s.totalWithdrawals)}</td>
                          <td className="px-3 py-2.5 text-info">{safeZero(s.totalDeposits)}</td>
                          <td className="px-3 py-2.5 text-warning">{safeZero(s.loanGiven)}</td>
                          <td className="px-3 py-2.5 text-warning">{safeZero(s.loanReceived)}</td>
                          <td className="px-3 py-2.5 text-muted">{safeZero(s.repayIn)}</td>
                          <td className="px-3 py-2.5 text-muted">{safeZero(s.repayOut)}</td>
                          <td className={cn("px-3 py-2.5 font-bold", empty ? "text-subtle" : net < 0 ? "text-danger" : "text-fg")}>{empty ? "–" : formatNum(net)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t border-line bg-surface-2 font-bold">
                    <tr>
                      <td className="sticky left-0 z-10 bg-surface-2 px-3 py-3 text-left text-fg">{selectedYear}</td>
                      {[
                        [yearlyTotals.sales, "text-brand"],
                        [yearlyTotals.frontCost, "text-danger"],
                        [yearlyTotals.backCost, "text-danger"],
                        [yearlyTotals.salaries, "text-danger"],
                        [yearlyTotals.advances, "text-danger"],
                        [yearlyTotals.withdrawals, "text-info"],
                        [yearlyTotals.deposits, "text-info"],
                        [yearlyTotals.loanGiven, "text-warning"],
                        [yearlyTotals.loanReceived, "text-warning"],
                        [yearlyTotals.repayIn, "text-muted"],
                        [yearlyTotals.repayOut, "text-muted"],
                        [yearlyNet, yearlyNet < 0 ? "text-danger" : "text-fg"],
                      ].map(([v, c], i) => (
                        <td key={i} className={cn("px-3 py-3", c)}>
                          {formatNum(v)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
