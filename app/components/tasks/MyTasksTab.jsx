"use client";
// My tasks (roadmap 4.11): one to-do list — late, today, tomorrow, this week,
// later — and a week strip to look at a single day. Tick to finish; a task
// that needs a photo asks for one. A missed day can still be ticked for a
// week (counted late). `readOnly` shows someone else's list (management).
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarClock, Camera, Check, Flag, ListChecks, Repeat, X } from "lucide-react";
import { Badge, Button, EmptyState, Sheet, Skeleton, Textarea, cn, toast } from "@/app/components/ui";
import { FileThumb } from "@/app/components/common/Files";
import { CATCH_UP_DAYS, addDays, agenda, dayList, repeatText } from "@/lib/tasks/model";
import { completeOnce, reopenOnce, tickDay, untickDay, uploadProof, useChecks } from "@/lib/tasks/client";

const dayText = (d) => format(parseISO(d), "EEE d MMM");

/** Monday of the week `d` is in. */
const weekStart = (d) => {
  const dow = parseISO(d).getDay(); // Sunday = 0
  return addDays(d, dow === 0 ? -6 : 1 - dow);
};

/** Finish with a photo and/or a note. */
function DoneSheet({ item, onClose, onDone }) {
  const [files, setFiles] = useState([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const needs = item?.task.needsPhoto;
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const go = async () => {
    setBusy(true);
    try {
      await onDone(item, { files, note });
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={!!item}
      onClose={onClose}
      title={item?.task.title || ""}
      description={needs ? "Add a photo of the work to finish it." : "Add a photo or a note if it helps."}
      footer={<Button onClick={go} loading={busy} disabled={needs && !files.length} icon={Check}>Mark done</Button>}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {previews.map((url, i) => (
            <div key={url} className="relative size-20 overflow-hidden rounded-xl border border-line">
              <img src={url} alt="" className="size-full object-cover" />
              <button type="button" aria-label="Remove" onClick={() => setFiles((l) => l.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {files.length < 4 && (
            <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-xs font-medium text-muted hover:bg-surface-2">
              <Camera className="size-5" /> Photo
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { const p = [...(e.target.files || [])]; e.target.value = ""; setFiles((l) => [...l, ...p].slice(0, 4)); }} />
            </label>
          )}
        </div>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" />
      </div>
    </Sheet>
  );
}

/** One task on the list. `showDate`: say which day it is for (late and coming-up items). */
function Row({ item, onTick, busy, canUndo, showDate, readOnly }) {
  const { task, done } = item;
  const check = item.check;
  const proof = done ? (item.kind === "repeat" ? check?.photos : task.done?.photos) || [] : [];
  const note = done ? (item.kind === "repeat" ? check?.note : task.done?.note) : "";
  const tickable = !readOnly && (done ? canUndo : item.canTick !== false);
  return (
    <li className="flex gap-3 rounded-2xl border border-line bg-surface p-3.5">
      {item.canTick === false && !done ? (
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-subtle" title="Not yet">
          <CalendarClock className="size-4" />
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onTick(item)}
          disabled={busy || !tickable}
          aria-pressed={done}
          aria-label={done ? `Undo: ${task.title}` : `Done: ${task.title}`}
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition",
            done ? "border-brand bg-brand text-brand-fg" : "border-line enabled:hover:border-brand",
            (busy || (!tickable && !done)) && "opacity-50"
          )}
        >
          {done && <Check className="size-4" strokeWidth={3} />}
        </button>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <p className={cn("text-sm font-semibold", done ? "text-muted line-through decoration-subtle" : "text-fg")}>{task.title}</p>
        {task.details && !done && <p className="text-xs text-muted">{task.details}</p>}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted">
          {showDate && item.date && <span className="font-semibold text-fg">{dayText(item.date)}</span>}
          {item.kind === "repeat" ? (
            <span className="inline-flex items-center gap-1"><Repeat className="size-3" />{repeatText(task)}</span>
          ) : (
            !showDate && <span>{task.dueDate ? `By ${dayText(task.dueDate)}` : "No due day"}</span>
          )}
          {task.createdBy?.name && <span>· from {task.createdBy.name}</span>}
          {task.priority === "urgent" && !done && <Badge tone="danger" className="px-2 py-px text-[10px]"><Flag className="size-3" />Urgent</Badge>}
          {task.needsPhoto && !done && <Badge className="px-2 py-px text-[10px]"><Camera className="size-3" />Photo</Badge>}
          {done && item.check?.doneOn > item.date && <Badge tone="warning" className="px-2 py-px text-[10px]">Done late</Badge>}
        </div>
        {(proof.length > 0 || note) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {proof.map((u) => <FileThumb key={u} url={u} label="Proof" className="size-14" />)}
            {note && <p className="text-xs text-fg">“{note}”</p>}
          </div>
        )}
      </div>
    </li>
  );
}

function Section({ title, hint, tone, items, children }) {
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <h3 className={cn("flex items-baseline gap-2 px-1 text-sm font-semibold", tone === "danger" ? "text-danger" : "text-fg")}>
        {title}
        <span className="text-xs font-normal text-muted">{hint}</span>
      </h3>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

/** tasks: this person's (live). user: who is ticking. person: whose list (defaults to user). */
export default function MyTasksTab({ tasks, loading, companyId, branchId, user, today, person, readOnly = false }) {
  const uid = person?.uid || user.uid;
  const [day, setDay] = useState(null); // null = the to-do list; a date = that day only
  const [asking, setAsking] = useState(null);
  const [busy, setBusy] = useState(null);
  const monday = weekStart(today);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);
  const from = [addDays(today, -CATCH_UP_DAYS), monday].sort()[0];
  const { checks, loading: checksLoading } = useChecks(companyId, branchId, { from, to: today, uid, all: readOnly });
  const list = useMemo(() => agenda(tasks, checks, today), [tasks, checks, today]);
  const single = useMemo(() => (day ? dayList(tasks, checks, day, today).map((x) => ({ ...x, date: day, canTick: x.kind === "once" || day <= today })) : []), [tasks, checks, day, today]);

  const finish = async (item, { files = [], note = "" } = {}) => {
    setBusy(`${item.task.id}-${item.date}`);
    try {
      const photos = files.length ? await uploadProof(companyId, branchId, user, files) : [];
      if (item.kind === "repeat") await tickDay(companyId, branchId, item.task, user, { date: item.date, doneOn: today, photos, note });
      else await completeOnce(companyId, branchId, item.task, user, { date: today, photos, note });
      toast.success(item.kind === "repeat" && item.date < today ? "Done — counted late" : "Done");
    } catch (e) {
      toast.error("Couldn't save", { description: e.message });
    } finally {
      setBusy(null);
    }
  };
  const undo = async (item) => {
    setBusy(`${item.task.id}-${item.date}`);
    try {
      if (item.kind === "repeat") await untickDay(companyId, branchId, item.task, item.date);
      else await reopenOnce(companyId, branchId, item.task);
    } catch (e) {
      toast.error("Couldn't undo", { description: e.message });
    } finally {
      setBusy(null);
    }
  };
  const onTick = (item) => {
    if (item.done) return undo(item);
    if (item.task.needsPhoto) return setAsking(item);
    return finish(item);
  };
  // your own tick, or a one-off you finished — today only
  const canUndo = (item) => (item.kind === "repeat" ? item.check?.by?.uid === user.uid && item.check?.doneOn === today : item.task.done?.by?.uid === user.uid && item.task.done?.date === today);
  const row = (item, showDate) => (
    <Row key={`${item.task.id}-${item.date}`} item={item} onTick={onTick} busy={busy === `${item.task.id}-${item.date}`} canUndo={canUndo(item)} showDate={showDate} readOnly={readOnly} />
  );

  // a dot under a day of the strip: something still to do that day
  const openOn = (d) => d >= addDays(today, -CATCH_UP_DAYS) && dayList(tasks, checks, d, today).some((x) => !x.done && (d >= today || x.kind === "repeat"));
  const left = list.today.filter((x) => !x.done).length;

  return (
    <div className="space-y-5">
      {/* the week: tap a day to see only it */}
      <div className="grid grid-cols-8 gap-1" role="group" aria-label="Pick a day">
        <button
          type="button"
          onClick={() => setDay(null)}
          aria-pressed={!day}
          className={cn("flex flex-col items-center justify-center rounded-xl py-2 text-xs font-semibold transition", !day ? "bg-brand text-brand-fg" : "bg-surface-2 text-muted hover:text-fg")}
        >
          All
        </button>
        {week.map((d) => {
          const on = day === d;
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDay(on ? null : d)}
              aria-pressed={on}
              aria-label={dayText(d)}
              className={cn(
                "relative flex flex-col items-center rounded-xl py-1.5 transition",
                on ? "bg-brand text-brand-fg" : isToday ? "bg-brand-soft text-brand" : "bg-surface-2 text-muted hover:text-fg"
              )}
            >
              <span className="text-[10px] font-medium uppercase">{format(parseISO(d), "EEEEE")}</span>
              <span className="text-sm font-semibold tabular-nums">{format(parseISO(d), "d")}</span>
              <span className={cn("mt-0.5 size-1 rounded-full", openOn(d) ? (on ? "bg-brand-fg" : d < today ? "bg-danger" : "bg-brand") : "bg-transparent")} />
            </button>
          );
        })}
      </div>

      {loading || checksLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" rounded="rounded-2xl" />)}</div>
      ) : day ? (
        <div className="space-y-3">
          <p className="px-1 text-sm font-semibold text-fg">
            {day === today ? "Today" : dayText(day)}
            <span className="ml-2 text-xs font-normal text-muted">
              {day > today ? "coming up — tick it on the day" : day < today ? "a past day — what is ticked now counts as late" : ""}
            </span>
          </p>
          {single.length ? <ul className="space-y-2">{single.map((x) => row(x, false))}</ul> : <p className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">Nothing on this day.</p>}
        </div>
      ) : !Object.values(list).some((l) => l.length) ? (
        <EmptyState icon={ListChecks} title={readOnly ? "No tasks" : "No tasks for you yet"} description={readOnly ? "Nothing given to them yet." : "When your manager gives you a task, it shows up here."} />
      ) : (
        <div className="space-y-6">
          <Section title="Late" hint={`${list.late.length} · tick now, counts as late`} tone="danger" items={list.late}>
            {list.late.map((x) => row(x, true))}
          </Section>
          <Section title="Today" hint={list.today.length ? (left ? `${left} of ${list.today.length} left` : "all done 🎉") : ""} items={list.today}>
            {list.today.map((x) => row(x, false))}
          </Section>
          {!list.today.length && <p className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">Nothing for today.</p>}
          <Section title="Tomorrow" hint={dayText(addDays(today, 1))} items={list.tomorrow}>
            {list.tomorrow.map((x) => row(x, false))}
          </Section>
          <Section title="This week" items={list.week}>{list.week.map((x) => row(x, true))}</Section>
          <Section title="Later" items={list.later}>{list.later.map((x) => row(x, true))}</Section>
          <Section title="Any time" hint="no due day" items={list.anytime}>{list.anytime.map((x) => row(x, false))}</Section>
        </div>
      )}
      <DoneSheet key={asking ? `${asking.task.id}-${asking.date}` : "none"} item={asking} onClose={() => setAsking(null)} onDone={finish} />
    </div>
  );
}
