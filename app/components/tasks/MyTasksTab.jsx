"use client";
// My tasks (roadmap 4.11): one to-do list — late, today, tomorrow, this week,
// later — and a week strip to look at a single day. Tick to finish; a task
// that needs a photo asks for one. A missed day can still be ticked for a
// week (counted late). `readOnly` shows someone else's list (management).
// A repeating task's day is whoever is on duty then (31 Oct): its rota, a
// cover, or — when that person is off — the supervisor, who gives it on.
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { CalendarClock, Camera, Check, Flag, ListChecks, Repeat, TriangleAlert, X } from "lucide-react";
import { Badge, Button, EmptyState, Input, Sheet, Skeleton, Textarea, cn, toast } from "@/app/components/ui";
import { FileThumb } from "@/app/components/common/Files";
import { CATCH_UP_DAYS, addDays, agenda, answersFor, canSetDuty, checklistState, dayList, issueHref, itemsOf, problemsIn, repeatText } from "@/lib/tasks/model";
import { completeOnce, reopenOnce, tickDay, untickDay, uploadProof, useChecks } from "@/lib/tasks/client";
import { resolveIssue } from "@/lib/issues/client";
import TaskDetailSheet from "./TaskDetailSheet";
import MessageBadge from "./MessageBadge";
import { CoverSheet, DutyNote } from "./DutySheets";
import { unreadOn } from "@/lib/tasks/model";

const dayText = (d) => format(parseISO(d), "EEE d MMM");

/** Monday of the week `d` is in. */
const weekStart = (d) => {
  const dow = parseISO(d).getDay(); // Sunday = 0
  return addDays(d, dow === 0 ? -6 : 1 - dow);
};

/** One checklist line: OK, or Problem with what is wrong. */
function ChecklistLine({ n, text, answer, onChange }) {
  const ok = answer?.ok === true;
  const bad = answer?.ok === false;
  return (
    <li className={cn("space-y-2 rounded-xl border p-3", bad ? "border-danger/40 bg-danger-soft/40" : ok ? "border-brand/40 bg-brand-soft/30" : "border-line")}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-subtle">{n}</span>
        <p className="min-w-0 flex-1 text-sm text-fg">{text}</p>
      </div>
      <div className="flex gap-2 pl-8">
        <button type="button" onClick={() => onChange({ ok: true, note: "" })} aria-pressed={ok} className={cn("inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition", ok ? "border-brand bg-brand text-brand-fg" : "border-line text-fg hover:bg-surface-2")}>
          <Check className="size-4" /> OK
        </button>
        <button type="button" onClick={() => onChange({ ok: false, note: answer?.note || "" })} aria-pressed={bad} className={cn("inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition", bad ? "border-danger bg-danger text-white" : "border-line text-fg hover:bg-surface-2")}>
          <TriangleAlert className="size-4" /> Problem
        </button>
      </div>
      {bad && (
        <div className="pl-8">
          <Input value={answer?.note || ""} onChange={(e) => onChange({ ok: false, note: e.target.value })} placeholder="What is wrong?" aria-label={`What is wrong: ${text}`} autoFocus />
        </div>
      )}
    </li>
  );
}

/**
 * Finish a task: its checklist answered line by line (OK / Problem), a photo
 * if it needs one, a note. A task made from an issue asks what was done —
 * finishing it resolves the issue.
 */
