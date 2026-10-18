"use client";
// Requests waiting for a decision at the branch — advances, staff loans and
// leave in one list (lib/requests). Approving money doesn't pay it out: it then waits in
// PayOutQueue until someone hands it over.
import { useMemo, useState } from "react";
import { useGetRequestsQuery } from "@/lib/redux/api/requestsApiSlice";
import { REQUEST_TYPES, actionsFor } from "@/lib/requests/model";
import useCurrency from "@/app/hooks/useCurrency";
import { Chip } from "@/app/components/entry/Choices";
import { RequestList } from "@/app/requested-panel/RequestCard";
import RequestItem from "./RequestItem";
import useRequestActions from "./useRequestActions";

export default function RequestInbox({ companyId, branchId, user }) {
  const currency = useCurrency();
  const { data = [], isLoading, isError } = useGetRequestsQuery(
    { companyId, branchId, status: "pending" },
    { skip: !companyId || !branchId, pollingInterval: 10000 }
  );
  const { run, busyId } = useRequestActions({ companyId, branchId, user });
  const [type, setType] = useState("all");

  const role = user?.role, uid = user?.uid, staffId = user?.staffId;
  const items = useMemo(() => data.map((r) => ({ r, actions: actionsFor(r, { role, uid, staffId }) })), [data, role, uid, staffId]);
  // what this person can act on first, then what waits on someone else
  const sorted = useMemo(() => [...items].sort((a, b) => b.actions.length - a.actions.length), [items]);
  const shown = type === "all" ? sorted : sorted.filter((x) => x.r.type === type);
  const counts = useMemo(() => data.reduce((m, r) => ((m[r.type] = (m[r.type] || 0) + 1), m), {}), [data]);

  return (
    <div className="space-y-3">
      {data.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Chip on={type === "all"} onClick={() => setType("all")}>
            All <span className="ml-1 tabular-nums opacity-70">{data.length}</span>
          </Chip>
          {Object.entries(REQUEST_TYPES)
            .filter(([k]) => counts[k])
            .map(([k, t]) => (
              <Chip key={k} on={type === k} onClick={() => setType(k)}>
                {t.label} <span className="ml-1 tabular-nums opacity-70">{counts[k]}</span>
              </Chip>
            ))}
        </div>
      )}
      <RequestList loading={isLoading} error={isError && "Couldn't load the requests."} count={shown.length} empty="No advances, staff loans or leave waiting for a decision.">
        {shown.map(({ r, actions }) => (
          <RequestItem key={`${r.type}-${r.id}`} req={r} actions={actions} onAction={run} busy={busyId === r.id} currency={currency} />
        ))}
      </RequestList>
    </div>
  );
}
