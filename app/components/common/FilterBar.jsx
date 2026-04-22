/* eslint-disable react/prop-types */
"use client";
import React from "react";

export default function FilterBar({
  filterType,
  dateRange,
  selectedMonth,
  searchDesc,
  sortOrder,
  onFilterChange,
  searchBarShow,
  placeholder,
  sortOptions
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-4 bg-white p-3 rounded-lg shadow">
      <select
        value={filterType}
        onChange={(e) => onFilterChange({ filterType: e.target.value })}
        className="border rounded px-3 py-2 text-sm"
      >
        <option value="all">All</option>
        <option value="weekly">This Week</option>
        <option value="monthly">This Month</option>
        <option value="last7days">Last 7 Days</option>
        <option value="range">Date Range</option>
        <option value="month">By Month</option>
      </select>

      {filterType === "range" && (
        <>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) =>
              onFilterChange({
                dateRange: { ...dateRange, from: e.target.value },
              })
            }
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) =>
              onFilterChange({
                dateRange: { ...dateRange, to: e.target.value },
              })
            }
            className="border rounded px-3 py-2 text-sm"
          />
        </>
      )}

      {filterType === "month" && (
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => onFilterChange({ selectedMonth: e.target.value })}
          className="border rounded px-3 py-2 text-sm"
        />
      )}

      {searchBarShow && (
        <input
          type="text"
          placeholder={placeholder}
          value={searchDesc}
          onChange={(e) => onFilterChange({ searchDesc: e.target.value })}
          className="border rounded px-3 py-2 text-sm flex-1"
        />
      )}

      <select
        value={sortOrder}
        onChange={(e) => onFilterChange({ sortOrder: e.target.value })}
        className="border rounded px-3 py-2 text-sm bg-white"
      >
        {sortOptions ? (
          sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))
        ) : (
          <>
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </>
        )}
      </select>
    </div>
  );
}
