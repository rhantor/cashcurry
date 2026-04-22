/* eslint-disable react/prop-types */
"use client";
import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function BranchPerformanceBar({ data }) {
  // expects: [{ name, sales, costs }, ...]
  return (
    <div className="w-full h-80">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="sales" name="Sales" />
          <Bar dataKey="costs" name="Costs" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
