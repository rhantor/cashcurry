"use client";
// Every branch at a glance (Ops, 30 Oct) for the owner, super admin and GM:
// what waits for them, and per branch the till, who is in and how the daily
// tasks are going — tap a branch for its own Ops.
import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight, CircleCheck } from "lucide-react";
import { Badge, Card, Skeleton, cn } from "@/app/components/ui";
import { businessToday, formatMoney, regionOf } from "@/lib/region";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import usePendingRequests from "@/app/components/shell/usePendingRequests";
import { useIssuesWaiting } from "@/app/components/issues/useIssues";
import { useServerCash } from "@/app/components/requests/CashInHand";
import { useGetStaffListQuery } from "@/lib/redux/api/staffApiSlice";
import { useAway, useChecks, useTasks } from "@/lib/tasks/client";
import { dutyGaps, dutyRows } from "@/lib/tasks/model";
import { useOnShift } from "./ShiftCard";

const NONE = [];

function Stat({ label, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-surface-2 px-2.5 py-2">
      <span className="truncate text-[11px] text-muted">{label}</span>
      <div className="truncate text-sm font-semibold tabular-nums text-fg">{children}</div>
    </div>
  );
}

/** One branch's card: its flags, cash, staff in and daily tasks — in its own money and on its own day. */
function BranchPulse({ user, branch, today: activeToday, onOpen }) {
  const { companyId, role } = user;
  const id = branch.id;
  const { data: settings } = useGetBranchSettingsQuery({ companyId, branchId: id }, { skip: !companyId });
  const region = useMemo(() => (settings ? regionOf(settings) : null), [settings]);
  const today = region ? businessToday(new Date(), region) : activeToday;
  const currency = settings?.financeSales?.currency || "RM";
  const pending = usePendingRequests({ companyId, branchId: id, role, uid: user.uid, branchIds: [id] });
  const issues = useIssuesWaiting(user, [id]);
  const till = useServerCash(companyId, id, undefined, today);
  const shift = useOnShift(companyId, id, today);
  const { list: tasks } = useTasks(companyId, id, { all: true });
  const { checks } = useChecks(companyId, id, { from: today, to: today, all: true });
  const { data: staff } = useGetStaffListQuery({ companyId, branchId: id }, { skip: !companyId });
  const away = useAway(companyId, id, user, staff || NONE);
  const rows = useMemo(() => dutyRows(tasks, checks, today, away), [tasks, checks, today, away]);
  const done = rows.filter((r) => r.done).length;
  const gaps = dutyGaps(rows);

  const flags = [
    pending.total > 0 && { tone: "warning", text: `${pending.total} need your OK` },
    gaps > 0 && { tone: "warning", text: `${gaps} task${gaps === 1 ? "" : "s"} need${gaps === 1 ? "s" : ""} someone` },
    shift.counts.late > 0 && { tone: "danger", text: `${shift.counts.late} late` },
    issues > 0 && { tone: "danger", text: `${issues} issue${issues === 1 ? "" : "s"}` },
  ].filter(Boolean);

  return (
    <Card interactive onClick={() => onOpen(branch)} className="space-y-3 p-4">
      <button type="button" onClick={(e) => (e.stopPropagation(), onOpen(branch))} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="truncate text-base font-semibold text-fg">{branch.name || "Branch"}</span>
        <ChevronRight className="size-4 shrink-0 text-subtle" />
      </button>
      <div className="flex flex-wrap gap-1">
        {flags.length ? (
          flags.map((f) => (
            <Badge key={f.text} tone={f.tone} className="px-2 py-px text-[10px]">
              {f.text}
            </Badge>
          ))
        ) : (
          <Badge tone="success" className="px-2 py-px text-[10px]">
            <CircleCheck className="size-3" /> All good
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Cash in hand">{till.ready ? formatMoney(till.cash, currency) : till.failed ? "—" : <Skeleton className="h-4 w-16" />}</Stat>
        <Stat label="Staff in">{shift.loading ? <Skeleton className="h-4 w-10" /> : `${shift.counts.in} / ${shift.expected}`}</Stat>
        <Stat label="Daily tasks">{rows.length ? `${done} / ${rows.length}` : "—"}</Stat>
      </div>
    </Card>
  );
}

export default function AllBranches({ user, branches, today, onOpen }) {
  const ids = useMemo(() => branches.map((b) => b.id), [branches]);
  // every branch's advances, loans and leave (the company inbox), as the menu counts them
  const pending = usePendingRequests({ companyId: user.companyId, branchId: null, role: user.role, uid: user.uid, branchIds: ids });

  return (
    <div className="space-y-3">
      <Link
        href="/requested-panel"
        className={cn("flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-colors", pending.total ? "border-warning/30 bg-warning-soft" : "border-line bg-surface hover:bg-surface-2")}
      >
        <span className={cn("text-2xl font-bold tabular-nums", pending.total ? "text-warning" : "text-fg")}>{pending.total}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-fg">Need your OK</span>
          <span className="block text-xs text-muted">Advances, staff loans and leave across every branch</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-subtle" />
      </Link>
      {branches.map((b) => (
        <BranchPulse key={b.id} user={user} branch={b} today={today} onOpen={onOpen} />
      ))}
    </div>
  );
}
