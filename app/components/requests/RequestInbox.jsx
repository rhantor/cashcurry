"use client";
// Requests waiting for a decision — advances, staff loans and leave in one
// list (lib/requests), oldest first. Owner, super admin and gm see every
// branch at once (or one branch), so they needn't switch branch to act; one
// approval is enough, from anyone who may approve. Approving money doesn't pay
// it out: it then waits in PayOutQueue until someone hands it over.
import { useMemo, useState } from "react";
import { useGetRequestsQuery } from "@/lib/redux/api/requestsApiSlice";
import { REQUEST_TYPES, actionsFor } from "@/lib/requests/model";
import { isCompanyRole } from "@/lib/authz/permissions";
import useCurrency from "@/app/hooks/useCurrency";
import { Chip } from "@/app/components/entry/Choices";
import { RequestList } from "@/app/requested-panel/RequestCard";
import RequestItem from "./RequestItem";
import useRequestActions from "./useRequestActions";

const oldestFirst = (a, b) => String(a.askedAt).localeCompare(String(b.askedAt));

export default function RequestInbox({ companyId, branchId, user, branches = [], free = null }) {
  const currency = useCurrency();
  const company = isCompanyRole(user?.role) && branches.length > 1;
  const [scope, setScope] = useState("all"); // company roles: "all" branches or "this" one
  const branchIds = company && scope === "all" ? branches.map((b) => b.id) : null;
  const { data = [], isLoading, isError } = useGetRequestsQuery(
    { companyId, branchId, branchIds, status: "pending" },
    { skip: !companyId || (!branchId && !branchIds), pollingInterval: 15000 }
  );
  const { run, busyId } = useRequestActions({ companyId, branchId, user });
  const [type, setType] = useState("all");

  const role = user?.role, uid = user?.uid, staffId = user?.staffId;
  const nameOf = useMemo(() => Object.fromEntries(branches.map((b) => [b.id, b.name || b.id])), [branches]);
  const items = useMemo(() => [...data].sort(oldestFirst).map((r) => ({ r, actions: actionsFor(r, { role, uid, staffId }) })), [data, role, uid, staffId]);
  const shown = type === "all" ? items : items.filter((x) => x.r.type === type);
  const counts = useMemo(() => data.reduce((m, r) => ((m[r.type] = (m[r.type] || 0) + 1), m), {}), [data]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {company && (
          <div className="mr-1 inline-flex rounded-xl bg-surface-2 p-0.5 text-xs font-semibold">
            {[
              ["all", "All branches"],
              ["this", nameOf[branchId] || "This branch"],
            ].map(([v, label]) => (
              <button key={v} type="button" onClick={() => setScope(v)} className={`rounded-lg px-3 py-1.5 transition-colors ${scope === v ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg"}`}>
                {label}
              </button>
            ))}
          </div>
        )}
        {data.length > 0 && (
          <>
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
          </>
        )}
      </div>
      <RequestList loading={isLoading} error={isError && "Couldn't load the requests."} count={shown.length} empty="No advances, staff loans or leave waiting for a decision.">
        {shown.map(({ r, actions }) => (
          <RequestItem key={`${r.branchId}-${r.type}-${r.id}`} req={r} actions={actions} onAction={run} busy={busyId === r.id} currency={currency} branchName={branchIds ? nameOf[r.branchId] : null} free={r.branchId === branchId ? free : null} />
        ))}
      </RequestList>
    </div>
  );
}
