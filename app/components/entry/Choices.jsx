"use client";
import { motion } from "framer-motion";
import { Check, Landmark, Wallet } from "lucide-react";
import { cn } from "@/app/components/ui";

/** A pill to pick one of a few options (categories, methods, durations…). */
export function Chip({ on, onClick, children, className, ...rest }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        on ? "border-brand bg-brand text-brand-fg" : "border-line bg-surface text-fg hover:bg-surface-2",
        className
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

/**
 * Big side-by-side choices with an icon, a title and a line under it.
 * options: [{ value, title, note, icon, tone: "brand" | "info" | "warning" }]
 */
export function ChoiceCards({ options, value, onChange, className }) {
  const tones = { brand: "bg-brand-soft text-brand", info: "bg-info-soft text-info", warning: "bg-warning-soft text-warning" };
  return (
    <div className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {options.map((c) => {
        const on = value === c.value;
        const Icon = c.icon;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            aria-pressed={on}
            className={cn(
              "relative flex items-center gap-3 rounded-2xl border p-3.5 text-left transition",
              on ? "border-brand bg-brand-soft/50 ring-4 ring-[var(--cc-ring)]" : "border-line bg-surface hover:bg-surface-2"
            )}
          >
            {Icon && (
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tones[c.tone] || tones.brand)}>
                <Icon className="size-5" />
              </span>
            )}
            <span className="min-w-0 pr-5">
              <span className="block text-sm font-semibold text-fg">{c.title}</span>
              {c.note && <span className="block text-xs text-muted">{c.note}</span>}
            </span>
            {on && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-brand text-brand-fg"
              >
                <Check className="size-3" strokeWidth={3} />
              </motion.span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Where the money came from: the till (front office) or the bank (back office). */
export function PaidFromChoice({ value, onChange, tillNote = "Cash — front office", bankNote = "Transfer — back office", className }) {
  return (
    <ChoiceCards
      className={className}
      value={value}
      onChange={onChange}
      options={[
        { value: "front", title: "From the till", note: tillNote, icon: Wallet, tone: "brand" },
        { value: "back", title: "From the bank", note: bankNote, icon: Landmark, tone: "info" },
      ]}
    />
  );
}
