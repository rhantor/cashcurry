/* eslint-disable react/prop-types */
import React from "react";
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function OpenHoursEditor({ value = [], onChange, disabled }) {
  const list = value.length
    ? value
    : Array.from({ length: 7 }, (_, i) => ({
        day: i,
        open: "10:00",
        close: "22:00",
        closed: false,
      }));

  const update = (i, patch) => {
    const next = [...list];
    next[i] = { ...next[i], ...patch };
    onChange?.(next);
  };

  return (
    <div className="space-y-2">
      {list.map((d, i) => (
        <div
          key={i}
          className="grid grid-cols-5 items-center gap-2 rounded-xl border border-slate-200 p-3"
        >
          <span className="text-sm font-medium text-slate-700">
            {dayNames[d.day]}
          </span>
          <input
            type="time"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={d.open}
            onChange={(e) => update(i, { open: e.target.value })}
            disabled={disabled || d.closed}
          />
          <input
            type="time"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={d.close}
            onChange={(e) => update(i, { close: e.target.value })}
            disabled={disabled || d.closed}
          />
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={!!d.closed}
              onChange={(e) => update(i, { closed: e.target.checked })}
              disabled={disabled}
            />
            <span className="text-sm text-slate-700">Closed</span>
          </label>
          <div />
        </div>
      ))}
    </div>
  );
}
