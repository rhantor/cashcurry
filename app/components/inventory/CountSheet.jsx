"use client";
// Count stock (8 Nov): pick a supplier, then write what is on the shelf for
// each of their goods. The app's own figure isn't shown while counting, so
// the count is what is really there; the difference shows once it's saved.
// A blank is "not counted", 0 is "none left".
import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import Sheet from "@/app/components/purchases/Sheet";
import { cn } from "@/app/components/ui";
import { countToSave, qtyText } from "@/lib/inventory/model";

/** The groups to count: the server's, plus every other supplier (for a first count, before anything was bought). */
export function countChoices(data) {
  const groups = data?.groups || [];
  const have = new Set(groups.map((g) => g.vendorId));
  const extra = (data?.vendors || [])
    .filter((v) => !have.has(v.id) && (data?.catalog || []).some((i) => i.vendorIds.includes(v.id)))
    .map((v) => ({ vendorId: v.id, vendorName: v.name || "Supplier", items: [], countedToday: false }));
  return [...groups.filter((g) => g.vendorId), ...extra.sort((a, b) => a.vendorName.localeCompare(b.vendorName)), ...groups.filter((g) => !g.vendorId)];
}

const asRow = (i) => ({ key: i.id, itemId: i.id, name: i.name, unit: i.unit, onHand: 0 });

export default function CountSheet({ open, data, onClose, onSave, busy }) {
  const choices = useMemo(() => countChoices(data), [data]);
  const [vendorId, setVendorId] = useState(null); // null: picking a supplier
  const [entered, setEntered] = useState({});
  const [added, setAdded] = useState([]); // catalog items put on this count by hand
  const [picking, setPicking] = useState(false);
  const [find, setFind] = useState("");

  const group = choices.find((g) => g.vendorId === vendorId) || null;
  const rows = useMemo(() => {
    if (!group) return [];
    const on = new Set(group.items.map((r) => r.key));
    return [...group.items, ...added.filter((r) => !on.has(r.key))];
  }, [group, added]);
  const filled = countToSave(rows, entered).length;

  const reset = () => {
    setVendorId(null);
    setEntered({});
    setAdded([]);
    setPicking(false);
    setFind("");
  };
  const close = () => {
    reset();
    onClose();
  };
  const pickVendor = (id) => {
    reset();
    setVendorId(id);
  };

  // the catalog to add from: this supplier's first, then the rest
  const addable = useMemo(() => {
    const on = new Set(rows.map((r) => r.key));
    const q = find.trim().toLowerCase();
    return (data?.catalog || [])
      .filter((i) => !on.has(i.id) && (!q || i.name.toLowerCase().includes(q)))
      .sort((a, b) => (b.vendorIds.includes(vendorId) ? 1 : 0) - (a.vendorIds.includes(vendorId) ? 1 : 0) || a.name.localeCompare(b.name))
      .slice(0, 40);
  }, [data, rows, find, vendorId]);

  const save = async () => {
    const lines = countToSave(rows, entered);
    if (!lines.length) return;
    const ok = await onSave({ vendorId: group.vendorId, vendorName: group.vendorId ? group.vendorName : "", lines });
    if (ok) close();
  };

  return (
    <Sheet
      open={open}
      title={group ? `Count · ${group.vendorName}` : "Count stock"}
      subtitle={group ? "Write what is there now. Leave a blank for anything you didn't count; 0 means none left." : "Whose goods are you counting?"}
      onClose={close}
      maxWidth="max-w-xl"
      footer={
        group && !picking ? (
          <button onClick={save} disabled={busy || !filled} className="min-h-[52px] w-full rounded-2xl bg-brand text-base font-bold text-brand-fg transition-colors active:brightness-95 disabled:opacity-40">
            {busy ? "Saving…" : filled ? `Save count · ${filled} ${filled === 1 ? "item" : "items"}` : "Fill in what you counted"}
          </button>
        ) : null
      }
    >
      {!group ? (
        <div className="space-y-2">
          {choices.map((g) => (
            <button key={g.vendorId || "other"} type="button" onClick={() => pickVendor(g.vendorId)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left hover:bg-surface-2/60">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-fg">{g.vendorName}</span>
                <span className="block text-xs text-muted">{g.items.length ? `${g.items.length} ${g.items.length === 1 ? "item" : "items"}` : "Nothing bought yet: add items to count"}</span>
              </span>
              {g.countedToday && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
                  <Check className="size-3.5" /> Counted today
                </span>
              )}
              <ChevronRight className="size-4 shrink-0 text-subtle" />
            </button>
          ))}
          {!choices.length && <p className="rounded-2xl bg-surface-2 p-5 text-sm text-muted">No suppliers yet. Add suppliers and items in Purchases first.</p>}
        </div>
      ) : picking ? (
        <div className="space-y-3">
          <button type="button" onClick={() => setPicking(false)} className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
            <ChevronLeft className="size-4" /> Back to the count
          </button>
          <label className="flex min-h-[48px] items-center gap-2 rounded-2xl border border-line bg-surface-2/60 px-3 focus-within:border-brand">
            <Search className="size-4 text-subtle" />
            <input autoFocus value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find an item" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
          </label>
          <div className="space-y-1.5">
            {addable.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => {
                  setAdded((a) => [...a, asRow(i)]);
                  setPicking(false);
                  setFind("");
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5 text-left text-sm"
              >
                <span className="min-w-0 truncate font-medium text-fg">{i.name}</span>
                <span className="shrink-0 text-xs text-muted">{i.unit}</span>
              </button>
            ))}
            {!addable.length && <p className="p-3 text-sm text-muted">Nothing found in the items catalog.</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button type="button" onClick={() => setVendorId(null)} className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
            <ChevronLeft className="size-4" /> Another supplier
          </button>
          {rows.map((r) => {
            const v = entered[r.key] ?? "";
            return (
              <label key={r.key} className={cn("flex items-center gap-3 rounded-2xl border p-3", v !== "" ? "border-brand/30 bg-brand-soft/40" : "border-line bg-surface")}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-fg">{r.name}</span>
                  {r.counted && <span className="block text-xs text-muted">Last counted {qtyText(r.counted.qty, r.unit)}</span>}
                </span>
                <input
                  inputMode="decimal"
                  value={v}
                  onChange={(e) => setEntered((p) => ({ ...p, [r.key]: e.target.value.replace(/[^\d.]/g, "") }))}
                  placeholder="—"
                  aria-label={`${r.name} counted`}
                  className="h-12 w-24 rounded-xl border border-line bg-surface text-center text-lg font-semibold tabular-nums outline-none focus:border-brand focus:ring-2 focus:ring-[var(--cc-ring)]/20"
                />
                <span className="w-10 shrink-0 text-sm text-muted">{r.unit}</span>
              </label>
            );
          })}
          <button type="button" onClick={() => setPicking(true)} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-sm font-semibold text-fg hover:bg-surface-2">
            <Plus className="size-4" /> Add an item to this count
          </button>
        </div>
      )}
    </Sheet>
  );
}
