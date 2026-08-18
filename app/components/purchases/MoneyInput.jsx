/* eslint-disable react/prop-types */
"use client";
import React from "react";

/**
 * Currency field sized for a thumb.
 *
 * `inputMode="decimal"` is the important bit — it opens the phone's number pad
 * instead of the full keyboard, which is the difference between typing a price
 * in one tap and three.
 */
export default function MoneyInput({ value, onChange, currency, label, size = "md" }) {
  const height = size === "sm" ? "min-h-[44px]" : "min-h-[48px]";

  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-slate-500 mb-1.5">{label}</span>}
      <span className="relative block">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400 pointer-events-none">
          {currency}
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={value ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || /^\d*\.?\d*$/.test(v)) onChange(v);
          }}
          placeholder="0.00"
          className={`w-full ${height} pl-11 pr-3 text-[15px] font-bold tabular-nums text-slate-900
                      border border-slate-200 rounded-xl bg-white text-right
                      focus:border-mint-500 focus:ring-2 focus:ring-mint-500/20 outline-none transition-colors`}
        />
      </span>
    </label>
  );
}
