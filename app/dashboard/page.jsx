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
import { ChartCard } from "../components/dashboard/charts/kit";

/** A small heading between groups of charts. */
function SectionHeader({ title }) {
  return (
    <div className="flex items-center gap-3 pt-3">
      <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">{title}</span>
      <div className="h-px flex-1 bg-line" />
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
  // Skeletons only on the first load; later refreshes keep the figures and show "Updating".
  const firstLoad = loading && !totalSales;

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
        {/* ── Period (the branch is chosen in the top bar) ── */}
        <PeriodBar filter={filter} setFilter={setFilter} busy={loading && !!totalSales} />

        {/* ── Headline figures ── */}
        <Stagger className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard loading={firstLoad} label="Total sales" value={totalSales} format={fmt} icon={TrendingUp} tone="brand" hint="All payment types" />
          <StatCard loading={firstLoad} label="Cash in hand" value={estCashOnHand} format={fmt} icon={Wallet} tone="brand" hint="Opening + cash in − cash out" />
          <StatCard loading={firstLoad} label="Bank (expected)" value={effectiveBankedAfterWithdrawals} format={fmt} icon={Landmark} tone="info" hint={bankedTenderLabelList || "Card · QR · online"} />
          <StatCard loading={firstLoad} label="Total costs" value={totalCosts} format={fmt} icon={Receipt} tone="neutral" hint="Front + back office" />
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
              loading={firstLoad}
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Sales trend" subtitle="Each day this period, against the same days before" legend={SalesTrend.legend(compareSalesTrend?.some((d) => d.previous > 0))} loading={firstLoad}>
            <SalesTrend data={salesTrend} compareData={compareSalesTrend} currency={currency} />
          </ChartCard>
          <ChartCard title="Sales vs costs" subtitle="What came in against everything spent, per day" legend={SalesVsCosts.legend} loading={firstLoad}>
            <SalesVsCosts data={salesVsCosts} currency={currency} />
          </ChartCard>
        </div>

        {/* ── Cash flow ── */}
        <SectionHeader title="Cash flow" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Cash vs costs" subtitle="Cash sales against costs paid from the till" legend={CashVsCost.legend} loading={firstLoad}>
            <CashVsCost data={cashVsCost} currency={currency} />
          </ChartCard>
          <ChartCard title="Bank vs withdrawals" subtitle="Card, QR and online sales against money taken out" legend={BankedVsWithdrawals.legend} loading={firstLoad}>
            <BankedVsWithdrawals data={bankedVsWdr} currency={currency} />
          </ChartCard>
        </div>

        {/* ── Bank ── */}
        <SectionHeader title="Bank" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Bank vs back-office costs" subtitle="Money into the bank against costs paid from it" legend={BankedVsBackCost.legend} loading={firstLoad}>
            <BankedVsBackCost data={bankedVsBackCost} currency={currency} />
          </ChartCard>
          <ChartCard title="Loans between branches" subtitle="Borrowed, lent and repaid" legend={LoansTimeline.legend} loading={firstLoad}>
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
