"use client";
// Tasks (roadmap 4.11), for the office (/tasks) and the staff app (/my-tasks):
// Team — today at a glance and each person (management: everyone; a
// supervisor: their own team), shown first to those who give tasks; My tasks
// — your to-do list; Performance; Notes — your own (a note's line can become a task).
// ?tab=team|mine|performance|notes opens one; ?task=<id> opens that task with
// its questions and answers (notifications link there).
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarCheck, Gauge, NotebookPen, Users } from "lucide-react";
import { Tabs, useIsPhone } from "@/app/components/ui";
import { useBusinessToday } from "@/app/hooks/useRegion";
import { useChatPeople } from "@/app/components/chat/useChat";
import { useGetStaffListQuery } from "@/lib/redux/api/staffApiSlice";
import { canManageTasks, canTeamTasks, leadOf, teamOf, unreadOn } from "@/lib/tasks/model";
import { useTaskReads, useTasks } from "@/lib/tasks/client";
import MyTasksTab from "./MyTasksTab";
import TeamTab from "./TeamTab";
import PerformanceTab from "./PerformanceTab";
import NotesTab from "./NotesTab";
import TaskDetailSheet from "./TaskDetailSheet";

export default function TasksHome({ user, branchId }) {
  const companyId = user.companyId;
  const today = useBusinessToday();
  const manage = canManageTasks(user.role) && !!branchId;
  const lead = !manage && canTeamTasks(user.role) && !!branchId; // a supervisor
  const gives = manage || lead;
  const [tab, setTab] = useState(null); // null: Team for those who give tasks, else My tasks
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = params.get("tab");
  const taskParam = params.get("task");
  useEffect(() => {
    if (tabParam === "today") setTab("mine"); // older links
    else if (["mine", "team", "performance", "notes"].includes(tabParam)) setTab(tabParam);
  }, [tabParam]);

  const mine = useTasks(companyId, branchId, { uid: user.uid });
  const given = useTasks(companyId, branchId, manage ? { all: true } : { lead: lead ? user.uid : undefined });
  const everyone = useChatPeople(gives ? companyId : null);
  // staff records say who leads whom (Staff management → Job → Supervisor)
  const { data: staff = [] } = useGetStaffListQuery({ companyId, branchId }, { skip: !gives || !companyId || !branchId });

  // who tasks can be given to: management — the branch's people; a supervisor — their team
  const people = useMemo(() => {
    const here = everyone.filter((p) => p.branchId === branchId && p.uid !== user.uid);
    if (manage) return here;
    if (!lead) return [];
    const team = new Set(teamOf(staff, user.uid));
    return here.filter((p) => team.has(p.uid));
  }, [everyone, branchId, user.uid, manage, lead, staff]);
  // who leads a new task: the supervisor giving it, else the person's own supervisor
  const leadFor = useMemo(() => (lead ? () => user.uid : (uid) => leadOf(staff, uid)), [lead, user.uid, staff]);
  const scope = manage ? { all: true } : { lead: user.uid };
  // which tasks' messages are new to this person (the green badges)
  const reads = useTaskReads(companyId, user.uid);
  const newMine = mine.list.filter((t) => unreadOn(t, reads, user.uid)).length;
  const newTeam = given.list.filter((t) => t.assigneeUid !== user.uid && unreadOn(t, reads, user.uid)).length;
  const withCount = (label, n) =>
    n ? (
      <>
        {label}
        <span className="ml-1 inline-flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-brand-fg">{n}</span>
      </>
    ) : (
      label
    );
  const openTask = (id) => {
    const next = new URLSearchParams(params.toString());
    next.set("task", id);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  // the task a notification points at: open it, on the tab it belongs to
  const linked = taskParam ? mine.list.find((t) => t.id === taskParam) || given.list.find((t) => t.id === taskParam) : null;
  useEffect(() => {
    if (!linked) return;
    setTab(linked.assigneeUid === user.uid ? "mine" : "team");
  }, [linked?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const closeLinked = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("task");
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  // on a phone the tabs share the width, words only, so all of them fit
  const phone = useIsPhone();
  const tabs = [
    ...(gives ? [{ value: "team", label: withCount(lead ? "My team" : "Team", newTeam), icon: Users }] : []),
    { value: "mine", label: withCount("My tasks", newMine), icon: CalendarCheck },
    { value: "performance", label: gives || phone ? "Performance" : "My performance", icon: Gauge },
    { value: "notes", label: "Notes", icon: NotebookPen },
  ].map((t) => (phone ? { ...t, icon: undefined } : t));
  const current = !tab || (tab === "team" && !gives) ? (gives ? "team" : "mine") : tab;

  if (!branchId)
    return <p className="rounded-2xl bg-surface-2 p-6 text-sm text-muted">Pick a branch at the top to see its tasks.</p>;

  return (
    <div className="space-y-5">
      <div className="-mx-1 max-w-full overflow-x-auto px-1 [scrollbar-width:none]">
        <Tabs tabs={tabs} value={current} onChange={setTab} className={phone ? "flex w-full [&>button]:flex-1 [&>button]:justify-center [&>button]:px-2" : undefined} />
      </div>
      {current === "team" && (
        <TeamTab tasks={given.list} loading={given.loading} people={people} companyId={companyId} branchId={branchId} user={user} today={today} scope={scope} leadFor={leadFor} reads={reads} onOpenTask={openTask} />
      )}
      {current === "mine" && <MyTasksTab tasks={mine.list} loading={mine.loading} companyId={companyId} branchId={branchId} user={user} today={today} team={lead ? people : []} reads={reads} />}
      {current === "performance" && (
        <PerformanceTab
          tasks={gives ? [...given.list, ...mine.list.filter((t) => !given.list.some((g) => g.id === t.id))] : mine.list}
          loading={gives ? given.loading : mine.loading}
          manage={manage}
          lead={lead}
          companyId={companyId}
          branchId={branchId}
          user={user}
          today={today}
        />
      )}
      {linked && <TaskDetailSheet task={linked} onClose={closeLinked} companyId={companyId} branchId={branchId} user={user} team={lead ? people : []} />}
      {taskParam && !linked && !mine.loading && !given.loading && (
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">That task is no longer here — it was finished long ago, deleted, or is at another branch.</p>
      )}
      {current === "notes" && <NotesTab companyId={companyId} user={user} gives={gives} people={people} branchId={branchId} today={today} leadFor={leadFor} />}
    </div>
  );
}
