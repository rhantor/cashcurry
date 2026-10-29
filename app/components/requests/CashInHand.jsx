"use client";
// Cash in hand on the Requested panel: what the till holds now (the same cash
// book as Home and the dashboard), what is approved but not handed over yet,
// and so what is free to give — so whoever approves needn't count the till or
// ask anyone. Only roles that see the cash tracker (reports.view) get it.
import { useEffect, useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { useBusinessToday } from "@/app/hooks/useRegion";
import useCurrency from "@/app/hooks/useCurrency";
import useBranchData from "@/app/hooks/dashboard/useBranchData";
import { presetFilter } from "@/app/hooks/dashboard/dateFilters";
import { useGetAdvanceEntriesQuery } from "@/lib/redux/api/AdvanceApiSlice";
import { useGetStaffLoansQuery } from "@/lib/redux/api/staffLoanApiSlice";
import { isLeaveRequest } from "@/lib/finance/rules";
import { formatMoney } from "@/lib/region/currency";
import { can } from "@/lib/authz/permissions";
import { Card, Skeleton, cn } from "@/app/components/ui";

/** May this role see the branch's cash on the Requested panel? */
export const seesCash = (role) => can(role, "reports.view");

// approved, from the till, not handed over yet (as PayOutQueue lists them)
const heldBack = (x) => x.status === "approved" && x.paidOut === null && !isLeaveRequest(x) && x.paidFromOffice !== "back";

/**
 * The card. `onFree(n)` hands what is free to give up to the page, for each
 * request's "After this" line; null until the figures are in.
 */
export default function CashInHand({ companyId, branchId, onFree }) {
  const today = useBusinessToday();
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);
  const [filter] = useState(() => presetFilter("week", new Date(), today));
  const { loading, estCashOnHand, totalSales } = useBranchData(filter);

  const args = { companyId, branchId, status: "approved", unpaid: true };
  const skip = { skip: !companyId || !branchId };
  const { data: advances = [] } = useGetAdvanceEntriesQuery(args, skip);
  const { data: loans = [] } = useGetStaffLoansQuery(args, skip);
  const held = useMemo(
    () => [...advances.filter(heldBack), ...loans.filter((l) => heldBack(l) && l.source !== "migration")].reduce((s, x) => s + (Number(x.amount) || 0), 0),
    [advances, loans]
  );

  const ready = !(loading && !totalSales);
  const cash = Number(estCashOnHand) || 0;
  const free = cash - held;
  useEffect(() => onFree?.(ready ? free : null), [ready, free, onFree]);
  useEffect(() => () => onFree?.(null), [onFree]);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Wallet className="size-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Cash in hand now</p>
            {ready ? <p className="text-xl font-bold tabular-nums text-fg">{money(cash)}</p> : <Skeleton className="mt-1 h-6 w-28" />}
          </div>
        </div>
        {ready && held > 0 && (
          <>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Approved, not handed over</p>
              <p className="text-base font-semibold tabular-nums text-warning">− {money(held)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Free to give</p>
              <p className={cn("text-base font-bold tabular-nums", free < 0 ? "text-danger" : "text-fg")}>{money(free)}</p>
            </div>
          </>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">From the till, as the cash tracker counts it. Money from the bank isn&apos;t counted here.</p>
    </Card>
  );
}

