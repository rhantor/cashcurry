"use client";
import { Check } from "lucide-react";
import { isActive } from "@/lib/purchases/vendors";

/** Shared field styling — one place so every input keeps a thumb-sized target. */
export const FIELD =
  "w-full min-h-[48px] px-4 text-[15px] border border-line rounded-2xl bg-surface-2/60 " +
  "focus:bg-surface focus:border-brand focus:ring-2 focus:ring-[var(--cc-ring)]/20 outline-none transition-colors";

/**
 * Tappable multi-select.
 *
 * Replaces `<select multiple>`, which needs a Ctrl/Cmd-click to pick more than
 * one row — a gesture that does not exist on a phone or a tablet, so the
 * control was effectively single-select for anyone not at a desk.
 */
function CheckList({ options, selected = [], onToggle, empty = "Nothing to choose from" }) {
  if (!options.length) {
    return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  }
  return (
    <div className="rounded-2xl border border-line divide-y divide-line max-h-56 overflow-y-auto">
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onToggle(o.id)}
            className={`w-full flex items-center gap-3 p-3.5 text-left transition-colors ${
              on ? "bg-brand-soft/60" : "active:bg-surface-2/60"
            }`}
          >
            <span
              className={`w-6 h-6 rounded-lg border-2 shrink-0 flex items-center justify-center transition-colors ${
                on ? "bg-brand border-brand" : "border-line bg-surface"
              }`}
            >
              {on && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-fg truncate">{o.label}</span>
              {o.hint && <span className="block text-xs text-muted mt-0.5">{o.hint}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}


/**
 * Picks which branches stock an item.
 *
 * Selecting nothing stores an empty list, which every screen reads as "all
 * branches" — the same shape items written before branch scoping have.
 */
function BranchPicker({ branches, selected = [], onChange }) {
  const all = selected.length === 0;

  const toggle = (id) => {
    // Coming off "all branches" has to start from the full list, otherwise
    // unticking one branch would silently drop every other one too.
    const base = all ? branches.map((b) => b.id) : selected;
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    onChange(next.length === branches.length ? [] : next);
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-fg mb-1.5">Stocked at</label>
      <div className="rounded-2xl border border-line divide-y divide-line max-h-56 overflow-y-auto">
        <button
          type="button"
          onClick={() => onChange([])}
          className={`w-full flex items-center gap-3 p-3.5 text-left transition-colors ${
            all ? "bg-brand-soft/60" : "active:bg-surface-2/60"
          }`}
        >
          <span
            className={`w-6 h-6 rounded-lg border-2 shrink-0 flex items-center justify-center transition-colors ${
              all ? "bg-brand border-brand" : "border-line bg-surface"
            }`}
          >
            {all && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
          </span>
          <span className="text-[15px] font-semibold text-fg">All branches</span>
        </button>
        {branches.map((b) => {
          const on = all || selected.includes(b.id);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => toggle(b.id)}
              className={`w-full flex items-center gap-3 p-3.5 text-left transition-colors ${
                on ? "bg-brand-soft/60" : "active:bg-surface-2/60"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-lg border-2 shrink-0 flex items-center justify-center transition-colors ${
                  on ? "bg-brand border-brand" : "border-line bg-surface"
                }`}
              >
                {on && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
              </span>
              <span className="text-[15px] text-fg min-w-0 truncate">
                {b.name || b.id}
                {b.code ? <span className="text-subtle ml-1.5">{b.code}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted mt-1.5">
        Only these branches see the item when ordering. Leave it on “All branches” if everyone carries it.
      </p>
    </div>
  );
}

/** Shared body of the add and edit sheets. */
export default function ItemFields({ form, setForm, vendors, branches, categories }) {
  const patch = (p) => setForm((f) => ({ ...f, ...p }));

  const toggleVendor = (id) => {
    const current = form.vendorIds || [];
    patch({ vendorIds: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-fg mb-1.5">Item name</label>
        <input
          value={form.name || ""}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="e.g. Tomato"
          className={FIELD}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-fg mb-1.5">Category</label>
        <input
          list="cat-list"
          value={form.category || ""}
          onChange={(e) => patch({ category: e.target.value })}
          placeholder="e.g. Groceries"
          className={FIELD}
        />
        <datalist id="cat-list">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-fg mb-1.5">Unit</label>
          <input
            value={form.unit || ""}
            onChange={(e) => patch({ unit: e.target.value })}
            placeholder="Kg, Pcs, Box"
            className={FIELD}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-fg mb-1.5">Usual price</label>
          <input
            type="text"
            inputMode="decimal"
            value={form.defaultPrice ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^\d*\.?\d*$/.test(v)) patch({ defaultPrice: v });
            }}
            placeholder="0.00"
            className={`${FIELD} text-right font-bold tabular-nums`}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-fg mb-1.5">Suppliers</label>
        <CheckList
          options={vendors.filter((v) => isActive(v) || (form.vendorIds || []).includes(v.id)).map((v) => ({ id: v.id, label: v.name }))}
          selected={form.vendorIds || []}
          onToggle={toggleVendor}
          empty="No suppliers added yet."
        />
        <p className="text-xs text-muted mt-1.5">
          Leave all unticked if any supplier can provide this item.
        </p>
      </div>

      {branches.length > 1 && (
        <BranchPicker
          branches={branches}
          selected={form.branchIds || []}
          onChange={(branchIds) => patch({ branchIds })}
        />
      )}
    </div>
  );
}
