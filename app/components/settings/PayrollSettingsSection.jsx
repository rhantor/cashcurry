/* eslint-disable react/prop-types */
"use client";
import React, { useState } from "react";
import { nanoid } from "nanoid";

const BASIS_OPTIONS = [
  { value: "basic", label: "Basic Salary" },
  { value: "gross", label: "Gross Earnings" },
  { value: "capped", label: "Capped Amount" },
];

const EMPTY_DED = () => ({
  key: nanoid(8),
  name: "",
  employeeRate: "",
  employerRate: "",
  basis: "basic",
  capAmount: "",
  enabled: true,
});

function DeductionRow({ ded, onChange, onDelete }) {
  return (
    <div className="grid grid-cols-12 gap-2 items-start py-3 border-b border-gray-100 last:border-0">
      {/* Enabled toggle */}
      <div className="col-span-1 flex items-center pt-1">
        <input
          type="checkbox"
          checked={ded.enabled}
          onChange={e => onChange({ ...ded, enabled: e.target.checked })}
          className="w-4 h-4 accent-mint-600"
        />
      </div>

      {/* Name */}
      <div className="col-span-3">
        <input
          type="text"
          value={ded.name}
          onChange={e => onChange({ ...ded, name: e.target.value })}
          placeholder="e.g. EPF / PF"
          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-mint-400 outline-none"
        />
      </div>

      {/* Employee % */}
      <div className="col-span-2">
        <div className="relative">
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={ded.employeeRate}
            onChange={e => onChange({ ...ded, employeeRate: e.target.value })}
            placeholder="0"
            className="w-full border border-gray-200 rounded-lg pl-2 pr-6 py-1.5 text-sm focus:ring-2 focus:ring-mint-400 outline-none"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
        </div>
      </div>

      {/* Employer % */}
      <div className="col-span-2">
        <div className="relative">
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={ded.employerRate}
            onChange={e => onChange({ ...ded, employerRate: e.target.value })}
            placeholder="0"
            className="w-full border border-gray-200 rounded-lg pl-2 pr-6 py-1.5 text-sm focus:ring-2 focus:ring-mint-400 outline-none"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
        </div>
      </div>

      {/* Basis */}
      <div className="col-span-2">
        <select
          value={ded.basis}
          onChange={e => onChange({ ...ded, basis: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-mint-400 outline-none"
        >
          {BASIS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Cap */}
      <div className="col-span-1">
        {ded.basis === "capped" ? (
          <input
            type="number"
            min="0"
            value={ded.capAmount}
            onChange={e => onChange({ ...ded, capAmount: e.target.value })}
            placeholder="Cap"
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-mint-400 outline-none"
          />
        ) : (
          <span className="text-xs text-gray-300 pl-2">—</span>
        )}
      </div>

      {/* Delete */}
      <div className="col-span-1 flex justify-center pt-1">
        <button
          type="button"
          onClick={onDelete}
          className="text-red-400 hover:text-red-600 text-sm font-bold"
          title="Remove"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function PayrollSettingsSection({ form, setForm }) {
  const payroll = form?.payroll || {};

  function set(key, value) {
    setForm(f => ({ ...f, payroll: { ...(f.payroll || {}), [key]: value } }));
  }

  const deductions = payroll.statutoryDeductions || [];

  function updateDed(index, updated) {
    const next = deductions.map((d, i) => (i === index ? updated : d));
    set("statutoryDeductions", next);
  }

  function deleteDed(index) {
    set("statutoryDeductions", deductions.filter((_, i) => i !== index));
  }

  function addDed() {
    set("statutoryDeductions", [...deductions, EMPTY_DED()]);
  }

  return (
    <div className="space-y-8">

      {/* ── Default Pay Settings ───────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
          Default Pay Settings
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Default mode */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Default Pay Mode
            </label>
            <select
              value={payroll.defaultMode || "hours"}
              onChange={e => set("defaultMode", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-mint-400 outline-none"
            >
              <option value="hours">Hours-based</option>
              <option value="days">Days-based</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Can be overridden per staff member.
            </p>
          </div>

          {/* Standard hours */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Standard Hours / Month
            </label>
            <input
              type="number"
              min="1"
              value={payroll.defaultStandardHours ?? 208}
              onChange={e => set("defaultStandardHours", Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-mint-400 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">Used when pay mode is Hours.</p>
          </div>

          {/* Working days */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Working Days / Month
            </label>
            <input
              type="number"
              min="1"
              value={payroll.defaultWorkingDays ?? 26}
              onChange={e => set("defaultWorkingDays", Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-mint-400 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">Used when pay mode is Days.</p>
          </div>

          {/* OT multiplier */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              OT Rate Multiplier
            </label>
            <input
              type="number"
              min="1"
              step="0.25"
              value={payroll.otMultiplier ?? 1.5}
              onChange={e => set("otMultiplier", parseFloat(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-mint-400 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              e.g. 1.5 = time-and-a-half. Applied to hourly rate.
            </p>
          </div>

          {/* PH multiplier */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Public Holiday Multiplier
            </label>
            <input
              type="number"
              min="1"
              step="0.25"
              value={payroll.phMultiplier ?? 2.0}
              onChange={e => set("phMultiplier", parseFloat(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-mint-400 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              e.g. 2.0 = double pay on public holidays.
            </p>
          </div>
        </div>
      </div>

      {/* ── Statutory Deductions ───────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Statutory Deductions
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Configure contributions for your country (EPF, SOCSO, PF, etc.).
              Each entry applies to all staff unless overridden individually.
            </p>
          </div>
          <button
            type="button"
            onClick={addDed}
            className="px-3 py-1.5 rounded-lg bg-mint-100 hover:bg-mint-200 text-mint-700 text-sm font-medium"
          >
            + Add
          </button>
        </div>

        {deductions.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
            No statutory deductions configured.
            <br />
            <button
              type="button"
              onClick={addDed}
              className="mt-2 text-mint-600 hover:underline text-sm"
            >
              Add your first deduction
            </button>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
              <div className="col-span-1">On</div>
              <div className="col-span-3">Name</div>
              <div className="col-span-2">Emp %</div>
              <div className="col-span-2">Employer %</div>
              <div className="col-span-2">Basis</div>
              <div className="col-span-1">Cap</div>
              <div className="col-span-1"></div>
            </div>
            <div className="px-3">
              {deductions.map((d, i) => (
                <DeductionRow
                  key={d.key}
                  ded={d}
                  onChange={updated => updateDed(i, updated)}
                  onDelete={() => deleteDed(i)}
                />
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-3">
          <strong>Basis:</strong> Basic Salary = rate applied to basic only.
          Gross = applied to all earnings. Capped = applied up to the cap amount.
        </p>
      </div>
    </div>
  );
}