function DoneSheet({ item, onClose, onDone }) {
  const [files, setFiles] = useState([]);
  const [note, setNote] = useState("");
  const [answers, setAnswers] = useState([]);
  const [busy, setBusy] = useState(false);
  const needs = item?.task.needsPhoto;
  const items = itemsOf(item?.task);
  const list = checklistState(items, answers);
  const fromIssue = !!item?.task.issueId;
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const go = async () => {
    setBusy(true);
    try {
      await onDone(item, { files, note, items: items.length ? answersFor(items, answers) : [] });
      onClose();
    } finally {
      setBusy(false);
    }
  };
  const allOk = () => setAnswers(items.map(() => ({ ok: true, note: "" })));
  const blocked = (needs && !files.length) || !list.ready;
  const description = fromIssue
    ? "Say what was done — the issue is marked resolved."
    : items.length
      ? `Check each line: OK, or Problem with what is wrong.${needs ? " A photo is needed too." : ""}`
      : needs
        ? "Add a photo of the work to finish it."
        : "Add a photo or a note if it helps.";
  return (
    <Sheet
      open={!!item}
      onClose={onClose}
      title={item?.task.title || ""}
      description={description}
      footer={
        <div className="flex w-full items-center gap-3">
          <p className="min-w-0 flex-1 text-xs text-muted">
            {items.length > 0 && (list.left ? `${list.left} of ${items.length} left` : list.needNote ? "Say what is wrong" : list.problems ? `${list.problems} problem${list.problems === 1 ? "" : "s"}` : "All OK")}
          </p>
          <Button onClick={go} loading={busy} disabled={blocked} icon={Check}>
            {fromIssue ? "Fixed — resolve the issue" : "Mark done"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {items.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-muted">Checklist · {items.length}</p>
              <button type="button" onClick={allOk} className="text-xs font-semibold text-brand hover:underline">Everything OK</button>
            </div>
            <ol className="space-y-2">
              {items.map((text, i) => (
                <ChecklistLine key={`${i}-${text}`} n={i + 1} text={text} answer={answers[i]} onChange={(a) => setAnswers((l) => { const next = [...l]; next[i] = a; return next; })} />
              ))}
            </ol>
          </div>
        )}
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
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={fromIssue ? "What was done to fix it" : "Note (optional)"} aria-label="Note" />
      </div>
    </Sheet>
  );
}

/** One task on the list. `showDate`: say which day it is for (late and coming-up items). */
function Row({ item, onTick, onOpen, busy, canUndo, showDate, readOnly, unread, role, user, onGive }) {
  const { task, done } = item;
  const check = item.check;
  const proof = done ? (item.kind === "repeat" ? check?.photos : task.done?.photos) || [] : [];
  const note = done ? (item.kind === "repeat" ? check?.note : task.done?.note) : "";
  const lines = itemsOf(task).length;
  const problems = done ? problemsIn(item.kind === "repeat" ? check?.items : task.done?.items) : [];
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
        <span className="flex items-start gap-2">
          <button type="button" onClick={() => onOpen(task)} className={cn("min-w-0 flex-1 text-left text-sm font-semibold hover:underline", done ? "text-muted line-through decoration-subtle" : "text-fg")}>
            {task.title}
          </button>
          <button type="button" onClick={() => onOpen(task)} className="shrink-0" aria-label="Open questions and answers">
            <MessageBadge count={task.commentCount || 0} unread={unread} />
          </button>
        </span>
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
          {lines > 0 && !done && <Badge className="px-2 py-px text-[10px]"><ListChecks className="size-3" />{lines} to check</Badge>}
          {task.issueId && (
            <Link href={issueHref(task, role)} className="inline-flex">
              <Badge tone="warning" className="px-2 py-px text-[10px] hover:underline"><TriangleAlert className="size-3" />Issue</Badge>
            </Link>
          )}
          {done && item.check?.doneOn > item.date && <Badge tone="warning" className="px-2 py-px text-[10px]">Done late</Badge>}
          {done && item.check?.by?.name && item.check.by.uid !== (item.check.doerUid || item.task.assigneeUid) && <span>· ticked by {item.check.by.name}</span>}
        </div>
        {!done && <DutyNote duty={item.duty} user={user} onGive={onGive ? () => onGive(item) : null} />}
        {problems.length > 0 && (
          <ul className="space-y-0.5 rounded-lg bg-danger-soft/50 px-2.5 py-1.5 text-xs text-danger">
            {problems.map((x, i) => (
              <li key={i}>
                <span className="font-semibold">✗ {x.text}</span>
                {x.note ? ` — ${x.note}` : ""}
              </li>
            ))}
          </ul>
        )}
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

/**
 * tasks: this person's (live). user: who is looking. person: whose list
 * (defaults to user). scope: the ticks a viewer may read for someone else
 * ({ all: true } management, { lead: uid } their supervisor). team: who a
 * supervisor can hand a task to.
 */
export default function MyTasksTab({ tasks, loading, companyId, branchId, user, today, person, readOnly = false, scope, team = [], reads = {}, away, dutyPeople = [] }) {
  const uid = person?.uid || user.uid;
  const [day, setDay] = useState(null); // null = the to-do list; a date = that day only
  const [asking, setAsking] = useState(null);
  const [busy, setBusy] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [giving, setGiving] = useState(null); // a day of a task, to give to someone
  const opened = openId && tasks.find((t) => t.id === openId);
  const monday = weekStart(today);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);
  const from = [addDays(today, -CATCH_UP_DAYS), monday].sort()[0];
  const { checks, loading: checksLoading } = useChecks(companyId, branchId, { from, to: today, ...(readOnly && scope ? scope : { uid }) });
  const duty = useMemo(() => ({ uid, away }), [uid, away]);
  const list = useMemo(() => agenda(tasks, checks, today, duty), [tasks, checks, today, duty]);
  const single = useMemo(() => (day ? dayList(tasks, checks, day, today, duty).map((x) => ({ ...x, date: day, canTick: x.kind === "once" || day <= today })) : []), [tasks, checks, day, today, duty]);

  const finish = async (item, { files = [], note = "", items = [] } = {}) => {
    setBusy(`${item.task.id}-${item.date}`);
    try {
      const photos = files.length ? await uploadProof(companyId, branchId, user, files) : [];
      // a task made from an issue: resolving the issue marks it done (with the note)
      if (item.task.issueId) {
        await resolveIssue(companyId, branchId, { id: item.task.issueId, taskId: item.task.id }, user, note);
        if (photos.length) await completeOnce(companyId, branchId, item.task, user, { date: today, photos, note }).catch(() => {});
        toast.success("Done — the issue is resolved");
        return;
      }
      if (item.kind === "repeat") await tickDay(companyId, branchId, item.task, user, { date: item.date, doneOn: today, doerUid: item.duty?.uid, photos, note, items });
      else await completeOnce(companyId, branchId, item.task, user, { date: today, photos, note, items });
      const bad = items.filter((x) => !x.ok).length;
      toast.success(item.kind === "repeat" && item.date < today ? "Done — counted late" : "Done", bad ? { description: `${bad} problem${bad === 1 ? "" : "s"} noted — your manager sees them` } : undefined);
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
    if (item.task.needsPhoto || itemsOf(item.task).length || item.task.issueId) return setAsking(item);
    return finish(item);
  };
  // your own tick, or a one-off you finished — today only (an issue's task opens again with the issue)
  const canUndo = (item) => !item.task.issueId && (item.kind === "repeat" ? item.check?.by?.uid === user.uid && item.check?.doneOn === today : item.task.done?.by?.uid === user.uid && item.task.done?.date === today);
  const row = (item, showDate) => (
    <Row
      key={`${item.task.id}-${item.date}`}
      item={item}
      unread={unreadOn(item.task, reads, user.uid)}
      onTick={onTick}
      onOpen={(t) => setOpenId(t.id)}
      busy={busy === `${item.task.id}-${item.date}`}
      canUndo={canUndo(item)}
      showDate={showDate}
      readOnly={readOnly}
      role={user.role}
      user={user}
      onGive={item.kind === "repeat" && item.date >= today && dutyPeople.length && canSetDuty(item.task, user) ? setGiving : null}
    />
  );

  // a dot under a day of the strip: something still to do that day
  const openOn = (d) => d >= addDays(today, -CATCH_UP_DAYS) && dayList(tasks, checks, d, today, duty).some((x) => !x.done && (d >= today || x.kind === "repeat"));
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
      {opened && <TaskDetailSheet task={opened} onClose={() => setOpenId(null)} companyId={companyId} branchId={branchId} user={user} team={team} dutyPeople={dutyPeople} away={away} today={today} />}
      <CoverSheet item={giving ? { task: tasks.find((t) => t.id === giving.task.id) || giving.task, date: giving.date } : null} onClose={() => setGiving(null)} people={dutyPeople} companyId={companyId} branchId={branchId} user={user} today={today} away={away} />
    </div>
  );
}
