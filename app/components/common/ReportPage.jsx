/* eslint-disable react/prop-types */
"use client";
import React, { useState, useMemo } from "react";
import Pagination from "@/app/components/common/Pagination";
import FilterBar from "@/app/components/common/FilterBar";
import { SkeletonReportPage } from "@/app/components/common/Skeleton";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  isWithinInterval,
  format,
} from "date-fns";
import useCurrency from "@/app/hooks/useCurrency";

// Recharts
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function ReportPage({
  data = [],
  branchData,
  columns = [],
  filterConfig = {},
  exportFunctions = {},
  title = "Report",
  modalContentRenderer,
  searchBarShow,
  searchPlaceholder,
  onDateSync,
  chartConfig,
  showTotalsFooter,
  isLoading = false, // ✅ NEW: show skeleton while data is fetching
}) {
  const currency = useCurrency();
  const [filterType, setFilterType] = useState("monthly");
  const [searchDesc, setSearchDesc] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [selectedMonth, setSelectedMonth] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [selectedItem, setSelectedItem] = useState(null);

  const today = new Date();
  const {
    dateField = "date",
    searchFields = [],
    customFilters = (rows) => rows,
  } = filterConfig || {};

  // ---------- Sync State With Parent for Server-Side Fetching ----------
  React.useEffect(() => {
    if (!onDateSync) return;

    let startDate = null;
    let endDate = null;
    const formatYMD = (d) => format(d, "yyyy-MM-dd");

    if (filterType === "monthly") {
      startDate = formatYMD(startOfMonth(today));
      endDate = formatYMD(endOfMonth(today));
    } else if (filterType === "weekly") {
      startDate = formatYMD(startOfWeek(today));
      endDate = formatYMD(endOfWeek(today));
    } else if (filterType === "last7days") {
      startDate = formatYMD(subDays(today, 7));
      endDate = formatYMD(today);
    } else if (filterType === "range" && dateRange.from && dateRange.to) {
      startDate = dateRange.from;
      endDate = dateRange.to;
    } else if (filterType === "month" && selectedMonth) {
      const [year, month] = selectedMonth.split("-");
      const d = new Date(parseInt(year), parseInt(month) - 1, 1);
      startDate = formatYMD(startOfMonth(d));
      endDate = formatYMD(endOfMonth(d));
    }

    onDateSync({ startDate, endDate });
  }, [filterType, dateRange, selectedMonth]);

  // ---------- Filtered + Sorted ----------
  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Date filters
    if (filterType === "weekly") {
      filtered = filtered.filter((entry) =>
        isWithinInterval(new Date(entry[dateField]), {
          start: startOfWeek(today),
          end: endOfWeek(today),
        })
      );
    } else if (filterType === "monthly") {
      filtered = filtered.filter((entry) =>
        isWithinInterval(new Date(entry[dateField]), {
          start: startOfMonth(today),
          end: endOfMonth(today),
        })
      );
    } else if (filterType === "last7days") {
      filtered = filtered.filter((entry) =>
        isWithinInterval(new Date(entry[dateField]), {
          start: subDays(today, 7),
          end: today,
        })
      );
    } else if (filterType === "range" && dateRange.from && dateRange.to) {
      filtered = filtered.filter((entry) =>
        isWithinInterval(new Date(entry[dateField]), {
          start: new Date(dateRange.from),
          end: new Date(dateRange.to),
        })
      );
    } else if (filterType === "month" && selectedMonth) {
      const [year, month] = selectedMonth.split("-");
      filtered = filtered.filter((entry) => {
        const d = new Date(entry[dateField]);
        return (
          d.getFullYear() === parseInt(year) &&
          d.getMonth() + 1 === parseInt(month)
        );
      });
    }

    // Search
    if (searchDesc && searchFields.length) {
      const q = searchDesc.toLowerCase();
      filtered = filtered.filter((entry) =>
        searchFields.some((field) =>
          entry[field]?.toString().toLowerCase().includes(q)
        )
      );
    }

    // Custom filters
    filtered = customFilters(filtered);

    // Sort by date asc/desc
    filtered.sort((a, b) =>
      sortOrder === "asc"
        ? new Date(a[dateField]) - new Date(b[dateField])
        : new Date(b[dateField]) - new Date(a[dateField])
    );

    return filtered;
  }, [
    data,
    filterType,
    dateRange,
    selectedMonth,
    searchDesc,
    sortOrder,
    dateField,
    searchFields,
    customFilters,
    today,
  ]);

  // ---------- Pagination ----------
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // ---------- Chart prep ----------
  const valueField =
    chartConfig?.valueField ??
    (data.length && "total" in (data[0] || {}) ? "total" : undefined);

  const chartEnabled = !!chartConfig?.enabled && !!valueField;

  const chartThemeColors = useMemo(() => {
    const presets = {
      sales: { stroke: "#6B8E23", fill: "rgba(107,142,35,0.20)" }, // olive/green
      cost: { stroke: "#E53E3E", fill: "rgba(229,62,62,0.15)" }, // red
      deposit: { stroke: "#3182CE", fill: "rgba(49,130,206,0.15)" }, // blue
      default: { stroke: "#4A5568", fill: "rgba(74,85,104,0.15)" }, // gray
    };
    if (!chartConfig?.theme) return presets.default;
    if (typeof chartConfig.theme === "string") {
      return presets[chartConfig.theme] || presets.default;
    }
    // custom { stroke, fill }
    return {
      stroke: chartConfig.theme.stroke || presets.default.stroke,
      fill: chartConfig.theme.fill || presets.default.fill,
    };
  }, [chartConfig?.theme]);

  const chartData = useMemo(() => {
    if (!chartEnabled) return [];
    const sorted = [...filteredData].sort(
      (a, b) => new Date(a[dateField]) - new Date(b[dateField])
    );
    return sorted.map((row) => {
      let label;
      try {
        label = format(new Date(row[dateField]), "dd/MM");
      } catch {
        label = String(row[dateField] ?? "");
      }
      const v = Number(row[valueField] ?? 0);
      return { d: label, v };
    });
  }, [chartEnabled, filteredData, dateField, valueField]);

  // ---------- Totals footer ----------
  const grandTotal = useMemo(() => {
    if (!valueField) return 0;
    return filteredData.reduce(
      (sum, r) => sum + (Number.isFinite(+r[valueField]) ? +r[valueField] : 0),
      0
    );
  }, [filteredData, valueField]);

  const thisMonthTotal = useMemo(() => {
    if (!valueField) return 0;

    const start = startOfMonth(today);
    const end = endOfMonth(today);

    return data
      .filter((r) =>
        isWithinInterval(new Date(r[dateField]), {
          start,
          end,
        })
      )
      .reduce(
        (sum, r) =>
          sum + (Number.isFinite(+r[valueField]) ? +r[valueField] : 0),
        0
      );
  }, [data, valueField, dateField, today]);

  // ✅ Render skeleton AFTER all hooks (Rules of Hooks safe)
  if (isLoading) {
    return (
      <SkeletonReportPage
        cols={columns.length || 5}
        chartEnabled={!!chartConfig?.enabled}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-semibold mb-3 capitalize">
        {branchData?.name?.split(" ")[0]} {title}
      </h1>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
        {/* ===== Filters ===== */}
        <FilterBar
          filterType={filterType}
          dateRange={dateRange}
          selectedMonth={selectedMonth}
          searchDesc={searchDesc}
          sortOrder={sortOrder}
          onFilterChange={(updated) => {
            if (updated.filterType !== undefined)
              setFilterType(updated.filterType);
            if (updated.dateRange !== undefined)
              setDateRange(updated.dateRange);
            if (updated.selectedMonth !== undefined)
              setSelectedMonth(updated.selectedMonth);
            if (updated.searchDesc !== undefined)
              setSearchDesc(updated.searchDesc);
            if (updated.sortOrder !== undefined)
              setSortOrder(updated.sortOrder);
            setCurrentPage(1); // reset to first page on filter changes
          }}
          searchBarShow={searchBarShow}
          placeholder={searchPlaceholder}
        />

        {/* ===== Export Buttons ===== */}
        <div className="flex flex-wrap gap-2 mb-4">
          {exportFunctions.exportPDF && (
            <button
              onClick={() =>
                exportFunctions.exportPDF(
                  filteredData,
                  branchData,
                  filterType,
                  dateRange,
                  selectedMonth,
                  searchDesc
                )
              }
              className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm"
            >
              Export Filtered (PDF)
            </button>
          )}
          {exportFunctions.exportExcel && (
            <button
              onClick={() =>
                exportFunctions.exportExcel(
                  filteredData,
                  branchData,
                  filterType,
                  dateRange,
                  selectedMonth,
                  searchDesc
                )
              }
              className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm"
            >
              Export Filtered (Excel)
            </button>
          )}
        </div>
      </div>
      {/* ===== Chart (optional) ===== */}
      {chartEnabled && chartData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base md:text-lg font-semibold">Trend</h2>
            <div className="text-sm text-gray-600">
              Total:&nbsp;
              <span className="font-semibold">{currency} {grandTotal.toFixed(2)}</span>
            </div>
          </div>
          <div className="h-56 md:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartConfig?.type === "bar" ? (
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 12, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="d" tickMargin={8} />
                  <YAxis tickMargin={8} width={60} />
                  <Tooltip
                    formatter={(v) => [`${currency} ${Number(v).toFixed(2)}`, "Total"]}
                    labelFormatter={(lbl) => `Date: ${lbl}`}
                  />
                  <Bar
                    dataKey="v"
                    stroke={chartThemeColors.stroke}
                    fill={chartThemeColors.fill}
                  />
                </BarChart>
              ) : (
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 12, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gt" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={chartThemeColors.stroke}
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor={chartThemeColors.stroke}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="d" tickMargin={8} />
                  <YAxis tickMargin={8} width={60} />
                  <Tooltip
                    formatter={(v) => [`${currency} ${Number(v).toFixed(2)}`, "Total"]}
                    labelFormatter={(lbl) => `Date: ${lbl}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={chartThemeColors.stroke}
                    strokeWidth={2}
                    fill="url(#gt)"
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ===== Table ===== */}
      {/* ===== Table (sticky header, single table) ===== */}
      <div className="relative bg-white rounded-lg shadow overflow-hidden">
        {/* subtle top/bottom fade to suggest scroll */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-white/80 to-transparent z-10" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-white/80 to-transparent z-10" />

        <div className="max-h-[65vh] overflow-auto">
          <table className="min-w-full table-fixed border-separate border-spacing-0">
            <thead className="sticky top-0 z-20">
              <tr className="bg-gray-50/90 backdrop-blur supports-[backdrop-filter]:bg-gray-50/60">
                {columns.map((col, idx) => (
                  <th
                    key={col.key}
                    className={[
                      "px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-gray-700",
                      "border-b border-gray-200",
                      // rounded header corners
                      idx === 0 ? "rounded-tl-lg" : "",
                      idx === columns.length - 1 ? "rounded-tr-lg" : "",
                      // optional per-column header classes
                      col.headerClassName || "",
                      // alignment helper
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                        ? "text-center"
                        : "text-left",
                    ].join(" ")}
                    style={col.thStyle}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {paginatedData.map((entry, rIdx) => (
                <tr
                  key={entry.id || entry[dateField] || rIdx}
                  className={[
                    "border-b border-gray-100",
                    "odd:bg-white even:bg-gray-50",
                    "hover:bg-mint-50 transition-colors",
                    "cursor-pointer",
                    "focus-within:ring-2 focus-within:ring-mint-200",
                  ].join(" ")}
                  onClick={() => setSelectedItem(entry)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      setSelectedItem(entry);
                  }}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={[
                        "px-3 sm:px-4 py-2 align-middle",
                        "text-sm text-gray-800",
                        // borders only between rows (not columns)
                        // optional per-column cell classes
                        col.className || "",
                        // alignment helper
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                          ? "text-center"
                          : "text-left",
                        // handle long content gracefully
                        col.truncate ? "truncate max-w-[12rem]" : "break-words",
                      ].join(" ")}
                      style={col.tdStyle}
                    >
                      {col.render
                        ? col.render(entry[col.key], entry)
                        : entry[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Empty state */}
          {paginatedData.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              No records found.
            </div>
          )}
        </div>
      </div>

      {/* ===== Pagination ===== */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* ===== Totals footer (optional) ===== */}
      {showTotalsFooter && valueField && (
        <div className="max-w-7xl mx-auto mt-3">
          <div className="w-full rounded border bg-gray-50">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 text-sm">
              <div className="font-medium text-gray-600">Grand Total</div>
              <div className="font-semibold">{currency} {grandTotal.toFixed(2)}</div>
              <div className="text-gray-600">Entries</div>
              <div className="font-medium">{filteredData.length}</div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal ===== */}
      {selectedItem &&
        modalContentRenderer?.(
          selectedItem,
          branchData,
          () => setSelectedItem(null),
          thisMonthTotal.toFixed(2)
        )}
    </div>
  );
}
