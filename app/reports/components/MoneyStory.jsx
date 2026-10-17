"use client";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, ChevronDown, Landmark, Layers, Minus, NotebookPen, Plus, Wallet } from "lucide-react";
import { Bridge, bankMoves, cashMoves } from "@/app/components/dashboard/charts/MoneyFlow";
import { COLOR } from "@/app/components/dashboard/charts/kit";
import { isCashCost } from "@/lib/finance/rules";
import { categoryLabel } from "@/app/entry-data/cost-entry/logic/constants";
import { Card, CountUp, cn } from "@/app/components/ui";

/* ── what moved the money, for each view ─────────────────────────────────── */

// Till and bank together: moves between the two cancel out, so they're left out.
const bothMoves = (t) => [
  { key: "sales", label: "Sales into the till and bank", value: t.cashSales + t.bankedSales },
  { key: "loans", label: "Branch loans", value: t.loanCashDelta + t.loanBankDelta },
  { key: "cost", label: "Costs", value: -(t.costCash + t.costBank) },
  { key: "salary", label: "Salaries", value: -(t.salaryCash + t.salaryBank) },
  { key: "advances", label: "Advances & staff loans", value: -(t.advance + t.staffLoanGiven + t.advanceBank + t.staffLoanBank) },
];

export const VIEW = {
  front: {
    moves: cashMoves,
    start: (l) => l.broughtForward.cash,
    end: (l) => l.closing.cash,
    endOf: (d) => d.runningCash,
    now: "Cash in the till",
    icon: Wallet,
    bg: "from-[#1f9a7c] to-[#0f5c4c]",
  },
  back: {
    moves: bankMoves,
    start: (l) => l.broughtForward.bank,
    end: (l) => l.closing.bank,
    endOf: (d) => d.runningBank,
    now: "Money in the bank",
    icon: Landmark,
    bg: "from-[#2a78d6] to-[#1a4f94]",
  },
  all: {
    moves: bothMoves,
    start: (l) => l.broughtForward.cash + l.broughtForward.bank,
    end: (l) => l.closing.cash + l.closing.bank,
    endOf: (d) => d.runningCash + d.runningBank,
    now: "Cash and bank together",
    icon: Layers,
    bg: "from-[#0e5a4a] to-[#052a22]",
  },
};

const inOut = (moves) => ({
  in: moves.reduce((n, m) => n + (m.value > 0 ? m.value : 0), 0),
  out: moves.reduce((n, m) => n + (m.value < 0 ? -m.value : 0), 0),
});
const day = (d, f) => format(parseISO(d), f);

/* ── 1. the answer ────────────────────────────────────────────────────────── */

/** Where the money stands at the end of the period, and in one line how it got there. */
export function Answer({ ledger, mode, money }) {
  const v = VIEW[mode];
  const start = v.start(ledger);
  const end = v.end(ledger);
  const { in: came, out: went } = inOut(v.moves(ledger.totals));
  const change = end - start;
  const Icon = v.icon;
  const pending = ledger.totals.deliveryUnbanked;
  return (
    <div className={cn("relative overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-white shadow-card sm:p-6", v.bg)}>
      <Icon aria-hidden className="absolute -right-6 -top-6 size-36 opacity-10" />
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
        {v.now} · {day(ledger.to, "d MMM")}
      </p>
      <CountUp value={end} format={money} className={cn("mt-1 block text-4xl font-bold tabular-nums tracking-tight", end < 0 && "text-[#ffd4c7]")} />
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/80">
        <span>
          Started {day(ledger.from, "d MMM")} with <b className="font-semibold text-white">{money(start)}</b>
        </span>
        <span className="inline-flex items-center gap-1">
          <Plus className="size-3.5" /> <b className="font-semibold text-white">{money(came)}</b> came in
        </span>
        <span className="inline-flex items-center gap-1">
          <Minus className="size-3.5" /> <b className="font-semibold text-white">{money(went)}</b> went out
        </span>
      </p>
      {Math.round(change * 100) !== 0 && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
          {change > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
          {money(Math.abs(change))} {change > 0 ? "more" : "less"} than at the start
        </p>
      )}
      {mode === "all" && pending > 0 && (
        <p className="mt-2 text-xs text-white/75">
          Plus {money(pending)} from delivery apps not paid out yet — <b className="font-semibold text-white">{money(end + pending)}</b> in all.
        </p>
      )}
    </div>
  );
}

