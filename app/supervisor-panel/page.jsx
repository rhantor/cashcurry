"use client";
import React, { useEffect, useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { Check, Clock, HandCoins, X } from "lucide-react";
import { useGetAdvanceEntriesQuery } from "@/lib/redux/api/AdvanceApiSlice";
import { useGetStaffLoansQuery } from "@/lib/redux/api/staffLoanApiSlice";
import { getSessionUser } from "@/lib/session";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { Avatar, Badge, Card, EmptyState, Skeleton, cn } from "@/app/components/ui";
import { Chip } from "@/app/components/entry/Choices";

const day = (v) => {
  const d = typeof v === "string" ? parseISO(v) : null;
  return d && isValid(d) ? format(d, "EEE, d MMM yyyy") : "";
};

// Where a request has got to: asked → approved → handed over (or rejected).
const stageOf = (r) => (r.status === "rejected" ? "rejected" : r.status === "pending" ? "asked" : r.paidOut ? "paid" : r.paidOut === null ? "approved" : "paid");
const STAGE = {
  asked: { label: "Waiting", tone: "warning", icon: Clock },
  approved: { label: "Approved — not handed over yet", tone: "info", icon: Check },
  paid: { label: "Handed over", tone: "brand", icon: HandCoins },
  rejected: { label: "Rejected", tone: "danger", icon: X },
};
const FILTERS = [
  { value: "all", label: "All" },
  { value: "asked", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Handed over" },
  { value: "rejected", label: "Rejected" },
];

function Steps({ stage }) {
  const order = ["asked", "approved", "paid"];
  const at = stage === "rejected" ? 0 : order.indexOf(stage);
  return (
    <ol className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold">
      {["Asked", "Approved", "Handed over"].map((s, i) => {
        const done = stage !== "rejected" && i <= at;
        return (
          <li key={s} className="flex flex-1 items-center gap-1.5">
            <span className={cn("h-1.5 flex-1 rounded-full", done ? "bg-brand" : stage === "rejected" && i === 1 ? "bg-danger" : "bg-surface-2")} />
            <span className={cn("shrink-0", done ? "text-brand" : stage === "rejected" && i === 1 ? "text-danger" : "text-subtle")}>{stage === "rejected" && i === 1 ? "Rejected" : s}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * My requests: the advances and staff loans this person asked for, newest
 * first, and where each has got to — waiting, approved, handed over or
 * rejected (and by whom).
 */
export default function SupervisorPanel() {
  const [companyId, setCompanyId] = useState(null);
  const [branchId, setBranchId] = useState(null);
  const [user, setUser] = useState(null);
  const [filter, setFilter] = useState("all");
  const currency = useCurrency();

  useEffect(() => {
    const u = getSessionUser();
    if (u) {
      setCompanyId(u.companyId);
      setBranchId(u.branchId);
      setUser(u);
    }
  }, []);

  // Only what this person raised.
  const mine = user?.uid ? { uid: user.uid } : undefined;
  const skip = { skip: !companyId || !branchId || !mine };
  const { data: advances = [], isLoading: advLoading } = useGetAdvanceEntriesQuery({ companyId, branchId, mine }, skip);
  const { data: loans = [], isLoading: loanLoading } = useGetStaffLoansQuery({ companyId, branchId, mine }, skip);

  const all = useMemo(
    () =>
      [
        ...advances.filter((a) => a.createdBy?.uid === user?.uid).map((a) => ({ ...a, kind: "Advance" })),
        ...loans.filter((l) => l.createdBy?.uid === user?.uid).map((l) => ({ ...l, kind: "Staff loan" })),
      ]
        .map((r) => ({ ...r, stage: stageOf(r) }))
        .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [advances, loans, user]
  );
  const counts = useMemo(() => all.reduce((m, r) => ((m[r.stage] = (m[r.stage] || 0) + 1), m), {}), [all]);
  const shown = filter === "all" ? all : all.filter((r) => r.stage === filter);

  if (!user || advLoading || loanLoading)
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28" rounded="rounded-2xl" />
        ))}
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Chip key={f.value} on={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label}
            {f.value !== "all" && counts[f.value] ? <span className="ml-1 tabular-nums opacity-70">{counts[f.value]}</span> : null}
          </Chip>
        ))}
      </div>

      {!shown.length ? (
        <EmptyState title={all.length ? "Nothing here" : "No requests yet"} description={all.length ? "No requests in this group." : "Advances and staff loans you ask for show up here, with where each has got to."} />
      ) : (
        <ul className="space-y-3">
          {shown.map((r, i) => {
            const st = STAGE[r.stage];
            return (
              <motion.li key={`${r.kind}-${r.id}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={r.staffName} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-fg">{r.staffName || "—"}</span>
                        <Badge tone={r.kind === "Advance" ? "brand" : "info"} className="px-2 py-px text-[10px]">
                          {r.kind}
                        </Badge>
                      </p>
                      <p className="text-xs text-muted">
                        {day(r.date)}
                        {r.kind === "Staff loan" && r.durationMonths ? ` · over ${r.durationMonths} months` : ""}
                      </p>
                      {r.reason && <p className="mt-1 line-clamp-2 text-xs text-subtle">“{r.reason}”</p>}
                    </div>
                    <span className="shrink-0 text-right">
                      <span className="block text-base font-bold tabular-nums text-fg">{formatMoney(r.amount, currency)}</span>
                      <Badge tone={st.tone} className="mt-1 px-2 py-px text-[10px]">
                        <st.icon className="size-3" /> {r.stage === "approved" ? "Approved" : st.label}
                      </Badge>
                    </span>
                  </div>
                  <Steps stage={r.stage} />
                  {r.stage !== "asked" && r.approvedBy?.name && (
                    <p className="mt-2 text-[11px] text-subtle">
                      {r.stage === "rejected" ? "Rejected" : "Approved"} by {r.approvedBy.name}
                      {r.approvedBy.role ? ` (${r.approvedBy.role})` : ""}
                      {r.stage === "paid" && r.paidOut?.date ? ` · handed over ${day(r.paidOut.date)}` : ""}
                    </p>
                  )}
                </Card>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
