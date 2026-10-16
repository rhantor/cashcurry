"use client";
import React, { useMemo, useState } from "react";
import { AlertTriangle, ArrowDownToLine, HandCoins, Landmark, Percent, PiggyBank, Receipt, TrendingUp, Wallet } from "lucide-react";
import useCompanyData from "@/utils/dashboard/useCompanyData";
import { presetFilter } from "@/utils/dashboard/dateFilters";
import { businessToday } from "@/lib/region";
import { Stagger, Tabs } from "@/app/components/ui";
import PeriodBar from "@/app/components/dashboard/PeriodBar";
import StatCard from "@/app/components/dashboard/StatCard";
import BreakdownSheet from "@/app/components/dashboard/BreakdownSheet";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/utils/formatMoney";
import RecentActivity from "@/app/components/dashboard/RecentActivity";
import SalesHero from "@/app/components/dashboard/charts/SalesHero";
import DailyNet from "@/app/components/dashboard/charts/DailyNet";
import BranchRanking from "@/app/components/dashboard/charts/BranchRanking";
import { COLOR, ChartCard, RankedBars } from "@/app/components/dashboard/charts/kit";

/** A titled group of figures or charts. */
function Section({ title, note, children }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">{title}</h2>
        <div className="h-px flex-1 bg-line" />
        {note && <span className="hidden text-xs text-subtle sm:inline">{note}</span>}
      </div>
      {children}
    </section>
  );
}

