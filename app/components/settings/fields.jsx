// The settings screens' building blocks, on the UI kit: a labelled row, text /
// number / long-text fields, an on/off switch and a section card. Every
// settings section uses these, so they set the look for all of them.
import React, { useId } from "react";
import { Lock } from "lucide-react";
import { Card, Input, Switch, Textarea, cn } from "@/app/components/ui";
import MoneyInput from "@/app/components/entry/MoneyInput";

export const FieldRow = ({ label, hint, children }) => (
  <div className="space-y-1.5">
    <div className="flex flex-wrap items-baseline gap-x-2">
      <label className="text-xs font-semibold text-muted">{label}</label>
      {hint ? <span className="text-[11px] text-subtle">{hint}</span> : null}
    </div>
    {children}
  </div>
);

export const TextField = ({ value, onChange, disabled, placeholder, type = "text" }) => (
  <Input type={type} value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} disabled={disabled} className="disabled:opacity-70" />
);

export const NumberField = ({ value, onChange, disabled, step = 1, placeholder }) => (
  <Input
    type="number"
    inputMode="decimal"
    step={step}
    value={value ?? ""}
    onChange={(e) => onChange?.(Number(e.target.value))}
    placeholder={placeholder}
    disabled={disabled}
    className="tabular-nums disabled:opacity-70"
  />
);

export const TextArea = ({ value, onChange, disabled, rows = 3, placeholder }) => (
  <Textarea rows={rows} value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} disabled={disabled} className="disabled:opacity-70" />
);

export const Toggle = ({ checked, onChange, disabled, label }) => <Switch checked={!!checked} onChange={(v) => onChange?.(v)} disabled={disabled} label={label} />;

export const SectionCard = ({ title, subtitle, children, className }) => (
  <Card className={cn("p-5", className)}>
    <div className="mb-4">
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
    </div>
    {children}
  </Card>
);

// ── the redesign's blocks (Branch, Money, Payment methods, Approvals & limits) ──

/** A group of settings: a title, then rows divided by lines. */
export const SettingsCard = ({ title, note, children, className }) => (
  <Card className={cn("overflow-hidden p-0", className)}>
    {(title || note) && (
      <div className="px-4 pb-3 pt-4 sm:px-5">
        {title && <h3 className="text-[15px] font-bold text-fg">{title}</h3>}
        {note && <div className="mt-1 text-sm text-muted">{note}</div>}
      </div>
    )}
    <div className="divide-y divide-line border-t border-line">{children}</div>
  </Card>
);

/**
 * One setting: its name and what it does on the left, a small control on the
 * right (stacked on a phone). `children({ id })` gets the id for the control.
 */
export function SettingRow({ label, hint, width = "sm:grid-cols-[minmax(0,1fr)_12rem]", children }) {
  const id = useId();
  return (
    <div className={cn("grid items-center gap-x-5 gap-y-2 px-4 py-3.5 sm:px-5", width)}>
      <label htmlFor={id} className="block min-w-0">
        <span className="block text-sm font-semibold text-fg">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-muted">{hint}</span>}
      </label>
      <div className="min-w-0">{children({ id })}</div>
    </div>
  );
}

/** An amount in the branch's money, kept as a number. */
export const MoneyField = ({ id, value, onChange, currency, disabled }) => (
  <MoneyInput
    id={id}
    size="sm"
    currency={currency}
    value={value == null || value === "" ? "" : Number(value).toFixed(2)}
    onValueChange={(s) => onChange?.(s === "" ? 0 : Number(s))}
    disabled={disabled}
  />
);

/** Why this can't be changed by you. */
export const LockedNote = ({ children }) => (
  <p className="flex items-start gap-2 bg-surface-2 px-4 py-3 text-[13px] text-muted sm:px-5">
    <Lock className="mt-0.5 size-3.5 shrink-0" />
    <span>{children}</span>
  </p>
);
