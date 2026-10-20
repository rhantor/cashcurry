"use client";
// The branch's tasks, for those who give them (roadmap 4.11): by person, with
// today's state of each checklist, and changing, stopping or removing them.
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, Flag, MoreHorizontal, Pause, Pencil, Play, Plus, Repeat, Trash2, Users } from "lucide-react";
import { Avatar, Badge, Button, EmptyState, Menu, Skeleton, cn, toast } from "@/app/components/ui";
import { confirmDialog } from "@/app/components/ui/notify";
import { Chip } from "@/app/components/entry/Choices";
import { checkId, occursOn, repeatText } from "@/lib/tasks/model";
import { deleteTask, setTaskActive, useChecks } from "@/lib/tasks/client";
import TaskSheet from "./TaskSheet";

const label = (d) => format(parseISO(d), "d MMM");

function stateOf(task, checks, today) {
  if (task.repeat) {
    if (task.active === false) return { text: "Stopped", tone: "neutral" };
    if (!occursOn(task, today)) return { text: "Not today", tone: "neutral" };
    return checks[checkId(task.id, today)] ? { text: "Done today", tone: "success" } : { text: "Not yet today", tone: "warning" };
  }
  if (task.status === "done") return { text: `Done ${task.done?.date ? label(task.done.date) : ""}`.trim(), tone: "success" };
  if (task.dueDate && task.dueDate < today) return { text: "Overdue", tone: "danger" };
  return { text: "Open", tone: "info" };
}

export default function TeamTab({ tasks, loading, people, companyId, branchId, user, today }) {
  const [who, setWho] = useState("all");
  const [editing, setEditing] = useState(null); // a task, or "new"
  const [showDone, setShowDone] = useState(false);
  const { checks } = useChecks(companyId, branchId, { from: today, to: today, all: true });

  const groups = useMemo(() => {
    const visible = tasks.filter((t) => (who === "all" || t.assigneeUid === who) && (showDone || t.repeat || t.status !== "done"));
    const by = new Map();
    for (const t of visible) {
      const k = t.assigneeUid;
      if (!by.has(k)) by.set(k, { person: t.assignee || { uid: k, name: "Someone" }, tasks: [] });
      by.get(k).tasks.push(t);
    }
    return [...by.values()].sort((a, b) => String(a.person.name).localeCompare(String(b.person.name)));
  }, [tasks, who, showDone]);
  const assignees = useMemo(() => [...new Map(tasks.map((t) => [t.assigneeUid, t.assignee])).values()].filter(Boolean), [tasks]);

  const remove = async (t) => {
    if (!(await confirmDialog({ title: "Delete this task?", message: `“${t.title}” and its place in the checklist go. Days already ticked stay in the performance figures.`, confirmLabel: "Delete", danger: true }))) return;
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button icon={Plus} onClick={() => setEditing("new")}>New task</Button>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="size-4 accent-[var(--cc-brand)]" />
          Show finished one-offs
        </label>
      </div>
      {assignees.length > 1 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <Chip on={who === "all"} onClick={() => setWho("all")}>Everyone</Chip>
          {assignees.map((p) => (
            <Chip key={p.uid} on={who === p.uid} onClick={() => setWho(p.uid)} className="shrink-0">{p.name}</Chip>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-24" rounded="rounded-2xl" />)}</div>
      ) : !groups.length ? (
        <EmptyState icon={Users} title="No tasks given yet" description="Give someone a one-off job or a daily checklist — opening, closing, cleaning." action={<Button icon={Plus} onClick={() => setEditing("new")}>New task</Button>} />
      ) : (
        groups.map((g) => (
          <section key={g.person.uid} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <header className="flex items-center gap-2.5 border-b border-line bg-surface-2/50 px-4 py-2.5">
              <Avatar name={g.person.name} size="sm" />
              <p className="flex-1 text-sm font-semibold text-fg">{g.person.name}</p>
              <span className="text-xs text-muted">{g.tasks.length} task{g.tasks.length === 1 ? "" : "s"}</span>
            </header>
            <ul className="divide-y divide-line">
              {g.tasks
                .sort((a, b) => Number(!!b.repeat) - Number(!!a.repeat) || String(a.title).localeCompare(String(b.title)))
                .map((t) => {
                  const st = stateOf(t, checks, today);
                  return (
                    <li key={t.id} className={cn("flex items-start gap-3 px-4 py-3", t.active === false && "opacity-60")}>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-medium text-fg">{t.title}</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                          {t.repeat ? <span className="inline-flex items-center gap-1"><Repeat className="size-3" />{repeatText(t)}</span> : <span>{t.dueDate ? `By ${label(t.dueDate)}` : "Once"}</span>}
                          {t.priority === "urgent" && <Flag className="size-3 text-danger" aria-label="Urgent" />}
                          {t.needsPhoto && <span>· photo needed</span>}
                        </div>
                      </div>
                      <Badge tone={st.tone} className="shrink-0 px-2 py-px text-[10px]">
                        {st.tone === "success" && <Check className="size-3" />}
                        {st.text}
                      </Badge>
                      <Menu
                        align="end"
                        width={190}
                        trigger={(p) => <Button {...p} variant="ghost" size="sm" icon={MoreHorizontal} aria-label={`More for ${t.title}`} />}
                        items={[
                          { label: "Change", icon: Pencil, onSelect: () => setEditing(t) },
                          ...(t.repeat ? [{ label: t.active === false ? "Start again" : "Stop it", icon: t.active === false ? Play : Pause, onSelect: () => pause(t) }] : []),
                          "divider",
                          { label: "Delete", icon: Trash2, danger: true, onSelect: () => remove(t) },
                        ]}
                      />
                    </li>
                  );
                })}
            </ul>
          </section>
        ))
      )}

      <TaskSheet open={!!editing} onClose={() => setEditing(null)} task={editing === "new" ? null : editing} people={people} companyId={companyId} branchId={branchId} user={user} today={today} />
    </div>
  );
}
