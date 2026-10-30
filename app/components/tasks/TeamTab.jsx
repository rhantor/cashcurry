"use client";
// The team, for those who give tasks (roadmap 4.11): today at a glance — how
// much of the branch's work is done and each person's progress — and, for one
// person, their to-do list and the tasks given to them (change, stop, delete).
// "Who does what today": each repeating task's person for the day (31 Oct) —
// someone off shows up here to be given to someone else.
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Check, ChevronRight, Flag, MoreHorizontal, Pause, Pencil, Play, Plus, Repeat, Trash2, UserRound, Users } from "lucide-react";
import { Avatar, Badge, Button, EmptyState, Menu, Skeleton, Tabs, cn, toast } from "@/app/components/ui";
import { confirmDialog } from "@/app/components/ui/notify";
import Link from "next/link";
import { CATCH_UP_DAYS, addDays, canSetDuty, dutyGaps, dutyRows, hasRota, issueHref, itemsOf, repeatText, rotaText, todayCount, unreadOn } from "@/lib/tasks/model";
import { deleteTask, setTaskActive, useChecks } from "@/lib/tasks/client";
import TaskSheet from "./TaskSheet";
import MyTasksTab from "./MyTasksTab";
import MessageBadge from "./MessageBadge";
import { CoverSheet, RotaSheet } from "./DutySheets";

