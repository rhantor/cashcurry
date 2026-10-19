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
import RecentActivity from "../components/dashboard/RecentActivity";
import SalesHero from "../components/dashboard/charts/SalesHero";
import DailyNet from "../components/dashboard/charts/DailyNet";
import MoneyFlow from "../components/dashboard/charts/MoneyFlow";
import BalanceTrend from "../components/dashboard/charts/BalanceTrend";
import { COLOR, ChartCard, RankedBars } from "../components/dashboard/charts/kit";
import { categoryLabel } from "@/app/entry-data/cost-entry/logic/constants";

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
    compareSalesTrend,
    salesVsCosts,
    recent,
    moneyFlow,
    balanceTrend,
    tenderMix,
    costByCategory,
    effectiveBankedAfterWithdrawals,
    estCashOnHand,
    totalCosts,
    totalNotCost,
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
  const kept = DailyNet.summary(salesVsCosts, currency);
  const t = moneyFlow?.totals;
  const loans = t
    ? [
        ["Borrowed", t.loanReceived],
        ["Lent", t.loanGiven],
        ["Repaid to us", t.repayCashIn + t.repayBankIn],
        ["We repaid", t.repayCashOut + t.repayBankOut],
      ]
    : [];
  const anyLoans = loans.some(([, v]) => v);

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
          <StatCard loading={firstLoad} label="Total costs" value={totalCosts} format={fmt} icon={Receipt} tone="neutral" hint={totalNotCost ? `Till + bank · incl. ${fmt(totalNotCost)} not a cost` : "Front + back office"} />
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

        {/* ── Sales ── */}
        <SectionHeader title="Sales" />
        <SalesHero total={totalSales} compareData={compareSalesTrend} currency={currency} loading={firstLoad} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard
            title="Money kept each day"
            subtitle={`${kept.kept} kept, ${kept.share} of sales${kept.losing ? ` · ${kept.losing} day${kept.losing > 1 ? "s" : ""} spent more than sold` : ""}`}
            legend={DailyNet.legend}
            loading={firstLoad}
          >
            <DailyNet data={salesVsCosts} currency={currency} />
          </ChartCard>
          <ChartCard title="How customers paid" subtitle="Sales by payment type, and where each one lands" loading={firstLoad}>
            <RankedBars
              format={fmt}
              rows={(tenderMix || []).map((r) => ({ name: r.label, value: r.value, tag: r.banked ? "Bank" : r.key === "cash" ? "Till" : null }))}
            />
          </ChartCard>
        </div>

        {/* ── Cash & bank ── */}
        <SectionHeader title="Cash & bank" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Where the money went" subtitle="Everything that added or took money away, step by step" loading={firstLoad}>
            <MoneyFlow flow={moneyFlow} currency={currency} />
          </ChartCard>
          <div className="space-y-4">
            <ChartCard title="Day by day" subtitle="Cash in hand at each day's end, and the bank's change so far" legend={BalanceTrend.legend} loading={firstLoad}>
              <BalanceTrend data={balanceTrend} currency={currency} />
            </ChartCard>
            {anyLoans && (
              <ChartCard title="Loans between branches" subtitle="This period, from this branch's side">
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {loans.map(([label, v]) => (
                    <div key={label} className="rounded-xl bg-surface-2/70 px-3 py-2">
                      <dt className="text-[11px] font-medium text-muted">{label}</dt>
                      <dd className="mt-0.5 truncate text-sm font-bold tabular-nums text-fg">{fmt(v)}</dd>
                    </div>
                  ))}
                </dl>
              </ChartCard>
            )}
          </div>
        </div>

        {/* ── Costs and the latest records ── */}
        <SectionHeader title="Costs & activity" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Top costs" subtitle="By category, largest first" loading={firstLoad}>
            <RankedBars format={fmt} color={COLOR.out} rows={costByCategory.map((r) => ({ ...r, name: categoryLabel(r.name) }))} empty="No costs in this period" />
          </ChartCard>
          <RecentActivity rows={recent} />
        </div>
      </div>
    </div>
  );
}
