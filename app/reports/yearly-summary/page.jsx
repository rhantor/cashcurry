"use client";
import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  Line,
} from "recharts";
import Button from "@/app/components/common/Button";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/utils/formatMoney";
import { mkFmt, mkCompact } from "@/utils/dashboard/utils";
import { useSummaryReportLogic } from "@/hook/useSummaryReportLogic";

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

// Chart palette — validated CVD-safe (dataviz skill). Sales/Expenses are the
// adjacent bars; Net is a line (secondary encoding by mark shape).
const C_SALES = "#6366f1"; // indigo
const C_EXPENSES = "#f59e0b"; // amber
const C_NET = "#10b981"; // emerald

export default function YearlySummaryPage() {
  const currency = useCurrency();
  const router = useRouter();
  const formatNum = (v) => formatMoney(v || 0, currency);
  const safeZero = (v) => (Number(v || 0) === 0 ? "-" : formatNum(v));

  // 1. Filtering State
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());

  const availableYears = useMemo(() => {
    // Generate list of 5 recent years
    return Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
  }, [currentYear]);

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
      filteredSummaries.map((s) => ({
        month: new Date(`${s.period}-02`).toLocaleString("default", {
          month: "short",
        }),
        sales: Number(s.totalSales || 0),
        expenses: monthExpenses(s),
        net: monthNet(s),
      })),
    [filteredSummaries]
  );

  const monthLabelShort = (s) =>
    s
      ? new Date(`${s.period}-02`).toLocaleString("default", {
          month: "short",
          year: "2-digit",
        })
      : "—";

  const chartFmt = mkFmt(currency);
  const chartCompact = mkCompact();

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
      alert("Failed to export Excel.");
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold capitalize">{branchName || 'Branch'} Yearly Summary</h2>
          <p className="text-gray-500 text-sm mt-1">Review grand totals dynamically calculated directly from daily transaction records. Click a month to open its full statement.</p>
        </div>

        <div className="flex items-center gap-3">
           <div className="flex items-center gap-2 bg-white border rounded shadow-sm px-3 py-1.5">
             <span className="text-sm text-gray-500 font-medium">Reporting Year:</span>
             <select
               value={selectedYear}
               onChange={(e) => setSelectedYear(e.target.value)}
               className="bg-transparent text-gray-800 font-bold focus:outline-none cursor-pointer"
             >
               {availableYears.map(y => (
                 <option key={y} value={y}>{y}</option>
               ))}
             </select>
           </div>

           <Button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            disabled={filteredSummaries.length === 0}
          >
            Export Excel
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-gray-500 mt-4 p-4 text-center bg-white rounded-xl shadow-sm">Calculating from daily records...</div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border rounded-xl shadow-sm p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Sales</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600">{formatNum(yearlyTotals.sales)}</p>
              <p className="text-xs text-gray-500 mt-1">across {selectedYear}</p>
            </div>
            <div className="bg-white border rounded-xl shadow-sm p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Expenses</p>
              <p className="text-2xl font-bold mt-1 text-amber-600">{formatNum(yearlyExpenses)}</p>
              <p className="text-xs text-gray-500 mt-1">cost, salary, advances &amp; loans given</p>
            </div>
            <div className="bg-white border rounded-xl shadow-sm p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Net Income</p>
              <p className={`text-2xl font-bold mt-1 ${yearlyNet < 0 ? "text-red-600" : "text-gray-800"}`}>{formatNum(yearlyNet)}</p>
              <p className="text-xs text-gray-500 mt-1">{yearlyMargin.toFixed(1)}% net margin</p>
            </div>
            <div className="bg-white border rounded-xl shadow-sm p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Best Month</p>
              <p className="text-2xl font-bold mt-1 text-indigo-600">{monthLabelShort(bestMonth)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {bestMonth ? `Net ${formatNum(monthNet(bestMonth))}` : "No activity"}
                {worstMonth && worstMonth !== bestMonth
                  ? ` · Worst ${monthLabelShort(worstMonth)}`
                  : ""}
              </p>
            </div>
          </div>

          {/* Monthly trend */}
          <div className="bg-white border rounded-xl shadow-sm p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Monthly Trend — Sales, Expenses &amp; Net</h3>
            <div className="w-full h-72">
              <ResponsiveContainer>
                <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={chartCompact}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
                  <Tooltip
                    formatter={(val, key) => {
                      const labels = { sales: "Sales", expenses: "Expenses", net: "Net Income" };
                      return [chartFmt(val), labels[key] || key];
                    }}
                    contentStyle={{ borderRadius: 10, fontSize: 12, border: "1px solid #e2e8f0" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar dataKey="sales" name="Sales" fill={C_SALES} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill={C_EXPENSES} radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="net" name="Net Income" stroke={C_NET} strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-600">
              <tr>
                <th className="py-3 px-3 font-semibold text-left">Month</th>
                <th className="py-3 px-3 font-semibold">Total Sales</th>
                <th className="py-3 px-3 font-semibold text-orange-600">Cost (Front)</th>
                <th className="py-3 px-3 font-semibold text-purple-600">Cost (Back)</th>
                <th className="py-3 px-3 font-semibold">Salaries</th>
                <th className="py-3 px-3 font-semibold">Advances</th>
                <th className="py-3 px-3 font-semibold text-blue-600">Withdrawals</th>
                <th className="py-3 px-3 font-semibold text-blue-600">Deposits</th>
                <th className="py-3 px-3 font-semibold text-teal-600">Loan Given</th>
                <th className="py-3 px-3 font-semibold text-teal-600">Loan Rcvd</th>
                <th className="py-3 px-3 font-semibold text-indigo-600">Repay In</th>
                <th className="py-3 px-3 font-semibold text-indigo-600">Repay Out</th>
                <th className="py-3 px-3 font-semibold">Net Income</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100/60">
              {filteredSummaries.map((s) => {
                const net = monthNet(s);
                const empty = isEmptyMonth(s);
                return (
                  <tr
                    key={s.period}
                    onClick={() => router.push(`/reports/yearly-summary/${s.period}`)}
                    className="hover:bg-blue-50/50 transition duration-150 cursor-pointer"
                    title={`Open ${s.period} statement`}
                  >
                    <td className="py-3 px-3 font-medium text-blue-700 hover:underline text-left whitespace-nowrap">
                      {new Date(`${s.period}-02`).toLocaleString('default', { month: 'short', year: '2-digit' })}
                    </td>
                    <td className="py-3 px-3 text-emerald-600 font-bold tracking-wide">{safeZero(s.totalSales)}</td>
                    <td className="py-3 px-3 text-orange-500 font-bold tracking-wide">{safeZero(s.frontCost)}</td>
                    <td className="py-3 px-3 text-purple-500 font-bold tracking-wide">{safeZero(s.backCost)}</td>
                    <td className="py-3 px-3 text-gray-700">{safeZero(s.totalSalaries)}</td>
                    <td className="py-3 px-3 text-gray-700">{safeZero(s.totalAdvances)}</td>
                    <td className="py-3 px-3 text-blue-500 font-medium">{safeZero(s.totalWithdrawals)}</td>
                    <td className="py-3 px-3 text-blue-500 font-medium">{safeZero(s.totalDeposits)}</td>
                    <td className="py-3 px-3 text-teal-600 font-medium">{safeZero(s.loanGiven)}</td>
                    <td className="py-3 px-3 text-teal-600 font-medium">{safeZero(s.loanReceived)}</td>
                    <td className="py-3 px-3 text-indigo-500 font-medium">{safeZero(s.repayIn)}</td>
                    <td className="py-3 px-3 text-indigo-500 font-medium">{safeZero(s.repayOut)}</td>
                    <td className={`py-3 px-3 font-bold ${empty ? "text-gray-400" : net < 0 ? "text-red-600" : "text-gray-800"}`}>
                      {empty ? "-" : formatNum(net)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filteredSummaries.length > 0 && (
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td className="py-4 px-3 font-bold text-gray-800 text-left">Yearly Total</td>
                  <td className="py-4 px-3 font-bold text-emerald-600">{formatNum(yearlyTotals.sales)}</td>
                  <td className="py-4 px-3 font-bold text-orange-600">{formatNum(yearlyTotals.frontCost)}</td>
                  <td className="py-4 px-3 font-bold text-purple-600">{formatNum(yearlyTotals.backCost)}</td>
                  <td className="py-4 px-3 font-bold text-gray-800">{formatNum(yearlyTotals.salaries)}</td>
                  <td className="py-4 px-3 font-bold text-gray-800">{formatNum(yearlyTotals.advances)}</td>
                  <td className="py-4 px-3 font-bold text-blue-600">{formatNum(yearlyTotals.withdrawals)}</td>
                  <td className="py-4 px-3 font-bold text-blue-600">{formatNum(yearlyTotals.deposits)}</td>
                  <td className="py-4 px-3 font-bold text-teal-600">{formatNum(yearlyTotals.loanGiven)}</td>
                  <td className="py-4 px-3 font-bold text-teal-600">{formatNum(yearlyTotals.loanReceived)}</td>
                  <td className="py-4 px-3 font-bold text-indigo-600">{formatNum(yearlyTotals.repayIn)}</td>
                  <td className="py-4 px-3 font-bold text-indigo-600">{formatNum(yearlyTotals.repayOut)}</td>
                  <td className={`py-4 px-3 font-bold ${yearlyNet < 0 ? "text-red-600" : "text-gray-900"}`}>{formatNum(yearlyNet)}</td>
                </tr>
              </tfoot>
            )}
          </table>
          </div>
        </>
      )}
    </div>
  );
}
