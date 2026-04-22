/* eslint-disable react/prop-types */
import React from "react";
const baseInput =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 disabled:bg-slate-100 disabled:text-slate-500";

export const FieldRow = ({ label, hint, children }) => (
  <div className="space-y-1">
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </div>
    {children}
  </div>
);

export const TextField = ({
  value,
  onChange,
  disabled,
  placeholder,
  type = "text",
}) => (
  <input
    type={type}
    className={baseInput}
    value={value ?? ""}
    onChange={(e) => onChange?.(e.target.value)}
    placeholder={placeholder}
    disabled={disabled}
  />
);

export const NumberField = ({
  value,
  onChange,
  disabled,
  step = 1,
  placeholder,
}) => (
  <input
    type="number"
    step={step}
    className={baseInput}
    value={value ?? ""}
    onChange={(e) => onChange?.(Number(e.target.value))}
    placeholder={placeholder}
    disabled={disabled}
  />
);

export const TextArea = ({
  value,
  onChange,
  disabled,
  rows = 3,
  placeholder,
}) => (
  <textarea
    rows={rows}
    className={baseInput}
    value={value ?? ""}
    onChange={(e) => onChange?.(e.target.value)}
    placeholder={placeholder}
    disabled={disabled}
  />
);

export const Toggle = ({ checked, onChange, disabled, label }) => (
  <label className="inline-flex items-center gap-2">
    <input
      type="checkbox"
      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
      checked={!!checked}
      onChange={(e) => onChange?.(e.target.checked)}
      disabled={disabled}
    />
    <span className="text-sm text-slate-700">{label}</span>
  </label>
);

export const SectionCard = ({ title, subtitle, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
    </div>
    {children}
  </div>
);
