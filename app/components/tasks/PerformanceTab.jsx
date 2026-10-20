"use client";
// How people did with their tasks over a month (roadmap 4.11): on time, late
// and missed, worked out from the tasks themselves — and the manager's stars
// and a word, side by side. Managers see everyone they give tasks to and rate
// them; everyone else sees their own.
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Gauge, Star } from "lucide-react";
import { Avatar, Button, EmptyState, Sheet, Skeleton, Textarea, cn, toast } from "@/app/components/ui";
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

function ScoreBar({ p }) {
  const total = p.onTime + p.late + p.missed;
  const w = (n) => `${total ? (n / total) * 100 : 0}%`;
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <span className="bg-brand" style={{ width: w(p.onTime) }} />
        <span className="bg-warning" style={{ width: w(p.late) }} />
        <span className="bg-danger" style={{ width: w(p.missed) }} />
      </div>
      <p className="text-xs tabular-nums text-muted">
        <span className="font-semibold text-brand">{p.onTime}</span> on time · <span className="font-semibold text-warning">{p.late}</span> late · <span className="font-semibold text-danger">{p.missed}</span> missed
        {p.open ? ` · ${p.open} still to do` : ""}
      </p>
    </div>
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
export default function PerformanceTab({ tasks, loading, manage, companyId, branchId, user, today }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [rating, setRating] = useState(null);
  const { from, to } = monthOf(`${month}-01`);
  const { checks, loading: checksLoading } = useChecks(companyId, branchId, { from, to, ...(manage ? { all: true } : { uid: user.uid }) });
  const { ratings } = useRatings(companyId, branchId, month, manage ? { all: true } : { uid: user.uid });

  const rows = useMemo(() => {
    const people = manage ? [...new Map(tasks.map((t) => [t.assigneeUid, t.assignee])).values()].filter(Boolean) : [{ uid: user.uid, name: "You" }];
    return people
      .map((p) => ({ person: p, p: performance(tasks, checks, p.uid, { from, to, today }), r: ratings[p.uid] }))
      .filter((x) => !manage || x.p.given || x.r)
      .sort((a, b) => (b.p.score ?? -1) - (a.p.score ?? -1) || String(a.person.name).localeCompare(String(b.person.name)));
  }, [tasks, checks, ratings, manage, user.uid, from, to, today]);

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
              <ScoreBar p={p} />
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
      {rating && <RateSheet person={rating.person} current={rating.current} month={month} onClose={() => setRating(null)} companyId={companyId} branchId={branchId} user={user} />}
    </div>
  );
}
