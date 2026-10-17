"use client";

import React, { useMemo, useState } from "react";
import { ArrowLeftRight, ArrowRight, ExternalLink, HandCoins } from "lucide-react";
import { useGetLoanActivitiesQuery } from "@/lib/redux/api/loanApiSlice";
import { useGetBranchesBasicQuery } from "@/lib/redux/api/branchApiSlice";
import useCurrency from "@/app/hooks/useCurrency";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import { formatMoney } from "@/lib/region/currency";
import { Badge, Card, Skeleton, Tabs, cn } from "@/app/components/ui";
import { Chip } from "@/app/components/entry/Choices";

import { personName } from "@/lib/people";
const fmtDate = (v) => {
  const ms = v?.seconds ? v.seconds * 1000 : v ? Date.parse(v) : 0;
  return ms ? new Date(ms).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
};
const STATUS = { approved: ["Approved", "brand"], rejected: ["Rejected", "danger"], pending: ["Waiting", "warning"] };

/**
 * Loan requests and repayments as they happened, in the summary's period:
 * coming to this branch, going from it, or both; what's waiting either way
 * and with which branch.
 */
export default function LoanActivityFeed({ fromMs = null, toMs = null, periodLabel = "All time" }) {
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);
  const { ready, companyId, branchId } = useResolvedCompanyBranch();

  const [direction, setDirection] = useState("incoming"); // incoming | outgoing | all
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");

  const { data: branches = [] } = useGetBranchesBasicQuery(companyId, { skip: !companyId });
  const nameOf = (id) => branches.find((b) => b.id === id)?.name || id;

  const { data: items = [], isLoading, error } = useGetLoanActivitiesQuery(
    ready && companyId && branchId ? { companyId, branchId, direction, status, type, fromMs, toMs, pageLimit: 150 } : { skip: true },
    { skip: !ready || !companyId, pollingInterval: 30000 }
  );

  const stats = useMemo(() => {
    const sum = (pred) => items.filter(pred).reduce((s, r) => s + Number(r.amount || 0), 0);
    const byBranch = {};
    items
      .filter((r) => r.status === "pending")
      .forEach((r) => {
        const key = direction === "incoming" ? r._fromBranchId : direction === "outgoing" ? r._toBranchId : r._fromBranchId === branchId ? r._toBranchId : r._fromBranchId;
        if (key) byBranch[key] = (byBranch[key] || 0) + Number(r.amount || 0);
      });
    return {
      waitingIn: sum((r) => r.status === "pending" && r._toBranchId === branchId),
      waitingOut: sum((r) => r.status === "pending" && r._fromBranchId === branchId),
      byBranch,
    };
  }, [items, branchId, direction]);

  if (!ready || !companyId || !branchId) return null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-fg">As it happened</h2>
        <span className="text-xs text-muted">{periodLabel}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          size="sm"
          value={direction}
          onChange={setDirection}
          tabs={[
            { value: "incoming", label: "To us" },
            { value: "outgoing", label: "From us" },
            { value: "all", label: "Both" },
          ]}
        />
        {[
          ["all", "Any status"],
          ["pending", "Waiting"],
          ["approved", "Approved"],
          ["rejected", "Rejected"],
        ].map(([v, l]) => (
          <Chip key={v} on={status === v} onClick={() => setStatus(v)}>
            {l}
          </Chip>
        ))}
        {[
          ["all", "Both kinds"],
          ["loan", "Loans"],
          ["repayment", "Repayments"],
        ].map(([v, l]) => (
          <Chip key={v} on={type === v} onClick={() => setType(v)}>
            {l}
          </Chip>
        ))}
      </div>

      {(stats.waitingIn > 0 || stats.waitingOut > 0) && (
        <Card className="flex flex-wrap gap-x-6 gap-y-2 p-4 text-sm">
          {stats.waitingIn > 0 && (
            <span>
              <span className="text-muted">Waiting for us to decide </span>
              <b className="tabular-nums text-warning">{money(stats.waitingIn)}</b>
            </span>
          )}
          {stats.waitingOut > 0 && (
            <span>
              <span className="text-muted">We&apos;re waiting on </span>
              <b className="tabular-nums text-warning">{money(stats.waitingOut)}</b>
            </span>
          )}
          {Object.keys(stats.byBranch).length > 0 && (
            <span className="flex w-full flex-wrap gap-1.5">
              {Object.entries(stats.byBranch).map(([bid, amt]) => (
                <Badge key={bid} tone="warning" className="px-2 py-px text-[10px]">
                  {nameOf(bid)} · {money(amt)}
                </Badge>
              ))}
            </span>
          )}
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-40" rounded="rounded-2xl" />
      ) : error ? (
        <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">{error?.message || "Couldn't load the activity"}</p>
      ) : !items.length ? (
        <p className="rounded-2xl bg-surface-2/60 px-4 py-6 text-center text-sm text-muted">Nothing in this period.</p>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-line">
            {items.map((r) => {
              const repay = r.type === "repayment";
              const [label, tone] = STATUS[r.status] || STATUS.pending;
              return (
                <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                  <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", repay ? "bg-info-soft text-info" : "bg-warning-soft text-warning")}>
                    {repay ? <ArrowLeftRight className="size-4" /> : <HandCoins className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-sm">
                      <b className="font-semibold text-fg">{repay ? "Repayment" : "Loan asked"}</b>
                      <Badge tone={tone} className="px-2 py-px text-[10px]">
                        {label}
                      </Badge>
                    </span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted">
                      <span className="truncate">{r.requestFrom || nameOf(r._fromBranchId)}</span>
                      <ArrowRight className="size-3 shrink-0 text-subtle" />
                      <span className="truncate">{r.requestedTo || nameOf(r._toBranchId)}</span>
                    </span>
                    <span className="mt-0.5 block text-[11px] text-subtle">
                      {fmtDate(r.createdAt)}
                      {personName(r.requestedBy) || personName(r.createdBy) ? ` · by ${personName(r.requestedBy) || personName(r.createdBy)}` : ""}
                      {r.approvedBy ? ` · ${r.status === "rejected" ? "rejected" : "approved"} by ${personName(r.approvedBy) || "-"}` : ""}
                      {repay ? ` · ${r.paymentMethod || "-"}${r.paymentMethod === "cash" && r.voucherNo ? ` ${r.voucherNo}` : ""}${r.paymentMethod === "online" && r.referenceNo ? ` ref ${r.referenceNo}` : ""}` : ""}
                    </span>
                    {(r.reason || r.note) && <span className="block truncate text-[11px] italic text-muted">“{repay ? r.note : r.reason}”</span>}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-bold tabular-nums text-fg">{money(r.amount)}</span>
                    {repay && r.proofUrl && (
                      <a href={r.proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-brand hover:underline">
                        Proof <ExternalLink className="size-3" />
                      </a>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </section>
  );
}
