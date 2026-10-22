"use client";
// One item at this branch: its last price and how it moved, each supplier's
// last price (cheapest first), what is bought a month over six months, and
// every purchase — from the item lines on the branch's bills
// (lib/purchases/items.js itemStats).
import React from "react";
import { format, parseISO } from "date-fns";
import { Pencil, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { Button, EmptyState, Sheet, cn } from "@/app/components/ui";
import { useItemsContext } from "../ItemsContext";

const day = (d) => (d ? format(parseISO(d), "d MMM yyyy") : "—");
const mon = (m) => format(parseISO(`${m}-01`), "MMM");

export default function ItemDetailSheet({ item, stat, onClose }) {
  const { money, canManage, handleOpenEdit, vendorNameById } = useItemsContext();
  const s = stat;
  const unit = item?.unit || "";
  const peak = s ? Math.max(...s.months.map((m) => m.spend), 0) : 0;

  return (
    <Sheet open={!!item} onClose={onClose} size="lg" title={item?.name || "Item"} description={[item?.category, unit].filter(Boolean).join(" · ") || undefined}>
      {item && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
            <div className="bg-surface p-3">
              <p className="text-[11px] font-semibold text-muted">Last price</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-fg">{s ? money(s.last.price) : "—"}</p>
              {s?.change != null && (
                <p className={cn("inline-flex items-center gap-0.5 text-[11px] font-semibold", s.change > 0 ? "text-warning" : "text-success")}>
                  {s.change > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {s.change > 0 ? "+" : ""}
                  {s.change}% · was {money(s.prev.price)}
                </p>
              )}
            </div>
            <div className="bg-surface p-3">
              <p className="text-[11px] font-semibold text-muted">This month</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-fg">{money(s?.month.spend || 0)}</p>
              <p className="text-[11px] text-subtle">
                {s?.month.qty || 0} {unit}
              </p>
            </div>
            <div className="bg-surface p-3">
              <p className="text-[11px] font-semibold text-muted">Last 90 days</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-fg">{money(s?.spend90 || 0)}</p>
            </div>
            <div className="bg-surface p-3">
              <p className="text-[11px] font-semibold text-muted">Last bought</p>
              <p className="mt-0.5 text-base font-bold text-fg">{s ? day(s.lastBought) : "Never"}</p>
              {s && <p className="truncate text-[11px] text-subtle">{s.last.vendorName}</p>}
            </div>
          </div>

          {!s ? (
            <EmptyState
              className="py-8"
              icon={Receipt}
              title="Not bought here yet"
              description="Prices show once a supplier's bill lists this item — bills made from purchase orders do."
            />
          ) : (
            <>
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Suppliers&apos; last price</p>
                <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                  {s.byVendor.map((v, i) => (
                    <li key={v.vendorId || v.vendorName} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-fg">{v.vendorName || vendorNameById.get(v.vendorId) || "Supplier"}</p>
                        <p className="text-[11px] text-muted">{day(v.date)}</p>
                      </div>
                      {i === 0 && s.byVendor.length > 1 && <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">Cheapest</span>}
                      <span className="shrink-0 text-sm font-bold tabular-nums text-fg">
                        {money(v.price)}
                        {unit && <span className="text-[11px] font-medium text-muted"> /{unit}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Spent a month</p>
                <div className="flex h-36 items-end gap-2 rounded-2xl border border-line p-3">
                  {s.months.map((m) => (
                    <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${mon(m.month)}: ${money(m.spend)} · ${m.qty} ${unit}`}>
                      <span className="text-[10px] tabular-nums text-muted">{m.spend > 0 ? money(m.spend).replace(/\.00$/, "") : ""}</span>
                      <div className="w-full max-w-10 rounded-t-[4px] bg-brand" style={{ height: `${peak ? Math.max(m.spend > 0 ? 4 : 0, (m.spend / peak) * 70) : 0}%` }} />
                      <span className="text-[11px] font-medium text-muted">{mon(m.month)}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Every purchase ({s.history.length})</p>
                <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                  {s.history.slice(0, 30).map((l, i) => (
                    <li key={`${l.date}-${l.invoiceNo}-${i}`} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-fg">{l.vendorName || "Supplier"}</p>
                        <p className="truncate text-[11px] text-muted">
                          {day(l.date)}
                          {l.invoiceNo ? ` · ${l.invoiceNo}` : ""} · {l.qty} {l.unit || unit} × {money(l.price)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-fg">{money(l.amount)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}

          {canManage && (
            <Button
              variant="secondary"
              icon={Pencil}
              onClick={() => {
                onClose();
                handleOpenEdit(item);
              }}
            >
              Edit item
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}
