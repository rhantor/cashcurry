"use client";
// A discount or voucher on a supplier's bill, often known only when the invoice
// comes. `before` is the bill before it; what it means: lib/purchases/discount.js
import { cn } from "@/app/components/ui";
import MoneyInput from "@/app/components/purchases/MoneyInput";
import RoundingRow from "@/app/components/purchases/RoundingRow";
import { DISCOUNT_KINDS, NO_DISCOUNT, afterDiscount, discountAmount, discountProblem } from "@/lib/purchases/discount";

export default function DiscountField({ value, onChange, before, currency, money, error, round, onRound }) {
  const v = value || NO_DISCOUNT;
  const set = (patch) => onChange({ ...v, ...patch });
  const on = discountAmount(v) > 0;
  const problem = error || (on && Number(before) > 0 ? discountProblem(before, v) : "");
  return (
    <div className="space-y-2.5 rounded-2xl border border-line bg-surface p-3.5">
      <MoneyInput label="Discount or voucher on this bill (optional)" value={v.amount} onChange={(amount) => set({ amount })} currency={currency} size="sm" />
      {on && (
        <>
          <div className="flex flex-wrap gap-2">
            {DISCOUNT_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={v.kind === k}
                onClick={() => set({ kind: k })}
                className={cn("min-h-[40px] rounded-xl border px-4 text-sm font-semibold transition-colors", v.kind === k ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface text-muted")}
              >
                {k}
              </button>
            ))}
          </div>
          <input
            value={v.note}
            onChange={(e) => set({ note: e.target.value })}
            placeholder={v.kind === "Voucher" ? "Voucher number" : "Why, if it says (optional)"}
            aria-label="Discount note"
            className="min-h-[44px] w-full rounded-2xl border border-line bg-surface-2/60 px-4 text-[15px] outline-none transition-colors focus:border-brand focus:bg-surface focus:ring-2 focus:ring-[var(--cc-ring)]/20"
          />
          {!problem && Number(before) > 0 && (
            <p className="text-xs text-muted">
              {money(before)} − {money(discountAmount(v))} = <span className="font-semibold text-fg">{money(afterDiscount(before, v))}</span>
            </p>
          )}
        </>
      )}
      {problem && <p className="text-xs font-medium text-danger">{problem}</p>}
      {onRound && !problem && <RoundingRow amount={afterDiscount(before, v)} on={round} onChange={onRound} money={money} />}
    </div>
  );
}
