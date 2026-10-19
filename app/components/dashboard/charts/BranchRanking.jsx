"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { Tabs, cn } from "@/app/components/ui";
import { COLOR } from "./kit";

const MEASURES = [
  { value: "sales", label: "Sales" },
  { value: "profit", label: "Profit" },
  { value: "margin", label: "Margin" },
];

/**
 * Branches ranked by sales, profit or margin, one row each: place, name, the
 * figure with a bar, and the other two figures underneath. Profit is sales −
 * costs − salaries (the company cards' "operating profit").
 * rows: [{ branchId, name, sales, costs, salaries }].
 */
export default function BranchRanking({ rows = [], format }) {
  const [by, setBy] = useState("sales");
  const list = rows
    .map((r) => {
      const profit = r.sales - (r.costs - (r.notCost || 0)) - r.salaries; // not-a-cost money stays out (4.9)
      return { ...r, profit, margin: r.sales ? (profit / r.sales) * 100 : 0 };
    })
    .sort((a, b) => b[by] - a[by]);
  const max = Math.max(1, ...list.map((r) => Math.abs(r[by])));
  const pct = (v) => `${v.toFixed(1)}%`;
  const show = (r, k) => (k === "margin" ? pct(r.margin) : format(r[k]));

  if (!list.length) return <p className="py-10 text-center text-sm text-muted">No branches yet.</p>;

  return (
    <div>
      <Tabs size="sm" tabs={MEASURES} value={by} onChange={setBy} />
      <ol key={by} className="mt-4 space-y-3">
        {list.map((r, i) => {
          const value = r[by];
          const negative = value < 0;
          return (
            <li key={r.branchId} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  i === 0 ? "bg-brand text-brand-fg" : "bg-surface-2 text-muted"
                )}
              >
                {i === 0 ? <Trophy className="size-3.5" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 truncate text-sm font-semibold text-fg">{r.name}</span>
                  <span className={cn("ml-auto shrink-0 text-sm font-bold tabular-nums", negative ? "text-warning" : "text-fg")}>{show(r, by)}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: negative ? COLOR.out : COLOR.in }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(Math.abs(value) / max) * 100}%` }}
                    transition={{ duration: 0.7, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <p className="mt-1 truncate text-[11px] text-muted">
                  {MEASURES.filter((m) => m.value !== by)
                    .map((m) => `${m.label} ${show(r, m.value)}`)
                    .join(" · ")}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
