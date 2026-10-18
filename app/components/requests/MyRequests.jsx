"use client";
// My requests: everything this person asked for (or was asked for them) —
// advances, staff loans and leave — newest first, with where each has got
// to, and Cancel while it still waits. Used by the office "My requests" page
// and the staff portal.
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useGetRequestsQuery } from "@/lib/redux/api/requestsApiSlice";
import { STAGES, actionsFor, stageOf } from "@/lib/requests/model";
import useCurrency from "@/app/hooks/useCurrency";
import { EmptyState, Skeleton } from "@/app/components/ui";
import { Chip } from "@/app/components/entry/Choices";
import RequestItem from "./RequestItem";
import useRequestActions from "./useRequestActions";

const FILTERS = ["all", "waiting", "approved", "paid", "closed", "rejected", "cancelled"];

export default function MyRequests({ companyId, branchId, user }) {
  const currency = useCurrency();
  const mine = user?.uid ? { uid: user.uid, staffId: user.staffId || undefined } : null;
  const { data = [], isLoading } = useGetRequestsQuery({ companyId, branchId, mine }, { skip: !companyId || !branchId || !mine });
  const { run, busyId } = useRequestActions({ companyId, branchId, user });
  const [filter, setFilter] = useState("all");

  const all = useMemo(() => data.map((r) => ({ ...r, stage: stageOf(r) })), [data]);
  const counts = useMemo(() => all.reduce((m, r) => ((m[r.stage] = (m[r.stage] || 0) + 1), m), {}), [all]);
  const shown = filter === "all" ? all : all.filter((r) => r.stage === filter);
  // only cancelling from here — deciding is done in the Requested panel
  const who = { uid: user?.uid, staffId: user?.staffId };

  if (!mine || isLoading)
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" rounded="rounded-2xl" />)}
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.filter((f) => f === "all" || counts[f]).map((f) => (
          <Chip key={f} on={filter === f} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : STAGES[f].label}
            {f !== "all" && <span className="ml-1 tabular-nums opacity-70">{counts[f]}</span>}
          </Chip>
        ))}
      </div>
      {!shown.length ? (
        <EmptyState title={all.length ? "Nothing here" : "No requests yet"} description={all.length ? "No requests in this group." : "Advances, loans and leave you ask for show up here, with where each has got to."} />
      ) : (
        <ul className="space-y-3">
          {shown.map((r, i) => (
            <motion.li key={`${r.type}-${r.id}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
              <RequestItem req={r} actions={actionsFor(r, who).filter((a) => a === "cancel")} onAction={run} busy={busyId === r.id} currency={currency} />
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
