"use client";
// Who is in today (Ops, 30 Oct): every staff member at the branch, from
// today's kiosk punches, their days off and approved leave, and their shift
// when the branch runs shifts — those not in yet when they should be, first.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar, Badge, Skeleton, cn } from "@/app/components/ui";
import { useGetBranchAttendanceTokensQuery } from "@/lib/redux/api/attendanceApiSlice";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { useGetStaffListQuery } from "@/lib/redux/api/staffApiSlice";
import { useApprovedLeaves } from "@/lib/tasks/client";
import { awayByStaff } from "@/lib/tasks/model";
import { onShift, shiftSummary, shiftText } from "@/lib/ops/model";

const TONE = { in: "success", late: "danger", due: "neutral", notIn: "warning", out: "neutral", off: "neutral" };
const PILL = { in: "In", late: "Late", due: "Later", notIn: "Not in", out: "Gone", off: "Off" };
const FIRST = 8; // shown before "Show everyone"

/** Today's staff, punches and leave at a branch → onShift(…); `now` moves on each minute. */
export function useOnShift(companyId, branchId, today) {
  const on = !!companyId && !!branchId && !!today;
  const { data: staff, isLoading: staffLoading } = useGetStaffListQuery({ companyId, branchId }, { skip: !on });
  const { data: punches, isLoading: punchesLoading } = useGetBranchAttendanceTokensQuery({ companyId, branchId, date: today }, { skip: !on, pollingInterval: 60000 });
  const { data: settings } = useGetBranchSettingsQuery({ companyId, branchId }, { skip: !on });
  const leaves = useApprovedLeaves(companyId, branchId, on);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  const shift = useMemo(
    () => onShift({ staff: staff || [], punches: punches || [], away: awayByStaff({ staff: staff || [], leaves }), date: today, now, settings: settings?.attendance || {} }),
    [staff, punches, leaves, today, now, settings]
  );
  return { ...shift, staffCount: staff?.length || 0, loading: staffLoading || punchesLoading };
}

export default function ShiftCard({ companyId, branchId, today }) {
  const { rows, counts, staffCount, loading } = useOnShift(companyId, branchId, today);
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, FIRST);

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-sm font-semibold text-fg">On shift</h2>
        {!loading && rows.length > 0 && <span className="text-xs text-muted">{shiftSummary(counts)}</span>}
      </div>
      {loading ? (
        <Skeleton className="h-40" rounded="rounded-2xl" />
      ) : !rows.length ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-sm text-muted">
          {staffCount ? "Everyone here is on a fixed salary with no clock-in, so there is no one to show." : "No staff at this branch yet — add them in Staff management."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <ul className="divide-y divide-line">
            {shown.map((r) => (
              <li key={r.id} className={cn("flex items-center gap-3 px-4 py-2.5", r.state === "off" && "opacity-70")}>
                <Avatar name={r.name} src={r.staff.photoUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{r.name}</span>
                  <span className={cn("block text-xs", r.state === "late" ? "font-medium text-danger" : r.lateMin > 0 ? "text-warning" : "text-muted")}>{shiftText(r)}</span>
                </span>
                <Badge tone={TONE[r.state]} className="shrink-0 px-2 py-px text-[10px]">{PILL[r.state]}</Badge>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2">
            {rows.length > FIRST ? (
              <button type="button" onClick={() => setAll((a) => !a)} className="py-1 text-xs font-semibold text-brand hover:underline">
                {all ? "Show fewer" : `Show everyone (${rows.length})`}
              </button>
            ) : (
              <span />
            )}
            <Link href="/attendance-log" className="inline-flex items-center gap-0.5 py-1 text-xs font-semibold text-brand hover:underline">
              Attendance log <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
