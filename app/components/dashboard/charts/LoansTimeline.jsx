/* eslint-disable react/prop-types */
"use client";
import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { mkFmt, mkCompact } from "@/utils/dashboard/utils";

export default function LoansTimeline({ data = [], currency = "RM" }) {
  const fmt     = mkFmt(currency);
  const compact = mkCompact();
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 10, bottom: 0 }}>
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
            formatter={(v, name) => [fmt(v), name]}
            contentStyle={{ borderRadius: 10, fontSize: 12, border: "1px solid #e2e8f0" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="borrowed"      name="Borrowed (Taken)"      fill="#f59e0b" radius={[3, 3, 0, 0]} />
          <Bar dataKey="lent"          name="Lent (Provided)"        fill="#10b981" radius={[3, 3, 0, 0]} />
          <Bar dataKey="repayReceived" name="Repayments Received"    fill="#6366f1" radius={[3, 3, 0, 0]} />
          <Bar dataKey="repayPaid"     name="Repayments Paid"        fill="#f43f5e" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
