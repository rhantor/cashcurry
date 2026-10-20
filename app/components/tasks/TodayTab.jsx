"use client";
// A person's day (roadmap 4.11): the checklist that falls on it, one-off tasks
// still open (overdue first) and what got done. Tick to finish; a task that
// needs a photo asks for one. Earlier days can be caught up (counted late).
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Camera, Check, ChevronLeft, ChevronRight, Flag, ListChecks, Repeat, X } from "lucide-react";
import { Badge, Button, EmptyState, Sheet, Skeleton, Textarea, cn, toast } from "@/app/components/ui";
import { FileThumb } from "@/app/components/common/Files";
import { addDays, dayList, repeatText } from "@/lib/tasks/model";
import { completeOnce, reopenOnce, tickDay, untickDay, uploadProof, useChecks } from "@/lib/tasks/client";

const label = (d) => format(parseISO(d), "EEE d MMM");
const CATCH_UP_DAYS = 7; // how far back a missed day can still be ticked (late)

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

function Row({ item, onTick, busy, canUndo }) {
  const { task, done, overdue, late, check } = item;
  const proof = done ? (item.kind === "repeat" ? check?.photos : task.done?.photos) || [] : [];
  const note = done ? (item.kind === "repeat" ? check?.note : task.done?.note) : "";
  return (
    <li className={cn("flex gap-3 rounded-2xl border bg-surface p-3.5", overdue ? "border-danger/40" : "border-line")}>
      <button
        type="button"
        onClick={() => onTick(item)}
        disabled={busy || (done && !canUndo)}
        aria-pressed={done}
        aria-label={done ? `Undo: ${task.title}` : `Done: ${task.title}`}
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition",
          done ? "border-brand bg-brand text-brand-fg" : "border-line hover:border-brand",
          busy && "opacity-50"
        )}
      >
        {done && <Check className="size-4" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1 space-y-1">
        <p className={cn("text-sm font-semibold", done ? "text-muted line-through decoration-subtle" : "text-fg")}>{task.title}</p>
        {task.details && !done && <p className="text-xs text-muted">{task.details}</p>}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
          {item.kind === "repeat" ? (
            <span className="inline-flex items-center gap-1"><Repeat className="size-3" />{repeatText(task)}</span>
          ) : (
            <span>{task.dueDate ? `By ${label(task.dueDate)}` : "No due day"}</span>
          )}
          {task.createdBy?.name && <span>· from {task.createdBy.name}</span>}
          {task.priority === "urgent" && !done && <Badge tone="danger" className="px-2 py-px text-[10px]"><Flag className="size-3" />Urgent</Badge>}
          {overdue && <Badge tone="danger" className="px-2 py-px text-[10px]">Overdue</Badge>}
          {task.needsPhoto && !done && <Badge className="px-2 py-px text-[10px]"><Camera className="size-3" />Photo</Badge>}
          {late && <Badge tone="warning" className="px-2 py-px text-[10px]">Done late</Badge>}
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

/** tasks: this person's (live). today: the business day. */
export default function TodayTab({ tasks, loading, companyId, branchId, user, today }) {
  const [date, setDate] = useState(today);
  const [asking, setAsking] = useState(null);
  const [busy, setBusy] = useState(null);
  const { checks, loading: checksLoading } = useChecks(companyId, branchId, { from: date, to: date, uid: user.uid });
  const list = useMemo(() => dayList(tasks, checks, date, today), [tasks, checks, date, today]);
  const left = list.filter((x) => !x.done).length;
  const earliest = addDays(today, -CATCH_UP_DAYS);
  const ahead = date > today;

  const finish = async (item, { files = [], note = "" } = {}) => {
    setBusy(item.task.id);
    try {
      const photos = files.length ? await uploadProof(companyId, branchId, user, files) : [];
      if (item.kind === "repeat") await tickDay(companyId, branchId, item.task, user, { date, doneOn: today, photos, note });
      else await completeOnce(companyId, branchId, item.task, user, { date: today, photos, note });
      toast.success(date < today && item.kind === "repeat" ? "Done — counted late" : "Done");
    } catch (e) {
      toast.error("Couldn't save", { description: e.message });
    } finally {
      setBusy(null);
    }
  };
  const undo = async (item) => {
    setBusy(item.task.id);
    try {
      if (item.kind === "repeat") await untickDay(companyId, branchId, item.task, date);
      else await reopenOnce(companyId, branchId, item.task);
    } catch (e) {
      toast.error("Couldn't undo", { description: e.message });
    } finally {
      setBusy(null);
    }
  };
  const onTick = (item) => {
    if (ahead) return toast.info("That day hasn't come yet");
    if (item.done) return undo(item);
    if (item.task.needsPhoto) return setAsking(item);
    return finish(item);
  };
  // your own tick, or a one-off you finished — today only
  const canUndo = (item) => (item.kind === "repeat" ? item.check?.by?.uid === user.uid && item.check?.doneOn === today : item.task.done?.by?.uid === user.uid && item.task.done?.date === today);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" icon={ChevronLeft} aria-label="Day before" disabled={date <= earliest} onClick={() => setDate(addDays(date, -1))} />
        <div className="min-w-0 flex-1 text-center">
          <p className="text-sm font-semibold text-fg">{date === today ? "Today" : label(date)}</p>
          <p className="text-xs text-muted">{loading ? " " : list.length ? (left ? `${left} of ${list.length} left` : "All done") : "Nothing for this day"}</p>
        </div>
        <Button variant="secondary" size="sm" icon={ChevronRight} aria-label="Next day" disabled={date >= addDays(today, 6)} onClick={() => setDate(addDays(date, 1))} />
      </div>
      {date !== today && (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
          {ahead ? "Looking ahead — these can be ticked on the day." : "An earlier day: what you tick now counts as done late."}{" "}
          <button type="button" className="font-semibold text-brand underline-offset-2 hover:underline" onClick={() => setDate(today)}>Back to today</button>
        </p>
      )}
      {loading || checksLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" rounded="rounded-2xl" />)}</div>
      ) : !list.length ? (
        <EmptyState icon={ListChecks} title="Nothing to do here" description="Tasks given to you show up on their day." />
      ) : (
        <ul className="space-y-2">
          {list.map((item) => <Row key={item.task.id} item={item} onTick={onTick} busy={busy === item.task.id} canUndo={canUndo(item)} />)}
        </ul>
      )}
      <DoneSheet key={asking?.task.id || "none"} item={asking} onClose={() => setAsking(null)} onDone={finish} />
    </div>
  );
}
