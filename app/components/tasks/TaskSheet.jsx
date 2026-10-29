"use client";
// Give a task, or change one (roadmap 4.11): what, who, once (by a day) or
// repeating (every day / chosen weekdays / a day each month), whether it
// needs a photo to count as done, and a checklist to go through (30 Oct) —
// typed, or started from a ready-made one (Opening check, Closing check…).
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ListChecks, Plus, X } from "lucide-react";
import { Button, DatePicker, Field, Input, Select, Sheet, Switch, Textarea, toast } from "@/app/components/ui";
import { Chip } from "@/app/components/entry/Choices";
import { MAX_ITEMS, TEMPLATES, WEEKDAYS, checkTask, cleanItems } from "@/lib/tasks/model";
import { roleLabel } from "@/lib/authz/permissions";
import { saveTask } from "@/lib/tasks/client";

const HOW = [
  { value: "once", label: "Once" },
  { value: "day", label: "Every day" },
  { value: "week", label: "Some weekdays" },
  { value: "month", label: "Monthly" },
];

const blank = (today) => ({ title: "", details: "", assigneeUid: "", how: "once", dueDate: today, days: [1, 2, 3, 4, 5], monthDay: 1, startDate: today, needsPhoto: false, urgent: false, items: [] });

/** The checklist: one line each, added, changed, moved or removed. */
function ChecklistEditor({ items, onChange }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const lines = draft.split("\n").map((x) => x.trim()).filter(Boolean);
    if (!lines.length) return;
    onChange([...items, ...lines].slice(0, MAX_ITEMS));
    setDraft("");
  };
  const move = (i, step) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + step, 0, x);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {items.map((text, i) => (
            <li key={i} className="flex items-center gap-2 px-2 py-1.5">
              <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-subtle">{i + 1}</span>
              <input value={text} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Line ${i + 1}`} className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-sm text-fg outline-none focus:bg-surface-2" />
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="rounded p-1 text-muted hover:text-fg disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down" className="rounded p-1 text-muted hover:text-fg disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove" className="rounded p-1 text-muted hover:text-danger"><X className="size-3.5" /></button>
            </li>
          ))}
        </ol>
      )}
      {items.length < MAX_ITEMS && (
        <div className="flex gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={items.length ? "Another thing to check" : "e.g. Tables clean and set"} aria-label="Add a line to the checklist" />
          <Button variant="secondary" icon={Plus} onClick={add} disabled={!draft.trim()} aria-label="Add the line" />
        </div>
      )}
    </div>
  );
}

function fromTask(t, today) {
  const r = t.repeat;
  return {
    title: t.title || "",
    details: t.details || "",
    assigneeUid: t.assigneeUid || "",
    how: r ? r.every : "once",
    dueDate: t.dueDate || "",
    days: r?.days || [1, 2, 3, 4, 5],
    monthDay: r?.day || 1,
    startDate: t.startDate || today,
    needsPhoto: !!t.needsPhoto,
    urgent: t.priority === "urgent",
    items: t.items || [],
  };
}

/**
 * task: the one to change, or null for a new one. people: who it can be given
 * to [{ uid, name, role }]; defaultAssigneeUid: picked already (from a person's page).
 */
export default function TaskSheet({ open, onClose, task, defaultAssigneeUid, defaultTitle, people, companyId, branchId, user, today, leadFor, onSaved }) {
  const [f, setF] = useState(() => blank(today));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setF(task ? fromTask(task, today) : { ...blank(today), assigneeUid: defaultAssigneeUid || "", title: defaultTitle || "" });
    setErrors({});
  }, [open, task, today, defaultAssigneeUid, defaultTitle]);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    const assignee = people.find((p) => p.uid === f.assigneeUid) || (task && task.assigneeUid === f.assigneeUid ? task.assignee : null);
    const repeat = f.how === "once" ? null : f.how === "day" ? { every: "day" } : f.how === "week" ? { every: "week", days: [...f.days].sort() } : { every: "month", day: Number(f.monthDay) };
    // who leads it: kept while the person stays the same, else theirs (leadFor)
    const teamLeadUid = (task && task.assigneeUid === f.assigneeUid && task.teamLeadUid) || (leadFor ? leadFor(f.assigneeUid) : null);
    const data = { teamLeadUid, title: f.title, details: f.details, assignee, repeat, dueDate: f.how === "once" ? f.dueDate || null : null, startDate: repeat ? f.startDate || today : null, needsPhoto: f.needsPhoto, priority: f.urgent ? "urgent" : "normal", items: cleanItems(f.items) };
    const e = checkTask(data);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const id = await saveTask(companyId, branchId, user, data, task?.id);
      toast.success(task ? "Task changed" : `Given to ${assignee.name.split(" ")[0]}`);
      onSaved?.({ id: id || task?.id, assignee });
      onClose();
    } catch (err) {
      toast.error("Couldn't save the task", { description: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={task ? "Change the task" : "New task"}
      description="Who does what, and when."
      footer={<Button onClick={save} loading={busy}>{task ? "Save" : "Give the task"}</Button>}
    >
      <div className="space-y-5">
        {!task && (
          // a ready-made checklist to start from: its name, lines and when — all changeable
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted">Start from a checklist</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <Chip
                  key={t.id}
                  on={f.title === t.title}
                  onClick={() =>
                    setF((x) => ({
                      ...x,
                      title: t.title,
                      items: t.items,
                      needsPhoto: t.needsPhoto,
                      how: t.repeat.every,
                      days: t.repeat.days || x.days,
                    }))
                  }
                >
                  <ListChecks className="mr-1 inline size-3.5" />
                  {t.title}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <Field label="What needs doing?" error={errors.title}>
          {({ id, invalid }) => <Input id={id} invalid={invalid} value={f.title} onChange={(e) => set("title")(e.target.value)} placeholder="e.g. Clean the fryer" size="lg" />}
        </Field>
        <Field label="Details (optional)">{({ id }) => <Textarea id={id} rows={2} value={f.details} onChange={(e) => set("details")(e.target.value)} placeholder="How, where, anything to check" />}</Field>
        <Field label="Who does it?" error={errors.assignee}>
          {({ id, invalid }) => (
            <Select id={id} invalid={invalid} value={f.assigneeUid} onChange={(e) => set("assigneeUid")(e.target.value)} className="h-12">
              <option value="">Choose a person…</option>
              {people.map((p) => (
                <option key={p.uid} value={p.uid}>
                  {p.name}
                  {p.role === "staff" ? "" : ` · ${roleLabel(p.role)}`}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted">When</p>
          <div className="flex flex-wrap gap-1.5">
            {HOW.map((h) => (
              <Chip key={h.value} on={f.how === h.value} onClick={() => set("how")(h.value)}>
                {h.label}
              </Chip>
            ))}
          </div>
          {f.how === "once" && <Field label="By">{() => <DatePicker value={f.dueDate} onChange={set("dueDate")} />}</Field>}
          {f.how === "week" && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Weekdays">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <Chip key={d} on={f.days.includes(d)} onClick={() => set("days")(f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d])}>
                  {WEEKDAYS[d]}
                </Chip>
              ))}
            </div>
          )}
          {f.how === "month" && (
            <Field label="Day of the month" hint="31 means the last day in shorter months">
              {({ id }) => <Input id={id} type="number" min={1} max={31} value={f.monthDay} onChange={(e) => set("monthDay")(e.target.value)} className="w-28" />}
            </Field>
          )}
          {f.how !== "once" && <Field label="Starting">{() => <DatePicker value={f.startDate} onChange={set("startDate")} />}</Field>}
          {errors.repeat && <p className="text-xs font-medium text-danger">{errors.repeat}</p>}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">Checklist (optional)</p>
          <p className="-mt-1 text-xs text-muted">Each line is marked OK or Problem to finish. Problems show here for you.</p>
          <ChecklistEditor items={f.items} onChange={set("items")} />
        </div>

        <div className="divide-y divide-line rounded-2xl border border-line">
          {/* a div, not a label: a label would pass the click on to the switch a second time */}
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="flex-1">
              <span className="block text-sm font-medium text-fg">Needs a photo</span>
              <span className="block text-xs text-muted">Done only with a photo of the work</span>
            </span>
            <Switch checked={f.needsPhoto} onChange={set("needsPhoto")} />
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="flex-1 text-sm font-medium text-fg">Urgent</span>
            <Switch checked={f.urgent} onChange={set("urgent")} />
          </div>
        </div>
      </div>
    </Sheet>
  );
}
