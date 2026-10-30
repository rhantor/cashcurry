"use client";
// Who does a repeating task, day by day (31 Oct). The rota: the usual person
// for each weekday — set by the supervisor it was given to (or management).
// A cover: one day given to someone else, mostly when the usual person is on
// their day off or on leave (the day then sits with the supervisor).
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, Check, UserRound } from "lucide-react";
import { Avatar, Button, Select, Sheet, cn, toast } from "@/app/components/ui";
import { dutyOn } from "@/lib/tasks/model";
import { setCover, setRota } from "@/lib/tasks/client";

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The rota. people: who can be put on it [{ uid, name, role }] (the
 * supervisor's team and themselves; management: the branch). away(uid, date)
 * marks someone's weekly day off on the weekday.
 */
export function RotaSheet({ task, onClose, people, companyId, branchId, user, today, away }) {
  const [rota, setRotaState] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (task) setRotaState(Object.fromEntries(Object.entries(task.rota || {}).map(([d, p]) => [d, p?.uid || ""])));
  }, [task]);
  if (!task) return <Sheet open={false} onClose={onClose} />;
  const byUid = new Map(people.map((p) => [p.uid, p]));
  for (const p of Object.values(task.rota || {})) if (p?.uid && !byUid.has(p.uid)) byUid.set(p.uid, p);
  const choices = [...byUid.values()];
  // a weekday on or after today, to ask "is this person off that weekday?"
  const dateFor = (wd) => {
    const d = parseISO(today);
    d.setDate(d.getDate() + ((wd - d.getDay() + 7) % 7));
    return format(d, "yyyy-MM-dd");
  };
  const everyDay = (uid) => setRotaState(Object.fromEntries(ORDER.map((d) => [d, uid])));
  const save = async () => {
    setBusy(true);
    try {
      const picked = Object.fromEntries(Object.entries(rota).filter(([, uid]) => uid).map(([d, uid]) => [d, byUid.get(uid)]));
      await setRota(companyId, branchId, task, user, picked, today);
      toast.success("Rota saved", { description: "On someone's day off or leave, the day comes to you to give to someone." });
      onClose();
    } catch (e) {
      toast.error("Couldn't save the rota", { description: e.message });
    } finally {
      setBusy(false);
    }
  };
  const assigneeName = task.assignee?.name || "whoever has it";
  return (
    <Sheet
      open
      onClose={onClose}
      title="Who does it each day"
      description={`${task.title} — a day with no one stays with ${task.assigneeUid === user.uid ? "you" : assigneeName}.`}
      footer={
        <div className="flex justify-end">
          <Button icon={Check} onClick={save} loading={busy}>Save the rota</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {choices.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Same person every day:</span>
            {choices.slice(0, 6).map((p) => (
              <button key={p.uid} type="button" onClick={() => everyDay(p.uid)} className="rounded-full border border-line px-2.5 py-1 font-semibold text-fg hover:bg-surface-2">
                {(p.name || "").split(" ")[0]}
              </button>
            ))}
          </div>
        )}
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {ORDER.map((d) => {
            const uid = rota[d] || "";
            const off = uid && away ? away(uid, dateFor(d)) : null;
            return (
              <li key={d} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-24 shrink-0 text-sm font-medium text-fg">{LONG[d]}</span>
                <div className="min-w-0 flex-1">
                  <Select value={uid} onChange={(e) => setRotaState((r) => ({ ...r, [d]: e.target.value }))} aria-label={`${LONG[d]}: who does it`}>
                    <option value="">{task.assigneeUid === user.uid ? "Me (no one else)" : `${assigneeName.split(" ")[0]} (as given)`}</option>
                    {choices.map((p) => (
                      <option key={p.uid} value={p.uid}>{p.name}</option>
                    ))}
                  </Select>
                  {off === "Day off" && <p className="mt-1 text-xs font-medium text-warning">Their day off — that day will come to you each week</p>}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted">
          Days off come from Staff management (Job → Weekly day off); approved leave counts too. On those days the task shows on your list as
          needing someone, and is never counted as missed for the person away.
        </p>
      </div>
    </Sheet>
  );
}

/**
 * One day of a task given to someone else (or back to the usual person).
 * item: { task, date }. people as for the rota.
 */
export function CoverSheet({ item, onClose, people, companyId, branchId, user, today, away }) {
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setPick(item?.task?.covers?.[item?.date]?.uid || ""), [item]);
  if (!item) return <Sheet open={false} onClose={onClose} />;
  const { task, date } = item;
  const duty = dutyOn(task, date, away);
  const usual = duty.via === "cover" ? dutyOn({ ...task, covers: {} }, date, away) : duty;
  const day = date === today ? "today" : format(parseISO(date), "EEEE d MMM");
  const save = async (person) => {
    setBusy(true);
    try {
      await setCover(companyId, branchId, task, date, person, today);
      toast.success(person ? `${(person.name || "").split(" ")[0]} does it ${day}` : `Back to the usual ${day}`);
      onClose();
    } catch (e) {
      toast.error("Couldn't change it", { description: e.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={`Who does it ${day}?`}
      description={
        usual.away
          ? `${task.title} — ${usual.away.name || "the usual person"} is away (${usual.away.reason.toLowerCase()}).`
          : `${task.title} — usually ${usual.uid === user.uid ? "you" : usual.name || "the usual person"}. Only ${day} changes.`
      }
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {duty.via === "cover" && (
            <Button variant="ghost" onClick={() => save(null)} loading={busy}>Back to the usual</Button>
          )}
          <Button icon={Check} onClick={() => save(people.find((p) => p.uid === pick))} loading={busy} disabled={!pick || pick === task.covers?.[date]?.uid}>
            Give {day}
          </Button>
        </div>
      }
    >
      <ul className="space-y-2">
        {people.map((p) => {
          const off = away ? away(p.uid, date) : null;
          return (
            <li key={p.uid}>
              <button
                type="button"
                onClick={() => setPick(p.uid)}
                aria-pressed={pick === p.uid}
                className={cn("flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition", pick === p.uid ? "border-brand bg-brand-soft" : "border-line hover:bg-surface-2", off && "opacity-60")}
              >
                <Avatar name={p.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{p.uid === user.uid ? `${p.name} (me)` : p.name}</span>
                  <span className={cn("block text-xs", off ? "text-warning" : "text-muted")}>{off || (p.uid === (usual.away?.uid || usual.uid) ? "Usually does it" : usual.away && p.uid === usual.uid ? "Has it for now" : "Free")}</span>
                </span>
                {pick === p.uid && <Check className="size-4 text-brand" />}
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

/** A line under a day of a task: away, held for someone, or covered. */
export function DutyNote({ duty, user, onGive }) {
  if (!duty || duty.via === "rota" || duty.via === "assignee") return null;
  if (duty.via === "cover")
    return (
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-info">
        <CalendarDays className="size-3" />
        {duty.uid === user.uid ? "Given to you for this day" : `${(duty.name || "Someone").split(" ")[0]} does it this day`}
      </p>
    );
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-warning-soft/60 px-2.5 py-1.5 text-xs text-fg">
      <UserRound className="size-3.5 shrink-0 text-warning" />
      <span className="min-w-0 flex-1">
        <span className="font-semibold">{duty.away.name || "The usual person"}</span> is away ({duty.away.reason.toLowerCase()}) — give it to someone, or do it yourself.
      </span>
      {onGive && (
        <button type="button" onClick={onGive} className="shrink-0 rounded-md bg-surface px-2 py-1 text-xs font-semibold text-brand shadow-sm hover:bg-surface-2">
          Give to someone
        </button>
      )}
    </div>
  );
}

