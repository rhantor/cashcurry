/* eslint-disable react/prop-types */
import React from "react";
import {
  Wallet,
  Building2,
  TrendingUp,
  ShoppingBag,
  Banknote,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  Calculator,
  PiggyBank,
  HandCoins,
} from "lucide-react";
import useCurrency from "@/app/hooks/useCurrency";

const makeFmt = (currency) => (n) =>
  `${currency} ${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const colorStyles = {
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  blue:    "bg-blue-50 text-blue-600 border-blue-100",
  rose:    "bg-rose-50 text-rose-600 border-rose-100",
  amber:   "bg-amber-50 text-amber-600 border-amber-100",
  violet:  "bg-violet-50 text-violet-600 border-violet-100",
  slate:   "bg-slate-50 text-slate-600 border-slate-200",
};

const StatCard = ({ label, value, icon: Icon, color, fmt, subtitle, negative }) => {
  const theme = colorStyles[color] || colorStyles.slate;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="relative z-10 min-w-0 flex-1 mr-3">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1 truncate">
            {label}
          </p>
          <h3 className={`text-xl font-bold tracking-tight ${negative ? "text-rose-600" : "text-slate-800"}`}>
            {negative && value > 0 ? "− " : ""}{fmt(value)}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`rounded-xl p-2.5 shrink-0 ${theme}`}>
          <Icon size={20} strokeWidth={2} />
        </div>
      </div>
    </div>
  );
};

export default function KpiCards({ mode, kpis }) {
  const currency = useCurrency();
  const fmt = makeFmt(currency);

  const d = {
    handInCash:       kpis?.handInCash ?? 0,
    bankBalance:      kpis?.bankBalance ?? 0,
    foodDelivery:     kpis?.foodDelivery ?? 0,
    netTotal:         kpis?.netTotal ?? 0,
    totalSales:       kpis?.totalSales ?? 0,
    totalCashSales:   kpis?.totalCashSales ?? 0,
    totalBankedSales: kpis?.totalBankedSales ?? 0,
    totalAdvances:    kpis?.totalAdvances ?? 0,
    totalLoanGiven:   kpis?.totalLoanGiven ?? 0,
    totalCostFront:   kpis?.totalCostFront ?? 0,
    totalCostBack:    kpis?.totalCostBack ?? 0,
    totalCost:        (kpis?.totalCostFront ?? 0) + (kpis?.totalCostBack ?? 0),
    periodDeposits:   kpis?.periodDeposits ?? 0,
    periodWithdrawals: kpis?.periodWithdrawals ?? 0,
  };

  // --- FRONT OFFICE ---
  if (mode === "front") {
    return (
      <div className="space-y-3 my-4">
        {/* Row 1: inflows */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            label="Total Sales"
            value={d.totalSales}
            icon={TrendingUp}
            color="violet"
            fmt={fmt}
            subtitle="Period · all payment methods"
          />
          <StatCard
            label="Cash Sales"
            value={d.totalCashSales}
            icon={Banknote}
            color="emerald"
            fmt={fmt}
            subtitle="Period · cash tender only"
          />
          <StatCard
            label="Cash in Hand"
            value={d.handInCash}
            icon={Wallet}
            color="emerald"
            fmt={fmt}
            subtitle="Running balance"
          />
        </div>
        {/* Row 2: outflows */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            label="Advances Given"
            value={d.totalAdvances}
            icon={HandCoins}
            color="amber"
            fmt={fmt}
            subtitle="Period · deducted from cash"
            negative
          />
          <StatCard
            label="Loans Given"
            value={d.totalLoanGiven}
            icon={ArrowUpRight}
            color="amber"
            fmt={fmt}
            subtitle="Period · cash out"
            negative
          />
          <StatCard
            label="Costs (Cash)"
            value={d.totalCostFront}
            icon={ArrowDownLeft}
            color="rose"
            fmt={fmt}
            subtitle="Period · front office expenses"
            negative
          />
        </div>
      </div>
    );
  }

  // --- BACK OFFICE ---
  if (mode === "back") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 my-4">
        <StatCard
          label="Bank Balance"
          value={d.bankBalance}
          icon={Building2}
          color="blue"
          fmt={fmt}
          subtitle="Running balance"
        />
        <StatCard
          label="Banked Sales"
          value={d.totalBankedSales}
          icon={TrendingUp}
          color="blue"
          fmt={fmt}
          subtitle="Period · card / QR / online"
        />
        <StatCard
          label="Cash Deposited"
          value={d.periodDeposits}
          icon={PiggyBank}
          color="emerald"
          fmt={fmt}
          subtitle="Period · cash → bank"
        />
        <StatCard
          label="Cash Withdrawn"
          value={d.periodWithdrawals}
          icon={ArrowUpRight}
          color="amber"
          fmt={fmt}
          subtitle="Period · bank → cash"
          negative
        />
        <StatCard
          label="Costs (Bank)"
          value={d.totalCostBack}
          icon={CreditCard}
          color="rose"
          fmt={fmt}
          subtitle="Period · bank expenses"
          negative
        />
      </div>
    );
  }

  // --- ALL / OVERVIEW ---
  return (
    <div className="space-y-3 my-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Net Total"
          value={d.netTotal}
          icon={Calculator}
          color="violet"
          fmt={fmt}
          subtitle="Cash + Bank + Pending delivery"
        />
        <StatCard
          label="Total Sales"
          value={d.totalSales}
          icon={TrendingUp}
          color="violet"
          fmt={fmt}
          subtitle="Period · all tenders"
        />
        <StatCard
          label="Total Costs"
          value={d.totalCost}
          icon={CreditCard}
          color="rose"
          fmt={fmt}
          subtitle="Period · cash + bank expenses"
          negative
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Cash in Hand"
          value={d.handInCash}
          icon={Wallet}
          color="emerald"
          fmt={fmt}
          subtitle="Running balance"
        />
        <StatCard
          label="Bank Balance"
          value={d.bankBalance}
          icon={Building2}
          color="blue"
          fmt={fmt}
          subtitle="Running balance"
        />
        <StatCard
          label="Food Delivery"
          value={d.foodDelivery}
          icon={ShoppingBag}
          color="amber"
          fmt={fmt}
          subtitle="Period · pending receivables"
        />
      </div>
    </div>
  );
}
