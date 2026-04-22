"use client";

import React, { useMemo, useState } from "react";
import { subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, format, parseISO } from "date-fns";
import { useGetApprovedLoanSummaryQuery } from "@/lib/redux/api/loanApiSlice";
import { useGetBranchesBasicQuery } from "@/lib/redux/api/branchApiSlice";
import LoanPayCards from "./LoanPayCards";
import LoanActivityFeed from "./LoanActivityFeed";
import useCurrency from "@/app/hooks/useCurrency";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import { exportLoanSummaryToExcel, exportLoanSummaryToPDF } from "@/utils/export/exportLoanSummary";

/* ─── period options ─── */
const PERIODS = [
  { value: "all",       label: "All Time" },
  { value: "last7",     label: "Last 7 Days" },
  { value: "thisWeek",  label: "This Week" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "range",     label: "Custom Range" },
];

/* compute { fromMs, toMs, label } from the filter state */
const computeDateRange = (period, customFrom, customTo) => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  switch (period) {
    case "last7": {
      const from = subDays(today, 6); from.setHours(0, 0, 0, 0);
      return { fromMs: from.getTime(), toMs: today.getTime(),
               label: `Last 7 Days (${format(from,"dd MMM")} – ${format(today,"dd MMM yyyy")})` };
    }
    case "thisWeek": {
      const from = startOfWeek(today, { weekStartsOn: 1 });
      const to   = endOfWeek(today,   { weekStartsOn: 1 });
      return { fromMs: from.getTime(), toMs: to.getTime(),
               label: `This Week (${format(from,"dd MMM")} – ${format(to,"dd MMM yyyy")})` };
    }
    case "thisMonth": {
      const from = startOfMonth(today);
      return { fromMs: from.getTime(), toMs: today.getTime(),
               label: `This Month (${format(from,"MMM yyyy")})` };
    }
    case "lastMonth": {
      const last  = subMonths(today, 1);
      const from  = startOfMonth(last);
      const to    = endOfMonth(last);
      return { fromMs: from.getTime(), toMs: to.getTime(),
               label: `Last Month (${format(from,"MMM yyyy")})` };
    }
    case "range": {
      const from = customFrom ? parseISO(customFrom) : null;
      const to   = customTo   ? parseISO(customTo)   : null;
      if (from) from.setHours(0, 0, 0, 0);
      if (to)   to.setHours(23, 59, 59, 999);
      return {
        fromMs: from?.getTime() ?? null,
        toMs:   to?.getTime()   ?? null,
        label: from && to
          ? `${format(from,"dd MMM yyyy")} – ${format(to,"dd MMM yyyy")}`
          : "Custom Range",
      };
    }
    default:
      return { fromMs: null, toMs: null, label: "All Time" };
  }
};

