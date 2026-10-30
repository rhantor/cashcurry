"use client";
// Cash in hand on the Requested panel: what the till holds now (the same cash
// book as Home and the dashboard), what is approved but not handed over yet,
// and so what is free to give — so whoever approves needn't count the till or
// ask anyone. Roles that see the cash tracker (reports.view) work it out here
// from the books; the cashier, who may not read them, gets just the figure
// from the server (app/api/branch/cash-in-hand) — the same engine either way.
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
import { auth } from "@/lib/firebase";
import { Card, Skeleton, cn } from "@/app/components/ui";

/** May this role see the branch's cash on the Requested panel? */
export const seesCash = (role) => can(role, "cashInHand.view");

// approved, from the till, not handed over yet (as PayOutQueue lists them)
const heldBack = (x) => x.status === "approved" && x.paidOut === null && !isLeaveRequest(x) && x.paidFromOffice !== "back";

/**
 * The card. `onFree(n)` hands what is free to give up to the page, for each
 * request's "After this" line; null until the figures are in.
 */
export default function CashInHand({ companyId, branchId, role, onFree }) {
  const [till, setTill] = useState({ ready: false, cash: 0 });
  const args = { companyId, branchId, status: "approved", unpaid: true };
  const skip = { skip: !companyId || !branchId };
  const { data: advances = [] } = useGetAdvanceEntriesQuery(args, skip);
  const { data: loans = [] } = useGetStaffLoansQuery(args, skip);
  const held = useMemo(
    () => [...advances.filter(heldBack), ...loans.filter((l) => heldBack(l) && l.source !== "migration")].reduce((s, x) => s + (Number(x.amount) || 0), 0),
    [advances, loans]
  );

  return (
    <>
      {can(role, "reports.view") ? (
        <FromTheBooks onTill={setTill} />
      ) : (
        <FromTheServer companyId={companyId} branchId={branchId} onTill={setTill} recount={held} />
      )}
      <TillCard till={till} held={held} onFree={onFree} />
    </>
  );
}

/** The till worked out here, from the books (as Home does). */
function FromTheBooks({ onTill }) {
  const today = useBusinessToday();
  const [filter] = useState(() => presetFilter("week", new Date(), today));
  const { loading, estCashOnHand, totalSales } = useBranchData(filter);
  const ready = !(loading && !totalSales);
  const cash = Number(estCashOnHand) || 0;
  useEffect(() => onTill({ ready, cash }), [ready, cash, onTill]);
  return null;
}

/** Just the figure, from the server, for those who may not read the books — counted again when what is held back changes (something handed over). */
function FromTheServer({ companyId, branchId, onTill, recount }) {
  const till = useServerCash(companyId, branchId, recount);
  useEffect(() => onTill(till), [till, onTill]);
  return null;
}

/**
 * A branch's cash in hand from the server (app/api/branch/cash-in-hand):
 * { ready, cash, failed? }. Counted again when `recount` changes. Also for
 * the GM's all-branches view on Ops, one branch per card (`day`: that
 * branch's own business day; else the active branch's).
 */
export function useServerCash(companyId, branchId, recount, day) {
  const active = useBusinessToday();
  const today = day || active;
  const [till, setTill] = useState({ ready: false, cash: 0 });
  useEffect(() => {
    if (!companyId || !branchId || !today) return;
    let live = true;
    (async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        const res = await fetch("/api/branch/cash-in-hand", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken || ""}` },
          body: JSON.stringify({ companyId, branchId, today }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (live) setTill({ ready: true, cash: Number(data.cash) || 0 });
      } catch (err) {
        console.warn("[CashInHand]", err?.message);
        if (live) setTill({ ready: false, cash: 0, failed: true });
      }
    })();
    return () => {
      live = false;
    };
  }, [companyId, branchId, today, recount]);
  return till;
}

function TillCard({ till, held, onFree }) {
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);

  const { ready, cash } = till;
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
            {ready ? (
              <p className="text-xl font-bold tabular-nums text-fg">{money(cash)}</p>
            ) : till.failed ? (
              <p className="text-sm text-muted">Couldn&apos;t count it just now</p>
            ) : (
              <Skeleton className="mt-1 h-6 w-28" />
            )}
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

