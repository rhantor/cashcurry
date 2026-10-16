"use client";
import React, { useState } from "react";
import { AlertTriangle, ArrowDownToLine, HandCoins, Landmark, Percent, PiggyBank, Receipt, TrendingUp, Wallet } from "lucide-react";
import useCompanyData from "@/utils/dashboard/useCompanyData";
import { presetFilter } from "@/utils/dashboard/dateFilters";
import { businessToday } from "@/lib/region";
import { Stagger } from "@/app/components/ui";
import PeriodBar from "@/app/components/dashboard/PeriodBar";
import StatCard from "@/app/components/dashboard/StatCard";
import BreakdownSheet from "@/app/components/dashboard/BreakdownSheet";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/utils/formatMoney";
import SalesBreakdownTenders from "@/app/components/dashboard/charts/SalesBreakdownTenders";
import ExpensePie from "@/app/components/dashboard/charts/ExpensePie";
import RecentActivity from "@/app/components/dashboard/RecentActivity";
import SalesVsCosts from "@/app/components/dashboard/charts/SalesVsCosts";
import BranchPerformanceBar from "@/app/components/dashboard/charts/BranchPerformanceBar";
import BranchLeaderboard from "@/app/components/dashboard/BranchLeaderboard";

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
    // charts
    salesVsCosts,
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
    // labels
    tenderKeys,
    tenderLabelsByKey,
    branchPerf,
    fSales,
    branchesList,
    currencies,
    branchBalances,
  } = useCompanyData(filter);
  // Skeletons only on the first load; later refreshes keep the figures and show "Updating".
  const firstLoad = loading && !totalSales;
  const [breakdown, setBreakdown] = useState(null); // { title, rows }

  // Company totals are written in the branches' currency; when branches use
  // different currencies the totals add them together, so say so (below).
  const mixedCurrencies = currencies.length > 1;
  const currency = currencies.length === 1 ? currencies[0] : activeBranchCurrency;
  const fmt = (v) => formatMoney(v, currency);

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

  // Per-branch splits behind each figure (tap a card). Each uses the same
  // formula as its company total, so the branches add up to it.
  const per = (pick) => (branchPerf || []).map((r) => ({ name: r.name, value: pick(r) }));
  const SPLITS = {
    sales: () => per((r) => r.sales),
    expenses: () => per((r) => r.costs + r.salaries),
    profit: () => per((r) => r.sales - r.costs - r.salaries),
    cash: () => (branchBalances || []).map((b) => ({ name: b.name, value: b.cash })),
    bank: () => (branchBalances || []).map((b) => ({ name: b.name, value: b.bank })),
    owed: () => per((r) => r.advances + r.staffLoans),
    withdrawals: () => per((r) => r.withdrawals),
  };
  const show = (title, key) => () => setBreakdown({ title, rows: SPLITS[key]() });

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

      </div>
    </div>
  );
}
