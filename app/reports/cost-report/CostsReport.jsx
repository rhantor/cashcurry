/* eslint-disable react/prop-types */
"use client";
import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  isWithinInterval,
} from "date-fns";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { useGetCostEntriesQuery, useDeleteCostEntryMutation } from "@/lib/redux/api/costApiSlice";
import {
  exportCostsToExcel,
  exportCostsToPDF,
  exportCostToExcel,
  exportCostToPDF,
  handleCostShare,
} from "@/utils/export/exportCostData";
import Pagination from "@/app/components/common/Pagination";
import FilterBar from "@/app/components/common/FilterBar";
import { skipToken } from "@reduxjs/toolkit/query";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import CostCharts from "@/app/components/reports/costs/CostCharts";
import EditCostModal from "@/app/components/reports/costs/EditCostModal";
import AttachmentViewerModal from "@/app/components/reports/costs/AttachmentViewerModal";
import useCurrency from "@/app/hooks/useCurrency";

// Methods shown when paid from BACK office
const BACK_METHODS = [
  { value: "card", label: "Card" },
  { value: "qr", label: "QR" },
  { value: "online", label: "Online" },
  { value: "bank_transfer", label: "Bank Transfer" },
];

const Badge = ({ children, tone = "gray" }) => {
  const tones = {
    gray: "bg-gray-100 text-gray-700",
    orange: "bg-mint-100 text-mint-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    emerald: "bg-emerald-100 text-emerald-700",
    pink: "bg-pink-100 text-pink-700",
    slate: "bg-slate-100 text-slate-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    cyan: "bg-cyan-100 text-cyan-700",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
        tones[tone] || tones.gray
      }`}
    >
      {children}
    </span>
  );
};

// derive safe fields for old documents
const derivePaidFrom = (entry) => {
  if (entry?.paidFromOffice === "front" || entry?.paidFromOffice === "back") {
    return entry.paidFromOffice;
  }
  if (entry?.paidMethod && entry.paidMethod !== "cash") return "back";
  return "front";
};

const derivePaidMethod = (entry) => {
  if (entry?.paidMethod) return entry.paidMethod;
  const from = derivePaidFrom(entry);
  return from === "front" ? "cash" : "";
};

export default function CostsReport() {
  const [filterType, setFilterType] = useState("monthly");
  const [searchDesc, setSearchDesc] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedCost, setSelectedCost] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // We just hold the entry to be viewed for attachments
  const [viewAttachmentsEntry, setViewAttachmentsEntry] = useState(null);

  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [paidFromFilter, setPaidFromFilter] = useState("");
  const [paidMethodFilter, setPaidMethodFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const { ready, companyId, branchId } = useResolvedCompanyBranch();
  const currency = useCurrency();

  const fetchArgs = useMemo(() => {
    let startDate = null;
    let endDate = null;
    const today = new Date();
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

    return { startDate, endDate };
  }, [filterType, dateRange, selectedMonth]);

  const args =
    ready && companyId && branchId ? { companyId, branchId, ...fetchArgs } : skipToken;

  const { data: costs = [], isLoading } = useGetCostEntriesQuery(args);
  const { data: branchData = {} } = useGetSingleBranchQuery(args);
  const [deleteCostEntry] = useDeleteCostEntryMutation();

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this cost entry?")) {
      try {
        await deleteCostEntry({ companyId, branchId, costId: selectedCost.id }).unwrap();
        setSelectedCost(null);
        alert("Deleted successfully!");
      } catch (err) {
        console.error(err);
        alert("Failed to delete cost entry");
      }
    }
  };

  // Build category list
  const categoryOptions = useMemo(() => {
    const set = new Set();
    costs.forEach((c) => set.add((c.category || "Uncategorized").trim()));
    return ["", ...Array.from(set).sort()];
  }, [costs]);

  // Filter + sort
  const filteredCosts = useMemo(() => {
    let filtered = [...costs];
    const today = new Date();

    if (filterType === "weekly") {
      filtered = filtered.filter((entry) =>
        isWithinInterval(new Date(entry.date), {
          start: startOfWeek(today),
          end: endOfWeek(today),
        })
      );
    } else if (filterType === "monthly") {
      filtered = filtered.filter((entry) =>
        isWithinInterval(new Date(entry.date), {
          start: startOfMonth(today),
          end: endOfMonth(today),
        })
      );
    } else if (filterType === "last7days") {
      filtered = filtered.filter((entry) =>
        isWithinInterval(new Date(entry.date), {
          start: subDays(today, 7),
          end: today,
        })
      );
    } else if (filterType === "range" && dateRange.from && dateRange.to) {
      filtered = filtered.filter((entry) =>
        isWithinInterval(new Date(entry.date), {
          start: new Date(dateRange.from),
          end: new Date(dateRange.to),
        })
      );
    } else if (filterType === "month" && selectedMonth) {
      const [year, month] = selectedMonth.split("-");
      filtered = filtered.filter((entry) => {
        const d = new Date(entry.date);
        return (
          d.getFullYear() === parseInt(year) &&
          d.getMonth() + 1 === parseInt(month)
        );
      });
    }

    if (selectedCategory) {
      filtered = filtered.filter(
        (entry) =>
          (entry.category || "Uncategorized").trim() === selectedCategory
      );
    }

    if (paidFromFilter) {
      filtered = filtered.filter(
        (entry) => derivePaidFrom(entry) === paidFromFilter
      );
    }

    if (paidMethodFilter) {
      filtered = filtered.filter(
        (entry) => derivePaidMethod(entry) === paidMethodFilter
      );
    }

    // search: description, category, method, paid-from (✅ includes category)
    if (searchDesc) {
      const q = searchDesc.toLowerCase();
      filtered = filtered.filter((entry) => {
        const desc = (entry.description || "").toLowerCase();
        const cat = (entry.category || "Uncategorized").toLowerCase();
        const method = derivePaidMethod(entry).toLowerCase();
        const from = derivePaidFrom(entry).toLowerCase();
        return (
          desc.includes(q) ||
          cat.includes(q) ||
          method.includes(q) ||
          from.includes(q)
        );
      });
    }

    // sort by date or amount
    return filtered.sort((a, b) => {
      if (sortOrder === "asc") return new Date(a.date) - new Date(b.date);
      if (sortOrder === "amountDesc") return Number(b.amount || 0) - Number(a.amount || 0);
      if (sortOrder === "amountAsc") return Number(a.amount || 0) - Number(b.amount || 0);
      return new Date(b.date) - new Date(a.date);
    });
  }, [
    costs,
    filterType,
    dateRange,
    selectedMonth,
    searchDesc,
    sortOrder,
    selectedCategory,
    paidFromFilter,
    paidMethodFilter,
  ]);

  // Pagination
  const totalPages = Math.ceil(filteredCosts.length / pageSize);
  const paginatedCosts = filteredCosts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Totals
  const grandTotal = useMemo(
    () =>
      filteredCosts.reduce(
        (sum, c) => sum + (Number.isFinite(+c.amount) ? +c.amount : 0),
        0
      ),
    [filteredCosts]
  );

  const totals = useMemo(() => {
    let cashFront = 0,
      card = 0,
      qr = 0,
      online = 0,
      bank = 0;
    filteredCosts.forEach((c) => {
      const from = derivePaidFrom(c);
      const method = derivePaidMethod(c);
      const amt = Number.isFinite(+c.amount) ? +c.amount : 0;

      if (from === "front") {
        cashFront += amt;
      } else {
        if (method === "card") card += amt;
        else if (method === "qr") qr += amt;
        else if (method === "online") online += amt;
        else if (method === "bank_transfer") bank += amt;
      }
    });
    return {
      cashFront,
      card,
      qr,
      online,
      bank,
      backTotal: card + qr + online + bank,
    };
  }, [filteredCosts]);

  if (!ready) return <p className="p-4">Preparing…</p>;
  if (isLoading) return <p className="p-4">Loading cost entries...</p>;

  // method options
  const methodOptions =
    paidFromFilter === "back"
      ? ["", ...BACK_METHODS.map((m) => m.value)]
      : paidFromFilter === "front"
      ? ["", "cash"]
      : ["", "cash", ...BACK_METHODS.map((m) => m.value)];

  const methodLabel = (m) => {
    if (m === "cash") return "Cash";
    const found = BACK_METHODS.find((x) => x.value === m);
    return found?.label || (m ? m : "All");
  };

  const methodTone = (m) => {
    switch (m) {
      case "cash":
        return "amber";
      case "card":
        return "blue";
      case "qr":
        return "purple";
      case "online":
        return "cyan";
      case "bank_transfer":
        return "emerald";
      default:
        return "gray";
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-semibold mb-4 capitalize">
        💰{branchData?.name?.split(" ")[0] || ""} Cost Report
      </h1>

      {/* ===== Filters ===== */}
      <div className="flex flex-col gap-3 mb-3">
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
            setCurrentPage(1);
          }}
          searchBarShow={true}
          placeholder="Search description, category, method, or paid-from…"
          sortOptions={[
            { value: "desc", label: "Newest First" },
            { value: "asc", label: "Oldest First" },
            { value: "amountDesc", label: "Amount: High to Low" },
            { value: "amountAsc", label: "Amount: Low to High" },
          ]}
        />

        {/* Extra filters: Category, Paid From, Method */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Category */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full max-w-xs rounded-lg border p-2 text-sm text-gray-700 bg-white"
            >
              {categoryOptions.map((opt) =>
                opt === "" ? (
                  <option key="__all" value="">
                    All
                  </option>
                ) : (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Paid From */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Paid From</label>
            <select
              value={paidFromFilter}
              onChange={(e) => {
                setPaidFromFilter(e.target.value);
                setPaidMethodFilter("");
                setCurrentPage(1);
              }}
              className="w-full max-w-xs rounded-lg border p-2 text-sm text-gray-700 bg-white"
            >
              <option value="">All</option>
              <option value="front">Front Office (Cash)</option>
              <option value="back">Back Office (Bank/Card/QR/Online)</option>
            </select>
          </div>

          {/* Method */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Method</label>
            <select
              value={paidMethodFilter}
              onChange={(e) => {
                setPaidMethodFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full max-w-xs rounded-lg border p-2 text-sm text-gray-700 bg-white"
            >
              {methodOptions.map((m) =>
                m === "" ? (
                  <option key="__m_all" value="">
                    All
                  </option>
                ) : (
                  <option key={m} value={m}>
                    {methodLabel(m)}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Totals strip */}
      <div className="w-full bg-white rounded-lg shadow p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-sm">
          <div className="flex flex-col">
            <span className="text-gray-500">Cash (Front)</span>
            <span className="font-semibold">
              {currency} {totals.cashFront.toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500">Card (Back)</span>
            <span className="font-semibold">{currency} {totals.card.toFixed(2)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500">QR (Back)</span>
            <span className="font-semibold">{currency} {totals.qr.toFixed(2)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500">Online (Back)</span>
            <span className="font-semibold">{currency} {totals.online.toFixed(2)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500">Bank Transfer (Back)</span>
            <span className="font-semibold">{currency} {totals.bank.toFixed(2)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500">Grand Total</span>
            <span className="font-semibold">{currency} {grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Bulk Export */}
      <div className="flex flex-wrap gap-2 mb-4 justify-end">
        <button
          onClick={() =>
            exportCostsToPDF(
              filteredCosts,
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
        <button
          onClick={() =>
            exportCostsToExcel(
              filteredCosts,
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
      </div>
      {/* ===== Top charts (daily | category) ===== */}
      <CostCharts rows={filteredCosts} />
      {/* ===== Table (sticky header, single table) ===== */}
      <div className="relative bg-white rounded-lg shadow overflow-hidden">
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-white/80 to-transparent z-10" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-white/80 to-transparent z-10" />

        <div className="max-h-[65vh] overflow-auto">
          <table className="min-w-full table-fixed border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="bg-gray-50/90 backdrop-blur supports-[backdrop-filter]:bg-gray-50/60">
                {[
                  "Date",
                  "Amount",
                  "Category",
                  "Paid From",
                  "Method",
                  "Description",
                  "Invoice",
                  "Created By",
                  "Added Time",
                ].map((label, idx) => (
                  <th
                    key={label}
                    className={[
                      "px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-gray-700",
                      "border-b border-gray-200",
                      idx === 0 ? "rounded-tl-lg" : "",
                      idx === 8 ? "rounded-tr-lg" : "",
                    ].join(" ")}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {paginatedCosts.map((entry, rIdx) => {
                const from = derivePaidFrom(entry);
                const method = derivePaidMethod(entry);
                return (
                  <tr
                    key={entry.id || rIdx}
                    className="border-b border-gray-100 odd:bg-white even:bg-gray-50 hover:bg-mint-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedCost(entry)}
                    tabIndex={0}
                    onKeyDown={(e) =>
                      (e.key === "Enter" || e.key === " ") &&
                      setSelectedCost(entry)
                    }
                  >
                    <td className="px-3 sm:px-4 py-2">
                      {format(new Date(entry.date), "dd/MM/yyyy")}
                    </td>
                    <td className="px-3 sm:px-4 py-2 font-semibold">
                      {currency} {Number(entry.amount || 0).toFixed(2)}
                    </td>
                    <td className="px-3 sm:px-4 py-2">
                      {(entry.category || "Uncategorized").trim()}
                    </td>
                    <td className="px-3 sm:px-4 py-2">
                      {from === "front" ? (
                        <Badge tone="amber">Front</Badge>
                      ) : (
                        <Badge tone="blue">Back</Badge>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-2">
                      {method ? (
                        <Badge tone={methodTone(method)}>
                          {methodLabel(method)}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-2 break-words">
                      {entry.description}
                    </td>
                    <td className="px-3 sm:px-4 py-2">
                      {entry.attachments?.length > 0 || entry.fileURL ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewAttachmentsEntry(entry);
                          }}
                          className="text-blue-600 underline font-medium hover:text-blue-800 transition-colors"
                        >
                          View Files {entry.attachments?.length > 1 ? `(${entry.attachments.length})` : ''}
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-2">
                      {entry.createdBy?.username || "N/A"}
                    </td>
                    <td className="px-3 sm:px-4 py-2">
                      {entry.createdAt?.seconds !== undefined
                        ? format(
                            new Date(
                              entry.createdAt.seconds * 1000 +
                                (entry.createdAt.nanoseconds || 0) / 1_000_000
                            ),
                            "HH:mm ~ dd/MM"
                          )
                        : entry.createdAt
                        ? format(new Date(entry.createdAt), "HH:mm ~ dd/MM")
                        : "N/A"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {paginatedCosts.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              No records found.
            </div>
          )}
        </div>
      </div>

      {/* Total */}
      <div className="mt-4 text-right font-bold text-lg">
        Total: {currency} {grandTotal.toFixed(2)}
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* Modal */}
      {selectedCost && isEditMode && (
        <EditCostModal 
          cost={selectedCost} 
          onClose={() => setIsEditMode(false)}
          onSuccess={() => {
            setIsEditMode(false);
            setSelectedCost(null);
          }}
        />
      )}

      {/* Attachment Viewer Modal */}
      {viewAttachmentsEntry && (
        <AttachmentViewerModal
          costEntry={viewAttachmentsEntry}
          onClose={() => setViewAttachmentsEntry(null)}
        />
      )}

      <AnimatePresence>
        {selectedCost && !isEditMode && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4"
          >
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 1 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 25 } }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 max-h-[85vh] sm:max-h-[90vh] flex flex-col pt-2 sm:pt-0"
            >
              <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-gray-50 flex justify-between items-center bg-gradient-to-r from-gray-50 to-white">
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-gray-800">
                    Cost Details
                  </h2>
                  <p className="text-xs sm:text-sm font-medium text-gray-500 mt-1 line-clamp-1">
                    {format(new Date(selectedCost.date), "dd/MM/yyyy")} • {Array.isArray(branchData) ? branchData.map((b) => b.name).join(", ") : branchData?.name || "Branch"}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCost(null)}
                  className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 rounded-full hover:bg-red-50 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto styled-scrollbar text-sm space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm sm:shadow-none">
                    <span className="block mb-1 text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</span>
                    <span className="text-lg font-bold text-gray-800">{currency} {Number(selectedCost.amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm sm:shadow-none">
                    <span className="block mb-1 text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</span>
                    <span className="text-base font-semibold text-indigo-700">{(selectedCost.category || "Uncategorized").trim()}</span>
                  </div>
                </div>

                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment Source</span>
                    <span className="font-medium text-gray-800 text-xs sm:text-sm text-right">
                      {derivePaidFrom(selectedCost) === "front" ? "Front Office (Cash)" : "Back Office"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Method</span>
                    <span className="font-medium text-gray-800 text-xs sm:text-sm text-right">
                      {methodLabel(derivePaidMethod(selectedCost)) || "—"}
                    </span>
                  </div>
                </div>

                <div className="p-1">
                  <span className="block mb-2 text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</span>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-xl p-4 border border-gray-100 leading-relaxed max-h-32 overflow-auto">
                    {selectedCost.description || "No description provided."}
                  </p>
                </div>

                {/* Vendor Payment Invoice Breakdown */}
                {selectedCost.meta?.allocations?.length > 0 && (
                  <div className="border-t border-gray-100 pt-4">
                    <span className="block mb-3 text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Invoices Paid ({selectedCost.meta.allocations.length})
                    </span>
                    <div className="space-y-2">
                      {selectedCost.meta.allocations.map((a, i) => (
                        <div key={i} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
                          <div>
                            <div className="font-bold text-gray-800 text-sm">{a.invoiceNo || a.billId || `Bill #${i + 1}`}</div>
                            <div className="text-gray-400 font-mono mt-0.5">
                              {a.invoiceDate && <span>Date: {a.invoiceDate}</span>}
                              {a.dueDate && <span className="ml-2">Due: {a.dueDate}</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-emerald-600 tabular-nums">{currency} {Number(a.amount).toFixed(2)}</div>
                            {a.billTotal > 0 && a.billTotal !== a.amount && (
                              <div className="text-[10px] text-gray-400">of {currency} {Number(a.billTotal).toFixed(2)}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attachments Section */}
                {(() => {
                  const allFiles = selectedCost.attachments?.length > 0 
                    ? selectedCost.attachments 
                    : (selectedCost.fileURL ? [selectedCost.fileURL] : []);
                  if (allFiles.length === 0) return null;
                  return (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Attachments ({allFiles.length})
                        </span>
                        <div className="flex gap-2">
                          {allFiles.length > 1 && (
                            <button
                              onClick={() => {
                                setSelectedCost(null);
                                setViewAttachmentsEntry(selectedCost);
                              }}
                              className="text-[10px] sm:text-xs font-semibold bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 transition-colors"
                            >
                              View All Files
                            </button>
                          )}
                          <a
                            href={allFiles[0]}
                            download={`CostEntry-${selectedCost.date}`}
                            className="text-[10px] sm:text-xs font-semibold bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-200 transition-colors"
                          >
                            Download
                          </a>
                        </div>
                      </div>
                      {allFiles.length === 1 ? (
                        <div className="w-full h-48 sm:h-80 border border-gray-200 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center p-2 shadow-inner">
                          {allFiles[0].match(/\.(jpeg|jpg|gif|png|webp|bmp)(?:\?.*)?$/i) ? (
                            <img 
                              src={allFiles[0]} 
                              alt="Preview" 
                              className="max-w-full max-h-full object-contain rounded-lg"
                            />
                          ) : (
                            <iframe
                              src={allFiles[0]}
                              className="w-full h-full rounded-lg bg-white"
                              title="Invoice Preview"
                            />
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {allFiles.map((url, i) => (
                            <div key={i} className="h-32 border border-gray-200 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center p-1 shadow-inner cursor-pointer hover:ring-2 ring-mint-400 transition-all"
                              onClick={() => {
                                setSelectedCost(null);
                                setViewAttachmentsEntry(selectedCost);
                              }}
                            >
                              {url.match(/\.(jpeg|jpg|gif|png|webp|bmp)(?:\?.*)?$/i) ? (
                                <img src={url} alt={`Attachment ${i + 1}`} className="max-w-full max-h-full object-contain rounded-lg" />
                              ) : (
                                <div className="flex flex-col items-center gap-1 text-gray-400">
                                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                  <span className="text-[10px]">PDF #{i + 1}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="p-4 sm:px-6 sm:py-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex w-full sm:w-auto gap-2">
                  <button
                    onClick={handleDelete}
                    className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-xl text-sm font-semibold bg-red-100 hover:bg-red-200 text-red-700 transition-colors text-center"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-xl text-sm font-semibold bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors text-center"
                  >
                    Edit Cost
                  </button>
                </div>
                
                <div className="flex w-full sm:w-auto gap-2 text-xs">
                  <button
                    onClick={() => exportCostToPDF(selectedCost, branchData)}
                    className="flex-1 sm:flex-none px-3 py-2.5 sm:py-2 rounded-lg font-medium bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
                    title="Export PDF"
                  >
                    PDF
                  </button>
                  <button
                    onClick={() => exportCostToExcel(selectedCost, branchData)}
                    className="flex-1 sm:flex-none px-3 py-2.5 sm:py-2 rounded-lg font-medium bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
                    title="Export Excel"
                  >
                    Excel
                  </button>
                  <button
                    onClick={() => handleCostShare(selectedCost, branchData)}
                    className="flex-1 sm:flex-none px-3 py-2.5 sm:py-2 rounded-lg font-medium bg-indigo-100 hover:bg-indigo-200 text-indigo-700 transition-colors"
                  >
                    Share
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
