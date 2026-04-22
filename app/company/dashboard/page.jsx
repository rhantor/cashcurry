"use client";
import React, { useState } from "react";
import useCompanyData from "@/utils/dashboard/useCompanyData";
import Filters from "@/app/components/dashboard/Filters";
import KPICard from "@/app/components/dashboard/KPICard";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/utils/formatMoney";
import SalesTrend from "@/app/components/dashboard/charts/SalesTrend";
import SalesBreakdownTenders from "@/app/components/dashboard/charts/SalesBreakdownTenders";
import BankedVsWithdrawals from "@/app/components/dashboard/charts/BankedVsWithdrawals";
import ExpensePie from "@/app/components/dashboard/charts/ExpensePie";
import LoansTimeline from "@/app/components/dashboard/charts/LoansTimeline";
import RecentActivity from "@/app/components/dashboard/RecentActivity";
import SalesVsCosts from "@/app/components/dashboard/charts/SalesVsCosts";
import CashVsCost from "@/app/components/dashboard/charts/CashVsCost";
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
    totalSales,
    // labels
    tenderKeys,
    tenderLabelsByKey,
    bankedTenderLabelList,
    branchPerf,
  } = useCompanyData(filter);

  const expensePie = [
    { name: "Costs", value: totalCosts || 0 },
    { name: "Salaries", value: totalSal || 0 },
    { name: "Advances", value: totalAdv || 0 },
  ];

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-[#f2edff] via-[#ffe1e1] to-[#ffd1f1]">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Owner Dashboard</h1>
            <p className="text-sm text-black/60">
              Company-wide sales, costs, bank flow & loans (all branches)
            </p>
          </div>
          <Filters filter={filter} setFilter={setFilter} />
        </div>

        {/* KPIs: Bank/Cash */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Banked Sales"
            value={fmt(bankedSales)}
            sub={bankedTenderLabelList}
          />
          <KPICard title="Withdrawals (from Bank)" value={fmt(totalWdr)} />
          <KPICard
            title="Effective Banked After Withdrawals & Back Costs"
            value={fmt(effectiveBankedAfterWithdrawals)}
            sub="bank balance as of end of period (all branches)"
          />
          <KPICard
            title="Estimated Cash On Hand"
            value={fmt(estCashOnHand)}
            sub="cash balance as of end of period (all branches, matches reports)"
          />
        </div>

        {/* KPIs: Sales vs Costs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Total Sales (All Branches)" value={fmt(totalSales)} />
          <KPICard title="Total Cost (All)" value={fmt(totalCosts)} />
          <KPICard
            title="Front-Office Costs (Cash)"
            value={fmt(totalCostsFront)}
          />
          <KPICard
            title="Back-Office Costs (Bank)"
            value={fmt(totalCostsBack)}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow p-4">
            <div className="font-medium mb-2">
              Branch Performance (Sales vs Costs)
            </div>
            <BranchPerformanceBar
              data={branchPerf.map((r) => ({
                name: r.name,
                sales: r.sales,
                costs: r.costs,
              }))}
            />
          </div>

          <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow p-4">
            <div className="font-medium mb-2">Top / Bottom Branches (Net)</div>
            <BranchLeaderboard data={branchPerf} />
          </div>
        </div>

        {/* Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow p-4">
            <div className="font-medium mb-2">Sales Trend</div>
            <SalesTrend data={salesTrend} />
          </div>
          <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow p-4">
            <SalesBreakdownTenders
              data={salesBreakdown}
              seriesKeys={tenderKeys}
              labels={tenderLabelsByKey}
            />
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow p-4">
            <div className="font-medium mb-2">
              Banked vs Withdrawals (Per Day)
            </div>
            <BankedVsWithdrawals data={bankedVsWdr} />
          </div>
          <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow p-4">
            <div className="font-medium mb-2">Cash vs Cost (Per Day)</div>
            <CashVsCost data={cashVsCost} />
          </div>
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow p-4">
            <div className="font-medium mb-2">Sales vs Costs (Daily)</div>
            <SalesVsCosts data={salesVsCosts} />
          </div>
          <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow p-4">
            <div className="font-medium mb-2">Expense Distribution</div>
            <ExpensePie data={expensePie} />
          </div>
        </div>

        {/* Loans + Recent */}
        <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow p-4">
          <div className="font-medium mb-2">Loans Timeline (Company)</div>
          <LoansTimeline data={loanTimeline} />
        </div>

        <RecentActivity rows={recent} />

        {loading && (
          <div className="fixed bottom-4 right-4 bg-white/90 px-4 py-2 rounded-xl shadow">
            Loading…
          </div>
        )}
      </div>
    </div>
  );
}
