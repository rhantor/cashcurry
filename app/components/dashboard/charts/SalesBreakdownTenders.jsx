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
  Legend,
} from "recharts";
import { RM, PCT } from "@/utils/dashboard/utils";

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
  data = [],
  seriesKeys, // e.g., tenderKeys from hook
  labels = {}, // e.g., tenderLabelsByKey from hook
}) {
  const [mode, setMode] = useState("amount"); // "amount" | "percent"

  // Fallback: infer keys from data if not provided
  const keys = useMemo(() => {
    if (Array.isArray(seriesKeys) && seriesKeys.length) return seriesKeys;
    const set = new Set();
    (data || []).forEach((row) => {
      Object.keys(row || {}).forEach((k) => {
        if (k !== "date") set.add(k);
      });
    });
    return Array.from(set);
  }, [seriesKeys, data]);

  const hasData = (data?.length ?? 0) > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium">Sales Breakdown (Tenders)</span>
        <div className="flex gap-1 rounded-lg bg-black/5 p-1">
          <button
            className={`px-2 py-1 rounded text-sm ${
              mode === "amount" ? "bg-white shadow" : ""
            }`}
            onClick={() => setMode("amount")}
          >
            Amount
          </button>
          <button
            className={`px-2 py-1 rounded text-sm ${
              mode === "percent" ? "bg-white shadow" : ""
            }`}
            onClick={() => setMode("percent")}
          >
            %
          </button>
        </div>
      </div>

      <div className="h-72">
        {hasData ? (
          <ResponsiveContainer>
            <BarChart
              data={data}
              {...(mode === "percent" ? { stackOffset: "expand" } : {})}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis
                tickFormatter={(v) => (mode === "percent" ? PCT(v) : RM(v))}
                domain={mode === "percent" ? [0, 1] : ["auto", "auto"]}
              />
              <Tooltip
                formatter={(val, name) => [
                  mode === "percent" ? PCT(val) : RM(val),
                  name,
                ]}
              />
              <Legend />
              {keys.map((k, i) => (
                <Bar
                  key={k}
                  dataKey={k}
                  name={labels?.[k] ?? titleCase(k)}
                  stackId="a"
                  fill={colorFor(k, i)}
                  // round ONLY the top of the stack (last series) in amount mode
                  radius={
                    i === keys.length - 1 && mode !== "percent"
                      ? [8, 8, 0, 0]
                      : 0
                  }
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-gray-500">
            No data for selected range
          </div>
        )}
      </div>
    </div>
  );
}
