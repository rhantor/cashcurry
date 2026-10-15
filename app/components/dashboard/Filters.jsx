"use client";
import React from "react";
import {
  presetFilter,
  filterFromInput,
  filterToInput,
  dayKeyOfFilter,
} from "@/utils/dashboard/dateFilters";
import { useBusinessToday } from "@/app/hooks/useRegion";

const Filters = ({ filter, setFilter }) => {
  // Presets end on today's business date (after the branch's day cut-off).
  const today = useBusinessToday();
  const current = dayKeyOfFilter(filter);
  const isActive = (preset) => {
    const p = dayKeyOfFilter(presetFilter(preset, new Date(), today));
    return current.from === p.from && current.to === p.to;
  };

  const isThisMonth = isActive("month");
  const isLast7     = isActive("week");
  const isLast30    = isActive("days30");

  const apply = (preset) => setFilter(presetFilter(preset, new Date(), today));

  const btnCls = (active) =>
    `px-3 py-2 rounded-xl shadow text-sm transition ${
      active
        ? "bg-black text-white ring-2 ring-black/20"
        : "bg-white/80 hover:bg-white"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className={btnCls(isThisMonth)} aria-pressed={isThisMonth} onClick={() => apply("month")}>
        This Month
      </button>
      <button className={btnCls(isLast7)}     aria-pressed={isLast7}     onClick={() => apply("week")}>
        Last 7 Days
      </button>
      <button className={btnCls(isLast30)}    aria-pressed={isLast30}    onClick={() => apply("days30")}>
        Last 30 Days
      </button>

      {/* Custom range — marks filter as custom so comparison shifts by duration */}
      <input
        type="date"
        className="px-3 py-2 rounded-xl bg-white/80 shadow text-sm"
        value={current.from}
        onChange={(e) =>
          e.target.value &&
          setFilter((p) => ({ ...p, from: filterFromInput(e.target.value), preset: "custom" }))
        }
      />
      <input
        type="date"
        className="px-3 py-2 rounded-xl bg-white/80 shadow text-sm"
        value={current.to}
        onChange={(e) =>
          e.target.value &&
          setFilter((p) => ({ ...p, to: filterToInput(e.target.value), preset: "custom" }))
        }
      />

      <span className="ml-1 text-xs px-2 py-1 rounded-full bg-black/5">
        {current.from || "—"} → {current.to || "—"}
      </span>
    </div>
  );
};

export default Filters;
