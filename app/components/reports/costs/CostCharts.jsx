/* eslint-disable react/prop-types */
"use client";
import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import { formatMoney } from "@/utils/formatMoney";
import useCurrency from "@/app/hooks/useCurrency";

// tiny helper to coerce + format currency
const toNum = (v) => (Number.isFinite(+v) ? +v : 0);

export default function CostCharts({
  rows = [], // filtered costs
  height = 280,
  defaultMode = "daily", // "daily" | "category"
}) {
  const currency = useCurrency();
  const fmt = (n) => formatMoney(n, currency);
  const [mode, setMode] = useState(defaultMode);

  // theme (cost = red)
  const stroke = "#E53E3E";
  const fill = "rgba(229,62,62,0.15)";

  // Daily: sum by date
  const dailyData = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (!r?.date) continue;
      const key = new Date(r.date).toISOString().slice(0, 10); // yyyy-mm-dd
      map.set(key, (map.get(key) || 0) + toNum(r.amount));
    }
    const arr = Array.from(map.entries())
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([d, total]) => ({ d: format(new Date(d), "dd/MM"), total }));
    return arr;
  }, [rows]);

  // Category: sum by category (trim/normalize)
  const categoryData = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const cat = (r?.category || "Uncategorized").trim() || "Uncategorized";
      map.set(cat, (map.get(cat) || 0) + toNum(r.amount));
    }
    const arr = Array.from(map.entries())
      .map(([cat, total]) => ({ cat, total }))
      .sort((a, b) => b.total - a.total);
    return arr;
  }, [rows]);

  const grandTotal = useMemo(
    () => rows.reduce((s, r) => s + toNum(r.amount), 0),
    [rows]
  );

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-base md:text-lg font-semibold">Cost Overview</h2>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-sm text-gray-600">View:</span>
          <div className="inline-flex rounded-lg border overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm ${
                mode === "daily"
                  ? "bg-red-50 text-red-700"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setMode("daily")}
            >
              Daily
            </button>
            <button
              className={`px-3 py-1.5 text-sm ${
                mode === "category"
                  ? "bg-red-50 text-red-700"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setMode("category")}
            >
              By Category
            </button>
          </div>

          <div className="ml-2 text-sm text-gray-600">
            Total:&nbsp;
            <span className="font-semibold">{fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-56 md:h-[280px]">
        <ResponsiveContainer width="100%" height={height}>
          {mode === "category" ? (
            <BarChart
              data={categoryData}
              margin={{ top: 10, right: 12, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="cat"
                tickMargin={8}
                height={50}
                interval={0}
                angle={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis tickMargin={8} width={70} />
              <Tooltip
                formatter={(v) => [fmt(v), "Total"]}
                labelFormatter={(lbl) => `Category: ${lbl}`}
              />
              <Bar dataKey="total" stroke={stroke} fill={fill} />
            </BarChart>
          ) : (
            <AreaChart
              data={dailyData}
              margin={{ top: 10, right: 12, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={stroke} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="d" tickMargin={8} />
              <YAxis tickMargin={8} width={70} />
              <Tooltip
                formatter={(v) => [fmt(v), "Total"]}
                labelFormatter={(lbl) => `Date: ${lbl}`}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke={stroke}
                strokeWidth={2}
                fill="url(#costGrad)"
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
