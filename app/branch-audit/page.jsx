"use client";
// Branch audit log: the same list as the company one, for the signed-in branch.
import { useEffect, useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query/react";
import { useGetBranchAuditLogsQuery } from "@/lib/redux/api/auditApiSlice";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { normalizeLog } from "@/lib/audit/normalize";
import { can } from "@/lib/authz/permissions";
import { getSessionUser } from "@/lib/session";
import useCurrency from "@/app/hooks/useCurrency";
import AuditLogView, { useAuditPeriod } from "@/app/components/audit/AuditLogView";

export default function BranchAuditPage() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    setUser(getSessionUser() || null);
  }, []);

  const companyId = user?.companyId ?? null;
  const branchId = user?.branchId ?? null;
  const allowed = can(user?.role, "audit.branch");

  const currency = useCurrency();
  const periodState = useAuditPeriod();
  const { startDate, endDate } = periodState;

  const { data: branch } = useGetSingleBranchQuery(companyId && branchId ? { companyId, branchId } : skipToken);
  const { data: raw = [], isLoading, isError } = useGetBranchAuditLogsQuery(
    companyId && branchId && allowed ? { companyId, branchId, startDate, endDate } : skipToken
  );
  const logs = useMemo(() => raw.map(normalizeLog), [raw]);

  if (user && !allowed) {
    return <div className="flex h-64 items-center justify-center text-muted">You do not have access to this page.</div>;
  }

  return (
    <AuditLogView
      title="Branch audit log"
      subtitle={`Everything added, changed, deleted or approved${branch?.name ? ` at ${branch.name}` : " at this branch"} — who did it and when.`}
      logs={logs}
      isLoading={isLoading || !user}
      isError={isError}
      periodState={periodState}
      currency={currency}
    />
  );
}
