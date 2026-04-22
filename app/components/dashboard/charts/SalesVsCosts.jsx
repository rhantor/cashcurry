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
  Bar,
  Line,
} from "recharts";
import { mkFmt, mkCompact } from "@/utils/dashboard/utils";

export default function SalesVsCosts({ data, currency = "RM" }) {
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
              const labels = { sales: "Sales", costs_total: "Total Costs" };
              return [fmt(val), labels[key] || key];
            }}
            contentStyle={{ borderRadius: 10, fontSize: 12, border: "1px solid #e2e8f0" }}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar  dataKey="costs_total" name="Total Costs" fill="#f43f5e" radius={[4, 4, 0, 0]} />
          <Line type="monotone" dataKey="sales" name="Sales" stroke="#6366f1" strokeWidth={2.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
