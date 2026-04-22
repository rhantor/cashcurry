"use client";
import React, { useState, useMemo, useEffect } from "react";
import { skipToken } from "@reduxjs/toolkit/query/react";
import { useGetAuditLogsQuery } from "@/lib/redux/api/auditApiSlice";
import { useGetBranchesQuery } from "@/lib/redux/api/branchApiSlice";
import Pagination from "@/app/components/common/Pagination";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUserFromStorage() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function fmt(isoStr) {
  if (!isoStr) return "—";
  return new Date(isoStr).toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ✅ LOCAL date helpers — avoids UTC mismatch in UTC+8 timezones
function localDateISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayISO() {
  return localDateISO();
}

function sevenDaysAgoISO() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return localDateISO(d);
}

function startOfMonthISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

// ✅ Recursively convert Firestore Timestamps inside before/after objects
function convertValue(val) {
  if (val === null || val === undefined) return val;
  // Firestore Timestamp has toDate()
  if (typeof val?.toDate === "function") return val.toDate().toISOString();
  // Firestore Timestamp stored as {seconds, nanoseconds}
  if (
    val !== null &&
    typeof val === "object" &&
    typeof val.seconds === "number" &&
    typeof val.nanoseconds === "number"
  ) {
    return new Date(val.seconds * 1000).toISOString();
  }
  if (Array.isArray(val)) return val.map(convertValue);
  if (typeof val === "object") {
    return Object.fromEntries(
      Object.entries(val).map(([k, v]) => [k, convertValue(v)])
    );
  }
  return val;
}

function safeStringify(val) {
  const converted = convertValue(val);
  if (converted === null || converted === undefined) return "—";
  if (typeof converted === "string") return converted;
  return JSON.stringify(converted);
}

// ─── Badge components ─────────────────────────────────────────────────────────

const ACTION_STYLES = {
  created: "bg-green-100 text-green-700 border border-green-200",
  updated: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  deleted: "bg-red-100 text-red-700 border border-red-200",
};

const COLLECTION_STYLES = {
  sales: "bg-blue-100 text-blue-700",
  costs: "bg-orange-100 text-orange-700",
  salaries: "bg-purple-100 text-purple-700",
  loans: "bg-cyan-100 text-cyan-700",
  vendorBills: "bg-gray-100 text-gray-700",
};

const COLLECTION_LABELS = {
  sales: "Sales",
  costs: "Costs",
  salaries: "Salaries",
  loans: "Loans",
  vendorBills: "Vendor Bills",
};

function ActionBadge({ action }) {
  const cls = ACTION_STYLES[action] || "bg-gray-100 text-gray-600";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {action}
    </span>
  );
}

function CollectionBadge({ name }) {
  const cls = COLLECTION_STYLES[name] || "bg-gray-100 text-gray-600";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {COLLECTION_LABELS[name] || name}
    </span>
  );
}

// ─── Diff viewer ──────────────────────────────────────────────────────────────