export default function OwnerDashboardPage() {
  const [filter, setFilter] = useState(() => presetFilter("month", new Date(), businessToday()));

  const activeBranchCurrency = useCurrency();

  const {
    loading,
    recent,
    // kpis
    totalWdr,
    effectiveBankedAfterWithdrawals,
    estCashOnHand,
    totalCosts,
    totalSal,
    totalAdv,
    totalStaffLoanCash,
    totalSales,
    currencies,
    branchTotals,
    companyDays,
  } = useCompanyData(filter);
  // Skeletons only on the first load; later refreshes keep the figures and show "Updating".
  const firstLoad = loading && !totalSales;
  const [breakdown, setBreakdown] = useState(null); // { title, rows }

  // Company totals are written in the branches' currency; when branches use
  // different currencies the totals add them together, so say so (below).
  const mixedCurrencies = currencies.length > 1;
  const currency = currencies.length === 1 ? currencies[0] : activeBranchCurrency;
  const fmt = (v) => formatMoney(v, currency);

  const totalOperatingExpenses = (totalCosts || 0) + (totalSal || 0);
  const netOperatingProfit = (totalSales || 0) - totalOperatingExpenses;
  const operatingMargin = totalSales ? ((netOperatingProfit / totalSales) * 100).toFixed(1) : "0.0";
  const totalReceivables = (totalAdv || 0) + (totalStaffLoanCash || 0);

  // Per-branch splits behind each figure (tap a card). Each uses the same
  // formula as its company total, so the branches add up to it.
  const per = (pick) => (branchTotals || []).map((r) => ({ name: r.name, value: pick(r) }));
  const SPLITS = {
    sales: () => per((r) => r.sales),
    expenses: () => per((r) => r.costs + r.salaries),
    profit: () => per((r) => r.sales - r.costs - r.salaries),
    cash: () => per((r) => r.cash),
    bank: () => per((r) => r.bank),
    owed: () => per((r) => r.advances + r.staffLoans),
    withdrawals: () => per((r) => r.withdrawals),
    costs: () => per((r) => r.costs),
    salaries: () => per((r) => r.salaries),
    advances: () => per((r) => r.advances),
    staffLoans: () => per((r) => r.staffLoans),
  };
  const show = (title, key) => () => setBreakdown({ title, rows: SPLITS[key]() });

  // The day-by-day company sales for the headline chart.
  const heroDays = companyDays.map((d) => ({ label: d.date, current: d.sales, currentDate: d.date }));
  const kept = DailyNet.summary(companyDays, currency);
  // Where the money went out, each tappable to see it by branch.
  const outgoings = [
    { name: "Costs", key: "costs", value: totalCosts || 0 },
    { name: "Salaries", key: "salaries", value: totalSal || 0 },
    { name: "Advances", key: "advances", value: totalAdv || 0 },
    { name: "Staff loans", key: "staffLoans", value: totalStaffLoanCash || 0 },
  ];
  // Payment types, for all branches or one.
  const [mixOf, setMixOf] = useState("all");
  const tenderMix = useMemo(() => {
    const map = new Map();
    for (const b of branchTotals || []) {
      if (mixOf !== "all" && b.branchId !== mixOf) continue;
      for (const t of b.tenders) {
        const row = map.get(t.key) || { name: t.label, value: 0, tag: t.banked ? "Bank" : t.key === "cash" ? "Till" : null };
        row.value += t.value;
        map.set(t.key, row);
      }
    }
    return [...map.values()];
  }, [branchTotals, mixOf]);

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
        <PeriodBar filter={filter} setFilter={setFilter} busy={loading && !firstLoad} />

        {mixedCurrencies && (
          <div className="flex gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-fg">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <p>
              <b>Branches use different currencies ({currencies.join(", ")}).</b> The company totals add them together,
              so they are not meaningful — use each branch&apos;s own dashboard and reports.
            </p>
          </div>
        )}

        {/* ── How the business did ── */}
        <Section title="Performance" note="Tap a figure to see it by branch">
          <Stagger className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard loading={firstLoad} label="Sales" value={totalSales} format={fmt} icon={TrendingUp} tone="brand" hint="All branches" onClick={show("Sales", "sales")} />
            <StatCard loading={firstLoad} label="Operating expenses" value={totalOperatingExpenses} format={fmt} icon={Receipt} hint="Costs + salaries" onClick={show("Operating expenses", "expenses")} />
            <StatCard loading={firstLoad} label="Operating profit" value={netOperatingProfit} format={fmt} icon={PiggyBank} tone={netOperatingProfit >= 0 ? "brand" : "neutral"} hint="Sales − expenses" onClick={show("Operating profit", "profit")} />
            <StatCard loading={firstLoad} label="Operating margin" value={Number(operatingMargin)} format={(v) => `${v.toFixed(1)}%`} icon={Percent} hint="Profit as % of sales" />
          </Stagger>
        </Section>

        {/* ── Where the money is ── */}
        <Section title="Cash & bank">
          <Stagger className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard loading={firstLoad} label="Cash in hand" value={estCashOnHand} format={fmt} icon={Wallet} tone="brand" hint="In every till, end of period" onClick={show("Cash in hand", "cash")} />
            <StatCard loading={firstLoad} label="Bank" value={effectiveBankedAfterWithdrawals} format={fmt} icon={Landmark} tone="info" hint="Expected balance" onClick={show("Bank", "bank")} />
            <StatCard loading={firstLoad} label="Owed by staff" value={totalReceivables} format={fmt} icon={HandCoins} hint="Advances + staff loans" onClick={show("Owed by staff", "owed")} />
            <StatCard loading={firstLoad} label="Withdrawals" value={totalWdr} format={fmt} icon={ArrowDownToLine} hint="Taken out of the bank" onClick={show("Withdrawals", "withdrawals")} />
          </Stagger>
        </Section>

        <BreakdownSheet open={!!breakdown} onClose={() => setBreakdown(null)} title={breakdown?.title} rows={breakdown?.rows} format={fmt} />

        {/* ── Sales across the company ── */}
        <Section title="Sales">
          <div className="space-y-4">
            <SalesHero title="Company sales this period" total={totalSales} compareData={heroDays} currency={currency} loading={firstLoad} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard
                title="Money kept each day"
                subtitle={`${kept.kept} kept, ${kept.share} of sales${kept.losing ? ` · ${kept.losing} day${kept.losing > 1 ? "s" : ""} spent more than sold` : ""}`}
                legend={DailyNet.legend}
                loading={firstLoad}
              >
                <DailyNet data={companyDays} currency={currency} />
              </ChartCard>
              <ChartCard title="How customers paid" subtitle="Sales by payment type, and where each one lands" loading={firstLoad}>
                {(branchTotals || []).length > 1 && (
                  <div className="-mx-1 mb-4 max-w-full overflow-x-auto px-1">
                    <Tabs
                      size="sm"
                      tabs={[{ value: "all", label: "All" }, ...branchTotals.map((b) => ({ value: b.branchId, label: b.name }))]}
                      value={mixOf}
                      onChange={setMixOf}
                    />
                  </div>
                )}
                <RankedBars format={fmt} rows={tenderMix} />
              </ChartCard>
            </div>
          </div>
        </Section>

        {/* ── Branch against branch ── */}
        <Section title="Branches">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Branch ranking" subtitle="Who sold most, kept most, and kept the most of each sale" loading={firstLoad}>
              <BranchRanking rows={branchTotals} format={fmt} />
            </ChartCard>
            <ChartCard title="Where the money went" subtitle="Everything paid out — tap one to see it by branch" loading={firstLoad}>
              <RankedBars format={fmt} color={COLOR.out} rows={outgoings} onPick={(r) => show(r.name, r.key)()} empty="Nothing paid out in this period" />
            </ChartCard>
          </div>
        </Section>

        {/* ── Latest records ── */}
        <Section title="Activity">
          <RecentActivity rows={recent} />
        </Section>
      </div>
    </div>
  );
}
