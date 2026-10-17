// The settings screens' building blocks, on the UI kit: a labelled row, text /
// number / long-text fields, an on/off switch and a section card. Every
// settings section uses these, so they set the look for all of them.
import React from "react";
import { Card, Input, Switch, Textarea, cn } from "@/app/components/ui";

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
