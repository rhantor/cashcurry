/* eslint-disable react/prop-types */
"use client";
import React from "react";

/* ─────────────────────────────────────────────
   Shimmer keyframe lives in globals.css (or here via <style>)
   We inject it once via a tiny <style> tag.
───────────────────────────────────────────── */
const ShimmerStyle = () => (
  <style>{`
    @keyframes shimmer {
      0%   { background-position: -600px 0; }
      100% { background-position: 600px 0; }
    }
    .sk-shimmer {
      background: linear-gradient(
        90deg,
        #f0fdf4 25%,
        #d1fae5 50%,
        #f0fdf4 75%
      );
      background-size: 600px 100%;
      animation: shimmer 1.4s infinite linear;
      border-radius: 6px;
    }
  `}</style>
);

/* ─── Base block ─── */
function SkeletonBlock({ className = "", style = {} }) {
  return <div className={`sk-shimmer ${className}`} style={style} />;
}

/* ─── Single row placeholder ─── */
export function SkeletonRow({ width = "100%", height = 16, className = "" }) {
  return (
    <SkeletonBlock
      className={className}
      style={{ width, height, borderRadius: 6 }}
    />
  );
}

/* ─── Card / chart area placeholder ─── */
export function SkeletonCard({ height = 120, className = "" }) {
  return (
    <SkeletonBlock
      className={`w-full ${className}`}
      style={{ height, borderRadius: 12 }}
    />
  );
}

/* ─── Stat badge row (like the totals header) ─── */
export function SkeletonStats({ count = 3 }) {
  return (
    <div className="flex gap-3 flex-wrap">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock
          key={i}
          style={{ width: 140, height: 56, borderRadius: 12 }}
        />
      ))}
    </div>
  );
}

/* ─── Full table skeleton ─── */
export function SkeletonTable({ rows = 6, cols = 5 }) {
  const widths = ["40%", "20%", "15%", "15%", "10%"];

  return (
    <>
      <ShimmerStyle />
      <div className="w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {/* Header row */}
        <div className="flex gap-4 px-4 py-3 border-b border-gray-100 bg-gray-50">
          {Array.from({ length: cols }).map((_, i) => (
            <SkeletonBlock
              key={i}
              style={{
                width: widths[i % widths.length],
                height: 12,
                borderRadius: 4,
                flex: i === 0 ? "1 1 auto" : "none",
              }}
            />
          ))}
        </div>

        {/* Data rows */}
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="flex gap-4 px-4 py-3 border-b border-gray-50"
            style={{ opacity: 1 - rowIdx * 0.08 }} // fade deeper rows
          >
            {Array.from({ length: cols }).map((_, colIdx) => (
              <SkeletonBlock
                key={colIdx}
                style={{
                  width: widths[colIdx % widths.length],
                  height: 14,
                  borderRadius: 4,
                  flex: colIdx === 0 ? "1 1 auto" : "none",
                }}
              />
            ))}
          </div>
        ))}

        {/* Footer total row */}
        <div className="flex justify-end gap-4 px-4 py-3 bg-mint-50 border-t border-mint-100">
          <SkeletonBlock style={{ width: 80, height: 14, borderRadius: 4 }} />
          <SkeletonBlock style={{ width: 100, height: 14, borderRadius: 4 }} />
        </div>
      </div>
    </>
  );
}

/* ─── Filter bar skeleton ─── */
export function SkeletonFilterBar() {
  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <SkeletonBlock style={{ width: 140, height: 36, borderRadius: 8 }} />
      <SkeletonBlock style={{ width: 120, height: 36, borderRadius: 8 }} />
      <SkeletonBlock style={{ width: 100, height: 36, borderRadius: 8 }} />
      <div className="ml-auto flex gap-2">
        <SkeletonBlock style={{ width: 90, height: 36, borderRadius: 8 }} />
        <SkeletonBlock style={{ width: 90, height: 36, borderRadius: 8 }} />
      </div>
    </div>
  );
}

/* ─── Full report page skeleton (chart + filter + table) ─── */
export function SkeletonReportPage({ cols = 5, chartEnabled = true }) {
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <ShimmerStyle />

      {/* Title */}
      <SkeletonBlock style={{ width: 220, height: 24, borderRadius: 6 }} />

      {/* Filter bar */}
      <SkeletonFilterBar />

      {/* Chart area */}
      {chartEnabled && <SkeletonCard height={200} />}

      {/* Stat badges */}
      <SkeletonStats count={3} />

      {/* Table */}
      <SkeletonTable rows={6} cols={cols} />
    </div>
  );
}

export default SkeletonTable;
