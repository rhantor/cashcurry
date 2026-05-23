/* eslint-disable react/prop-types */
"use client";
import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { RM } from "@/utils/dashboard/utils";

const COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b"];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white border border-slate-200 shadow-xl rounded-xl p-3 text-sm min-w-[200px]">
        <div className="font-semibold text-slate-800 mb-2 border-b pb-1">
          {data.name} : {RM(data.value)}
        </div>
        {data.breakdown && data.breakdown.length > 0 && (
          <div className="space-y-1">
            {data.breakdown.map((b, i) => (
              <div key={i} className="flex justify-between items-center text-xs">
                <span className="text-slate-600 truncate mr-3">{b.name}</span>
                <span className="font-medium text-slate-800">{RM(b.value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function ExpensePie({ data }) {
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={100}
            label={({ name, value }) => `${name} (${RM(value)})`}
            labelLine={true}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
