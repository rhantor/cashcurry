"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { format, isValid } from "date-fns";
import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, HandCoins, Inbox, Landmark, Receipt, ShoppingBag, Users } from "lucide-react";
import { Card, EmptyState, Stagger, Tabs, cn } from "@/app/components/ui";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { toDate } from "@/app/hooks/dashboard/utils";

// How each kind of record looks, and where its report is.
const KINDS = {
  Sale: { label: "Sales", icon: ShoppingBag, tone: "in", href: "/reports/sales-report", group: "sales" },
  Cost: { label: "Cost", icon: Receipt, tone: "out", href: "/reports/cost-report", group: "costs" },
  Deposit: { label: "Cash to bank", icon: ArrowUpFromLine, tone: "bank", href: "/reports/deposit-report", group: "bank" },
  Withdraw: { label: "Bank to cash", icon: ArrowDownToLine, tone: "bank", href: "/reports/withdrawal-report", group: "bank" },
  Salary: { label: "Salary", icon: Users, tone: "out", href: "/reports/salary-report", group: "staff" },
  Advance: { label: "Advance", icon: HandCoins, tone: "out", href: "/reports/advance-report", group: "staff" },
  Loan: { label: "Branch loan", icon: Landmark, tone: "bank", href: "/loans/loan-updates", group: "bank" },
};
const TONE = {
  in: "bg-brand-soft text-brand",
  out: "bg-warning-soft text-warning",
  bank: "bg-info-soft text-info",
};
const FILTERS = [
  { value: "all", label: "All" },
  { value: "sales", label: "Sales" },
  { value: "costs", label: "Costs" },
  { value: "bank", label: "Bank" },
  { value: "staff", label: "Staff" },
];

const when = (r) => {
  const d = toDate(r.ts || r.date);
  return isValid(d) ? d : null;
};

/**
 * The latest records in the period, newest first, like a statement. Chips
 * narrow it to one kind; tapping a row opens that kind's report.
 * rows: [{ type: "Sale"|"Cost"|…, date, ts?, amount }]
 */
export default function RecentActivity({ rows = [], limit = 12 }) {
  const currency = useCurrency();
  const [filter, setFilter] = useState("all");
  const list = useMemo(
    () =>
      rows
        .map((r) => ({ ...r, kind: KINDS[r.type] || { label: r.type, icon: Receipt, tone: "bank", group: "other" }, at: when(r) }))
        .filter((r) => filter === "all" || r.kind.group === filter)
        .sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0))
        .slice(0, limit),
    [rows, filter, limit]
  );

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-fg">Recent activity</h3>
        <div className="-mx-1 max-w-full overflow-x-auto px-1">
          <Tabs size="sm" tabs={FILTERS} value={filter} onChange={setFilter} />
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Inbox} title="Nothing here yet" description="Entries in this period will show up here." className="py-8" />
      ) : (
        <Stagger key={filter} as="ul" gap={0.03} className="divide-y divide-line">
          {list.map((r, i) => {
            const Icon = r.kind.icon;
            const row = (
              <>
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", TONE[r.kind.tone])}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{r.kind.label}</span>
                  <span className="block text-xs text-muted">{r.at ? format(r.at, "EEE, d MMM") : "—"}</span>
                </span>
                <span className="text-sm font-semibold tabular-nums text-fg">{formatMoney(r.amount, currency)}</span>
                {r.kind.href && <ChevronRight className="size-4 shrink-0 text-subtle" />}
              </>
            );
            return (
              <Stagger.Item as="li" key={`${r.type}-${i}`}>
                {r.kind.href ? (
                  <Link href={r.kind.href} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-2 active:bg-surface-2">
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 py-2.5">{row}</div>
                )}
              </Stagger.Item>
            );
          })}
        </Stagger>
      )}
    </Card>
  );
}
