import React from "react";
import { CircleCheck, Trash2, Truck, Landmark, Calculator } from "lucide-react";

export default function TendersEditor({ value = [], onChange, can }) {
  const tenders = [...value].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const commit = (arr) => onChange(arr.map((t, i) => ({ ...t, order: i + 1 })));
  const update = (idx, patch) => {
    const arr = [...tenders];
    arr[idx] = { ...arr[idx], ...patch };
    commit(arr);
  };
  const remove = (idx) => commit(tenders.filter((_, i) => i !== idx));

  const canEdit = can("tenders");

  // Replaces the basic button grid
  const quickAddPresets = [
    { key: "cash", label: "Cash", banked: false, delivery: false },
    { key: "card", label: "Card", banked: true, delivery: false },
    { key: "qr", label: "QR Code", banked: true, delivery: false },
    { key: "grab", label: "Grab (Delivery)", banked: true, delivery: true },
    { key: "foodpanda", label: "Foodpanda", banked: true, delivery: true },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Add Section */}
      <div className="bg-surface-2/60 p-4 rounded-2xl border border-line mb-6">
        <p className="text-sm font-semibold text-muted mb-3 uppercase tracking-wider">Quick Add Payment Methods</p>
        <div className="flex flex-wrap gap-2">
          {quickAddPresets.map((p) => {
            const exists = tenders.some((t) => t.key === p.key);
            return (
              <button
                key={p.key}
                type="button"
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                  exists 
                    ? "bg-surface border-line text-subtle cursor-not-allowed opacity-60" 
                    : "bg-surface border-brand/30 text-brand hover:bg-brand-soft hover:border-brand/30 shadow-sm"
                }`}
                disabled={!canEdit || exists}
                onClick={() => {
                  if (exists) return;
                  commit([
                    ...tenders,
                    {
                      key: p.key,
                      label: p.label,
                      enabled: true,
                      includeInTotal: true,
                      requireProof: false,
                      banked: !!p.banked,
                      delivery: !!p.delivery,
                      order: tenders.length + 1,
                    },
                  ]);
                }}
              >
                {exists ? <CircleCheck size="1em" className="text-brand" /> : "+"} {p.label}
              </button>
            );
          })}
          
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl bg-fg border border-fg px-4 py-2 text-sm font-medium text-bg hover:opacity-90 transition-all shadow-sm"
            disabled={!canEdit}
            onClick={() =>
              commit([
                ...tenders,
                {
                  key: `custom_${tenders.length + 1}`,
                  label: `Custom Method`,
                  enabled: true,
                  includeInTotal: true,
                  requireProof: false,
                  banked: false,
                  delivery: false,
                  order: tenders.length + 1,
                },
              ])
            }
          >
            + Custom Tenders
          </button>
        </div>
      </div>

      {/* Tenders Grid - Replacing old table row design */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tenders.map((t, idx) => (
          <div
            key={t.key + idx}
            className={`p-5 rounded-2xl border transition-all duration-200 ${
              t.enabled 
                ? "bg-surface border-line shadow-sm hover:shadow-md hover:border-brand/30" 
                : "bg-surface-2/60 border-line opacity-70"
            }`}
          >
            {/* Header: Label & Key */}
            <div className="flex justify-between items-start mb-4">
              <div className="w-full mr-4">
                <input
                  className="w-full bg-transparent text-lg font-bold text-fg placeholder:text-subtle focus:outline-none focus:border-b-2 focus:border-brand pb-1 mb-1 transition-all"
                  value={t.label}
                  onChange={(e) => update(idx, { label: e.target.value })}
                  placeholder="Method Label (e.g. Card)"
                  disabled={!canEdit}
                />
                <input
                  className="w-full text-xs font-mono text-muted bg-transparent focus:outline-none focus:border-b focus:border-line"
                  value={t.key}
                  onChange={(e) => update(idx, { key: e.target.value.trim().toLowerCase() })}
                  placeholder="internal_key"
                  disabled={!canEdit}
                />
              </div>

              {/* Status Toggle (Enabled) */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={!!t.enabled}
                  onChange={(e) => update(idx, { enabled: e.target.checked })}
                  disabled={!canEdit}
                />
                <div className="w-11 h-6 bg-surface-2 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
              </label>
            </div>

            {/* Toggle Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Include in Total Toggle */}
              <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer select-none transition-colors ${t.includeInTotal ? 'bg-brand-soft/50 border-brand/30' : 'bg-surface-2/60 hover:bg-surface-2 border-line'}`}>
                <input
                  type="checkbox"
                  className="w-4 h-4 text-brand border-line rounded focus:ring-[var(--cc-ring)]"
                  checked={!!t.includeInTotal}
                  onChange={(e) => update(idx, { includeInTotal: e.target.checked })}
                  disabled={!canEdit}
                />
                <div className="flex items-center gap-1.5 text-xs font-medium text-fg">
                  <Calculator className={t.includeInTotal ? 'text-brand' : 'text-subtle'} size={11} /> 
                  Count in Total
                </div>
              </label>

              {/* Settles to Bank Toggle */}
              <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer select-none transition-colors ${t.banked ? 'bg-brand-soft/50 border-brand/30' : 'bg-surface-2/60 hover:bg-surface-2 border-line'}`}>
                <input
                  type="checkbox"
                  className="w-4 h-4 text-brand border-line rounded focus:ring-[var(--cc-ring)]"
                  checked={!!t.banked}
                  onChange={(e) => update(idx, { banked: e.target.checked })}
                  disabled={!canEdit}
                />
                <div className="flex items-center gap-1.5 text-xs font-medium text-fg">
                  <Landmark className={t.banked ? 'text-brand' : 'text-subtle'} size={11} /> 
                  Sent to Bank
                </div>
              </label>

              {/* Delivery Toggle */}
              <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer select-none transition-colors col-span-2 ${t.delivery ? 'bg-warning-soft/50 border-warning/30' : 'bg-surface-2/60 hover:bg-surface-2 border-line'}`}>
                <input
                  type="checkbox"
                  className="w-4 h-4 text-warning border-line rounded focus:ring-orange-500"
                  checked={!!t.delivery}
                  onChange={(e) => update(idx, { delivery: e.target.checked })}
                  disabled={!canEdit}
                />
                <div className="flex items-center gap-1.5 text-xs font-medium text-fg">
                  <Truck className={t.delivery ? 'text-orange-500' : 'text-subtle'} size={11} /> 
                  Delivery Platform (Grab/Foodpanda logic)
                </div>
              </label>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-between items-center border-t border-line pt-3">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-muted">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 text-muted border-line rounded focus:ring-[var(--cc-ring)]"
                  checked={!!t.requireProof}
                  onChange={(e) => update(idx, { requireProof: e.target.checked })}
                  disabled={!canEdit}
                />
               Requires Photo Proof
              </label>

              <button
                type="button"
                className="text-red-400 hover:text-danger p-1.5 hover:bg-danger-soft rounded-lg transition-colors cursor-pointer"
                onClick={() => remove(idx)}
                disabled={!canEdit}
                title="Delete this payment method"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}

        {tenders.length === 0 && (
          <div className="col-span-1 md:col-span-2 p-8 text-center text-subtle border-2 border-dashed border-line rounded-2xl">
            No payment methods found. Use the quick add buttons above!
          </div>
        )}
      </div>
    </div>
  );
}
