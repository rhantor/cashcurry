"use client";
import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "./cn";
import { spring } from "./motion";

/**
 * Segmented tabs; the highlight slides to the chosen one.
 * tabs: [{ value, label, icon? }]
 */
export default function Tabs({ tabs, value, onChange, className, size = "md" }) {
  const group = useId(); // keeps two Tabs on one page from sharing the highlight
  return (
    <div role="tablist" className={cn("inline-flex rounded-xl bg-surface-2 p-1", className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange?.(t.value)}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-colors",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
              active ? "text-fg" : "text-muted hover:text-fg"
            )}
          >
            {active && (
              <motion.span
                layoutId={`tab-${group}`}
                transition={spring.snappy}
                className="absolute inset-0 rounded-lg bg-surface shadow-card"
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {Icon && <Icon className="size-4" aria-hidden="true" />}
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
