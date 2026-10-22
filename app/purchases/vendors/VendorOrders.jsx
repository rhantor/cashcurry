"use client";
// A supplier's orders at this branch and how they deliver: on time, came
// short, days it takes (lib/purchases/vendors.js scorecard), open and late
// orders, the last ones received.
import React, { useMemo } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { cn } from "@/app/components/ui";
import { useGetRequisitionsQuery } from "@/lib/redux/api/requisitionsApiSlice";
import { formatMoney } from "@/lib/region/currency";
import { businessToday } from "@/lib/region";
import useCurrency from "@/app/hooks/useCurrency";
import { dueText, lateDays, missingLines } from "@/lib/purchases/orders";
import { dayOf, scorecard } from "@/lib/purchases/vendors";
import { poReference } from "@/lib/purchases/purchaseOrderPdf";
import { ListHead, RowList, niceDate } from "./parts";

const OPEN = ["Pending", "Approved", "Sent"];

/** One figure of the scorecard: big number, what it means, how many it is out of. */
function Score({ label, value, note, tone }) {
  return (
    <div className="bg-surface p-3">
      <p className="text-[11px] font-semibold text-muted">{label}</p>
      <p className={cn("mt-0.5 text-lg font-bold tabular-nums", tone || "text-fg")}>{value}</p>
      <p className="text-[11px] text-subtle">{note}</p>
    </div>
  );
}

export default function VendorOrders({ companyId, branchId, vendorId }) {
  const currency = useCurrency();
  const money = (v) => formatMoney(Number(v ?? 0), currency);
  const today = businessToday();
  const { data: all = [], isLoading } = useGetRequisitionsQuery(companyId && branchId ? { companyId, branchId } : undefined, { skip: !companyId || !branchId });
  const orders = useMemo(() => all.filter((o) => o.vendorId === vendorId), [all, vendorId]);
  const s = scorecard(orders, today);
  const open = orders.filter((o) => OPEN.includes(o.status || "Pending")).sort((a, b) => lateDays(b, today) - lateDays(a, today));
  const received = orders
    .filter((o) => o.status === "Received")
    .sort((a, b) => dayOf(b.receivedAt).localeCompare(dayOf(a.receivedAt)))
    .slice(0, 8);

  const goodBad = (p, goodAt) => (p == null ? "text-muted" : p >= goodAt ? "text-success" : p >= goodAt - 20 ? "text-warning" : "text-danger");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
        <Score label="On time" value={s.onTimePct == null ? "—" : `${s.onTimePct}%`} note={s.onTimeOf ? `${s.onTime} of ${s.onTimeOf} by their day` : "No delivery days yet"} tone={goodBad(s.onTimePct, 90)} />
        <Score label="Came short" value={s.shortPct == null ? "—" : `${s.shortPct}%`} note={s.received ? `${s.short} of ${s.received} orders` : "Nothing received yet"} tone={s.shortPct == null ? "text-muted" : s.shortPct <= 10 ? "text-success" : s.shortPct <= 30 ? "text-warning" : "text-danger"} />
        <Score label="Takes" value={s.avgDays == null ? "—" : `${s.avgDays} day${s.avgDays === 1 ? "" : "s"}`} note={s.avgOf ? `sent → arrived, ${s.avgOf} order${s.avgOf === 1 ? "" : "s"}` : "Once sent orders arrive"} />
        <Score label="Open" value={String(s.open)} note={s.late ? `${s.late} late` : "None late"} tone={s.late ? "text-danger" : undefined} />
      </div>

      <section>
        <ListHead label="Open orders" value={open.length}>
          <Link href="/purchases/purchase-orders" className="text-xs font-semibold text-brand hover:underline">
            Purchase orders →
          </Link>
        </ListHead>
        <RowList loading={isLoading} rows={open} empty={{ icon: ClipboardList, title: "No open orders", description: "Orders not yet arrived show here." }}>
          {open.map((o) => {
            const late = lateDays(o, today);
            return (
              <li key={o.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">{poReference(o)}</p>
                  <p className="truncate text-[11px] text-muted">
                    {o.status || "Pending"}
                    {o.status === "Sent" && o.deliverBy ? ` · ${dueText(o, today)}` : ""}
                    {o.payoutHold ? " · bill waiting in Pay-outs" : ""}
                  </p>
                </div>
                <span className={cn("shrink-0 text-sm font-bold tabular-nums", late ? "text-danger" : "text-fg")}>{money(o.totalEst)}</span>
              </li>
            );
          })}
        </RowList>
      </section>

      {received.length > 0 && (
        <section>
          <ListHead label="Last received" value={received.length} />
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {received.map((o) => {
              const miss = missingLines(o);
              const day = dayOf(o.receivedAt);
              const onTime = o.deliverBy && day ? day <= o.deliverBy : null;
              return (
                <li key={o.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-fg">{poReference(o)}</p>
                    <p className="truncate text-[11px] text-muted">
                      {day ? `Arrived ${niceDate(day)}` : "Arrived"}
                      {onTime === true && <span className="text-success"> · on time</span>}
                      {onTime === false && <span className="text-danger"> · late (due {niceDate(o.deliverBy)})</span>}
                      {miss.length > 0 && <span className="text-warning"> · {miss.length} item{miss.length === 1 ? "" : "s"} short</span>}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-fg">{money(o.finalTotal)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
