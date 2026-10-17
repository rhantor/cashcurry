"use client";
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Banknote, Building2, Calculator, CreditCard, HandCoins, Landmark, PiggyBank, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import { Card, CountUp, Skeleton, cn } from "@/app/components/ui";

const TONE = {
  in: "bg-brand-soft text-brand",
  out: "bg-danger-soft text-danger",
  bank: "bg-info-soft text-info",
  warn: "bg-warning-soft text-warning",
};

function Tile({ label, value, note, icon: Icon, tone = "in", out = false, money }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-muted">{label}</p>
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", TONE[tone])}>
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className={cn("mt-1.5 truncate text-lg font-bold tabular-nums tracking-tight", out && value > 0 ? "text-danger" : "text-fg")}>
        {out && value > 0 ? "−" : ""}
        {money(value)}
      </p>
      {note && <p className="mt-0.5 truncate text-[11px] text-subtle">{note}</p>}
    </Card>
  );
}

/** The figure the mode is about — where the money stands at the end of the period. */
function Hero({ label, value, from, note, tone, icon: Icon, money }) {
  const bg = { cash: "from-[#1f9a7c] to-[#0f5c4c]", bank: "from-[#2a78d6] to-[#1a4f94]", all: "from-[#0e5a4a] to-[#052a22]" }[tone];
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-card", bg)}>
      <Icon aria-hidden className="absolute -right-4 -top-4 size-28 opacity-10" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">{label}</p>
      <CountUp value={value} format={money} className={cn("mt-1 block text-3xl font-bold tabular-nums tracking-tight", value < 0 && "text-[#ffd4c7]")} />
      {from !== undefined && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-white/75">
          <ArrowRightLeft className="size-3.5" /> Started the period with <b className="font-semibold text-white">{money(from)}</b>
        </p>
      )}
      {note && <p className="mt-1 text-xs text-white/75">{note}</p>}
    </div>
  );
}

/**
 * The period at a glance for the chosen view: the till (cash), the bank, or
 * both together. The big card is where the money stands at the end; the
 * small ones are what came in and went out over the period.
 * kpis: from useSummaryReportLogic; opening: { cash, bank } brought forward.
 */
export default function KpiCards({ mode, kpis = {}, opening = {}, money, loading }) {
  const k = (n) => Number(kpis[n]) || 0;
  if (loading)
    return (
      <div className="grid gap-3 lg:grid-cols-[1.2fr_2fr]">
        <Skeleton className="h-36" rounded="rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[5.5rem]" rounded="rounded-2xl" />
          ))}
        </div>
      </div>
    );

  const view = {
    front: {
      hero: <Hero label="Cash in hand" value={k("handInCash")} from={opening.cash} tone="cash" icon={Wallet} money={money} />,
      tiles: [
        { label: "Total sales", value: k("totalSales"), note: "Every way of paying", icon: TrendingUp },
        { label: "Cash sales", value: k("totalCashSales"), note: "Into the till", icon: Banknote },
        { label: "Costs paid in cash", value: k("totalCostFront"), icon: ArrowDownLeft, tone: "out", out: true },
        { label: "Advances", value: k("totalAdvances"), note: "From the till", icon: HandCoins, tone: "warn", out: true },
        { label: "Loans given", value: k("totalLoanGiven"), note: "To staff and branches", icon: ArrowUpRight, tone: "warn", out: true },
        { label: "Cash to bank", value: k("periodDeposits"), icon: PiggyBank, tone: "bank", out: true },
      ],
    },
    back: {
      hero: <Hero label="Bank balance" value={k("bankBalance")} from={opening.bank} tone="bank" icon={Landmark} money={money} />,
      tiles: [
        { label: "Sales into the bank", value: k("totalBankedSales"), note: "Card, QR, online", icon: TrendingUp, tone: "bank" },
        { label: "Cash to bank", value: k("periodDeposits"), note: "From the till", icon: PiggyBank, tone: "bank" },
        { label: "Bank to cash", value: k("periodWithdrawals"), note: "Into the till", icon: ArrowUpRight, tone: "warn", out: true },
        { label: "Costs paid by bank", value: k("totalCostBack"), icon: CreditCard, tone: "out", out: true },
      ],
    },
    all: {
      hero: (
        <Hero
          label="Net total"
          value={k("netTotal")}
          note={`Cash ${money(k("handInCash"))} + bank ${money(k("bankBalance"))}${k("foodDelivery") ? " + delivery not paid out yet" : ""}`}
          tone="all"
          icon={Calculator}
          money={money}
        />
      ),
      tiles: [
        { label: "Total sales", value: k("totalSales"), icon: TrendingUp },
        { label: "Total costs", value: k("totalCostFront") + k("totalCostBack"), note: "Cash and bank", icon: CreditCard, tone: "out", out: true },
        { label: "Cash in hand", value: k("handInCash"), icon: Wallet },
        { label: "Bank balance", value: k("bankBalance"), icon: Building2, tone: "bank" },
        { label: "Food delivery", value: k("foodDelivery"), note: "Grab, Foodpanda…", icon: ShoppingBag, tone: "warn" },
      ],
    },
  }[mode];

  return (
    <div className="grid gap-3 lg:grid-cols-[1.2fr_2fr]">
      {view.hero}
      <div className={cn("grid grid-cols-2 gap-3", view.tiles.length > 4 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {view.tiles.map((t) => (
          <Tile key={t.label} {...t} money={money} />
        ))}
      </div>
    </div>
  );
}
