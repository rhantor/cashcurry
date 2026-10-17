"use client";

import React, { useMemo, useState } from "react";
import { subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, format, parseISO } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, Download, FileSpreadsheet, FileText, Scale } from "lucide-react";
import { useGetApprovedLoanSummaryQuery } from "@/lib/redux/api/loanApiSlice";
import { useGetBranchesBasicQuery } from "@/lib/redux/api/branchApiSlice";
import LoanPayCards from "./LoanPayCards";
import LoanActivityFeed from "./LoanActivityFeed";
import useCurrency from "@/app/hooks/useCurrency";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import { formatMoney } from "@/lib/region/currency";
import { exportLoanSummaryToExcel, exportLoanSummaryToPDF } from "@/utils/export/exportLoanSummary";
import { Badge, Button, Card, DateRangePicker, EmptyState, Menu, Skeleton, Tabs, cn } from "@/app/components/ui";

import { personName } from "@/lib/people";
/* ─── periods ─── */
const PERIODS = [
  { value: "all", label: "All time" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "last7", label: "7 days" },
  { value: "range", label: "Custom" },
];

/* { fromMs, toMs, label } for the period */
const computeDateRange = (period, customFrom, customTo) => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  switch (period) {
    case "last7": {
      const from = subDays(today, 6);
      from.setHours(0, 0, 0, 0);
      return { fromMs: from.getTime(), toMs: today.getTime(), label: `${format(from, "d MMM")} – ${format(today, "d MMM yyyy")}` };
    }
    case "thisWeek": {
      const from = startOfWeek(today, { weekStartsOn: 1 });
      const to = endOfWeek(today, { weekStartsOn: 1 });
      return { fromMs: from.getTime(), toMs: to.getTime(), label: `${format(from, "d MMM")} – ${format(to, "d MMM yyyy")}` };
    }
    case "thisMonth": {
      const from = startOfMonth(today);
      return { fromMs: from.getTime(), toMs: today.getTime(), label: format(from, "MMMM yyyy") };
    }
    case "lastMonth": {
      const from = startOfMonth(subMonths(today, 1));
      const to = endOfMonth(from);
      return { fromMs: from.getTime(), toMs: to.getTime(), label: format(from, "MMMM yyyy") };
    }
    case "range": {
      const from = customFrom ? parseISO(customFrom) : null;
      const to = customTo ? parseISO(customTo) : null;
      if (from) from.setHours(0, 0, 0, 0);
      if (to) to.setHours(23, 59, 59, 999);
      return { fromMs: from?.getTime() ?? null, toMs: to?.getTime() ?? null, label: from && to ? `${format(from, "d MMM yyyy")} – ${format(to, "d MMM yyyy")}` : "Pick the dates" };
    }
    default:
      return { fromMs: null, toMs: null, label: "All time" };
  }
};

const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

