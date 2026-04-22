/* eslint-disable react/prop-types */
"use client";
import React from "react";
import { byDateKey } from "@/utils/dashboard/utils";

const Filters = ({ filter, setFilter }) => {
  const now = new Date();

  const k             = (d) => (d ? byDateKey(d) : "");
  const todayKey      = k(now);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const last7Start    = new Date(+now - 6 * 864e5);
  const last30Start   = new Date(+now - 29 * 864e5);

  const fromKey = k(filter.from);
  const toKey   = k(filter.to);

  const isThisMonth = fromKey === k(thisMonthStart) && toKey === todayKey;
  const isLast7     = fromKey === k(last7Start)     && toKey === todayKey;
  const isLast30    = fromKey === k(last30Start)    && toKey === todayKey;

  const apply = (preset) => {
    const nowLocal = new Date();
    if (preset === "week") {
      setFilter({ from: new Date(+nowLocal - 6 * 864e5), to: nowLocal, preset: "week" });
    } else if (preset === "days30") {
      setFilter({ from: new Date(+nowLocal - 29 * 864e5), to: nowLocal, preset: "days30" });
    } else {
      setFilter({
        from: new Date(nowLocal.getFullYear(), nowLocal.getMonth(), 1),
        to:   nowLocal,
        preset: "month",
      });
    }
  };

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
        value={fromKey}
        onChange={(e) =>
          setFilter((p) => ({ ...p, from: new Date(e.target.value), preset: "custom" }))
        }
      />
      <input
        type="date"
        className="px-3 py-2 rounded-xl bg-white/80 shadow text-sm"
        value={toKey}
        onChange={(e) =>
          setFilter((p) => ({ ...p, to: new Date(e.target.value + "T23:59:59"), preset: "custom" }))
        }
      />

      <span className="ml-1 text-xs px-2 py-1 rounded-full bg-black/5">
        {fromKey || "—"} → {toKey || "—"}
      </span>
    </div>
  );
};

export default Filters;
