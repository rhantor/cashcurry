"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Equal, Minus, Plus } from "lucide-react";
import { Tabs, cn } from "@/app/components/ui";
import { formatMoney } from "@/lib/region/currency";
import { COLOR } from "./kit";

// What moved the till and the bank, from a ledger's totals — or from one
// day's figures, which have the same fields. Each list adds up exactly to the
// ledger's cashChange / bankChange.
export const cashMoves = (t) => [
  { key: "cashSales", label: "Cash sales", value: t.cashSales },
  { key: "withdrawal", label: "Taken from the bank", value: t.withdrawal, transfer: true },
  { key: "loans", label: "Branch loans (cash)", value: t.loanCashDelta },
  { key: "cost", label: "Costs paid from the till", value: -t.costCash },
  { key: "salary", label: "Salaries in cash", value: -t.salaryCash },
  { key: "advances", label: "Advances & staff loans", value: -(t.advance + t.staffLoanGiven) },
  { key: "payout", label: "Pay-outs not yet costs", value: -(t.payout || 0) },
  { key: "deposit", label: "Put into the bank", value: -t.deposit, transfer: true },
];
export const bankMoves = (t) => [
  { key: "bankedSales", label: "Card, QR & online sales", value: t.bankedSales },
  { key: "deposit", label: "Cash put in", value: t.deposit, transfer: true },
  { key: "loans", label: "Branch loans (bank)", value: t.loanBankDelta },
  { key: "cost", label: "Back-office costs", value: -t.costBank },
  { key: "salary", label: "Salaries by bank", value: -t.salaryBank },
  { key: "advances", label: "Advances & loans by transfer", value: -(t.advanceBank + t.staffLoanBank) },
  { key: "withdrawal", label: "Taken out as cash", value: -t.withdrawal, transfer: true },
];

// The steps from the ledger's totals. Each list adds up exactly to its card:
// cash ends on "Cash in hand", bank on "Bank (expected)" (the period's change).
export function cashSteps({ broughtForward, totals: t, closing }) {
  return {
    start: { label: "Cash at the start", value: broughtForward.cash },
    steps: cashMoves(t),
    end: { label: "Cash in hand now", value: closing.cash },
  };
}

export function bankSteps({ totals: t }) {
  return {
    start: null,
    steps: bankMoves(t),
    end: { label: "Bank change this period", value: t.bankChange },
  };
}

/**
 * Where the money went, as a bridge: start, each thing that added or took
 * money away (a bar floating from the running total), and where it ended.
 * Steps of zero are left out. `flow` = { broughtForward, totals, closing }.
 */
export default function MoneyFlow({ flow, currency }) {
  const [tab, setTab] = useState("cash");
  if (!flow) return null;
  return (
    <div>
      <Tabs
        size="sm"
        tabs={[
          { value: "cash", label: "Cash" },
          { value: "bank", label: "Bank" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Bridge key={tab} {...(tab === "cash" ? cashSteps(flow) : bankSteps(flow))} currency={currency} className="mt-4" />
    </div>
  );
}

/** The bridge itself: { start?, steps, end } — each step a bar floating from the running total. */
export function Bridge({ start, steps, end, currency, className }) {
  const money = (v) => formatMoney(Math.abs(v), currency);

  // running total → each bar's span
  let run = start?.value ?? 0;
  const rows = [];
  if (start) rows.push({ ...start, kind: "total", from: 0, to: start.value });
  for (const s of steps) {
    if (!Math.round(s.value * 100)) continue;
    rows.push({ ...s, kind: s.value > 0 ? "in" : "out", from: run, to: run + s.value });
    run += s.value;
  }
  rows.push({ ...end, kind: "total", from: 0, to: end.value });

  const lo = Math.min(0, ...rows.flatMap((r) => [r.from, r.to]));
  const hi = Math.max(0, ...rows.flatMap((r) => [r.from, r.to]));
  const range = hi - lo || 1;
  const pos = (v) => ((v - lo) / range) * 100;

  return (
    <ul className={cn("space-y-2.5", className)}>
      {rows.map((r, i) => {
        const left = pos(Math.min(r.from, r.to));
        const width = Math.max(0.8, pos(Math.max(r.from, r.to)) - left);
        const Icon = r.kind === "in" ? Plus : r.kind === "out" ? Minus : Equal;
        const total = r.kind === "total";
        return (
          <li key={r.label} className={cn(total && i > 0 && "border-t border-dashed border-line pt-2.5")}>
            <div className="mb-1 flex items-center gap-2 text-sm">
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full",
                  r.kind === "in" ? "bg-brand-soft text-brand" : r.kind === "out" ? "bg-warning-soft text-warning" : "bg-surface-2 text-muted"
                )}
              >
                <Icon className="size-3" strokeWidth={3} />
              </span>
              <span className={cn("min-w-0 truncate", total ? "font-semibold text-fg" : "text-muted")}>{r.label}</span>
              <span className={cn("ml-auto shrink-0 tabular-nums", total ? "font-bold text-fg" : "font-semibold text-fg")}>
                {r.kind === "out" || (total && r.value < 0) ? "−" : r.kind === "in" ? "+" : ""}
                {money(r.value)}
              </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-surface-2/70">
              <motion.div
                className="absolute inset-y-0 rounded-full"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  background: total ? "var(--cc-fg)" : r.kind === "in" ? COLOR.in : COLOR.out,
                  opacity: total ? 0.75 : 1,
                  transformOrigin: r.kind === "out" ? "right" : "left",
                }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.55, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
