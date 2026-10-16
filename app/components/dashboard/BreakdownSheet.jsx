"use client";
import { motion } from "framer-motion";
import { Sheet, Stagger } from "@/app/components/ui";

/**
 * A company figure split by branch, in a bottom sheet: each branch's amount
 * and a bar for its share of the largest. rows: [{ name, value }].
 */
export default function BreakdownSheet({ open, onClose, title, rows = [], format }) {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...sorted.map((r) => Math.abs(r.value)));
  const total = sorted.reduce((n, r) => n + r.value, 0);
  return (
    <Sheet open={open} onClose={onClose} title={title} description="By branch">
      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No branches yet.</p>
      ) : (
        <Stagger as="ul" gap={0.04} className="space-y-3">
          {sorted.map((r) => (
            <Stagger.Item as="li" key={r.name}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium text-fg">{r.name}</span>
                <span className="shrink-0 font-semibold tabular-nums text-fg">{format(r.value)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <motion.div
                  className={r.value < 0 ? "h-full rounded-full bg-warning" : "h-full rounded-full bg-brand"}
                  initial={{ width: 0 }}
                  animate={{ width: `${(Math.abs(r.value) / max) * 100}%` }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </Stagger.Item>
          ))}
          <li className="flex items-baseline justify-between border-t border-line pt-3 text-sm">
            <span className="font-semibold text-muted">Total</span>
            <span className="font-bold tabular-nums text-fg">{format(total)}</span>
          </li>
        </Stagger>
      )}
    </Sheet>
  );
}
