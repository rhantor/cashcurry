"use client";
import React, { useState, useMemo, useEffect } from "react";
import { normalizeLog } from "@/app/audit-log/normalize";
import { skipToken } from "@reduxjs/toolkit/query/react";
import { useGetBranchAuditLogsQuery } from "@/lib/redux/api/auditApiSlice";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import Pagination from "@/app/components/common/Pagination";
import { hasRole } from "@/lib/authz/roles";
import { getSessionUser } from "@/lib/session";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUserFromStorage() {
  try {
    const raw = getSessionUser();
    return raw ? raw : null;
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

function convertValue(val) {
  if (val === null || val === undefined) return val;
  if (typeof val?.toDate === "function") return val.toDate().toISOString();
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

function FormatValue({ val, fieldName }) {
  const converted = convertValue(val);
  if (converted === null || converted === undefined || converted === "") {
    return <span className="text-subtle italic">—</span>;
  }
  
  if (Array.isArray(converted)) {
    if (converted.length === 0) return <span className="text-subtle italic">empty</span>;
    if (fieldName === "attachments" || fieldName === "images") {
      return (
        <div className="flex flex-col gap-1 mt-0.5">
          {converted.map((url, i) => (
            typeof url === 'string' && url.startsWith('http') ? (
              <a key={i} href={url} target="_blank" rel="noreferrer" className="text-info hover:underline text-[11px] truncate block">
                [View Attachment {i + 1}]
              </a>
            ) : (
              <span key={i} className="text-[11px]">{String(url)}</span>
            )
          ))}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-0.5 mt-0.5">
        {converted.map((item, i) => (
          <div key={i} className="bg-black/5 px-1.5 py-0.5 rounded text-[11px]">
             {typeof item === "object" ? JSON.stringify(item) : String(item)}
          </div>
        ))}
      </div>
    );
  }

  if (typeof converted === "object") {
    if (fieldName === "createdBy" || fieldName === "updatedBy") {
      return <span>{converted.name || converted.username || converted.email || "System User"}</span>;
    }
    return (
      <pre className="whitespace-pre-wrap text-[10px] leading-tight bg-black/5 p-1 rounded mt-0.5">
        {JSON.stringify(converted, null, 2)}
      </pre>
    );
  }

  return <span>{String(converted)}</span>;
}

// ─── Badge components ─────────────────────────────────────────────────────────

const ACTION_STYLES = {
  created: "bg-brand-soft text-brand border border-brand/30",
  updated: "bg-warning-soft text-warning border border-warning/30",
  deleted: "bg-danger-soft text-danger border border-danger/30",
};

const COLLECTION_STYLES = {
  sales: "bg-info-soft text-info",
  costs: "bg-warning-soft text-warning",
  salaries: "bg-warning-soft text-warning",
  loans: "bg-info-soft text-info",
  vendorBills: "bg-surface-2 text-fg",
};

const COLLECTION_LABELS = {
  sales: "Sales",
  costs: "Costs",
  salaries: "Salaries",
  loans: "Loans",
  vendorBills: "Vendor Bills",
  advances: "Advances",
  payroll: "Payroll",
  staff: "Staff",
};

function ActionBadge({ action, label }) {
  const cls = ACTION_STYLES[action] || "bg-surface-2 text-muted";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {label || action}
    </span>
  );
}

function CollectionBadge({ name }) {
  const cls = COLLECTION_STYLES[name] || "bg-surface-2 text-muted";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {COLLECTION_LABELS[name] || name}
    </span>
  );
}

// ─── Diff viewer ──────────────────────────────────────────────────────────────

function DiffViewer({ before, after, action, details }) {
  if (!before && !after)
    return <p className="text-sm text-fg">{details || <span className="text-subtle">No details were saved with this entry.</span>}</p>;

  const allKeys = Array.from(
    new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  ).filter((k) => !["createdAt", "updatedAt", "searchKeywords", "searchArray"].includes(k));

  if (action === "created") {
    return (
      <div className="space-y-1.5">
        {allKeys.map((k) => (
          <div key={k} className="flex gap-2 text-xs items-start">
            <span className="w-36 shrink-0 text-muted font-medium pt-0.5">{k}</span>
            <div className="text-brand bg-brand-soft px-1.5 py-0.5 rounded break-all border border-brand/20 flex-1">
              <FormatValue val={after?.[k]} fieldName={k} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (action === "deleted") {
    return (
      <div className="space-y-1.5">
        {allKeys.map((k) => (
          <div key={k} className="flex gap-2 text-xs items-start">
            <span className="w-36 shrink-0 text-muted font-medium pt-0.5">{k}</span>
            <div className="text-danger bg-danger-soft px-1.5 py-0.5 rounded line-through break-all border border-danger/20 flex-1">
              <FormatValue val={before?.[k]} fieldName={k} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // updated — show only changed fields
  const changedKeys = allKeys.filter(
    (k) =>
      JSON.stringify(convertValue(before?.[k])) !== JSON.stringify(convertValue(after?.[k]))
  );

  if (changedKeys.length === 0) {
    return (
      <p className="text-subtle text-xs">No field changes detected.</p>
    );
  }

  return (
    <div className="space-y-2.5">
      {changedKeys.map((k) => (
        <div key={k} className="text-xs">
          <span className="font-medium text-muted block mb-1">{k}</span>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="text-danger bg-danger-soft px-1.5 py-0.5 rounded line-through break-all border border-danger/20 flex-1">
              <FormatValue val={before?.[k]} fieldName={k} />
            </div>
            <span className="text-subtle hidden sm:inline">→</span>
            <div className="text-brand bg-brand-soft px-1.5 py-0.5 rounded break-all border border-brand/20 flex-1">
              <FormatValue val={after?.[k]} fieldName={k} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ["branchAdmin", "manager"];
const PAGE_SIZE = 15;

export default function BranchAuditPage() {
  const [user, setUser] = useState(null);

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
    setUser(getUserFromStorage());
  }, []);

  const companyId = user?.companyId ?? null;
  const branchId = user?.branchId ?? null;
  const isAllowed = hasRole(user, ALLOWED_ROLES);

  const { data: branchData } = useGetSingleBranchQuery(
    companyId && branchId ? { companyId, branchId } : skipToken
  );

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

  const queryArgs =
    companyId && branchId && isAllowed
      ? { companyId, branchId, startDate, endDate }
      : skipToken;

  const { data: rawLogs = [], isLoading, isError } = useGetBranchAuditLogsQuery(queryArgs);
  // record changes and app events, read the same way
  const logs = useMemo(() => rawLogs.map(normalizeLog), [rawLogs]);

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

  if (user && !isAllowed) {
    return (
      <div className="flex items-center justify-center h-64 text-muted">
        You do not have permission to view this page.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-fg">Branch Audit Log</h1>
        <p className="text-sm text-muted mt-0.5">
          {branchData?.name
            ? `All activity for ${branchData.name} — who did what and when.`
            : "All create, update, and delete activity for this branch."}
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-surface rounded-xl shadow-sm border border-line p-4 flex flex-wrap gap-3 items-center">
        <select
          value={filterType}
          onChange={(e) => handleFilterType(e.target.value)}
          className="border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--cc-ring)]"
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
              className="border border-line rounded-lg px-3 py-2 text-sm"
            />
            <span className="text-subtle text-sm">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) =>
                setDateRange((p) => ({ ...p, to: e.target.value }))
              }
              className="border border-line rounded-lg px-3 py-2 text-sm"
            />
          </>
        )}

        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }}
          className="border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--cc-ring)]"
        >
          <option value="all">All Actions</option>
          <option value="created">Created</option>
          <option value="updated">Updated</option>
          <option value="deleted">Deleted</option>
        </select>

        <select
          value={collectionFilter}
          onChange={(e) => { setCollectionFilter(e.target.value); setCurrentPage(1); }}
          className="border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--cc-ring)]"
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
          className="border border-line rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-[var(--cc-ring)]"
        />

        <span className="ml-auto text-xs text-subtle">
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl shadow-sm border border-line overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-subtle">
            Loading audit log…
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center h-40 text-danger">
            Failed to load audit log. You may not have permission.
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-subtle gap-2">
            <span className="text-3xl">📋</span>
            <p className="text-sm">No audit records found for this filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-surface-2/60 border-b border-line text-left text-xs text-muted uppercase tracking-wide">
                  <th className="px-4 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Collection</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {paginated.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr
                      className={`hover:bg-surface-2 transition-colors ${
                        expandedId === log.id ? "bg-brand-soft" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-muted whitespace-nowrap text-xs">
                        {fmt(log.timestamp)}
                      </td>
                      <td className="px-4 py-3 font-medium text-fg">
                        {log.actorName || "unknown"}
                      </td>
                      <td className="px-4 py-3">
                        <ActionBadge action={log.action} label={log.what} />
                      </td>
                      <td className="px-4 py-3">
                        <CollectionBadge name={log.collection} />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleExpand(log.id)}
                          className="text-xs text-brand hover:text-brand font-medium underline underline-offset-2"
                        >
                          {expandedId === log.id ? "Hide" : "View"}
                        </button>
                      </td>
                    </tr>

                    {expandedId === log.id && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-4 bg-brand-soft border-l-4 border-brand"
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-3 mb-1">
                              <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                                Changes
                              </span>
                              <span className="text-xs text-subtle font-mono">
                                {log.docId}
                              </span>
                            </div>
                            <DiffViewer
                              before={log.before}
                              after={log.after}
                              action={log.action}
                              details={log.details}
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
