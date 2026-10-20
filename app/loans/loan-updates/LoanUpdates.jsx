"use client";
import React, { useMemo, useState } from "react";
import { ArrowLeftRight, ArrowRight, ExternalLink, HandCoins } from "lucide-react";
import { useGetLoanActivitiesQuery } from "@/lib/redux/api/loanApiSlice";
import { useGetBranchesBasicQuery } from "@/lib/redux/api/branchApiSlice";
import useResolvedCompanyBranch from "@/app/hooks/useResolvedCompanyBranch";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { Badge, Card, EmptyState, Skeleton, Tabs, cn } from "@/app/components/ui";
import { Chip } from "@/app/components/entry/Choices";

import { personName } from "@/lib/people";
const tsToMs = (v) => {
  if (!v) return null;
  if (typeof v === "number") return v;
  if (v?.seconds) return v.seconds * 1000;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : ms;
};
const fmtDateTime = (v) => {
  const ms = tsToMs(v);
  return ms ? new Date(ms).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
};
const STATUS = {
  approved: { label: "Approved", tone: "brand" },
  rejected: { label: "Rejected", tone: "danger" },
  pending: { label: "Waiting", tone: "warning" },
};

/* one loan or repayment */
function LoanCard({ item, branchId, money, nameOf }) {
  const repay = item.type === "repayment";
  const st = STATUS[item.status] || STATUS.pending;
  // _fromBranchId = the borrower (asked for the money); _toBranchId = the lender
  // repayments carry only the branch ids — the directory names them
  const borrower = item.requestFrom || nameOf(item._fromBranchId) || "—";
  const lender = item.requestedTo || nameOf(item._toBranchId) || "—";
  const weBorrowed = item._fromBranchId === branchId;
  const weLent = item._toBranchId === branchId;
  // money goes lender → borrower for a loan, borrower → lender for a repayment
  const [from, to] = repay ? [borrower, lender] : [lender, borrower];
  const who = personName(item.requestedBy) || personName(item.createdBy) || item.requestedBy?.email;
  const decidedBy = personName(item.approvedBy);
  const decidedAt = fmtDateTime(item.updatedAt || item.approvedAt);
  const cash = item.paymentMethod === "cash";

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", repay ? "bg-info-soft text-info" : "bg-warning-soft text-warning")}>
          {repay ? <ArrowLeftRight className="size-4" /> : <HandCoins className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-fg">{repay ? "Repayment" : "Loan"}</span>
            {(weBorrowed || weLent) && (
              <Badge tone={weBorrowed ? "warning" : "info"} className="px-2 py-px text-[10px]">
                {weBorrowed ? "We borrowed" : "We lent"}
              </Badge>
            )}
            <Badge tone={st.tone} className="px-2 py-px text-[10px]">
              {st.label}
            </Badge>
          </p>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted">
            <span className="truncate font-medium text-fg">{from}</span>
            <ArrowRight className="size-3 shrink-0 text-subtle" />
            <span className="truncate font-medium text-fg">{to}</span>
          </p>
        </div>
        <span className="shrink-0 text-right">
          <span className="block text-base font-bold tabular-nums text-fg">{money(item.amount)}</span>
          <span className="block text-[11px] text-subtle">{fmtDateTime(item.createdAt)}</span>
        </span>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2.5 text-xs">
        {!repay && item.reason && (
          <div className="flex gap-1">
            <dt className="text-subtle">Why</dt>
            <dd className="text-muted">{item.reason}</dd>
          </div>
        )}
        {who && (
          <div className="flex gap-1">
            <dt className="text-subtle">Asked by</dt>
            <dd className="text-muted">{who}</dd>
          </div>
        )}
        {decidedBy && (
          <div className="flex gap-1">
            <dt className="text-subtle">{item.status === "rejected" ? "Rejected by" : "Approved by"}</dt>
            <dd className="text-muted">
              {decidedBy}
              {item.status !== "pending" && decidedAt ? ` · ${decidedAt}` : ""}
            </dd>
          </div>
        )}
        {repay && (
          <div className="flex gap-1">
            <dt className="text-subtle">Paid by</dt>
            <dd className="text-muted">
              {item.paymentMethod || "—"}
              {cash && item.voucherNo ? ` · voucher ${item.voucherNo}` : ""}
              {!cash && item.bankName ? ` · ${item.bankName}` : ""}
              {!cash && item.referenceNo ? ` · ref ${item.referenceNo}` : ""}
            </dd>
          </div>
        )}
        {repay && item.proofUrl && (
          <a href={item.proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">
            Proof <ExternalLink className="size-3" />
          </a>
        )}
      </dl>
    </Card>
  );
}

/**
 * Loan updates: every loan and repayment this branch is part of — asked,
 * approved or rejected — newest first, as borrower or lender, with who
 * decided and how a repayment was paid.
 */
export default function BranchLoanUpdates() {
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);
  const [tab, setTab] = useState("all"); // all | borrowed | lent
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const { ready, companyId, branchId } = useResolvedCompanyBranch();

  const { data: items = [], isLoading, isError } = useGetLoanActivitiesQuery(
    ready && companyId && branchId ? { companyId, branchId, direction: "all", status: "all", type: "all", pageLimit: 200 } : { skip: true },
    { skip: !ready || !companyId || !branchId, pollingInterval: 30000 }
  );

  const { data: branches = [] } = useGetBranchesBasicQuery(companyId, { skip: !companyId });
  const nameOf = (id) => branches.find((b) => b.id === id)?.name || id;

  const counts = useMemo(() => items.reduce((m, i) => ((m[i.status || "pending"] = (m[i.status || "pending"] || 0) + 1), m), {}), [items]);

  const displayed = useMemo(() => {
    let list = items;
    if (tab === "borrowed") list = list.filter((i) => i._fromBranchId === branchId);
    if (tab === "lent") list = list.filter((i) => i._toBranchId === branchId);
    if (typeFilter !== "all") list = list.filter((i) => i.type === typeFilter);
    if (statusFilter !== "all") list = list.filter((i) => i.status === statusFilter);
    return [...list].sort((a, b) => (tsToMs(b.createdAt) || 0) - (tsToMs(a.createdAt) || 0));
  }, [items, tab, typeFilter, statusFilter, branchId]);

  const filtered = tab !== "all" || typeFilter !== "all" || statusFilter !== "all";
  const clear = () => (setTab("all"), setTypeFilter("all"), setStatusFilter("all"));

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "all", label: "All" },
            { value: "borrowed", label: "We borrowed" },
            { value: "lent", label: "We lent" },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {[
          ["all", "Loans & repayments"],
          ["loan", "Loans"],
          ["repayment", "Repayments"],
        ].map(([v, l]) => (
          <Chip key={v} on={typeFilter === v} onClick={() => setTypeFilter(v)}>
            {l}
          </Chip>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        {[
          ["all", "Any status"],
          ["pending", "Waiting"],
          ["approved", "Approved"],
          ["rejected", "Rejected"],
        ].map(([v, l]) => (
          <Chip key={v} on={statusFilter === v} onClick={() => setStatusFilter(v)}>
            {l}
            {v !== "all" && counts[v] ? <span className="ml-1 tabular-nums opacity-70">{counts[v]}</span> : null}
          </Chip>
        ))}
      </div>

      {!ready || isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32" rounded="rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">Couldn&apos;t load the loan updates. Check the connection and refresh.</p>
      ) : !displayed.length ? (
        <EmptyState
          title={items.length ? "Nothing matches" : "No loans yet"}
          description={items.length ? "No loan or repayment matches these filters." : "Loans with other branches, and their repayments, show up here."}
          action={
            filtered ? (
              <button type="button" onClick={clear} className="text-sm font-semibold text-brand hover:underline">
                Clear filters
              </button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {displayed.map((item) => (
            <LoanCard key={item.id} item={item} branchId={branchId} money={money} nameOf={nameOf} />
          ))}
        </div>
      )}
    </div>
  );
}
