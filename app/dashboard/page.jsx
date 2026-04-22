"use client";
import React, { useState } from "react";
import useBranchData from "@/utils/dashboard/useBranchData";
import { useGetBranchesBasicQuery } from "@/lib/redux/api/branchApiSlice";
import Filters from "../components/dashboard/Filters";
import KPICard from "../components/dashboard/KPICard";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/utils/formatMoney";
import SalesTrend from "../components/dashboard/charts/SalesTrend";
import BankedVsWithdrawals from "../components/dashboard/charts/BankedVsWithdrawals";
import RecentActivity from "../components/dashboard/RecentActivity";
import SalesVsCosts from "../components/dashboard/charts/SalesVsCosts";
import CashVsCost from "../components/dashboard/charts/CashVsCost";
import BankedVsBackCost from "../components/dashboard/charts/BankedVsBackCost";
import LoansTimeline from "../components/dashboard/charts/LoansTimeline";

/* ── Reusable section divider ── */
function SectionHeader({ title }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
        {title}
      </span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

/* ── Chart wrapper card ── */
function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
      <div className="mb-4">
        <div className="font-semibold text-slate-800 text-sm">{title}</div>
        {subtitle && (
          <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>
        )}
      </div>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const now = new Date();
  const [filter, setFilter] = useState({
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: now,
    preset: "month",
  });

  const currency = useCurrency();
  const fmt = (v) => formatMoney(v, currency);

  const {
    loading,
    salesTrend,
    compareSalesTrend,
    salesVsCosts,
    cashVsCost,
    bankedVsWdr,
    bankedVsBackCost,
    loanTimeline,
    recent,
    effectiveBankedAfterWithdrawals,
    estCashOnHand,
    totalCosts,
    totalCostsFront,
    totalCostsBack,
    totalSal,
    totalAdv,
    totalSales,
    bankedTenderLabelList,
    branchName,
    // branch switching for owner / gm / superAdmin
    branchId,
    isCompany,
    setActiveBranch,
  } = useBranchData(filter);

  // Fetch branch list only for company roles (owner / gm / superAdmin)
  const companyId = isCompany
    ? (() => { try { return JSON.parse(localStorage.getItem("user") || "{}").companyId } catch { return null } })()
    : null;
  const { data: branches = [] } = useGetBranchesBasicQuery(companyId, { skip: !companyId });

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Sticky header ── */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-base font-bold text-slate-800 leading-tight">
              {branchName || "Branch"} Dashboard
            </h1>
            <p className="text-xs text-slate-400">Financial overview</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Branch selector — only for owner / gm / superAdmin */}
            {isCompany && branches.length > 0 && (
              <select
                value={branchId || ""}
                onChange={(e) => setActiveBranch(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="" disabled>Select branch…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name || b.id}</option>
                ))}
              </select>
            )}
            {loading && (
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <svg className="animate-spin h-3 w-3 text-indigo-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Updating…
              </span>
            )}
            <Filters filter={filter} setFilter={setFilter} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-5">

        {/* ── Primary KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            title="Total Sales"
            value={fmt(totalSales)}
            color="green"
          />
          <KPICard
            title="Cash On Hand (Est.)"
            value={fmt(estCashOnHand)}
            color="blue"
            sub="Opening + cash in − cash out"
          />
          <KPICard
            title="Banked (Expected)"
            value={fmt(effectiveBankedAfterWithdrawals)}
            color="indigo"
            sub={bankedTenderLabelList || "card · qr · online"}
          />
          <KPICard
            title="Total Costs"
            value={fmt(totalCosts)}
            color="rose"
          />
        </div>

        {/* ── Secondary KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            title="Front-Office Costs"
            value={fmt(totalCostsFront)}
            color="amber"
            sub="Cash paid"
          />
          <KPICard
            title="Back-Office Costs"
            value={fmt(totalCostsBack)}
            color="orange"
            sub="Bank paid"
          />
          <KPICard
            title="Staff Salaries"
            value={fmt(totalSal)}
            color="slate"
          />
          <KPICard
            title="Staff Advances"
            value={fmt(totalAdv)}
            color="slate"
          />
        </div>

        {/* ── Performance ── */}
        <SectionHeader title="Performance" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Sales Trend" subtitle="This period vs prior period — bars show comparison">
            <SalesTrend data={salesTrend} compareData={compareSalesTrend} currency={currency} />
          </ChartCard>
          <ChartCard title="Sales vs Costs" subtitle="Revenue vs total expenses per day">
            <SalesVsCosts data={salesVsCosts} currency={currency} />
          </ChartCard>
        </div>

        {/* ── Cash Flow ── */}
        <SectionHeader title="Cash Flow" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Cash vs Cost" subtitle="Cash sales against front-office (cash) costs">
            <CashVsCost data={cashVsCost} currency={currency} />
          </ChartCard>
          <ChartCard title="Banked vs Withdrawals" subtitle="Banked sales vs withdrawals from bank account">
            <BankedVsWithdrawals data={bankedVsWdr} currency={currency} />
          </ChartCard>
        </div>

        {/* ── Bank Health ── */}
        <SectionHeader title="Bank Health" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Banked vs Back-Office Cost" subtitle="Banked receipts vs bank-paid expenses">
            <BankedVsBackCost data={bankedVsBackCost} currency={currency} />
          </ChartCard>
          <ChartCard title="Loans Timeline" subtitle="Inter-branch lending and repayments">
            <LoansTimeline data={loanTimeline} currency={currency} />
          </ChartCard>
        </div>

        {/* ── Recent Activity ── */}
        <SectionHeader title="Recent Activity" />
        <RecentActivity rows={recent} />

      </div>
    </div>
  );
}
