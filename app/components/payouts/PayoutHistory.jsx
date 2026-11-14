"use client";
// Pay-out history (owner, 14 Nov 2026): yesterday by default, a day at a time
// with ← →, and each day of the month at a glance — tap a day to open it.
import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, ReceiptText, RotateCw } from "lucide-react";
import { useBusinessToday } from "@/app/hooks/useRegion";
import { Badge, Card, DatePicker, EmptyState, Skeleton, Tabs, cn, toast } from "@/app/components/ui";
import { loadPayoutRange } from "@/lib/payouts/client";
import { monthOf, payoutDay, payoutMonth, shiftDay } from "@/lib/payouts/history";

const nice = (d) => (d ? format(parseISO(d), "EEE d MMM") : "");
const TONE = { open: "warning", pending: "info", approved: "success", rejected: "danger" };

export default function PayoutHistory({ companyId, branchId, money }) {
  const today = useBusinessToday();
  // yesterday until someone picks a day: the branch's today can settle after the first render
  const [picked, setDate] = useState(null);
  const date = picked || shiftDay(today, -1);
  const [view, setView] = useState("day");
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const month = useMemo(() => monthOf(date), [date]);

  const load = useCallback(async () => {
    if (!companyId || !branchId) return;
    setBusy(true);
    try {
      setData({ ...(await loadPayoutRange(companyId, branchId, month.from, month.to)), from: month.from });
    } catch (e) {
      toast.error("Couldn't load the history", { description: e.message });
      setData({ records: [], billsById: {}, from: month.from });
    } finally {
      setBusy(false);
    }
  }, [companyId, branchId, month.from, month.to]);
  useEffect(() => { load(); }, [load]);

  const ready = data && data.from === month.from;
  const day = useMemo(() => (ready ? payoutDay(data.records, date, data.billsById) : null), [ready, data, date]);
  const mon = useMemo(() => (ready ? payoutMonth(data.records, month) : null), [ready, data, month]);
  const t = day?.totals;

  const change = (v) => (v > 0 ? `${money(v)} back to the till` : v < 0 ? `${money(-v)} more paid from the till` : "nothing back");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs size="sm" value={view} onChange={setView} tabs={[{ value: "day", label: "Day" }, { value: "month", label: format(parseISO(month.from), "MMMM") }]} />
        <div className="ml-auto flex items-center gap-1">
          <button type="button" aria-label="Day before" onClick={() => setDate(shiftDay(date, -1))} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg">
            <ChevronLeft className="size-4" />
          </button>
          <DatePicker value={date} max={today} onChange={(v) => v && setDate(v)} className="[&_button]:h-9" />
          <button type="button" aria-label="Day after" disabled={date >= today} onClick={() => setDate(shiftDay(date, 1))} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30">
            <ChevronRight className="size-4" />
          </button>
          <button type="button" aria-label="Refresh" onClick={load} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg">
            <RotateCw className={cn("size-4", busy && "animate-spin")} />
          </button>
        </div>
      </div>

      {!ready ? (
        <Skeleton className="h-40" rounded="rounded-2xl" />
      ) : view === "month" ? (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-3 gap-3 border-b border-line bg-surface-2/50 px-4 py-3 text-sm">
            <div>
              <p className="text-xs text-muted">Handed out</p>
              <p className="font-semibold text-fg">{money(mon.totals.handedOut)}</p>
              <p className="text-xs text-subtle">{mon.totals.count} pay-out{mon.totals.count === 1 ? "" : "s"}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Bills back</p>
              <p className="font-semibold text-fg">{money(mon.totals.bills)}</p>
              <p className="text-xs text-subtle">{mon.totals.billCount} bill{mon.totals.billCount === 1 ? "" : "s"}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Change</p>
              <p className="font-semibold text-fg">{money(Math.abs(mon.totals.change))}</p>
              <p className="text-xs text-subtle">{mon.totals.change > 0 ? "back to the till" : mon.totals.change < 0 ? "more paid from the till" : "nothing back"}</p>
            </div>
          </div>
          {!mon.days.length ? (
            <EmptyState icon={ReceiptText} title="No pay-outs this month" />
          ) : (
            <ul className="divide-y divide-line">
              {mon.days.map((r) => (
                <li key={r.date}>
                  <button type="button" onClick={() => { setDate(r.date); setView("day"); }} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/60">
                    <span className="w-24 shrink-0 text-sm font-medium text-fg">{nice(r.date)}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted">
                      {r.count} handed out{r.billCount ? ` · ${r.billCount} bill${r.billCount === 1 ? "" : "s"} back ${money(r.bills)}` : ""}
                      {r.openCount ? ` · ${r.openCount} no bill yet` : ""}
                    </span>
                    <span className="text-sm font-semibold text-fg">{money(r.handedOut)}</span>
                    <ChevronRight className="size-4 text-subtle" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs font-medium text-muted">Handed out {date === shiftDay(today, -1) ? "yesterday" : date === today ? "today" : `on ${nice(date)}`}</p>
              <p className="mt-1 text-2xl font-semibold text-fg">{money(t.handedOut)}</p>
              <p className="text-xs text-subtle">{t.count} pay-out{t.count === 1 ? "" : "s"}{t.openCount ? ` · ${money(t.stillOut)} still with no bill` : ""}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted">Bills brought back that day</p>
              <p className="mt-1 text-2xl font-semibold text-fg">{money(t.bills)}</p>
              <p className="text-xs text-subtle">{t.billCount} bill{t.billCount === 1 ? "" : "s"}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted">Change</p>
              <p className="mt-1 text-2xl font-semibold text-fg">{money(Math.abs(t.change))}</p>
              <p className="text-xs text-subtle">{change(t.change)}</p>
            </Card>
          </div>

          <section className="space-y-2">
            <h2 className="px-1 text-sm font-semibold text-fg">Handed out</h2>
            {!day.outs.length ? (
              <EmptyState icon={ReceiptText} title="Nothing handed out" description={`No pay-outs on ${nice(date)}.`} />
            ) : (
              <Card className="divide-y divide-line">
                {day.outs.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-fg">
                        <span className="font-semibold">{o.to?.name || "—"}</span> · {o.purpose || "—"}
                      </p>
                      <p className="text-xs text-muted">
                        by {o.by?.name || "—"}
                        {o.bill && o.state.key !== "open" ? ` · bill ${money(o.bill.billAmount)}${o.bill.date !== o.date ? ` on ${nice(o.bill.date)}` : ""}` : ""}
                      </p>
                    </div>
                    <Badge tone={TONE[o.state.key]}>{o.state.label}</Badge>
                    <span className="w-24 text-right text-sm font-semibold text-fg">{money(o.amount)}</span>
                  </div>
                ))}
              </Card>
            )}
          </section>

          {day.billsBack.length > 0 && (
            <section className="space-y-2">
              <h2 className="px-1 text-sm font-semibold text-fg">Bills back for earlier pay-outs</h2>
              <Card className="divide-y divide-line">
                {day.billsBack.map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-fg">
                        <span className="font-semibold">{b.to?.name || "—"}</span> · {b.category || b.purpose || "—"}
                      </p>
                      <p className="text-xs text-muted">{money(b.floatAmount)} handed out · {change(Math.round((Number(b.floatAmount) - Number(b.billAmount)) * 100) / 100)}</p>
                    </div>
                    <Badge tone={TONE[b.status === "approved" ? "approved" : "pending"]}>{b.status === "approved" ? "Bill approved" : "Bill waiting for approval"}</Badge>
                    <span className="w-24 text-right text-sm font-semibold text-fg">{money(b.billAmount)}</span>
                  </div>
                ))}
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}
