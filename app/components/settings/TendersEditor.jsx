import React from "react";
import { FaCheckCircle, FaTrashAlt, FaTruck, FaUniversity, FaCalculator } from "react-icons/fa";

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
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
        <p className="text-sm font-semibold text-slate-600 mb-3 uppercase tracking-wider">Quick Add Payment Methods</p>
        <div className="flex flex-wrap gap-2">
          {quickAddPresets.map((p) => {
            const exists = tenders.some((t) => t.key === p.key);
            return (
              <button
                key={p.key}
                type="button"
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                  exists 
                    ? "bg-white border-slate-200 text-slate-400 cursor-not-allowed opacity-60" 
                    : "bg-white border-mint-200 text-mint-700 hover:bg-mint-50 hover:border-mint-300 shadow-sm"
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
                {exists ? <FaCheckCircle className="text-mint-400" /> : "+"} {p.label}
              </button>
            );
          })}
          
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-all shadow-sm"
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
                ? "bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-mint-300" 
                : "bg-slate-50 border-slate-200 opacity-70"
            }`}
          >
            {/* Header: Label & Key */}
            <div className="flex justify-between items-start mb-4">
              <div className="w-full mr-4">
                <input
                  className="w-full bg-transparent text-lg font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-b-2 focus:border-mint-500 pb-1 mb-1 transition-all"
                  value={t.label}
                  onChange={(e) => update(idx, { label: e.target.value })}
                  placeholder="Method Label (e.g. Card)"
                  disabled={!canEdit}
                />
                <input
                  className="w-full text-xs font-mono text-slate-500 bg-transparent focus:outline-none focus:border-b focus:border-slate-300"
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
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-mint-500"></div>
              </label>
            </div>

            {/* Toggle Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Include in Total Toggle */}
              <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer select-none transition-colors ${t.includeInTotal ? 'bg-mint-50/50 border-mint-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'}`}>
                <input
                  type="checkbox"
                  className="w-4 h-4 text-mint-600 border-slate-300 rounded focus:ring-mint-500"
                  checked={!!t.includeInTotal}
                  onChange={(e) => update(idx, { includeInTotal: e.target.checked })}
                  disabled={!canEdit}
                />
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <FaCalculator className={t.includeInTotal ? 'text-mint-500' : 'text-slate-400'} size={11} /> 
                  Count in Total
                </div>
              </label>

              {/* Settles to Bank Toggle */}
              <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer select-none transition-colors ${t.banked ? 'bg-sky-50/50 border-sky-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'}`}>
                <input
                  type="checkbox"
                  className="w-4 h-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                  checked={!!t.banked}
                  onChange={(e) => update(idx, { banked: e.target.checked })}
                  disabled={!canEdit}
                />
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <FaUniversity className={t.banked ? 'text-sky-500' : 'text-slate-400'} size={11} /> 
                  Sent to Bank
                </div>
              </label>

              {/* Delivery Toggle */}
              <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer select-none transition-colors col-span-2 ${t.delivery ? 'bg-orange-50/50 border-orange-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'}`}>
                <input
                  type="checkbox"
                  className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500"
                  checked={!!t.delivery}
                  onChange={(e) => update(idx, { delivery: e.target.checked })}
                  disabled={!canEdit}
                />
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                  <FaTruck className={t.delivery ? 'text-orange-500' : 'text-slate-400'} size={11} /> 
                  Delivery Platform (Grab/Foodpanda logic)
                </div>
              </label>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-between items-center border-t border-slate-100 pt-3">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 text-slate-600 border-slate-300 rounded focus:ring-slate-500"
                  checked={!!t.requireProof}
                  onChange={(e) => update(idx, { requireProof: e.target.checked })}
                  disabled={!canEdit}
                />
               Requires Photo Proof
              </label>

              <button
                type="button"
                className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                onClick={() => remove(idx)}
                disabled={!canEdit}
                title="Delete this payment method"
              >
                <FaTrashAlt size={13} />
              </button>
            </div>
          </div>
        ))}

        {tenders.length === 0 && (
          <div className="col-span-1 md:col-span-2 p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
            No payment methods found. Use the quick add buttons above!
          </div>
        )}
      </div>
    </div>
  );
}