/* ─── helpers ─── */
const fmtAmt = (v, currency) =>
  `${currency} ${Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDate = (ms) => {
  if (!ms) return "—";
  try { return new Date(ms).toLocaleDateString(); } catch { return "—"; }
};

/* ─── stat card ─── */
const StatCard = ({ label, value, tone, currency }) => {
  const styles = {
    green:  "bg-emerald-50 border-emerald-200 text-emerald-800",
    red:    "bg-rose-50 border-rose-200 text-rose-800",
    blue:   "bg-blue-50 border-blue-200 text-blue-800",
    slate:  "bg-slate-50 border-slate-200 text-slate-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${styles[tone] || styles.slate}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider opacity-60 mb-1">{label}</p>
      <p className="text-lg font-bold">{fmtAmt(value, currency)}</p>
    </div>
  );
};

/* ─── individual loan card ─── */
const LoanCard = ({ row, counterpartyName, currency, isProvided }) => {
  const outstanding = Number(row.outstanding ?? row.amount ?? 0);
  const settled = row.settled || outstanding <= 0.000001;

  return (
    <div className={`rounded-lg border p-3 text-sm transition-all ${
      settled
        ? "bg-slate-50 border-slate-100 opacity-60"
        : isProvided
          ? "bg-emerald-50 border-emerald-200"
          : "bg-amber-50 border-amber-200"
    }`}>
      <div className="flex items-start justify-between gap-3">
        {/* Left — details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1.5">
            <span className="font-semibold text-slate-800">
              {isProvided ? `→ ${counterpartyName}` : `← ${counterpartyName}`}
            </span>
            {settled ? (
              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-200 text-slate-600">Settled</span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-200 text-amber-800">Outstanding</span>
            )}
          </div>

          {row.reason && (
            <p className="text-xs text-slate-600 mb-1.5 italic">
              &ldquo;{row.reason}&rdquo;
            </p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-500">
            <span>Requested: {fmtDate(row.createdAt)}</span>
            {row.durationDays > 0 && <span>Duration: {row.durationDays}d</span>}
            {row.requestedBy?.username && (
              <span>By: <span className="font-medium text-slate-700">{row.requestedBy.username}</span></span>
            )}
            {row.approvedBy && (
              <span>
                Approved by:{" "}
                <span className="font-medium text-slate-700">
                  {row.approvedBy.name || row.approvedBy.username || "—"}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Right — amounts */}
        <div className="text-right shrink-0">
          <p className="text-[10px] text-slate-400 mb-0.5">Original</p>
          <p className="font-semibold text-slate-700">{fmtAmt(row.amount, currency)}</p>
          {!settled && (
            <div className="mt-1.5">
              <p className="text-[10px] text-amber-600 mb-0.5">Outstanding</p>
              <p className="font-bold text-amber-700">{fmtAmt(outstanding, currency)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── relation section (provided / taken for one counterparty) ─── */
const RelationSection = ({ title, icon, loans, currency, isProvided, nameOf }) => {
  const [expanded, setExpanded] = useState(true);
  const outstanding = loans.reduce((s, r) => s + Number(r.outstanding ?? r.amount ?? 0), 0);
  const hasOutstanding = outstanding > 0.000001;

  if (!loans.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="font-semibold text-slate-800 text-sm">{title}</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
            {loans.length} loan{loans.length !== 1 ? "s" : ""}
          </span>
          {hasOutstanding && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              {fmtAmt(outstanding, currency)} outstanding
            </span>
          )}
        </div>
        <span className="text-slate-400 text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Loan cards */}
      {expanded && (
        <div className="p-3 space-y-2 bg-white">
          {loans.map((row) => {
            const counterpartyName = isProvided
              ? (row.requestFrom || nameOf(row.fromBranchId))   // borrower
              : (row.requestedTo || nameOf(row.toBranchId));    // lender
            return (
              <LoanCard
                key={row.loanId}
                row={row}
                counterpartyName={counterpartyName}
                currency={currency}
                isProvided={isProvided}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ─── main component ─── */
export default function LoanSummary() {
  const { ready, companyId, branchId, user } = useResolvedCompanyBranch();
  const currency = useCurrency();

  // Filter state
  const [period, setPeriod]           = useState("thisMonth");
  const [customFrom, setCustomFrom]   = useState("");
  const [customTo, setCustomTo]       = useState("");
  const { fromMs, toMs, label: periodLabel } = useMemo(
    () => computeDateRange(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  const { data: summary = {}, isLoading, error } = useGetApprovedLoanSummaryQuery(
    companyId ? { companyId, fromMs, toMs } : undefined,
    { skip: !companyId }
  );
  const { data: branches = [] } = useGetBranchesBasicQuery(companyId || undefined, {
    skip: !companyId,
  });

  // Build a name map from stored loan data so branch names show even before
  // the branches query resolves (loans store requestFrom / requestedTo at creation time)
  const storedNamesMap = useMemo(() => {
    const map = {};
    Object.values(summary).forEach((s) => {
      [...(s.providedDetails || []), ...(s.takenDetails || [])].forEach((r) => {
        if (r.fromBranchId && r.requestFrom) map[r.fromBranchId] = r.requestFrom;
        if (r.toBranchId   && r.requestedTo) map[r.toBranchId]   = r.requestedTo;
      });
    });
    return map;
  }, [summary]);

  const nameOf = (id) =>
    branches.find((b) => b.id === id)?.name || storedNamesMap[id] || id || "—";

  const isBranchLevel = ["branchAdmin", "manager"].includes(user?.role);

  const visible = useMemo(() => {
    if (!companyId || !ready) return {};
    if (!isBranchLevel) return summary;
    return branchId && summary?.[branchId] ? { [branchId]: summary[branchId] } : {};
  }, [companyId, ready, isBranchLevel, branchId, summary]);

  // Payment cards only show what the current branch owes
  const cardsData = useMemo(() => {
    if (!ready || !branchId || !summary?.[branchId]?.relations) return {};
    const rels = summary[branchId].relations;
    const adapted = Object.fromEntries(
      Object.entries(rels).map(([otherId, rel]) => [
        otherId,
        { net: Number(rel?.taken || 0) },
      ])
    );
    return { [branchId]: { relations: adapted } };
  }, [ready, branchId, summary]);

  if (!ready) return <p className="p-6 text-sm text-slate-500">Syncing session…</p>;
  if (!companyId) return <p className="p-6 text-sm text-slate-500">Please log in to view loans.</p>;
  if (isLoading) return <p className="p-6 text-sm text-slate-500">Loading loan summary…</p>;
  if (error) return <p className="p-6 text-sm text-red-600">Error: {error?.message || "Failed to load"}</p>;

  const entries = Object.entries(visible);

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Loan Summary</h2>
          <p className="text-xs text-slate-500 mt-0.5">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportLoanSummaryToExcel({
              visible,
              nameOf,
              currency,
              companyName: "",
              branchName: isBranchLevel ? nameOf(branchId) : "",
              generatedAt: `${periodLabel} — ${new Date().toLocaleString()}`,
            })}
            className="px-3 py-1.5 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          >
            Export Excel
          </button>
          <button
            onClick={() => exportLoanSummaryToPDF({
              visible,
              nameOf,
              currency,
              companyName: "",
              branchName: isBranchLevel ? nameOf(branchId) : "",
              generatedAt: new Date().toLocaleString(),
            })}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-end gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Period</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {period === "range" && (
          <>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </>
        )}

        {isLoading && (
          <span className="text-xs text-slate-400 self-end pb-1.5">Loading…</span>
        )}
      </div>

      {/* ── Summary content ── */}
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">
          {isLoading ? "Loading…" : `No loan data found for "${periodLabel}".`}
        </p>
      ) : (
        entries.map(([bid, s]) => {
          const branchLabel = nameOf(bid);
          const net = Number(s?.net || 0);
          return (
            <div key={bid} className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1 rounded-full bg-slate-800" />
                <h3 className="text-base font-bold text-slate-800">{branchLabel}</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard label="Total Provided" value={s?.provided || 0} tone="green" currency={currency} />
                <StatCard label="Total Taken"    value={s?.taken    || 0} tone="red"   currency={currency} />
                <StatCard
                  label="Net Position"
                  value={Math.abs(net)}
                  tone={net >= 0 ? "green" : "red"}
                  currency={currency}
                />
              </div>

              <div className="space-y-3">
                {s?.providedDetails?.length > 0 && (
                  <RelationSection
                    title="Provided to Others (as Lender)"
                    icon="↗"
                    loans={s.providedDetails}
                    currency={currency}
                    isProvided={true}
                    nameOf={nameOf}
                  />
                )}
                {s?.takenDetails?.length > 0 && (
                  <RelationSection
                    title="Taken from Others (as Borrower)"
                    icon="↙"
                    loans={s.takenDetails}
                    currency={currency}
                    isProvided={false}
                    nameOf={nameOf}
                  />
                )}
                {!s?.providedDetails?.length && !s?.takenDetails?.length && (
                  <p className="text-sm text-slate-500 italic">No loan details for this period.</p>
                )}
              </div>

              <hr className="border-slate-200" />
            </div>
          );
        })
      )}

      {/* Settle outstanding */}
      {branchId && <LoanPayCards summary={cardsData} />}

      {/* Activity feed — shares the same date filter */}
      <LoanActivityFeed fromMs={fromMs} toMs={toMs} periodLabel={periodLabel} />
    </div>
  );
}
