/* eslint-disable react/prop-types */
"use client";
import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { RM } from "@/utils/dashboard/utils";

// Known colors (we'll use these first if keys match)
const BASE_COLORS = {
  cash: "#16a34a",
  card: "#2563eb",
  qr: "#9333ea",
  online: "#0ea5e9",
  grab: "#22c55e",
  foodpanda: "#ec4899",
  cheque: "#f59e0b",
  promotion: "#64748b",
};

// Palette for any extra/unknown tender keys
const PALETTE = [
  "#0ea5e9",
  "#16a34a",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#22c55e",
  "#6366f1",
  "#e11d48",
  "#10b981",
  "#a855f7",
  "#0284c7",
  "#d946ef",
];

const titleCase = (s) =>
  (s || "")
    .replace(/[_-]+/g, " ")
    .replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

const colorFor = (key, idx) =>
  BASE_COLORS[key] || PALETTE[idx % PALETTE.length];

export default function SalesBreakdownTenders({
  rawSales = [],
  seriesKeys = [],
  labels = {},
  branches = [],
}) {
  const [selectedBranch, setSelectedBranch] = useState("all");

  const keys = useMemo(() => {
    if (Array.isArray(seriesKeys) && seriesKeys.length) return seriesKeys;
    const set = new Set();
    rawSales.forEach((s) => {
      Object.keys(s).forEach((k) => {
        if (!['date', 'createdAt', 'branchId', 'id', 'tenderMeta'].includes(k) && typeof s[k] !== 'object') {
          set.add(k);
        }
      });
    });
    return Array.from(set);
  }, [seriesKeys, rawSales]);

  const chartData = useMemo(() => {
    if (!rawSales?.length || !keys?.length) return [];
    
    const filtered = selectedBranch === "all" 
      ? rawSales 
      : rawSales.filter(s => s.branchId === selectedBranch);

    return keys
      .map((k, i) => {
        const sum = filtered.reduce((acc, row) => acc + (Number(row[k]) || 0), 0);
        return { 
          name: labels?.[k] ?? titleCase(k), 
          value: sum, 
          key: k,
          color: colorFor(k, i) 
        };
      })
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [rawSales, keys, labels, selectedBranch]);

  const hasData = chartData.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="font-medium mb-3 text-slate-800">Sales Breakdown (Tenders)</div>
      
      {branches && branches.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          <button
            onClick={() => setSelectedBranch("all")}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedBranch === "all" 
                ? "bg-slate-800 text-white shadow" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Branches
          </button>
          {branches.map(b => (
            <button
              key={b.id}
              onClick={() => setSelectedBranch(b.id)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedBranch === b.id 
                  ? "bg-slate-800 text-white shadow" 
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {b.name || b.id}
            </button>
          ))}
        </div>
      )}

      <div className="h-72 mt-auto">
        {hasData ? (
          <ResponsiveContainer>
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => RM(v)} width={80} axisLine={false} tickLine={false} />
              <Tooltip formatter={(val) => RM(val)} cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-gray-500">
            No data for selected branch
          </div>
        )}
      </div>
    </div>
  );
}
