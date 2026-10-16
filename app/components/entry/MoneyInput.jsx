"use client";
import { useRef } from "react";
import { NumericFormat } from "react-number-format";
import { currencyInfo } from "@/lib/region/currency";
import { cn } from "@/app/components/ui";

/**
 * An amount field: the currency sign in front, thousands separators while
 * typing, two decimals at most, never negative, the number keypad on phones.
 * `onValueChange` gets the plain string ("1234.5"), "" when empty.
 */
export default function MoneyInput({ value, onValueChange, currency, invalid, size = "lg", className, ...rest }) {
  const sign = currencyInfo(currency).symbol;
  const fresh = useRef(false);
  const lg = size === "lg";
  return (
    <div className={cn("relative", className)}>
      <span
        className={cn(
          "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-subtle",
          lg ? "text-sm" : "text-xs"
        )}
      >
        {sign}
      </span>
      <NumericFormat
        value={value ?? ""}
        thousandSeparator
        decimalScale={2}
        allowNegative={false}
        inputMode="decimal"
        placeholder="0.00"
        aria-invalid={invalid || undefined}
        onValueChange={(v) => onValueChange?.(v.value)}
        // Select the old amount so typing replaces it. A tap places the caret
        // when the finger lifts, so select again then (only for that first tap).
        onFocus={(e) => {
          fresh.current = true;
          e.target.select();
        }}
        onMouseUp={(e) => {
          if (!fresh.current) return;
          fresh.current = false;
          e.preventDefault();
          e.currentTarget.select();
        }}
        className={cn(
          "w-full rounded-xl border bg-surface pr-3.5 text-right font-semibold tabular-nums text-fg outline-none transition placeholder:font-medium placeholder:text-subtle",
          "focus:border-brand focus:ring-4 focus:ring-[var(--cc-ring)] disabled:opacity-60",
          lg ? "h-12 pl-12 text-lg" : "h-10 pl-10 text-sm",
          invalid ? "border-danger" : "border-line"
        )}
        {...rest}
      />
    </div>
  );
}
