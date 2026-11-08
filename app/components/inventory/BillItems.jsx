"use client";
// "What came" on a bill without a purchase order (8 Nov): New Vendor Bill and
// a pay-out's new supplier bill. Optional; each line put here goes into stock
// (lib/inventory/model.js reads the bill's item lines). The supplier's own
// items come first in the picker.
import { useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { Plus, Search, X } from "lucide-react";
import { useGetItemsQuery } from "@/lib/redux/api/itemsApiSlice";
import { cn } from "@/app/components/ui";

/** rows: [{ itemId, name, unit, qty, price }] — billItemLines() turns them into what the bill keeps. */
export default function BillItems({ companyId, branchId, vendorId, rows, onChange, className }) {
  const { data: items = [] } = useGetItemsQuery(companyId ? { companyId, branchId } : skipToken);
  const [picking, setPicking] = useState(false);
  const [find, setFind] = useState("");
  const choices = useMemo(() => {
    const on = new Set(rows.map((r) => r.itemId));
    const q = find.trim().toLowerCase();
    const theirs = (i) => (vendorId && (i.vendorIds || []).includes(vendorId) ? 1 : 0);
    return items
      .filter((i) => !on.has(i.id) && (!q || String(i.name || "").toLowerCase().includes(q)))
      .sort((a, b) => theirs(b) - theirs(a) || String(a.name).localeCompare(String(b.name)))
      .slice(0, 30);
  }, [items, rows, find, vendorId]);
  const set = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const num = (v) => v.replace(/[^\d.]/g, "");

  return (
    <div className={cn("space-y-2", className)}>
      {rows.map((r, i) => (
        <div key={r.itemId || i} className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-2.5">
          <span className="min-w-0 flex-1 truncate pl-1 text-sm font-semibold text-fg">{r.name}</span>
          <input inputMode="decimal" value={r.qty} onChange={(e) => set(i, { qty: num(e.target.value) })} placeholder="Qty" aria-label={`${r.name} quantity`} className="h-11 w-20 rounded-xl border border-line bg-surface-2/60 text-center text-base font-semibold tabular-nums outline-none focus:border-brand" />
          <span className="w-9 shrink-0 text-xs text-muted">{r.unit}</span>
          <input inputMode="decimal" value={r.price} onChange={(e) => set(i, { price: num(e.target.value) })} placeholder="Price" aria-label={`${r.name} price each`} className="hidden h-11 w-20 rounded-xl border border-line bg-surface-2/60 text-center text-sm tabular-nums outline-none focus:border-brand sm:block" />
          <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Remove ${r.name}`} className="flex size-9 shrink-0 items-center justify-center rounded-xl text-subtle hover:bg-surface-2">
            <X className="size-4" />
          </button>
        </div>
      ))}

      {picking ? (
        <div className="space-y-2 rounded-2xl border border-line p-2.5">
          <label className="flex min-h-[44px] items-center gap-2 rounded-xl bg-surface-2/60 px-3">
            <Search className="size-4 text-subtle" />
            <input autoFocus value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find an item" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
            <button type="button" onClick={() => setPicking(false)} className="text-sm font-semibold text-muted">
              Done
            </button>
          </label>
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {choices.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  onChange([...rows, { itemId: it.id, name: it.name, unit: it.unit || "", qty: "", price: "" }]);
                  setFind("");
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-2"
              >
                <span className="min-w-0 truncate text-fg">{it.name}</span>
                <span className="shrink-0 text-xs text-muted">{it.unit}</span>
              </button>
            ))}
            {!choices.length && <p className="px-3 py-2 text-sm text-muted">Nothing found. Add it in the Items catalog first.</p>}
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setPicking(true)} className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-sm font-semibold text-fg hover:bg-surface-2">
          <Plus className="size-4" /> {rows.length ? "Add another item" : "Add the items that came"}
        </button>
      )}
    </div>
  );
}