/* ─── one loan with another branch ─── */
function LoanRow({ row, counterparty, money, lent }) {
  const outstanding = Number(row.outstanding ?? row.amount ?? 0);
  const settled = row.settled || outstanding <= 0.000001;
  return (
    <li className={cn("flex items-start gap-3 px-4 py-3", settled && "opacity-60")}>
      <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", lent ? "bg-brand-soft text-brand" : "bg-warning-soft text-warning")}>
        {lent ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-fg">{lent ? `To ${counterparty}` : `From ${counterparty}`}</span>
          <Badge tone={settled ? "neutral" : "warning"} className="px-2 py-px text-[10px]">
            {settled ? "Paid back" : "Outstanding"}
          </Badge>
        </span>
        {row.reason && <span className="block truncate text-xs italic text-muted">“{row.reason}”</span>}
        <span className="mt-0.5 block text-[11px] text-subtle">
          {fmtDate(row.createdAt)}
          {row.durationDays > 0 ? ` · ${row.durationDays} days` : ""}
          {personName(row.requestedBy) ? ` · asked by ${row.requestedBy.username}` : ""}
          {row.approvedBy ? ` · approved by ${row.approvedBy.name || row.approvedBy.username || "—"}` : ""}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-semibold tabular-nums text-fg">{money(row.amount)}</span>
        {!settled && <span className="block text-xs font-semibold tabular-nums text-warning">{money(outstanding)} left</span>}
      </span>
    </li>
  );
}

/* ─── lent or borrowed, as a group ─── */
function Relation({ title, loans, money, lent, nameOf }) {
  const [open, setOpen] = useState(true);
  const outstanding = loans.reduce((s, r) => s + Number(r.outstanding ?? r.amount ?? 0), 0);
  if (!loans.length) return null;
  return (
    <Card className="overflow-hidden p-0">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 bg-surface-2/50 px-4 py-3 text-left">
        <span className="text-sm font-semibold text-fg">{title}</span>
        <Badge className="px-2 py-px text-[10px]">
          {loans.length} loan{loans.length === 1 ? "" : "s"}
        </Badge>
        {outstanding > 0.000001 && (
          <Badge tone="warning" className="px-2 py-px text-[10px]">
            {money(outstanding)} outstanding
          </Badge>
        )}
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="ml-auto text-subtle">
          <ChevronDown className="size-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="divide-y divide-line overflow-hidden">
            {loans.map((row) => (
              <LoanRow
                key={row.loanId}
                row={row}
                money={money}
                lent={lent}
                counterparty={lent ? row.requestFrom || nameOf(row.fromBranchId) : row.requestedTo || nameOf(row.toBranchId)}
              />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </Card>
  );
}

/**
 * Loan summary: what this branch (or, for the company, each branch) has lent
 * to and borrowed from other branches in a period, what is still owed either
 * way, paying back what it owes, and the requests and repayments as they
 * happened.
 */
export default function LoanSummary() {
  const { ready, companyId, branchId, user } = useResolvedCompanyBranch();
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);

  const [period, setPeriod] = useState("all");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const { fromMs, toMs, label: periodLabel } = useMemo(() => computeDateRange(period, custom.from, custom.to), [period, custom]);

  const { data: summary = {}, isLoading, error } = useGetApprovedLoanSummaryQuery(companyId ? { companyId, fromMs, toMs } : undefined, { skip: !companyId });
  const { data: branches = [] } = useGetBranchesBasicQuery(companyId || undefined, { skip: !companyId });

  // names from the loans themselves, so they show before the branch list loads
  const storedNamesMap = useMemo(() => {
    const map = {};
    Object.values(summary).forEach((s) => {
      [...(s.providedDetails || []), ...(s.takenDetails || [])].forEach((r) => {
        if (r.fromBranchId && r.requestFrom) map[r.fromBranchId] = r.requestFrom;
        if (r.toBranchId && r.requestedTo) map[r.toBranchId] = r.requestedTo;
      });
    });
    return map;
  }, [summary]);
  const nameOf = (id) => branches.find((b) => b.id === id)?.name || storedNamesMap[id] || id || "—";

  const isBranchLevel = ["branchAdmin", "manager"].includes(user?.role);
  const visible = useMemo(() => {
    if (!companyId || !ready) return {};
    if (!isBranchLevel) return summary;
    return branchId && summary?.[branchId] ? { [branchId]: summary[branchId] } : {};
  }, [companyId, ready, isBranchLevel, branchId, summary]);

  // the pay cards show only what this branch owes
  const cardsData = useMemo(() => {
    if (!ready || !branchId || !summary?.[branchId]?.relations) return {};
    const rels = summary[branchId].relations;
    return { [branchId]: { relations: Object.fromEntries(Object.entries(rels).map(([otherId, rel]) => [otherId, { net: Number(rel?.taken || 0) }])) } };
  }, [ready, branchId, summary]);

  if (!ready) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;
  if (!companyId) return <p className="p-6 text-sm text-muted">Sign in to see loans.</p>;

  const entries = Object.entries(visible);
  const exportArgs = (gen) => ({ visible, nameOf, currency, companyName: "", branchName: isBranchLevel ? nameOf(branchId) : "", generatedAt: gen });

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
      {/* period and export */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Tabs value={period} onChange={setPeriod} tabs={PERIODS} />
        </div>
        {period === "range" && <DateRangePicker value={custom} onChange={(v) => setCustom(v || { from: "", to: "" })} />}
        <span className="text-xs font-medium text-muted">{periodLabel}</span>
        <Menu
          align="end"
          width={190}
          trigger={(p) => (
            <Button {...p} variant="secondary" icon={Download} className="ml-auto" disabled={isLoading || !entries.length}>
              Export
            </Button>
          )}
          items={[
            { label: "Excel", icon: FileSpreadsheet, onSelect: () => exportLoanSummaryToExcel(exportArgs(`${periodLabel} — ${new Date().toLocaleString()}`)) },
            { label: "PDF", icon: FileText, onSelect: () => exportLoanSummaryToPDF(exportArgs(new Date().toLocaleString())) },
          ]}
        />
      </div>

      {isLoading ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24" rounded="rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-48" rounded="rounded-2xl" />
        </>
      ) : error ? (
        <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">Couldn&apos;t load the loans: {error?.message || "try again"}</p>
      ) : !entries.length ? (
        <EmptyState title="No loans in this period" description="Loans between branches, and what is still owed, show up here." />
      ) : (
        entries.map(([bid, s]) => {
          const net = Number(s?.net || 0);
          return (
            <section key={bid} className="space-y-3">
              {!isBranchLevel && <h2 className="text-base font-bold text-fg">{nameOf(bid)}</h2>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: "Lent out, still to come back", value: s?.provided || 0, icon: ArrowUpRight, tone: "bg-brand-soft text-brand" },
                  { label: "Borrowed, still to pay back", value: s?.taken || 0, icon: ArrowDownLeft, tone: "bg-warning-soft text-warning" },
                  {
                    label: net > 0 ? "Owed to us, overall" : net < 0 ? "We owe, overall" : "All square",
                    value: Math.abs(net),
                    icon: Scale,
                    tone: net >= 0 ? "bg-info-soft text-info" : "bg-danger-soft text-danger",
                  },
                ].map((c) => (
                  <Card key={c.label} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-muted">{c.label}</p>
                      <span className={cn("flex size-7 items-center justify-center rounded-lg", c.tone)}>
                        <c.icon className="size-3.5" />
                      </span>
                    </div>
                    <p className="mt-1.5 text-xl font-bold tabular-nums text-fg">{money(c.value)}</p>
                  </Card>
                ))}
              </div>
              <Relation title="Lent to other branches" loans={s?.providedDetails || []} money={money} lent nameOf={nameOf} />
              <Relation title="Borrowed from other branches" loans={s?.takenDetails || []} money={money} lent={false} nameOf={nameOf} />
              {!s?.providedDetails?.length && !s?.takenDetails?.length && <p className="text-sm text-muted">No loans for this period.</p>}
            </section>
          );
        })
      )}

      {/* pay back what this branch owes */}
      {branchId && <LoanPayCards summary={cardsData} />}

      {/* as it happened — the same period */}
      <LoanActivityFeed fromMs={fromMs} toMs={toMs} periodLabel={periodLabel} />
    </div>
  );
}
