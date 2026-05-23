"use client";
import React, { useState } from "react";
import useCompanyData from "@/utils/dashboard/useCompanyData";
import Filters from "@/app/components/dashboard/Filters";
import KPICard from "@/app/components/dashboard/KPICard";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/utils/formatMoney";
import SalesBreakdownTenders from "@/app/components/dashboard/charts/SalesBreakdownTenders";
import ExpensePie from "@/app/components/dashboard/charts/ExpensePie";
import RecentActivity from "@/app/components/dashboard/RecentActivity";
import SalesVsCosts from "@/app/components/dashboard/charts/SalesVsCosts";
import BranchPerformanceBar from "@/app/components/dashboard/charts/BranchPerformanceBar";
import BranchLeaderboard from "@/app/components/dashboard/BranchLeaderboard";

export default function OwnerDashboardPage() {
  const now = new Date();
  const [filter, setFilter] = useState({
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: now,
  });

  const currency = useCurrency();
  const fmt = (v) => formatMoney(v, currency);

  const {
    loading,
    // charts
    salesTrend,
    salesBreakdown,
    salesVsCosts,
    cashVsCost,
    bankedVsWdr,
    loanTimeline,
    recent,
    // kpis
    bankedSales,
    totalWdr,
    effectiveBankedAfterWithdrawals,
    estCashOnHand,
    totalCosts,
    totalCostsFront,
    totalCostsBack,
    totalSal,
    totalAdv,
    totalStaffLoanCash,
    totalSales,
    // labels
    tenderKeys,
    tenderLabelsByKey,
    bankedTenderLabelList,
    branchPerf,
    fSales,
    branchesList,
  } = useCompanyData(filter);

  const expensePie = [
    { 
      name: "Costs", 
      value: totalCosts || 0,
      breakdown: branchPerf?.map(r => ({ name: r.name, value: r.costs })).filter(x => x.value > 0).sort((a, b) => b.value - a.value) || []
    },
    { 
      name: "Salaries", 
      value: totalSal || 0,
      breakdown: branchPerf?.map(r => ({ name: r.name, value: r.salaries })).filter(x => x.value > 0).sort((a, b) => b.value - a.value) || []
    },
    { 
      name: "Advances", 
      value: totalAdv || 0,
      breakdown: branchPerf?.map(r => ({ name: r.name, value: r.advances })).filter(x => x.value > 0).sort((a, b) => b.value - a.value) || []
    },
    { 
      name: "Staff Loans", 
      value: totalStaffLoanCash || 0,
      breakdown: branchPerf?.map(r => ({ name: r.name, value: r.staffLoans })).filter(x => x.value > 0).sort((a, b) => b.value - a.value) || []
    },
  ];

  const totalOperatingExpenses = (totalCosts || 0) + (totalSal || 0);
  const netOperatingProfit = (totalSales || 0) - totalOperatingExpenses;
  const operatingMargin = totalSales ? ((netOperatingProfit / totalSales) * 100).toFixed(1) : "0.0";
  const totalReceivables = (totalAdv || 0) + (totalStaffLoanCash || 0);

  const revenueBreakdown = branchPerf?.map(r => ({ label: r.name, value: fmt(r.sales) })) || [];
  const expenseBreakdown = branchPerf?.map(r => ({ label: r.name, value: fmt(r.costs + r.salaries) })) || [];
  const profitBreakdown = branchPerf?.map(r => ({ label: r.name, value: fmt(r.net) })) || [];

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-[#f2edff] via-[#ffe1e1] to-[#ffd1f1]">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">CEO Dashboard</h1>
            <p className="text-sm text-black/60">
              Executive summary of company health, liquidity, and branch performance
            </p>
          </div>
          <Filters filter={filter} setFilter={setFilter} />
        </div>

        {/* Section 1: The Bottom Line */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-slate-800">1. Operating Performance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Total Revenue" value={fmt(totalSales)} color="emerald" sub="All branches combined" breakdown={revenueBreakdown} />
            <KPICard title="Total Operating Expenses" value={fmt(totalOperatingExpenses)} color="rose" sub="Costs + Salaries" breakdown={expenseBreakdown} />
            <KPICard title="Net Operating Profit" value={fmt(netOperatingProfit)} color={netOperatingProfit >= 0 ? "emerald" : "rose"} sub="Revenue minus operating expenses" breakdown={profitBreakdown} />
            <KPICard title="Operating Margin" value={`${operatingMargin}%`} color={netOperatingProfit >= 0 ? "emerald" : "rose"} sub="Profit percentage" />
          </div>
        </div>

        {/* Section 2: Liquidity & Cash Flow */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-slate-800">2. Liquidity & Cash Flow</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Physical Cash on Hand" value={fmt(estCashOnHand)} color="slate" sub="Consolidated cash in registers" />
            <KPICard title="Estimated Bank Balance" value={fmt(effectiveBankedAfterWithdrawals)} color="slate" sub="Consolidated bank account balance" />
            <KPICard title="Total Receivables" value={fmt(totalReceivables)} color="amber" sub="Advances + Staff Loans" />
            <KPICard title="Owner Withdrawals" value={fmt(totalWdr)} color="orange" sub="Total money withdrawn from bank" />
          </div>
        </div>

        {/* Section 3: Branch Performance */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-slate-800">3. Branch Performance</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow p-4 flex flex-col">
              <div className="font-medium mb-2">Branch Leaderboard (Net Profit)</div>
              <div className="flex-1">
                <BranchLeaderboard data={branchPerf} />
              </div>
            </div>
            <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow p-4 flex flex-col">
              <div className="font-medium mb-2">Sales vs Costs by Branch</div>
              <div className="flex-1">
                <BranchPerformanceBar
                  data={branchPerf.map((r) => ({
                    name: r.name,
                    sales: r.sales,
                    costs: r.costs,
                  }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Key Visualizations */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-slate-800">4. Key Visualizations</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow p-4 lg:col-span-2">
              <div className="font-medium mb-2">Daily Revenue vs Expenses Trend</div>
              <SalesVsCosts data={salesVsCosts} />
            </div>
            <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow p-4">
              <div className="font-medium mb-2">Expense Distribution</div>
              <ExpensePie data={expensePie} />
            </div>
          </div>
          <div className="grid grid-cols-1 mt-6">
            <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow p-4">
              <SalesBreakdownTenders
                rawSales={fSales}
                branches={branchesList}
                seriesKeys={tenderKeys}
                labels={tenderLabelsByKey}
              />
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-8">
          <RecentActivity rows={recent} />
        </div>

        {loading && (
          <div className="fixed bottom-4 right-4 bg-white/90 px-4 py-2 rounded-xl shadow">
            Loading…
          </div>
        )}
      </div>
    </div>
  );
}
