/* eslint-disable react/prop-types */
"use client";
import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
} from "recharts";
import { mkFmt, mkCompact } from "@/utils/dashboard/utils";

export default function CashVsCost({ data, currency = "RM" }) {
  const fmt     = mkFmt(currency);
  const compact = mkCompact();
  return (
    <div className="w-full h-72">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
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
          <Tooltip
            formatter={(val, key) => {
              const labels = { cashSales: "Cash Sales", cashCosts: "Costs (Cash/Front)" };
              return [fmt(val), labels[key] || key];
            }}
            contentStyle={{ borderRadius: 10, fontSize: 12, border: "1px solid #e2e8f0" }}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Line
            type="monotone"
            dataKey="cashCosts"
            name="Costs (Cash/Front)"
            stroke="#f43f5e"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="cashSales"
            name="Cash Sales"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={{ r: 3, stroke: "#10b981", fill: "#fff", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
