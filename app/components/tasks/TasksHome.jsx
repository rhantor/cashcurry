"use client";
// Tasks (roadmap 4.11), for the office (/tasks) and the staff app (/my-tasks):
// Team — today at a glance and each person (management: everyone; a
// supervisor: their own team), shown first to those who give tasks; My tasks
// — your to-do list; Performance; Notes — your own (a note's line can become a task).
// ?tab=team|mine|performance|notes opens one (notifications link there).
import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Gauge, NotebookPen, Users } from "lucide-react";
import { Tabs, useIsPhone } from "@/app/components/ui";
import { useBusinessToday } from "@/app/hooks/useRegion";
import { useChatPeople } from "@/app/components/chat/useChat";
import { useGetStaffListQuery } from "@/lib/redux/api/staffApiSlice";
import { canManageTasks, canTeamTasks, leadOf, teamOf } from "@/lib/tasks/model";
import { useTasks } from "@/lib/tasks/client";
import MyTasksTab from "./MyTasksTab";
import TeamTab from "./TeamTab";
import PerformanceTab from "./PerformanceTab";
import NotesTab from "./NotesTab";

export default function TasksHome({ user, branchId }) {
  const companyId = user.companyId;
  const today = useBusinessToday();
  const manage = canManageTasks(user.role) && !!branchId;
  const lead = !manage && canTeamTasks(user.role) && !!branchId; // a supervisor
  const gives = manage || lead;
  const [tab, setTab] = useState(null); // null: Team for those who give tasks, else My tasks
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "today") setTab("mine"); // older links
    else if (["mine", "team", "performance", "notes"].includes(t)) setTab(t);
  }, []);

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

  // on a phone the tabs share the width, words only, so all of them fit
  const phone = useIsPhone();
  const tabs = [
    ...(gives ? [{ value: "team", label: lead ? "My team" : "Team", icon: Users }] : []),
    { value: "mine", label: "My tasks", icon: CalendarCheck },
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
        <TeamTab tasks={given.list} loading={given.loading} people={people} companyId={companyId} branchId={branchId} user={user} today={today} scope={scope} leadFor={leadFor} />
      )}
      {current === "mine" && <MyTasksTab tasks={mine.list} loading={mine.loading} companyId={companyId} branchId={branchId} user={user} today={today} team={lead ? people : []} />}
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
      {current === "notes" && <NotesTab companyId={companyId} user={user} gives={gives} people={people} branchId={branchId} today={today} leadFor={leadFor} />}
    </div>
  );
}
