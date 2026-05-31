"use client";
import React from "react";

const VARIANTS = {
  green:  "bg-emerald-500",
  blue:   "bg-blue-500",
  indigo: "bg-indigo-500",
  rose:   "bg-rose-500",
  amber:  "bg-amber-500",
  orange: "bg-orange-500",
  slate:  "bg-slate-400",
};

export default function KPICard({ title, value, sub, color = "slate", breakdown }) {
  const dotColor = VARIANTS[color] ?? VARIANTS.slate;
  return (
    <div className="relative group rounded-3xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-slate-100/60 transition-all duration-300 p-5 transform hover:-translate-y-0.5">
      <div className="flex items-center gap-2.5 mb-2.5">
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${dotColor} shadow-sm`} />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
      </div>
      <div className="text-[1.7rem] font-bold text-slate-800 tracking-tight leading-none">{value}</div>
      {sub && <div className="text-xs mt-2 leading-snug text-slate-400 font-medium">{sub}</div>}
      
      {breakdown && breakdown.length > 0 && (
        <div className="absolute top-full left-0 mt-2 w-full z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 bg-white/95 backdrop-blur-md border border-slate-200/60 shadow-xl rounded-2xl p-4 text-sm">
           <div className="font-semibold text-slate-800 mb-3 border-b border-slate-100 pb-1.5">Branch Breakdown</div>
           <div className="space-y-1.5">
             {breakdown.map((b, i) => (
               <div key={i} className="flex justify-between items-center">
                 <span className="text-slate-500 truncate mr-2 font-medium">{b.label}</span>
                 <span className="font-semibold text-slate-800">{b.value}</span>
               </div>
             ))}
           </div>
        </div>
      )}
    </div>
  );
}
