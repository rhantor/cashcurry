"use client";
import React from "react";

const VARIANTS = {
  green:  { card: "bg-emerald-50 border border-emerald-100",  dot: "bg-emerald-500", value: "text-emerald-700", label: "text-emerald-600/70", sub: "text-emerald-500/60" },
  blue:   { card: "bg-blue-50 border border-blue-100",         dot: "bg-blue-500",    value: "text-blue-700",   label: "text-blue-600/70",   sub: "text-blue-500/60"   },
  indigo: { card: "bg-indigo-50 border border-indigo-100",     dot: "bg-indigo-500",  value: "text-indigo-700", label: "text-indigo-600/70", sub: "text-indigo-500/60" },
  rose:   { card: "bg-rose-50 border border-rose-100",         dot: "bg-rose-500",    value: "text-rose-700",   label: "text-rose-600/70",   sub: "text-rose-500/60"   },
  amber:  { card: "bg-amber-50 border border-amber-100",       dot: "bg-amber-500",   value: "text-amber-700",  label: "text-amber-600/70",  sub: "text-amber-500/60"  },
  orange: { card: "bg-orange-50 border border-orange-100",     dot: "bg-orange-500",  value: "text-orange-700", label: "text-orange-600/70", sub: "text-orange-500/60" },
  slate:  { card: "bg-white border border-slate-100",          dot: "bg-slate-400",   value: "text-slate-800",  label: "text-slate-500",     sub: "text-slate-400"     },
};

export default function KPICard({ title, value, sub, color = "slate" }) {
  const v = VARIANTS[color] ?? VARIANTS.slate;
  return (
    <div className={`rounded-2xl shadow-sm hover:shadow-md transition-shadow p-4 ${v.card}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-2 w-2 rounded-full shrink-0 ${v.dot}`} />
        <span className={`text-xs font-semibold uppercase tracking-wide ${v.label}`}>
          {title}
        </span>
      </div>
      <div className={`text-2xl font-bold ${v.value}`}>{value}</div>
      {sub && <div className={`text-xs mt-1 leading-snug ${v.sub}`}>{sub}</div>}
    </div>
  );
}