function DiffViewer({ before, after, action }) {
  if (!before && !after)
    return <p className="text-gray-400 text-sm">No data captured.</p>;

  const allKeys = Array.from(
    new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  ).filter((k) => !["createdAt", "updatedAt"].includes(k));

  if (action === "created") {
    return (
      <div className="space-y-1">
        {allKeys.map((k) => (
          <div key={k} className="flex gap-2 text-xs">
            <span className="w-36 shrink-0 text-gray-500 font-medium">{k}</span>
            <span className="text-green-700 bg-green-50 px-1 rounded break-all">
              {safeStringify(after?.[k])}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (action === "deleted") {
    return (
      <div className="space-y-1">
        {allKeys.map((k) => (
          <div key={k} className="flex gap-2 text-xs">
            <span className="w-36 shrink-0 text-gray-500 font-medium">{k}</span>
            <span className="text-red-700 bg-red-50 px-1 rounded line-through break-all">
              {safeStringify(before?.[k])}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // updated — show only changed fields
  const changedKeys = allKeys.filter(
    (k) =>
      safeStringify(before?.[k]) !== safeStringify(after?.[k])
  );

  if (changedKeys.length === 0) {
    return (
      <p className="text-gray-400 text-xs">No field changes detected.</p>
    );
  }

  return (
    <div className="space-y-2">
      {changedKeys.map((k) => (
        <div key={k} className="text-xs">
          <span className="font-medium text-gray-600">{k}</span>
          <div className="flex flex-wrap gap-2 mt-0.5 items-center">
            <span className="text-red-600 bg-red-50 px-1 rounded line-through break-all">
              {safeStringify(before?.[k])}
            </span>
            <span className="text-gray-400">→</span>
            <span className="text-green-700 bg-green-50 px-1 rounded break-all">
              {safeStringify(after?.[k])}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

export default function AuditLogPage() {
  const [companyId, setCompanyId] = useState(null);

  const [filterType, setFilterType] = useState("last7days");
  const [dateRange, setDateRange] = useState({
    from: sevenDaysAgoISO(),
    to: todayISO(),
  });
  const [actionFilter, setActionFilter] = useState("all");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [actorSearch, setActorSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const u = getUserFromStorage();
    if (u?.companyId) setCompanyId(u.companyId);
  }, []);

  // ✅ Fetch branches to show branch names instead of IDs
  const { data: branches = [] } = useGetBranchesQuery(companyId ?? skipToken);
  const branchMap = useMemo(() => {
    const map = {};
    branches.forEach((b) => { map[b.id] = b.name; });
    return map;
  }, [branches]);

  // Build date args using LOCAL dates
  const { startDate, endDate } = useMemo(() => {
    const today = todayISO();
    if (filterType === "last7days") {
      return { startDate: sevenDaysAgoISO(), endDate: today };
    }
    if (filterType === "monthly") {
      return { startDate: startOfMonthISO(), endDate: today };
    }
    if (filterType === "range" && dateRange.from && dateRange.to) {
      return { startDate: dateRange.from, endDate: dateRange.to };
    }
    return { startDate: null, endDate: null };
  }, [filterType, dateRange]);

  const queryArgs = companyId
    ? { companyId, startDate, endDate }
    : skipToken;

  const { data: logs = [], isLoading, isError } = useGetAuditLogsQuery(queryArgs);

  const filtered = useMemo(() => {
    let list = [...logs];
    if (actionFilter !== "all")
      list = list.filter((l) => l.action === actionFilter);
    if (collectionFilter !== "all")
      list = list.filter((l) => l.collection === collectionFilter);
    if (actorSearch.trim()) {
      const q = actorSearch.toLowerCase();
      list = list.filter((l) =>
        (l.actorName || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [logs, actionFilter, collectionFilter, actorSearch]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleFilterType = (val) => {
    setFilterType(val);
    setCurrentPage(1);
  };

  const toggleExpand = (id) =>
    setExpandedId((prev) => (prev === id ? null : id));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Every create, update and delete on financial records — who did it and when.
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3 items-center">
        <select
          value={filterType}
          onChange={(e) => handleFilterType(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mint-400"
        >
          <option value="last7days">Last 7 Days</option>
          <option value="monthly">This Month</option>
          <option value="range">Date Range</option>
          <option value="all">All Time</option>
        </select>

        {filterType === "range" && (
          <>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) =>
                setDateRange((p) => ({ ...p, from: e.target.value }))
              }
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) =>
                setDateRange((p) => ({ ...p, to: e.target.value }))
              }
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </>
        )}

        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mint-400"
        >
          <option value="all">All Actions</option>
          <option value="created">Created</option>
          <option value="updated">Updated</option>
          <option value="deleted">Deleted</option>
        </select>

        <select
          value={collectionFilter}
          onChange={(e) => { setCollectionFilter(e.target.value); setCurrentPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mint-400"
        >
          <option value="all">All Collections</option>
          <option value="sales">Sales</option>
          <option value="costs">Costs</option>
          <option value="salaries">Salaries</option>
          <option value="loans">Loans</option>
          <option value="vendorBills">Vendor Bills</option>
        </select>

        <input
          type="text"
          placeholder="Search by user…"
          value={actorSearch}
          onChange={(e) => { setActorSearch(e.target.value); setCurrentPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-mint-400"
        />

        <span className="ml-auto text-xs text-gray-400">
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">
            Loading audit log…
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center h-40 text-red-400">
            Failed to load audit log. You may not have permission.
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <span className="text-3xl">📋</span>
            <p className="text-sm">No audit records found for this filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Collection</th>
                  <th className="px-4 py-3 font-semibold">Branch</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr
                      className={`hover:bg-gray-50 transition-colors ${
                        expandedId === log.id ? "bg-mint-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                        {fmt(log.timestamp)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {log.actorName || "unknown"}
                      </td>
                      <td className="px-4 py-3">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-4 py-3">
                        <CollectionBadge name={log.collection} />
                      </td>
                      {/* ✅ Show branch name instead of ID */}
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {log.branchId
                          ? (branchMap[log.branchId] || log.branchId)
                          : <span className="text-gray-400 italic">company</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleExpand(log.id)}
                          className="text-xs text-mint-600 hover:text-mint-800 font-medium underline underline-offset-2"
                        >
                          {expandedId === log.id ? "Hide" : "View"}
                        </button>
                      </td>
                    </tr>

                    {expandedId === log.id && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-4 bg-mint-50 border-l-4 border-mint-400"
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-3 mb-1">
                              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Changes
                              </span>
                              <span className="text-xs text-gray-400 font-mono">
                                {log.docId}
                              </span>
                            </div>
                            <DiffViewer
                              before={log.before}
                              after={log.after}
                              action={log.action}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(p) => {
            setCurrentPage(p);
            setExpandedId(null);
          }}
        />
      )}
    </div>
  );
}
