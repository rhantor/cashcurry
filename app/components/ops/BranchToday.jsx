"use client";
// One branch today (Ops, 30 Oct): what waits for this person, the till, who
// is in, and who does what — each part only for the roles that may see it
// (lib/authz/permissions.js), so the page is the same for everyone and shows
// each person their own share of it.
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, ChevronRight, HandCoins, ListChecks, MessageCircle, NotebookPen, TriangleAlert } from "lucide-react";
import { cn } from "@/app/components/ui";
import { can, canAny, canOpen } from "@/lib/authz/permissions";
import usePendingRequests from "@/app/components/shell/usePendingRequests";
import { useIssuesWaiting } from "@/app/components/issues/useIssues";
import CashInHand from "@/app/components/requests/CashInHand";
import useTaskTeam from "@/app/components/tasks/useTaskTeam";
import { TodaysDuty } from "@/app/components/tasks/TeamTab";
import { CoverSheet } from "@/app/components/tasks/DutySheets";
import { useChecks } from "@/lib/tasks/client";
import { dutyGaps, dutyRows, todayCount } from "@/lib/tasks/model";
import ShiftCard from "./ShiftCard";

/** A count that opens where it is dealt with. */
function Tile({ n, label, href, tone }) {
  const hot = n > 0 && tone;
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col gap-1 rounded-2xl border p-3 transition-colors active:scale-[0.98]",
        hot === "warning" ? "border-warning/30 bg-warning-soft" : hot === "danger" ? "border-danger/30 bg-danger-soft" : "border-line bg-surface hover:bg-surface-2"
      )}
    >
      <span className={cn("text-2xl font-bold tabular-nums", hot === "warning" ? "text-warning" : hot === "danger" ? "text-danger" : "text-fg")}>{n}</span>
      <span className="text-xs leading-tight text-muted">{label}</span>
    </Link>
  );
}

const COLS = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" };

// shortcuts to the pages done from the phone, for those who may open them
const SHORTCUTS = [
  { href: "/payouts", label: "Hand out cash", icon: HandCoins },
  { href: "/entry-data/sales-entry", label: "Sales entry", icon: NotebookPen },
  { href: "/attendance-log", label: "Attendance", icon: CalendarClock },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/issues", label: "Issues", icon: TriangleAlert },
  { href: "/messages", label: "Chat", icon: MessageCircle },
];

export default function BranchToday({ user, companyId, branchId, today }) {
  const router = useRouter();
  const role = user?.role;

  // waiting for this person's decision, and issues waiting on them
  const approves = canAny(role, ["advances.approve", "costs.approve"]);
  const pending = usePendingRequests({ companyId, branchId, role, branchIds: [branchId] });
  const issues = useIssuesWaiting(user, [branchId]);

  // the day's tasks: the team's (those who give tasks) and one's own
  const team = useTaskTeam(user, branchId);
  const { checks } = useChecks(companyId, branchId, { from: today, to: today, ...(team.gives ? team.scope : { uid: user?.uid }) });
  const rows = useMemo(() => (team.gives ? dutyRows(team.teamTasks, checks, today, team.away) : []), [team.gives, team.teamTasks, checks, today, team.away]);
  const gaps = dutyGaps(rows);
  const mine = useMemo(() => todayCount(team.myTasks, checks, today, { uid: user?.uid, away: team.away }), [team.myTasks, checks, today, user?.uid, team.away]);
  const [giving, setGiving] = useState(null); // { task, date }: one day to someone else
  const nameOf = (uid) => team.dutyPeople.find((p) => p.uid === uid)?.name || "Someone";

  const tiles = [
    approves && { key: "ok", n: pending.total, label: "Need your OK", href: "/requested-panel", tone: "warning" },
    team.gives && { key: "duty", n: gaps, label: gaps === 1 ? "Task needs someone" : "Tasks need someone", href: "#duty", tone: "warning" },
    { key: "issues", n: issues, label: "Issues for you", href: "/issues", tone: "danger" },
    { key: "mine", n: Math.max(0, mine.total - mine.done), label: mine.late ? `My tasks left · ${mine.late} late` : "My tasks left today", href: "/tasks?tab=mine" },
  ].filter(Boolean);
  const shortcuts = SHORTCUTS.filter((s) => canOpen(role, s.href));

  return (
    <div className="space-y-5">
      <div className={cn("grid gap-2", COLS[tiles.length])}>
        {tiles.map(({ key, ...t }) => (
          <Tile key={key} {...t} />
        ))}
      </div>

      {can(role, "cashInHand.view") && <CashInHand companyId={companyId} branchId={branchId} role={role} />}

      {can(role, "attendance.view") && <ShiftCard companyId={companyId} branchId={branchId} today={today} />}

      {team.gives &&
        (rows.length ? (
          <TodaysDuty id="duty" tasks={team.teamTasks} checks={checks} today={today} away={team.away} user={user} nameOf={nameOf} onGive={setGiving} onOpen={(t) => router.push(`/tasks?task=${t.id}`)} />
        ) : (
          <Link id="duty" href="/tasks" className="flex items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-3.5 text-sm text-muted hover:bg-surface-2">
            <ListChecks className="size-5 text-subtle" />
            <span className="flex-1">No daily tasks today. Give the team its daily checklists in Tasks.</span>
            <ChevronRight className="size-4 text-subtle" />
          </Link>
        ))}

      {shortcuts.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-semibold text-fg">Go to</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {shortcuts.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="group flex flex-col items-center gap-1.5 rounded-2xl p-2 hover:bg-surface-2">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand transition group-active:scale-95">
                  <Icon className="size-5" />
                </span>
                <span className="text-center text-[11px] font-medium leading-tight text-fg">{label}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <CoverSheet
        item={giving ? { task: team.teamTasks.find((t) => t.id === giving.task.id) || giving.task, date: giving.date } : null}
        onClose={() => setGiving(null)}
        people={team.dutyPeople}
        companyId={companyId}
        branchId={branchId}
        user={user}
        today={today}
        away={team.away}
      />
    </div>
  );
}
