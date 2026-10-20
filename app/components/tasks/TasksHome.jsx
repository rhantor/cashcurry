"use client";
// Tasks (roadmap 4.11), for the office (/tasks) and the staff app (/my-tasks):
// Team — today at a glance and each person (management, shown first); My tasks
// — your to-do list; Performance; Notes — your own.
// ?tab=team|mine|performance|notes opens one (notifications link there).
import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Gauge, NotebookPen, Users } from "lucide-react";
import { Tabs, useIsPhone } from "@/app/components/ui";
import { useBusinessToday } from "@/app/hooks/useRegion";
import { useChatPeople } from "@/app/components/chat/useChat";
import { canManageTasks } from "@/lib/tasks/model";
import { useTasks } from "@/lib/tasks/client";
import MyTasksTab from "./MyTasksTab";
import TeamTab from "./TeamTab";
import PerformanceTab from "./PerformanceTab";
import NotesTab from "./NotesTab";

export default function TasksHome({ user, branchId }) {
  const companyId = user.companyId;
  const today = useBusinessToday();
  const manage = canManageTasks(user.role) && !!branchId;
  const [tab, setTab] = useState(null); // null: Team for those who give tasks, else My tasks
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "today") setTab("mine"); // older links
    else if (["mine", "team", "performance", "notes"].includes(t)) setTab(t);
  }, []);

  const mine = useTasks(companyId, branchId, { uid: user.uid });
  const all = useTasks(companyId, branchId, { all: manage });
  const everyone = useChatPeople(manage ? companyId : null);
  // who a task can be given to: this branch's people with a login, not yourself
  const people = useMemo(() => everyone.filter((p) => p.branchId === branchId && p.uid !== user.uid), [everyone, branchId, user.uid]);

  // on a phone the tabs share the width, words only, so all of them fit
  const phone = useIsPhone();
  const tabs = [
    ...(manage ? [{ value: "team", label: "Team", icon: Users }] : []),
    { value: "mine", label: "My tasks", icon: CalendarCheck },
    { value: "performance", label: manage || phone ? "Performance" : "My performance", icon: Gauge },
    { value: "notes", label: "Notes", icon: NotebookPen },
  ].map((t) => (phone ? { ...t, icon: undefined } : t));
  const current = !tab || (tab === "team" && !manage) ? (manage ? "team" : "mine") : tab;

  if (!branchId)
    return <p className="rounded-2xl bg-surface-2 p-6 text-sm text-muted">Pick a branch at the top to see its tasks.</p>;

  return (
    <div className="space-y-5">
      <div className="-mx-1 max-w-full overflow-x-auto px-1 [scrollbar-width:none]">
        <Tabs tabs={tabs} value={current} onChange={setTab} className={phone ? "flex w-full [&>button]:flex-1 [&>button]:justify-center [&>button]:px-2" : undefined} />
      </div>
      {current === "mine" && <MyTasksTab tasks={mine.list} loading={mine.loading} companyId={companyId} branchId={branchId} user={user} today={today} />}
      {current === "team" && <TeamTab tasks={all.list} loading={all.loading} people={people} companyId={companyId} branchId={branchId} user={user} today={today} />}
      {current === "performance" && (
        <PerformanceTab tasks={manage ? all.list : mine.list} loading={manage ? all.loading : mine.loading} manage={manage} companyId={companyId} branchId={branchId} user={user} today={today} />
      )}
      {current === "notes" && <NotesTab companyId={companyId} user={user} />}
    </div>
  );
}
