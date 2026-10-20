"use client";
// The team, for those who give tasks (roadmap 4.11): today at a glance — how
// much of the branch's work is done and each person's progress — and, for one
// person, their to-do list and the tasks given to them (change, stop, delete).
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowLeft, ChevronRight, Flag, MoreHorizontal, Pause, Pencil, Play, Plus, Repeat, Trash2, Users } from "lucide-react";
import { Avatar, Badge, Button, EmptyState, Menu, Skeleton, Tabs, cn, toast } from "@/app/components/ui";
import { confirmDialog } from "@/app/components/ui/notify";
import { CATCH_UP_DAYS, addDays, repeatText, todayCount, unreadOn } from "@/lib/tasks/model";
import { deleteTask, setTaskActive, useChecks } from "@/lib/tasks/client";
import TaskSheet from "./TaskSheet";
import MyTasksTab from "./MyTasksTab";
import MessageBadge from "./MessageBadge";

const label = (d) => format(parseISO(d), "d MMM");

function Progress({ done, total, className }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-surface-2", className)} aria-hidden="true">
      <div className={cn("h-full rounded-full", pct === 100 ? "bg-brand" : "bg-brand/70")} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Every task given to one person, to change, stop or delete. */
function GivenList({ tasks, onEdit, onOpen, companyId, branchId, today, reads, uid }) {
  const remove = async (t) => {
    if (!(await confirmDialog({ title: "Delete this task?", message: `“${t.title}” goes. Days already ticked stay in the performance figures.`, confirmLabel: "Delete", danger: true }))) return;
    try {
      await deleteTask(companyId, branchId, t);
      toast.success("Task deleted");
    } catch (e) {
      toast.error("Couldn't delete it", { description: e.message });
    }
  };
  const pause = async (t) => {
    try {
      await setTaskActive(companyId, branchId, t, t.active === false, today);
      toast.success(t.active === false ? "Started again" : "Stopped — it won't come up any more");
    } catch (e) {
      toast.error("Couldn't change it", { description: e.message });
    }
  };
  const sorted = [...tasks].sort((a, b) => Number(!!b.repeat) - Number(!!a.repeat) || String(a.title).localeCompare(String(b.title)));
  if (!sorted.length) return <p className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">Nothing given to them yet.</p>;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {sorted.map((t) => (
        <li key={t.id} className={cn("flex items-start gap-3 px-4 py-3", t.active === false && "opacity-60")}>
          <div className="min-w-0 flex-1 space-y-1">
            <span className="flex items-start gap-2">
              <button type="button" onClick={() => onOpen(t)} className="min-w-0 flex-1 text-left text-sm font-medium text-fg hover:underline">{t.title}</button>
              <button type="button" onClick={() => onOpen(t)} className="shrink-0" aria-label="Open questions and answers">
                <MessageBadge count={t.commentCount || 0} unread={unreadOn(t, reads, uid)} />
              </button>
            </span>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
              {t.repeat ? <span className="inline-flex items-center gap-1"><Repeat className="size-3" />{repeatText(t)}</span> : <span>{t.dueDate ? `By ${label(t.dueDate)}` : "Once, any time"}</span>}
              {t.priority === "urgent" && <Flag className="size-3 text-danger" aria-label="Urgent" />}
              {t.needsPhoto && <span>· photo needed</span>}
              {t.active === false && <Badge className="px-2 py-px text-[10px]">Stopped</Badge>}
              {!t.repeat && t.status === "done" && <Badge tone="success" className="px-2 py-px text-[10px]">Done {t.done?.date ? label(t.done.date) : ""}</Badge>}
            </div>
          </div>
          <Menu
            align="end"
            width={190}
            trigger={(p) => <Button {...p} variant="ghost" size="sm" icon={MoreHorizontal} aria-label={`More for ${t.title}`} />}
            items={[
              { label: "Change", icon: Pencil, onSelect: () => onEdit(t) },
              ...(t.repeat ? [{ label: t.active === false ? "Start again" : "Stop it", icon: t.active === false ? Play : Pause, onSelect: () => pause(t) }] : []),
              "divider",
              { label: "Delete", icon: Trash2, danger: true, onSelect: () => remove(t) },
            ]}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * scope: which ticks to read — { all: true } for management, { lead: uid } for a
 * supervisor. people: who can be given tasks (a supervisor: their team).
 * leadFor(uid): who leads a new task for that person.
 */
export default function TeamTab({ tasks, loading, people, companyId, branchId, user, today, scope = { all: true }, leadFor, reads = {}, onOpenTask }) {
  const [editing, setEditing] = useState(null); // a task, or { new: true, assigneeUid }
  const [openUid, setOpenUid] = useState(null);
  const [view, setView] = useState("todo");
  const { checks } = useChecks(companyId, branchId, { from: addDays(today, -CATCH_UP_DAYS), to: today, ...scope });

  // everyone at the branch who can be given tasks, and anyone who already has some
  const rows = useMemo(() => {
    const byUid = new Map(people.map((p) => [p.uid, p]));
    for (const t of tasks) if (!byUid.has(t.assigneeUid)) byUid.set(t.assigneeUid, t.assignee || { uid: t.assigneeUid, name: "Someone" });
    return [...byUid.values()]
      .map((p) => {
        const mine = tasks.filter((t) => t.assigneeUid === p.uid);
        return { person: p, tasks: mine, unread: mine.filter((t) => unreadOn(t, reads, user.uid)).length, ...todayCount(mine, checks, today) };
      })
      .sort((a, b) => Number(!a.tasks.length) - Number(!b.tasks.length) || b.late - a.late || String(a.person.name).localeCompare(String(b.person.name)));
  }, [people, tasks, checks, today, reads, user.uid]);
  const total = rows.reduce((n, r) => n + r.total, 0);
  const done = rows.reduce((n, r) => n + r.done, 0);
  const late = rows.reduce((n, r) => n + r.late, 0);
  const open = openUid && rows.find((r) => r.person.uid === openUid);

  const sheet = (
    <TaskSheet
      open={!!editing}
      onClose={() => setEditing(null)}
      task={editing && !editing.new ? editing : null}
      defaultAssigneeUid={editing?.new ? editing.assigneeUid : undefined}
      people={people}
      leadFor={leadFor}
      companyId={companyId}
      branchId={branchId}
      user={user}
      today={today}
    />
  );

  if (loading) return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" rounded="rounded-2xl" />)}</div>;

  // one person
  if (open) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => setOpenUid(null)} aria-label="Back to the team" />
          <Avatar name={open.person.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-fg">{open.person.name}</p>
            <p className="text-xs text-muted">
              Today {open.done} of {open.total} done{open.late ? ` · ${open.late} late` : ""}
            </p>
          </div>
          <Button size="sm" icon={Plus} onClick={() => setEditing({ new: true, assigneeUid: open.person.uid })}>Task</Button>
        </div>
        <Tabs
          size="sm"
          value={view}
          onChange={setView}
          tabs={[
            { value: "todo", label: "Their to-do" },
            { value: "given", label: `All given (${open.tasks.length})` },
          ]}
        />
        {view === "todo" ? (
          <MyTasksTab tasks={open.tasks} loading={false} companyId={companyId} branchId={branchId} user={user} today={today} person={open.person} readOnly scope={scope} reads={reads} />
        ) : (
          <GivenList tasks={open.tasks} onEdit={setEditing} onOpen={(t) => onOpenTask?.(t.id)} companyId={companyId} branchId={branchId} today={today} reads={reads} uid={user.uid} />
        )}
        {sheet}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* today at a glance */}
      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-fg">Today</p>
          <p className="text-sm tabular-nums text-muted">
            <span className="text-lg font-bold text-fg">{done}</span> of {total} done
          </p>
        </div>
        <Progress done={done} total={total} />
        {late > 0 && <p className="text-xs font-medium text-danger">{late} late across the team (missed days and overdue tasks)</p>}
      </div>

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">People</h3>
        <Button size="sm" icon={Plus} onClick={() => setEditing({ new: true })}>New task</Button>
      </div>

      {!rows.length ? (
        <EmptyState
          icon={Users}
          title={scope.lead ? "No one in your team yet" : "No one to give tasks to"}
          description={scope.lead ? "Staff whose record names you as their supervisor (or names no one) show up here — set it in Staff management." : "People at this branch with a login show up here."}
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {rows.map((r) => (
            <li key={r.person.uid}>
              <button type="button" onClick={() => { setOpenUid(r.person.uid); setView("todo"); }} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                <Avatar name={r.person.name} size="sm" />
                <span className="min-w-0 flex-1 space-y-1.5">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-fg">{r.person.name}</span>
                    {r.late > 0 && <Badge tone="danger" className="shrink-0 px-2 py-px text-[10px]">{r.late} late</Badge>}
                    {r.unread > 0 && <MessageBadge count={r.unread} unread />}
                  </span>
                  {r.tasks.length ? (
                    r.total ? <Progress done={r.done} total={r.total} /> : <span className="block text-xs text-muted">Nothing today</span>
                  ) : (
                    <span className="block text-xs text-subtle">No tasks yet</span>
                  )}
                </span>
                {r.total > 0 && <span className="shrink-0 text-sm font-semibold tabular-nums text-fg">{r.done}/{r.total}</span>}
                <ChevronRight className="size-4 shrink-0 text-subtle" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {sheet}
    </div>
  );
}
