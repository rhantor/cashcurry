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

const COLORS = ["#ef4444", "#3b82f6", "#10b981"];
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
            label
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => RM(v)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
