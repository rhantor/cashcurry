"use client";
// "Today's tasks" on the staff app's Home (roadmap 4.11): how many are left and
// the next few, opening the full list.
import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight, ListChecks } from "lucide-react";
import { useBusinessToday } from "@/app/hooks/useRegion";
import { dayList, unreadOn } from "@/lib/tasks/model";
import { useAway, useChecks, useTaskReads, useTasks } from "@/lib/tasks/client";

export default function TodayTasksCard({ user, href = "/my-tasks" }) {
  const today = useBusinessToday();
  const { list: tasks, loading } = useTasks(user.companyId, user.branchId, { uid: user.uid });
  const { checks } = useChecks(user.companyId, user.branchId, { from: today, to: today, uid: user.uid });
  const reads = useTaskReads(user.companyId, user.uid);
  const away = useAway(user.companyId, user.branchId, user);
  // only what is theirs today: not a day off, nor a day given to someone else
  const items = useMemo(() => dayList(tasks, checks, today, today, { uid: user.uid, away }), [tasks, checks, today, user.uid, away]);
  const fresh = tasks.filter((t) => unreadOn(t, reads, user.uid)).length;
  if (loading || (!items.length && !fresh)) return null;
  const left = items.filter((x) => !x.done);
  return (
    <Link href={href} className="block rounded-2xl border border-line bg-surface p-4 transition hover:bg-surface-2">
      <span className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <ListChecks className="size-5" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-fg">Today&apos;s tasks</span>
          <span className="block text-xs text-muted">
            {items.length ? (left.length ? `${left.length} of ${items.length} left` : `All ${items.length} done`) : "Nothing today"}
            {fresh > 0 && <span className="ml-2 font-semibold text-brand">· {fresh} with new messages</span>}
          </span>
        </span>
        <ChevronRight className="size-4 text-subtle" />
      </span>
      {left.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-line pt-3">
          {left.slice(0, 3).map((x) => (
            <li key={x.task.id} className="flex items-center gap-2 text-sm text-fg">
              <span className={`size-1.5 rounded-full ${x.overdue ? "bg-danger" : "bg-brand"}`} />
              <span className="truncate">{x.task.title}</span>
            </li>
          ))}
          {left.length > 3 && <li className="text-xs text-muted">and {left.length - 3} more</li>}
        </ul>
      )}
    </Link>
  );
}
