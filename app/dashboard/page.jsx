"use client";
import React, { useState } from "react";
import { Banknote, Coins, HandCoins, Landmark, Receipt, ShoppingBag, TrendingUp, Users, Wallet } from "lucide-react";
import useBranchData from "@/utils/dashboard/useBranchData";
import { presetFilter } from "@/utils/dashboard/dateFilters";
import { businessToday } from "@/lib/region";
import { Stagger } from "@/app/components/ui";
import PeriodBar from "../components/dashboard/PeriodBar";
import StatCard from "../components/dashboard/StatCard";
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
    <div className="flex items-center gap-4 pt-4 pb-1">
      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
        {title}
      </span>
      <div className="flex-1 h-px bg-slate-200/60" />
    </div>
  );
}

/* ── Chart wrapper card ── */
function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-3xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-slate-100/60 p-6 transition-all duration-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
      <div className="mb-5">
        <div className="font-semibold text-slate-800 tracking-tight">{title}</div>
        {subtitle && (
          <div className="text-xs text-slate-400 mt-1 font-medium">{subtitle}</div>
        )}
      </div>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const [filter, setFilter] = useState(() => presetFilter("month", new Date(), businessToday()));

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
    totalStaffLoanCash,
    totalSales,
    bankedTenderLabelList,
  } = useBranchData(filter);

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
        {/* ── Period (the branch is chosen in the top bar) ── */}
        <PeriodBar filter={filter} setFilter={setFilter} busy={loading && !!totalSales} />

        {/* ── Headline figures ── */}
        <Stagger className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard loading={loading && !totalSales} label="Total sales" value={totalSales} format={fmt} icon={TrendingUp} tone="brand" hint="All payment types" />
          <StatCard loading={loading && !totalSales} label="Cash in hand" value={estCashOnHand} format={fmt} icon={Wallet} tone="brand" hint="Opening + cash in − cash out" />
          <StatCard loading={loading && !totalSales} label="Bank (expected)" value={effectiveBankedAfterWithdrawals} format={fmt} icon={Landmark} tone="info" hint={bankedTenderLabelList || "Card · QR · online"} />
          <StatCard loading={loading && !totalSales} label="Total costs" value={totalCosts} format={fmt} icon={Receipt} tone="neutral" hint="Front + back office" />
        </Stagger>

        {/* ── The rest: a swipeable row on phones, a grid on computers ── */}
        <Stagger gap={0.035} delay={0.12} className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 xl:grid-cols-5">
          {[
            ["Front office", totalCostsFront, Coins, "Costs paid in cash"],
            ["Back office", totalCostsBack, ShoppingBag, "Costs paid by bank"],
            ["Salaries", totalSal, Users, "Paid this period"],
            ["Advances", totalAdv, HandCoins, "Handed over"],
            ["Staff loans", totalStaffLoanCash, Banknote, "From the till"],
          ].map(([label, value, icon, hint]) => (
            <StatCard
              key={label}
              size="sm"
              loading={loading && !totalSales}
              label={label}
              value={value}
              format={fmt}
              icon={icon}
              hint={hint}
              className="w-44 shrink-0 snap-start sm:w-auto"
            />
          ))}
        </Stagger>

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
