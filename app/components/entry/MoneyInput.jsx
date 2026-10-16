"use client";
import { useRef } from "react";
import { currencyInfo } from "@/lib/region/currency";
import { cn } from "@/app/components/ui";

const MAX_DIGITS = 13; // up to 99,999,999,999.99

/** "1234.5" → 123450 (cents); "" → null. */
const toCents = (value) => {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};
/** The digits of whatever is in the box, leading zeros dropped ("0.05" → "5", "0.00" → ""). */
export const digitsOf = (text) => String(text).replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_DIGITS);
/** Digits read as cents → the plain amount string ("125" → "1.25"; "" → ""). */
export const amountOf = (digits) => (digits === "" ? "" : (Number(digits) / 100).toFixed(2));

/**
 * An amount field that fills from the cents, like a card terminal or ATM:
 * typing 1, 2, 5 shows 0.01 → 0.12 → 1.25; backspace takes the last digit
 * off. The currency sign sits in front, thousands are grouped the way the
 * branch's country writes them, and phones show the number pad.
 * `value` / `onValueChange` use plain strings ("1.25"), "" when empty.
 */
export default function MoneyInput({ value, onValueChange, currency, invalid, size = "lg", className, ...rest }) {
  const info = currencyInfo(currency);
  const fmt = new Intl.NumberFormat(info.locale || "en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cents = toCents(value);
  const shown = cents == null ? "" : fmt.format(cents / 100);
  const fresh = useRef(false);
  const lg = size === "lg";

  const set = (digits) => onValueChange?.(amountOf(digits));

  // Whatever changed in the box (a digit typed, backspace, select-all and
  // type), the amount is its digits read as cents. Works with every phone
  // keyboard, which don't all report which key was pressed.
  const onChange = (e) => set(digitsOf(e.target.value));

  // A pasted amount is read as written ("50" is fifty, not fifty cents).
  const onPaste = (e) => {
    const text = e.clipboardData.getData("text").replace(/[^\d.]/g, "");
    if (!text) return;
    e.preventDefault();
    const n = Number(text);
    if (Number.isFinite(n)) set(digitsOf(Math.round(n * 100)));
  };

  return (
    <div className={cn("relative", className)}>
      <span
        className={cn(
          "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-subtle",
          lg ? "text-sm" : "text-xs"
        )}
      >
        {info.symbol}
      </span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={fmt.format(0)}
        value={shown}
        onChange={onChange}
        onPaste={onPaste}
        aria-invalid={invalid || undefined}
        // Tapping an amount selects it, so the next digits start a new one.
        // (A tap places the caret when the finger lifts, so select again then.)
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
        onKeyDown={(e) => {
          // New digits always go on the end: keep the caret from moving into the middle.
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            const end = e.currentTarget.value.length;
            e.currentTarget.setSelectionRange(end, end);
          }
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
