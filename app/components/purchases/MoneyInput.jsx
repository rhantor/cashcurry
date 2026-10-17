"use client";
import EntryMoneyInput from "@/app/components/entry/MoneyInput";

/**
 * The purchase screens' money field, now the app's: the number pad on a
 * phone, filled from the cents like a card terminal, grouped the way the
 * branch's money is written. Same props as before: value, onChange, currency, label, size.
 */
export default function MoneyInput({ value, onChange, currency, label, size = "md" }) {
  const field = <EntryMoneyInput value={value ?? ""} onValueChange={onChange} currency={currency} size={size === "sm" ? "md" : "lg"} aria-label={label || "Amount"} />;
  if (!label) return field;
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
      {field}
    </label>
  );
}
