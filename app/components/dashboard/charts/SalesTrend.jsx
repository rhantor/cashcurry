/* eslint-disable react/prop-types */
"use client";
import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { mkFmt, mkCompact } from "@/utils/dashboard/utils";

/* ── Custom tooltip ── */
function CompareTooltip({ active, payload, label, fmt }) {
  if (!active || !payload?.length) return null;
  const cur  = payload.find(p => p.dataKey === "current");
  const prev = payload.find(p => p.dataKey === "previous");
  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-100 px-3 py-2.5 text-xs min-w-[180px] space-y-1.5">
      <div className="font-semibold text-slate-700">{label}</div>
      {cur && cur.value != null && (
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            {cur.payload?.currentDate ?? "This period"}
          </span>
          <span className="font-bold text-indigo-700">{fmt(cur.value)}</span>
        </div>
      )}
      {prev && prev.value != null && (
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            {prev.payload?.prevDate ?? "Prior period"}
          </span>
          <span className="font-semibold text-slate-500">{fmt(prev.value)}</span>
        </div>
      )}
    </div>
  );
}

export default function SalesTrend({ data = [], compareData, currency = "RM" }) {
  const fmt     = mkFmt(currency);
  const compact = mkCompact();

  const chartData = compareData
    ?? data.map(d => ({ label: d.date, current: d.total, previous: null, currentDate: d.date }));

  const hasComparison =
    Array.isArray(compareData) &&
    compareData.some(d => d.previous != null && d.previous > 0);

  return (
    <div className="h-72">
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={compact}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip content={(props) => <CompareTooltip {...props} fmt={fmt} />} />
          {hasComparison && (
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(value) =>
                value === "previous" ? "Prior period" : "This period"
              }
            />
          )}

          {/* Dashed gray line — prior period */}
          {hasComparison && (
            <Line
              type="monotone"
              dataKey="previous"
              name="previous"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 4, fill: "#94a3b8" }}
            />
          )}

          {/* Solid indigo line — current period */}
          <Line
            type="monotone"
            dataKey="current"
            name="current"
            stroke="#6366f1"
            strokeWidth={2.5}
            dot={{ r: 3, stroke: "#6366f1", fill: "#fff", strokeWidth: 2 }}
            activeDot={{ r: 5, fill: "#6366f1" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