/** Each repeating task due today and who does it — anyone off shows, to be given to someone (here and on Ops). */
export function TodaysDuty({ tasks, checks, today, away, user, nameOf, onGive, onOpen, id }) {
  const rows = dutyRows(tasks, checks, today, away);
  if (!rows.length) return null;
  const waiting = dutyGaps(rows);
  return (
    <section id={id} className="scroll-mt-20 space-y-2">
      <h3 className="flex items-baseline gap-2 px-1 text-sm font-semibold text-fg">
        Who does what today
        {waiting > 0 && <span className="text-xs font-medium text-warning">{waiting} need{waiting === 1 ? "s" : ""} someone</span>}
      </h3>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {rows.map(({ task: t, duty, done }) => {
          const name = duty.uid === user.uid ? "You" : duty.name || nameOf(duty.uid);
          const open = duty.via === "lead" && !done;
          return (
            <li key={t.id} className={cn("flex items-center gap-3 px-4 py-2.5", open && "bg-warning-soft/40")}>
              <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", done ? "bg-brand text-brand-fg" : open ? "bg-warning-soft text-warning" : "bg-surface-2 text-subtle")}>
                {done ? <Check className="size-3.5" strokeWidth={3} /> : <UserRound className="size-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <button type="button" onClick={() => onOpen(t)} className="block truncate text-left text-sm font-medium text-fg hover:underline">{t.title}</button>
                <span className={cn("block text-xs", open ? "font-medium text-warning" : "text-muted")}>
                  {open ? `${duty.away.name || "Someone"} is away (${duty.away.reason.toLowerCase()}) — with ${name === "You" ? "you" : name} for now` : `${name}${duty.via === "cover" ? " · today only" : ""}`}
                </span>
              </span>
              {!done && canSetDuty(t, user) && (
                <Button size="sm" variant={open ? "primary" : "ghost"} onClick={() => onGive({ task: t, date: today })}>
                  {open ? "Give" : "Change"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

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
function GivenList({ tasks, onEdit, onOpen, onRota, companyId, branchId, today, reads, uid }) {
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
              {itemsOf(t).length > 0 && <span>· {itemsOf(t).length} to check</span>}
              {t.issueId && <Badge tone="warning" className="px-2 py-px text-[10px]">From an issue</Badge>}
              {t.active === false && <Badge className="px-2 py-px text-[10px]">Stopped</Badge>}
              {hasRota(t) && <span>· {rotaText(t)}</span>}
              {!t.repeat && t.status === "done" && <Badge tone="success" className="px-2 py-px text-[10px]">Done {t.done?.date ? label(t.done.date) : ""}</Badge>}
            </div>
          </div>
          {t.issueId ? (
            // made from an issue: changed (or taken off them) from the issue itself
            <Link href={issueHref(t)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-surface-2">
              Open the issue
            </Link>
          ) : (
            <Menu
              align="end"
              width={190}
              trigger={(p) => <Button {...p} variant="ghost" size="sm" icon={MoreHorizontal} aria-label={`More for ${t.title}`} />}
              items={[
                { label: "Change", icon: Pencil, onSelect: () => onEdit(t) },
                ...(t.repeat && t.active !== false && onRota ? [{ label: "Who does it each day", icon: Users, onSelect: () => onRota(t) }] : []),
                ...(t.repeat ? [{ label: t.active === false ? "Start again" : "Stop it", icon: t.active === false ? Play : Pause, onSelect: () => pause(t) }] : []),
                "divider",
                { label: "Delete", icon: Trash2, danger: true, onSelect: () => remove(t) },
              ]}
            />
          )}
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
export default function TeamTab({ tasks, loading, people, companyId, branchId, user, today, scope = { all: true }, leadFor, reads = {}, onOpenTask, away, dutyPeople = [] }) {
  const [editing, setEditing] = useState(null); // a task, or { new: true, assigneeUid }
  const [giving, setGiving] = useState(null); // { task, date }: one day to someone else
  const [rotaFor, setRotaFor] = useState(null);
  const nameOf = (uid) => dutyPeople.find((p) => p.uid === uid)?.name || people.find((p) => p.uid === uid)?.name || "Someone";
  const [openUid, setOpenUid] = useState(null);
  const [view, setView] = useState("todo");
  const { checks } = useChecks(companyId, branchId, { from: addDays(today, -CATCH_UP_DAYS), to: today, ...scope });

  // everyone at the branch who can be given tasks, and anyone who already has some
  const rows = useMemo(() => {
    const byUid = new Map(people.map((p) => [p.uid, p]));
    for (const t of tasks) if (!byUid.has(t.assigneeUid)) byUid.set(t.assigneeUid, t.assignee || { uid: t.assigneeUid, name: "Someone" });
    return [...byUid.values()]
      .map((p) => {
        // given to them — or theirs on a rota or a cover (their day counts by who is on duty)
        const mine = tasks.filter((t) => t.assigneeUid === p.uid || (t.doers || []).includes(p.uid));
        return { person: p, tasks: mine, given: mine.filter((t) => t.assigneeUid === p.uid), unread: mine.filter((t) => unreadOn(t, reads, user.uid)).length, ...todayCount(mine, checks, today, { uid: p.uid, away }) };
      })
      .sort((a, b) => Number(!a.tasks.length) - Number(!b.tasks.length) || b.late - a.late || String(a.person.name).localeCompare(String(b.person.name)));
  }, [people, tasks, checks, today, reads, user.uid, away]);
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
  const dutySheets = (
    <>
      <CoverSheet item={giving ? { task: tasks.find((t) => t.id === giving.task.id) || giving.task, date: giving.date } : null} onClose={() => setGiving(null)} people={dutyPeople} companyId={companyId} branchId={branchId} user={user} today={today} away={away} />
      {rotaFor && <RotaSheet task={tasks.find((t) => t.id === rotaFor.id) || rotaFor} onClose={() => setRotaFor(null)} people={dutyPeople} companyId={companyId} branchId={branchId} user={user} today={today} away={away} />}
    </>
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
            { value: "given", label: `All given (${open.given.length})` },
          ]}
        />
        {view === "todo" ? (
          <MyTasksTab tasks={open.tasks} loading={false} companyId={companyId} branchId={branchId} user={user} today={today} person={open.person} readOnly scope={scope} reads={reads} away={away} dutyPeople={dutyPeople} />
        ) : (
          <GivenList tasks={open.given} onEdit={setEditing} onOpen={(t) => onOpenTask?.(t.id)} onRota={dutyPeople.length ? setRotaFor : null} companyId={companyId} branchId={branchId} today={today} reads={reads} uid={user.uid} />
        )}
        {sheet}
        {dutySheets}
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

      <TodaysDuty tasks={tasks} checks={checks} today={today} away={away} user={user} nameOf={nameOf} onGive={setGiving} onOpen={(t) => onOpenTask?.(t.id)} />

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
      {dutySheets}
    </div>
  );
}
