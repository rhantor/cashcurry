"use client";
// A bill's total rounded to the nearest 0.05: on by itself, off for an invoice
// that charges the exact sen. Shown only when it would change the total.
import { round5, roundingOf, signedMoney } from "@/lib/purchases/discount";

export default function RoundingRow({ amount, on, onChange, money }) {
  const r = roundingOf(amount);
  if (!r || !(Number(amount) > 0)) return null;
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-surface-2/60 px-3 py-2.5">
      <input type="checkbox" checked={!!on} onChange={(e) => onChange(e.target.checked)} className="size-4 shrink-0 accent-[var(--cc-brand)]" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">Round to the nearest 0.05</span>
        <span className="block text-xs text-muted">
          {on ? `Rounding ${signedMoney(r, money)} · bill is ${money(round5(amount))}` : `Off · bill stays ${money(amount)}`}
        </span>
      </span>
    </label>
  );
}
