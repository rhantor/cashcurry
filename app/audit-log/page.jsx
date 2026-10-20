"use client";
// Company audit log: every branch's record changes and approvals, newest first.
import { useEffect, useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query/react";
import { useGetAuditLogsQuery } from "@/lib/redux/api/auditApiSlice";
import { useGetBranchesQuery } from "@/lib/redux/api/branchApiSlice";
import { normalizeLog } from "@/lib/audit/normalize";
import { getSessionUser } from "@/lib/session";
import useCurrency from "@/app/hooks/useCurrency";
import AuditLogView, { useAuditPeriod } from "@/app/components/audit/AuditLogView";

export default function AuditLogPage() {
  const [companyId, setCompanyId] = useState(null);
  useEffect(() => {
    setCompanyId(getSessionUser()?.companyId || null);
  }, []);

  const currency = useCurrency();
  const periodState = useAuditPeriod();
  const { startDate, endDate } = periodState;

  const { data: branches = [] } = useGetBranchesQuery(companyId ?? skipToken);
  const names = useMemo(() => Object.fromEntries(branches.map((b) => [b.id, b.name])), [branches]);

  const { data: raw = [], isLoading, isError } = useGetAuditLogsQuery(companyId ? { companyId, startDate, endDate } : skipToken);
  const logs = useMemo(() => raw.map(normalizeLog), [raw]);

  return (
    <AuditLogView
      title="Audit log"
      subtitle="Every sale, cost, salary, loan and bill added, changed or deleted, and every approval — who did it and when."
      logs={logs}
      isLoading={isLoading || !companyId}
      isError={isError}
      periodState={periodState}
      branchName={(id) => names[id] || "Branch removed"}
      currency={currency}
    />
  );
}
