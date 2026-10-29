"use client";
// My attendance (roadmap 4.6): every day of the pay period with its clock-ins,
// the hours and overtime they count for (the same engine as payroll), and what
// to raise with the manager — a missing clock-out, early OT still waiting.
import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import useSession from "@/app/hooks/useSession";
import useCurrency from "@/app/hooks/useCurrency";
import { Badge, EmptyState, Skeleton, cn } from "@/app/components/ui";
import { toLocalDateStr } from "@/lib/attendance/computeHours";
import { useMyStaff, useMyWork } from "../useStaffApp";
import { PeriodCard } from "../parts";

const hrs = (n) => (Math.round(n * 10) / 10).toLocaleString("en", { maximumFractionDigits: 1 });
const day = (s, opts) => new Date(`${s}T00:00:00`).toLocaleDateString("en-GB", opts);

function periodLabel(period) {
  if (!period) return "";
  if (period.type === "weekly") {
    const end = new Date(period.start.getFullYear(), period.start.getMonth(), period.start.getDate() + 6);
    const f = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${f(period.start)} – ${f(end)}`;
  }
  return period.start.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** `who`: the person, when shown in the office app's Me page (else the signed-in staff member). */
export default function MyAttendancePage({ who, payHref = "/my-pay" }) {
  const { user: signedIn } = useSession();
  const user = who || signedIn;
  const currency = useCurrency();
  const { staff, priv } = useMyStaff(user);
  const me = user ? { ...user, staffId: user.staffId || staff?.id } : null;
  const [offset, setOffset] = useState(0);
  const { period, stats, loading } = useMyWork(me, staff, priv, offset);
  const days = [...(stats.days || [])].reverse(); // newest first

  return (
    <div className="space-y-5 p-4 md:p-0">
      {!who && <h1 className="hidden text-2xl font-semibold tracking-tight md:block">My attendance</h1>}

      <div className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface p-1.5">
        <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label="Earlier" className="inline-flex size-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg">
          <ChevronLeft className="size-5" />
        </button>
        <p className="text-sm font-semibold">{periodLabel(period)}</p>
        <button type="button" onClick={() => setOffset((o) => Math.min(0, o + 1))} disabled={offset === 0} aria-label="Later" className="inline-flex size-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent">
          <ChevronRight className="size-5" />
        </button>
      </div>

      {stats.isFixed ? (
        <EmptyState icon={CalendarDays} title="Your hours are not counted" description="You are on a fixed monthly salary, so your pay doesn't depend on clock-ins." />
      ) : (
        <>
          {offset === 0 && <PeriodCard staff={staff} period={period} stats={stats} loading={loading} currency={currency} href={payHref} />}
          {offset !== 0 && !loading && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["Hours", hrs(stats.basicHours)], ["Overtime", `+${hrs(stats.otHours)}`], ["Days", stats.daysWorked]].map(([k, v]) => (
                <div key={k} className="rounded-2xl border border-line bg-surface px-2 py-3">
                  <p className="text-[11px] font-medium text-muted">{k}</p>
                  <p className="mt-0.5 text-lg font-semibold">{v}</p>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" rounded="rounded-2xl" />)}</div>
          ) : days.length ? (
            <div className="space-y-2">{days.map((d) => <DayRow key={d.date} d={d} />)}</div>
          ) : (
            <EmptyState icon={Clock} title="No clock-ins" description={offset === 0 ? "Your clock-ins at the kiosk show up here, day by day." : "Nothing was clocked in this period."} />
          )}

          <p className="px-1 text-center text-xs text-subtle">Something wrong with a day? Tell your manager — Requests or Chat. Your payslip is the final word.</p>
        </>
      )}
    </div>
  );
}

function DayRow({ d }) {
  const pairs = d.pairs || [];
  return (
    <div className={cn("rounded-2xl border bg-surface px-4 py-3", d.unpaired && d.date !== toLocalDateStr(new Date()) ? "border-warning/50" : "border-line")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{day(d.date, { weekday: "short", day: "numeric", month: "short" })}</p>
          <p className="mt-0.5 text-xs text-muted tabular-nums">
            {[...pairs.map((p) => `${p.in} – ${p.out}`), ...(d.openIn ? [`${d.openIn} – …`] : [])].join(" · ") || "—"}
            {d.shift && <span className="text-subtle"> · shift {d.shift}</span>}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-semibold tabular-nums">{d.unpaired && !d.total ? "—" : `${hrs(d.basic)} h`}</p>
          {d.ot > 0 && <p className="text-xs font-medium text-brand tabular-nums">+{hrs(d.ot)} OT</p>}
        </div>
      </div>
      {(d.unpaired || d.lateMinutes > 0 || d.otApproval !== "none" || d.bonus > 0 || d.earlyLeaveMinutes > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {d.unpaired && (d.date === toLocalDateStr(new Date())
            ? <Badge tone="info" dot pulse>At work now — counted when you clock out</Badge>
            : <Badge tone="warning">A clock-in or clock-out is missing — tell your manager</Badge>)}
          {d.lateMinutes > 0 && <Badge tone="danger">Late {Math.round(d.lateMinutes)} min</Badge>}
          {d.earlyLeaveMinutes > 0 && <Badge tone="neutral">Left {Math.round(d.earlyLeaveMinutes)} min early</Badge>}
          {d.otApproval === "pending" && <Badge tone="warning" dot pulse>Early OT waiting ({Math.round(d.earlyMinutes)} min)</Badge>}
          {d.otApproval === "approved" && <Badge tone="success">Early OT approved</Badge>}
          {d.otApproval === "rejected" && <Badge tone="neutral">Early OT not approved</Badge>}
          {d.bonus > 0 && <Badge tone="brand">Paid break +1 h</Badge>}
        </div>
      )}
    </div>
  );
}