/* ── 2. how it got there ─────────────────────────────────────────────────── */

export function HowItGotThere({ ledger, mode, currency }) {
  const v = VIEW[mode];
  return (
    <Bridge
      currency={currency}
      start={{ label: `At the start (${day(ledger.from, "d MMM")})`, value: v.start(ledger) }}
      steps={v.moves(ledger.totals)}
      end={{ label: `Now (${day(ledger.to, "d MMM")})`, value: v.end(ledger) }}
    />
  );
}

/* ── 3. sales, and where each kind goes ──────────────────────────────────── */

export function SalesSplit({ ledger, money }) {
  const t = ledger.tenders;
  const rows = t.keys
    .map((k) => {
      const value = Number(ledger.totals.tenders[k]) || 0;
      const where = k === "cash" ? "till" : t.isBanked(k) ? "bank" : "later";
      return { k, label: t.byKey.get(k)?.label || k, value, where, counted: t.countsInTotal(k) };
    })
    .filter((r) => r.value);
  const total = ledger.totals.totalSales;
  const WHERE = {
    till: { text: "into the till", color: COLOR.in },
    bank: { text: "to the bank", color: COLOR.bank },
    later: { text: "paid out later", color: COLOR.other },
  };
  if (!rows.length) return <p className="rounded-xl bg-surface-2/60 py-8 text-center text-sm text-muted">No sales in this period</p>;
  return (
    <div>
      <p className="text-2xl font-bold tabular-nums tracking-tight text-fg">{money(total)}</p>
      {/* one bar, split by kind */}
      <div className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full">
        {rows.map((r) => (
          <motion.span
            key={r.k}
            initial={{ flexGrow: 0 }}
            animate={{ flexGrow: r.value }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ background: WHERE[r.where].color, flexBasis: 0 }}
            title={`${r.label}: ${money(r.value)}`}
          />
        ))}
      </div>
      <ul className="mt-3 divide-y divide-line text-sm">
        {rows.map((r) => (
          <li key={r.k} className="flex items-center gap-2.5 py-2">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: WHERE[r.where].color }} />
            <span className="font-medium text-fg">{r.label}</span>
            <span className="text-xs text-muted">{WHERE[r.where].text}</span>
            {!r.counted && <span className="text-[11px] text-subtle">(not in the total)</span>}
            <span className="ml-auto font-semibold tabular-nums text-fg">{money(r.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── 4. day by day ───────────────────────────────────────────────────────── */

/** The named things behind a day's figures: who got an advance, which costs, loans, notes. */
function dayItems(d, mode, events) {
  const items = [];
  const costs = d.records.costs.filter((c) => (mode === "front" ? isCashCost(c) : mode === "back" ? !isCashCost(c) : true));
  for (const c of costs) items.push({ label: `Cost · ${categoryLabel((c.category || "Other").trim())}${c.description ? ` — ${c.description}` : ""}`, value: -Number(c.amount || 0) });
  for (const e of events) {
    if (e.type === "salesNote") items.push({ note: e.notesText });
    else if (e.type === "staffAdvance" || e.type === "staffLoan") mode !== "back" && items.push({ label: e.label, value: -Number(e.amount || 0) });
    else if (e.type === "loan") items.push({ label: e.label, value: (e.role === "lender" ? -1 : 1) * Number(e.amount || 0) });
    else if (e.type === "repayment") items.push({ label: e.label, value: (e.role === "lender" ? 1 : -1) * Number(e.amount || 0) });
  }
  return items;
}

function DayRow({ d, mode, events, money }) {
  const [open, setOpen] = useState(false);
  const v = VIEW[mode];
  const moves = v.moves(d).filter((m) => Math.round(m.value * 100) && !(mode === "all" && m.transfer));
  const { in: came, out: went } = inOut(moves);
  const items = dayItems(d, mode, events);
  return (
    <li>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/50">
        <span className="w-14 shrink-0">
          <span className="block text-xs font-semibold uppercase text-muted">{day(d.date, "EEE")}</span>
          <span className="block text-base font-bold leading-tight text-fg">{day(d.date, "d MMM")}</span>
        </span>
        <span className="min-w-0 flex-1">
          {d.totalSales > 0 && <span className="block truncate text-sm text-fg">Sales {money(d.totalSales)}</span>}
          <span className="flex flex-wrap gap-x-3 text-xs">
            {came > 0 && <span className="font-medium text-brand">+{money(came)}</span>}
            {went > 0 && <span className="font-medium text-danger">−{money(went)}</span>}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[11px] text-subtle">End of day</span>
          <span className={cn("block text-sm font-bold tabular-nums", v.endOf(d) < 0 ? "text-danger" : "text-fg")}>{money(v.endOf(d))}</span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="shrink-0 text-subtle">
          <ChevronDown className="size-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-3 bg-surface-2/40 px-4 py-3 text-sm sm:pl-[5.25rem]">
              <ul className="space-y-1">
                {moves.map((m) => (
                  <li key={m.key} className="flex justify-between gap-3">
                    <span className="text-muted">{m.label}</span>
                    <span className={cn("font-medium tabular-nums", m.value > 0 ? "text-brand" : "text-danger")}>
                      {m.value > 0 ? "+" : "−"}
                      {money(Math.abs(m.value))}
                    </span>
                  </li>
                ))}
              </ul>
              {items.length > 0 && (
                <ul className="space-y-1 border-t border-dashed border-line pt-2 text-xs">
                  {items.map((it, i) =>
                    it.note ? (
                      <li key={i} className="flex gap-1.5 rounded-lg bg-warning-soft/70 px-2 py-1.5 text-fg">
                        <NotebookPen className="mt-0.5 size-3.5 shrink-0 text-warning" />
                        <span className="whitespace-pre-wrap">{it.note}</span>
                      </li>
                    ) : (
                      <li key={i} className="flex justify-between gap-3 text-muted">
                        <span className="min-w-0 truncate">{it.label}</span>
                        <span className="shrink-0 tabular-nums">{money(Math.abs(it.value))}</span>
                      </li>
                    )
                  )}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/**
 * Every day, newest first: its sales, what came in and went out, and where the
 * money stood at the end; tap one for the details. Days with nothing recorded
 * fold into one line.
 */
export function DayList({ ledger, rows, mode, money }) {
  const list = useMemo(() => {
    const events = new Map();
    for (const r of rows) if (r.type !== "daily" && r.type !== "balance" && r.date) events.set(r.date, [...(events.get(r.date) || []), r]);
    const v = VIEW[mode];
    const out = [];
    for (const d of [...ledger.days].reverse()) {
      const busy = d.totalSales || v.moves(d).some((m) => Math.round(m.value * 100)) || events.has(d.date);
      const last = out[out.length - 1];
      if (!busy && last?.quiet) last.from = d.date;
      else out.push(busy ? { d, events: events.get(d.date) || [] } : { quiet: true, from: d.date, to: d.date, end: v.endOf(d) });
    }
    return out;
  }, [ledger, rows, mode]);

  return (
    <Card className="overflow-hidden p-0">
      <ul className="divide-y divide-line">
        {list.map((x) =>
          x.quiet ? (
            <li key={x.from} className="flex items-center gap-3 px-4 py-2.5 text-xs text-subtle">
              <span className="flex-1">
                {x.from === x.to ? day(x.from, "EEE d MMM") : `${day(x.from, "d MMM")} – ${day(x.to, "d MMM")}`} · nothing recorded
              </span>
              <span className="tabular-nums">{money(x.end)}</span>
              <span className="w-4" />
            </li>
          ) : (
            <DayRow key={x.d.date} d={x.d} mode={mode} events={x.events} money={money} />
          )
        )}
      </ul>
    </Card>
  );
}
