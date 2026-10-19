"use client";
// Pay-outs (roadmap 4.10; replaces bills sent on WhatsApp): money handed out
// of the till to buy something, and the bill when it comes back. What is
// still out shows by person and how long it has been out; bills sent back
// wait here to be tried again.
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Clock, HandCoins, ReceiptText, RotateCcw, Trash2 } from "lucide-react";
import useSession from "@/app/hooks/useSession";
import useCurrency from "@/app/hooks/useCurrency";
import { Badge, Button, Card, EmptyState, Skeleton, cn, confirmDialog, toast } from "@/app/components/ui";
import { formatMoney } from "@/lib/region/currency";
import { ageText, openByPerson } from "@/lib/payouts/model";
import { cancelPayout, useLivePayouts } from "@/lib/payouts/client";
import { BillSheet, HandOutSheet } from "@/app/components/payouts/PayoutSheets";

const day = (d) => (d ? format(parseISO(d), "EEE d MMM") : "");

export default function PayoutsPage() {
  const { user, companyId, branchId } = useSession();
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);
  const { open, waiting, sentBack, loading } = useLivePayouts(companyId, branchId);
  const people = useMemo(() => openByPerson(open), [open]);
  const outNow = open.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const [handing, setHanding] = useState(false);
  const [billFor, setBillFor] = useState(null);
  const [retry, setRetry] = useState(null);

  const takeBack = async (p) => {
    if (!(await confirmDialog({ title: "Take this pay-out back?", message: `${money(p.amount)} to ${p.to?.name}. Only if it was a mistake and the money is back in the till.`, confirmLabel: "Take back", danger: true }))) return;
    try {
      await cancelPayout(companyId, branchId, p.id);
      toast.success("Taken back");
    } catch (e) {
      toast.error("Couldn't take it back", { description: e.message });
    }
  };

  if (!companyId || !branchId) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight text-fg">Pay-outs</h1>
          <p className="text-sm text-muted">Money handed out of the till to buy something — and the bills that come back.</p>
        </div>
        <Button icon={HandCoins} onClick={() => setHanding(true)}>Hand out money</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Out of the till now</p>
          <p className="mt-1 text-2xl font-semibold text-fg">{money(outNow)}</p>
          <p className="text-xs text-subtle">{open.length} pay-out{open.length === 1 ? "" : "s"} with no bill yet</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Bills waiting for approval</p>
          <p className="mt-1 text-2xl font-semibold text-fg">{waiting.length}</p>
        </Card>
        <Card className={cn("p-4", sentBack.length && "border-warning/40")}>
          <p className="text-xs font-medium text-muted">Sent back to fix</p>
          <p className="mt-1 text-2xl font-semibold text-fg">{sentBack.length}</p>
        </Card>
      </div>

      {sentBack.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-semibold text-fg">Sent back — try again</h2>
          {sentBack.map((s) => (
            <Card key={s.id} className="flex flex-wrap items-center gap-3 border-warning/40 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg">{money(s.billAmount)} · {s.category || s.purpose}</p>
                <p className="text-xs text-muted">{day(s.date)} · {s.to?.name} · {s.review?.by?.name ? `${s.review.by.name}: ` : ""}{s.review?.note || "no reason given"}</p>
              </div>
              <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => setRetry(s)}>Try again</Button>
            </Card>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold text-fg">Still out</h2>
        {loading ? (
          <Skeleton className="h-28" rounded="rounded-2xl" />
        ) : !people.length ? (
          <EmptyState icon={ReceiptText} title="Nothing out" description="Every pay-out has its bill. Hand out money when someone goes to buy something." />
        ) : (
          people.map((row) => (
            <Card key={row.key} className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-line bg-surface-2/50 px-4 py-3">
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{row.name}</p>
                {row.late && <Badge tone="warning">Bill overdue</Badge>}
                <p className="text-sm font-semibold text-fg">{money(row.total)}</p>
              </div>
              <ul className="divide-y divide-line">
                {row.items.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-fg">{money(p.amount)} · {p.purpose}</p>
                      <p className={cn("flex items-center gap-1 text-xs", p.late ? "font-semibold text-warning" : "text-muted")}>
                        <Clock className="size-3" /> {p.ageHours < 1 ? "just now" : `${ageText(p.ageHours)} ago`} · {day(p.date)} · by {p.by?.name || "—"}
                      </p>
                    </div>
                    <Button size="sm" icon={ReceiptText} onClick={() => setBillFor(p)}>Bill back</Button>
                    {p.by?.uid === user?.uid && (
                      <button type="button" aria-label="Take back" onClick={() => takeBack(p)} className="rounded-lg p-2 text-subtle hover:bg-danger/10 hover:text-danger">
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </section>

      {waiting.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-semibold text-fg">Waiting for approval</h2>
          <Card className="divide-y divide-line">
            {waiting.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{s.category || s.purpose} · {s.to?.name}</span>
                <span className="text-xs text-muted">{day(s.date)}</span>
                <span className="font-semibold">{money(s.billAmount)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}

      <HandOutSheet open={handing} onClose={() => setHanding(false)} companyId={companyId} branchId={branchId} user={user} />
      <BillSheet payout={billFor} retry={retry} onClose={() => { setBillFor(null); setRetry(null); }} companyId={companyId} branchId={branchId} user={user} />
    </div>
  );
}
