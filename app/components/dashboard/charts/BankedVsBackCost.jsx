/* eslint-disable react/prop-types */
"use client";
import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { mkFmt, mkCompact } from "@/utils/dashboard/utils";

export default function BankedVsBackCost({ data = [], currency = "RM" }) {
  const fmt     = mkFmt(currency);
  const compact = mkCompact();
  return (
    <div className="w-full h-72">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            minTickGap={14}
          />
          <YAxis
            tickFormatter={compact}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            formatter={(v, name) => [fmt(v), name]}
            contentStyle={{ borderRadius: 10, fontSize: 12, border: "1px solid #e2e8f0" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Line
            type="monotone"
            dataKey="bankedSales"
            name="Banked Sales"
            stroke="#6366f1"
            strokeWidth={2.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="backCosts"
            name="Back-Office Costs"
            stroke="#f43f5e"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
