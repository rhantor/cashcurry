"use client";
// How people did with their tasks over a month (roadmap 4.11): on time, late
// and missed, worked out from the tasks themselves — and the manager's stars
// and a word, side by side. Managers see everyone they give tasks to and rate
// them; everyone else sees their own.
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Gauge, List, Star } from "lucide-react";
import { Avatar, Badge, Button, EmptyState, Sheet, Skeleton, Textarea, cn, toast } from "@/app/components/ui";
import { Chip } from "@/app/components/entry/Choices";
import { monthOf, performance } from "@/lib/tasks/model";
import { rate, useChecks, useRatings } from "@/lib/tasks/client";

const monthLabel = (m) => format(parseISO(`${m}-01`), "MMMM yyyy");
const shiftMonth = (m, n) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

function Stars({ value = 0, size = "size-4", onPick }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={value ? `${value} of 5 stars` : "Not rated"}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = <Star className={cn(size, n <= value ? "fill-warning text-warning" : "text-line")} />;
        return onPick ? (
          <button key={n} type="button" onClick={() => onPick(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`} aria-pressed={n === value} className="rounded p-0.5 hover:bg-surface-2">
            {icon}
          </button>
        ) : (
          <span key={n}>{icon}</span>
        );
      })}
    </span>
  );
}

const RESULTS = [
  { value: "missed", label: "Missed", tone: "danger", text: "text-danger" },
  { value: "late", label: "Late", tone: "warning", text: "text-warning" },
  { value: "onTime", label: "On time", tone: "success", text: "text-brand" },
  { value: "open", label: "Still to do", tone: "neutral", text: "text-muted" },
];
const dayText = (d) => format(parseISO(d), "EEE d MMM");

/** The bar and the counts; each count opens the list of those tasks. */
function ScoreBar({ p, onShow }) {
  const total = p.onTime + p.late + p.missed;
  const w = (n) => `${total ? (n / total) * 100 : 0}%`;
  const count = (r, n) => (
    <button type="button" onClick={() => onShow(r.value)} disabled={!n} className="rounded-md px-1 py-0.5 hover:bg-surface-2 disabled:pointer-events-none">
      <span className={cn("font-semibold", r.text)}>{n}</span> {r.label.toLowerCase()}
    </button>
  );
  const [missed, late, onTime, open] = RESULTS;
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <span className="bg-brand" style={{ width: w(p.onTime) }} />
        <span className="bg-warning" style={{ width: w(p.late) }} />
        <span className="bg-danger" style={{ width: w(p.missed) }} />
      </div>
      <p className="-mx-1 flex flex-wrap items-center gap-x-0.5 text-xs tabular-nums text-muted">
        {count(onTime, p.onTime)}·{count(late, p.late)}·{count(missed, p.missed)}
        {p.open ? <>·{count(open, p.open)}</> : null}
      </p>
    </div>
  );
}

/** Which tasks: each day missed, late (and when it was done), on time or still to do. */
function DetailsSheet({ open, onClose, who, month, p, show, setShow }) {
  const list = (p?.items || []).filter((x) => x.result === show);
  const r = RESULTS.find((x) => x.value === show) || RESULTS[0];
  return (
    <Sheet open={open} onClose={onClose} title={`${who} · ${monthLabel(month)}`} description="Every task counted this month, day by day.">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {RESULTS.map((x) => {
            const n = (p?.items || []).filter((i) => i.result === x.value).length;
            return (
              <Chip key={x.value} on={show === x.value} onClick={() => setShow(x.value)} disabled={!n}>
                {x.label} · {n}
              </Chip>
            );
          })}
        </div>
        {!list.length ? (
          <p className="text-sm text-muted">None.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {list.map((x) => (
              <li key={`${x.taskId}-${x.date}`} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-24 shrink-0 text-xs font-medium tabular-nums text-muted">{dayText(x.date)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">{x.title}</span>
                  {x.result === "late" && x.doneOn && <span className="block text-xs text-warning">done {dayText(x.doneOn)}</span>}
                </span>
                <Badge tone={r.tone} className="shrink-0 px-2 py-px text-[10px]">{r.label}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

const scoreTone = (s) => (s == null ? "text-subtle" : s >= 85 ? "text-brand" : s >= 60 ? "text-warning" : "text-danger");

function RateSheet({ person, month, current, onClose, companyId, branchId, user }) {
  const [stars, setStars] = useState(current?.stars || 0);
  const [note, setNote] = useState(current?.note || "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await rate(companyId, branchId, user, person, month, { stars, note });
      toast.success("Rating saved");
      onClose();
    } catch (e) {
      toast.error("Couldn't save the rating", { description: e.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={!!person} onClose={onClose} title={`Rate ${person?.name || ""}`} description={monthLabel(month)} footer={<Button onClick={save} loading={busy} disabled={!stars}>Save</Button>}>
      <div className="space-y-4">
        <Stars value={stars} size="size-8" onPick={setStars} />
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A word on the month — what went well, what to do better" aria-label="Comment" />
        <p className="text-xs text-muted">{person?.name?.split(" ")[0]} sees this with their task figures.</p>
      </div>
    </Sheet>
  );
}

/** manage: everyone's (and rating); otherwise only `user`'s own. */
/**
 * manage: everyone, and rating. lead (a supervisor): their team and themselves,
 * no rating (they see their own). Otherwise only the person's own.
 */
export default function PerformanceTab({ tasks, loading, manage, lead = false, companyId, branchId, user, today, away }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [rating, setRating] = useState(null);
  const [details, setDetails] = useState(null); // { uid, show }
  const { from, to } = monthOf(`${month}-01`);
  const many = manage || lead;
  const { checks: scoped, loading: checksLoading } = useChecks(companyId, branchId, { from, to, ...(manage ? { all: true } : lead ? { lead: user.uid } : { uid: user.uid }) });
  // a supervisor's own ticks are not among their team's
  const { checks: own } = useChecks(companyId, branchId, { from, to, uid: lead ? user.uid : undefined });
  const checks = useMemo(() => ({ ...own, ...scoped }), [own, scoped]);
  const { ratings } = useRatings(companyId, branchId, month, manage ? { all: true } : { uid: user.uid });

  const rows = useMemo(() => {
    // everyone a task can fall to: whoever has it, and those on its rota or covering a day
    const all = tasks.flatMap((t) => [{ ...t.assignee, uid: t.assigneeUid }, ...Object.values(t.rota || {}), ...Object.values(t.covers || {})]).filter((p) => p?.uid);
    const people = many ? [...new Map(all.map((p) => [p.uid, p.uid === user.uid ? { ...p, name: "You" } : p])).values()] : [{ uid: user.uid, name: "You" }];
    return people
      .map((p) => ({ person: p, p: performance(tasks, checks, p.uid, { from, to, today, away }), r: ratings[p.uid] }))
      .filter((x) => !many || x.p.given || x.r)
      .sort((a, b) => (b.p.score ?? -1) - (a.p.score ?? -1) || String(a.person.name).localeCompare(String(b.person.name)));
  }, [tasks, checks, ratings, many, user.uid, from, to, today, away]);

  const future = month > today.slice(0, 7);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" icon={ChevronLeft} aria-label="Month before" onClick={() => setMonth(shiftMonth(month, -1))} />
        <p className="flex-1 text-center text-sm font-semibold text-fg">{monthLabel(month)}</p>
        <Button variant="secondary" size="sm" icon={ChevronRight} aria-label="Next month" disabled={month >= today.slice(0, 7)} onClick={() => setMonth(shiftMonth(month, 1))} />
      </div>
      <p className="text-xs text-muted">
        Score: tasks done on time, a late one counting half{month === today.slice(0, 7) ? `, up to today (${format(parseISO(today), "d MMM")})` : ""}.
      </p>

      {loading || checksLoading ? (
        <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-24" rounded="rounded-2xl" />)}</div>
      ) : !rows.length || future ? (
        <EmptyState icon={Gauge} title="Nothing to show for this month" description={manage ? "Once people have tasks, how they did shows here." : "Tasks given to you show here once they're due."} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rows.map(({ person, p, r }) => (
            <li key={person.uid} className="min-w-0 space-y-3 rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center gap-3">
                <Avatar name={person.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">{person.name}</p>
                  <p className="text-xs text-muted">{p.given} task{p.given === 1 ? "" : "s"} this month</p>
                </div>
                <p className={cn("text-2xl font-bold tabular-nums", scoreTone(p.score))}>{p.score == null ? "—" : `${p.score}%`}</p>
              </div>
              <ScoreBar p={p} onShow={(show) => setDetails({ uid: person.uid, show })} />
              {p.given > 0 && (
                <Button size="sm" variant="ghost" icon={List} onClick={() => setDetails({ uid: person.uid, show: p.missed ? "missed" : p.late ? "late" : "onTime" })} className="-ml-2">
                  See each task
                </Button>
              )}
              <div className="space-y-1.5 border-t border-line pt-3">
                <div className="flex items-center gap-2">
                  <Stars value={r?.stars || 0} />
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">{r ? `by ${r.by?.name || "a manager"}` : "Not rated yet"}</span>
                  {manage && person.uid !== user.uid && (
                    <Button size="sm" variant="secondary" onClick={() => setRating({ person, current: r })}>{r ? "Change" : "Rate"}</Button>
                  )}
                </div>
                {r?.note && <p className="text-sm text-fg">“{r.note}”</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {(() => {
        const row = details && rows.find((x) => x.person.uid === details.uid);
        return (
          <DetailsSheet
            open={!!row}
            onClose={() => setDetails(null)}
            who={row ? (row.person.uid === user.uid && !manage ? "You" : row.person.name) : ""}
            month={month}
            p={row?.p}
            show={details?.show || "missed"}
            setShow={(show) => setDetails((d) => ({ ...d, show }))}
          />
        );
      })()}
      {rating && <RateSheet person={rating.person} current={rating.current} month={month} onClose={() => setRating(null)} companyId={companyId} branchId={branchId} user={user} />}
    </div>
  );
}
