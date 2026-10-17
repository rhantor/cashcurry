"use client";
import React from "react";
import { Minus, Plus } from "lucide-react";

/**
 * Big minus / value / plus control for entering a quantity.
 *
 * Staff enter these on a phone while holding a clipboard, so tapping beats
 * typing: the buttons are full thumb targets and the field itself is only there
 * for the odd 12.5 kg. `inputMode="decimal"` is what makes a phone open the
 * number pad rather than the full keyboard.
 */
export default function QtyStepper({
  value,
  onChange,
  unit,
  step = 1,
  min = 0,
  size = "md",
  tone = "default",
}) {
  const num = Number(value || 0);
  const isSet = num > 0;

  const bump = (delta) => {
    const next = Math.max(min, Math.round((num + delta) * 100) / 100);
    onChange(next === 0 ? "" : String(next));
  };

  const btn =
    size === "sm"
      ? "w-11 h-11"
      : "w-12 h-12 sm:w-11 sm:h-11";
  const field = size === "sm" ? "h-11 text-base" : "h-12 sm:h-11 text-lg sm:text-base";

  const ring =
    tone === "warn"
      ? "border-warning/30 bg-warning-soft text-warning"
      : isSet
      ? "border-brand/30 bg-brand-soft text-brand"
      : "border-line bg-surface text-fg";

  return (
    <div className="flex items-stretch gap-1.5 select-none">
      <button
        type="button"
        onClick={() => bump(-step)}
        disabled={num <= min}
        aria-label="Decrease"
        className={`${btn} shrink-0 flex items-center justify-center rounded-xl border border-line
                    bg-surface-2/60 text-muted active:bg-surface-2 disabled:opacity-40
                    disabled:active:bg-surface-2/60 transition-colors`}
      >
        <Minus className="w-5 h-5" />
      </button>

      <div className={`relative flex-1 min-w-[76px]`}>
        <input
          type="text"
          inputMode="decimal"
          value={value ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            // Keep it to digits and a single decimal point — a stray letter here
            // silently becomes NaN further down the line.
            if (v === "" || /^\d*\.?\d*$/.test(v)) onChange(v);
          }}
          placeholder="0"
          className={`w-full ${field} ${ring} border rounded-xl text-center font-bold tabular-nums
                      focus:border-brand focus:ring-2 focus:ring-[var(--cc-ring)]/20 outline-none transition-colors
                      ${unit ? "pr-9" : ""}`}
        />
        {unit && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-subtle pointer-events-none">
            {unit}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => bump(step)}
        aria-label="Increase"
        className={`${btn} shrink-0 flex items-center justify-center rounded-xl border border-brand/30
                    bg-brand-soft text-brand active:bg-brand-soft transition-colors`}
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  );
}
