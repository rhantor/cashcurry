"use client";
// Who gives tasks at a branch and to whom (4.11): the tasks given to this
// person and those they gave, the people they may give to, who is off when,
// and who can be put on a duty — the same for Tasks (/tasks, /my-tasks) and
// Ops (/ops), so both show the same team and the same day.
import { useMemo } from "react";
import { useChatPeople } from "@/app/components/chat/useChat";
import { useGetStaffListQuery } from "@/lib/redux/api/staffApiSlice";
import { canManageTasks, canTeamTasks, leadOf, teamOf } from "@/lib/tasks/model";
import { useAway, useTasks } from "@/lib/tasks/client";
import { personName } from "@/lib/people";

const NONE = [];
const union = (a, b) => [...a, ...b.filter((t) => !a.some((x) => x.id === t.id))];

export default function useTaskTeam(user, branchId) {
  const companyId = user?.companyId;
  const manage = canManageTasks(user?.role) && !!branchId;
  const lead = !manage && canTeamTasks(user?.role) && !!branchId; // a supervisor
  const gives = manage || lead;

  const mine = useTasks(companyId, branchId, { uid: user?.uid });
  const given = useTasks(companyId, branchId, manage ? { all: true } : { lead: lead ? user?.uid : undefined });
  const everyone = useChatPeople(gives ? companyId : null);
  // staff records say who leads whom (Staff management → Job → Supervisor)
  const { data: staffData } = useGetStaffListQuery({ companyId, branchId }, { skip: !gives || !companyId || !branchId });
  const staff = staffData || NONE;
  // who is off when (31 Oct): days off on the staff records, approved leave — everyone's
  // for those who give tasks, else only one's own
  const away = useAway(companyId, branchId, user, gives ? staff : null);

  // who tasks can be given to: management — the branch's people; a supervisor — their team
  const people = useMemo(() => {
    const here = everyone.filter((p) => p.branchId === branchId && p.uid !== user?.uid);
    if (manage) return here;
    if (!lead) return [];
    const team = new Set(teamOf(staff, user?.uid));
    return here.filter((p) => team.has(p.uid));
  }, [everyone, branchId, user?.uid, manage, lead, staff]);
  // who leads a new task: the supervisor giving it, else the person's own supervisor
  const leadFor = useMemo(() => (lead ? () => user?.uid : (uid) => leadOf(staff, uid)), [lead, user?.uid, staff]);
  const scope = useMemo(() => (manage ? { all: true } : { lead: user?.uid, uid: user?.uid }), [manage, user?.uid]);
  // who can be put on a rota or given a day: the team (or the branch) and oneself
  const dutyPeople = useMemo(() => (gives ? [{ uid: user.uid, name: personName(user) || user.username || "Me", role: user.role }, ...people] : []), [gives, user, people]);
  // one's own list: what is given to one, and the days that fall to one as the
  // supervisor (or whoever gave it) while someone is off
  const myTasks = useMemo(() => (gives ? union(mine.list, given.list) : mine.list), [gives, mine.list, given.list]);
  const teamTasks = useMemo(() => (lead ? union(given.list, mine.list) : given.list), [lead, given.list, mine.list]);

  return { companyId, manage, lead, gives, mine, given, staff, away, people, leadFor, scope, dutyPeople, myTasks, teamTasks };
}
