"use client";
import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import Button from "@/app/components/common/Button";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/utils/formatMoney";
import { useSummaryReportLogic } from "@/hook/useSummaryReportLogic";

export default function YearlySummaryPage() {
  const currency = useCurrency();
  const formatNum = (v) => formatMoney(v || 0, currency);
  const safeZero = (v) => Number(v || 0) === 0 ? "-" : formatNum(v);

  // 1. Filtering State
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());

  const availableYears = useMemo(() => {
    // Generate list of 5 recent years
    return Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
  }, [currentYear]);

  // 2. Fetch Data using the native summary logic (aggregates completely locally for the requested year)
  const { computed, branchName, ready } = useSummaryReportLogic(
    {
      filterType: "range",
      dateRange: { from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` },
    },
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

  // 6. Export Excel
  const handleExportExcel = () => {
    try {
      const dataForExcel = filteredSummaries.map((s) => {
        const readableMonth = new Date(`${s.period}-02`).toLocaleString('default', { month: 'long', year: 'numeric' });
        return {
          "Month": readableMonth,
          "Total Sales": Number(s.totalSales || 0),
          "Front Office Cost": Number(s.frontCost || 0),
          "Back Office Cost": Number(s.backCost || 0),
          "Total Advances": Number(s.totalAdvances || 0),
          "Total Salaries": Number(s.totalSalaries || 0),
          "Total Deposits": Number(s.totalDeposits || 0),
          "Total Withdrawals": Number(s.totalWithdrawals || 0),
          "Loan Given": Number(s.loanGiven || 0),
          "Loan Received": Number(s.loanReceived || 0),
          "Repay In": Number(s.repayIn || 0),
          "Repay Out": Number(s.repayOut || 0),
        };
      });

      dataForExcel.push({
        "Month": `TOTAL (${selectedYear})`,
        "Total Sales": yearlyTotals.sales,
        "Front Office Cost": yearlyTotals.frontCost,
        "Back Office Cost": yearlyTotals.backCost,
        "Total Advances": yearlyTotals.advances,
        "Total Salaries": yearlyTotals.salaries,
        "Total Deposits": yearlyTotals.deposits,
        "Total Withdrawals": yearlyTotals.withdrawals,
        "Loan Given": yearlyTotals.loanGiven,
        "Loan Received": yearlyTotals.loanReceived,
        "Repay In": yearlyTotals.repayIn,
        "Repay Out": yearlyTotals.repayOut,
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataForExcel);

      ws["!cols"] = [
        { wch: 15 }, 
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, 
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, `Yearly Summary ${selectedYear}`);
      XLSX.writeFile(wb, `${branchName || 'Branch'}_Yearly_Summary_${selectedYear}.xlsx`);
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
          <p className="text-gray-500 text-sm mt-1">Review grand totals dynamically calculated directly from daily transaction records.</p>
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

      {!ready ? (
        <div className="text-gray-500 mt-4 p-4 text-center bg-white rounded-xl shadow-sm">Calculating from daily records...</div>
      ) : (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100/60">
              {filteredSummaries.map((s) => (
                  <tr key={s.period} className="hover:bg-blue-50/50 transition duration-150">
                    <td className="py-3 px-3 font-medium text-gray-800 text-left whitespace-nowrap">
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
                  </tr>
              ))}
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
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
