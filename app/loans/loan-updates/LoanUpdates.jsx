"use client";
import React, { useMemo, useState } from "react";
import { useGetLoanActivitiesQuery } from "@/lib/redux/api/loanApiSlice";
import { FaHandHoldingUsd, FaClock, FaExchangeAlt } from "react-icons/fa";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import useCurrency from "@/app/hooks/useCurrency";

const tsToMs = (v) => {
  if (!v) return null;
  if (typeof v === "number") return v;
  if (v?.seconds) return v.seconds * 1000;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : ms;
};

const fmtDateTime = (v) => {
  const ms = tsToMs(v);
  if (!ms) return "-";
  const d = new Date(ms);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
};

const STATUS_STYLE = {
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected:  "bg-rose-100   text-rose-700   border-rose-200",
  pending:   "bg-amber-100  text-amber-700  border-amber-200",
};

/* ─── single card ─── */
function LoanCard({ item, branchId, currency }) {
  const isRepayment = item.type === "repayment";
  const status      = item.status || "pending";
  const amount      = Number(item.amount || 0).toFixed(2);

  // _fromBranchId = BORROWER (the branch that requested money)
  // _toBranchId   = LENDER   (the branch being asked to provide money)
  const borrowerName = item.requestFrom || item._fromBranchId || "—";
  const lenderName   = item.requestedTo || item._toBranchId   || "—";

  // Our role on this record
  const weBorrowed = item._fromBranchId === branchId;
  const weLent     = item._toBranchId   === branchId;
  const ourRole    = weBorrowed ? "We Borrowed" : weLent ? "We Lent" : null;

  const requestedBy =
    item.requestedBy?.username || item.createdBy?.username ||
    item.requestedBy?.email    || "-";
  const approvedBy =
    item.approvedBy?.name || item.approvedBy?.username || null;

  const created  = fmtDateTime(item.createdAt);
  const actioned = fmtDateTime(item.updatedAt || item.approvedAt);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* type badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
            isRepayment
              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
              : "bg-slate-100 text-slate-700 border-slate-200"
          }`}>
            {isRepayment ? <FaExchangeAlt className="h-3 w-3" /> : <FaHandHoldingUsd className="h-3 w-3" />}
            {isRepayment ? "Repayment" : "Loan"}
          </span>

          {/* our role badge */}
          {ourRole && (
            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
              weBorrowed
                ? "bg-orange-50 text-orange-700 border-orange-200"
                : "bg-teal-50   text-teal-700   border-teal-200"
            }`}>
              {ourRole}
            </span>
          )}

          {/* status */}
          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize border ${STATUS_STYLE[status] || STATUS_STYLE.pending}`}>
            {status}
          </span>
        </div>

        <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
          <FaClock className="h-3 w-3" />
          {created}
        </div>
      </div>

      {/* Amount */}
      <p className="text-2xl font-bold text-slate-800">{currency} {amount}</p>

      {/* Borrower / Lender */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Borrower</p>
          <p className="font-medium text-slate-700 truncate">{borrowerName}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Lender</p>
          <p className="font-medium text-slate-700 truncate">{lenderName}</p>
        </div>
      </div>

      {/* Details */}
      <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-100">
        {!isRepayment && item.reason && (
          <p>Reason: <span className="font-medium text-slate-700">{item.reason}</span></p>
        )}

        <p>
          Requested by: <span className="font-medium text-slate-700">{requestedBy}</span>
          {approvedBy && (
            <> &nbsp;·&nbsp; {status === "rejected" ? "Rejected" : "Approved"} by:{" "}
              <span className="font-medium text-slate-700">{approvedBy}</span>
            </>
          )}
        </p>

        {isRepayment && (
          <p>
            Method: <span className="font-medium text-slate-700">{item.paymentMethod || "-"}</span>
            {item.paymentMethod === "cash"   && item.voucherNo   && <> &nbsp;·&nbsp; Vch: <span className="font-medium text-slate-700">{item.voucherNo}</span></>}
            {item.paymentMethod === "online" && item.bankName    && <> &nbsp;·&nbsp; <span className="font-medium text-slate-700">{item.bankName}</span></>}
            {item.paymentMethod === "online" && item.referenceNo && <> &nbsp;·&nbsp; Ref: <span className="font-medium text-slate-700">{item.referenceNo}</span></>}
            {item.proofUrl && (
              <> &nbsp;·&nbsp; <a href={item.proofUrl} target="_blank" rel="noreferrer" className="text-indigo-600 underline underline-offset-2">View proof</a></>
            )}
          </p>
        )}

        {status !== "pending" && actioned !== "-" && (
          <p>{status === "approved" ? "Approved" : "Rejected"} at: <span className="font-medium text-slate-700">{actioned}</span></p>
        )}
      </div>
    </div>
  );
}

/* ─── tab button ─── */
function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

/* ─── stat chip ─── */
function Chip({ label, value, color }) {
  const colors = {
    amber:   "bg-amber-50  text-amber-700  border-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rose:    "bg-rose-50   text-rose-700   border-rose-200",
    slate:   "bg-slate-50  text-slate-600  border-slate-200",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border ${colors[color] || colors.slate}`}>
      {label}: <b>{value}</b>
    </span>
  );
}

/* ─── main ─── */
export default function BranchLoanUpdates() {
  const currency = useCurrency();
  // tab: "all" | "borrowed" (we are borrower) | "lent" (we are lender)
  const [tab, setTab] = useState("all");
  const [typeFilter,   setTypeFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { ready, companyId, branchId } = useResolvedCompanyBranch();

  const { data: items = [], isLoading, isError } = useGetLoanActivitiesQuery(
    ready && companyId && branchId
      ? { companyId, branchId, direction: "all", status: "all", type: "all", pageLimit: 200 }
      : { skip: true },
    { skip: !ready || !companyId || !branchId, pollingInterval: 30000 }
  );

  const stats = useMemo(() => ({
    pending:  items.filter((i) => i.status === "pending").length,
    approved: items.filter((i) => i.status === "approved").length,
    rejected: items.filter((i) => i.status === "rejected").length,
  }), [items]);

  const displayed = useMemo(() => {
    let list = items;

    // "borrowed" = we are the borrower = _fromBranchId === branchId
    // "lent"     = we are the lender   = _toBranchId   === branchId
    if (tab === "borrowed") list = list.filter((i) => i._fromBranchId === branchId);
    if (tab === "lent")     list = list.filter((i) => i._toBranchId   === branchId);

    if (typeFilter   !== "all") list = list.filter((i) => i.type   === typeFilter);
    if (statusFilter !== "all") list = list.filter((i) => i.status === statusFilter);

    return [...list].sort((a, b) => (tsToMs(b.createdAt) || 0) - (tsToMs(a.createdAt) || 0));
  }, [items, tab, typeFilter, statusFilter, branchId]);

  /* ── states ── */
  if (!ready) return <div className="p-8 text-sm text-slate-500 animate-pulse">Syncing session…</div>;

  if (isLoading) return (
    <div className="p-8 space-y-3">
      {[1, 2, 3].map((i) => <div key={i} className="h-36 rounded-2xl bg-slate-100 animate-pulse" />)}
    </div>
  );

  if (isError) return (
    <div className="p-8">
      <div className="rounded-2xl bg-rose-50 border border-rose-200 p-5 text-sm text-rose-700">
        <p className="font-semibold mb-1">Failed to load loan activity</p>
        <p className="text-rose-500">Check your connection or Firestore permissions.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-5">
          <h1 className="text-xl font-bold text-slate-800">Loan Activity</h1>
          <p className="text-sm text-slate-500 mt-0.5">All loan and repayment requests involving this branch</p>
        </div>

        {/* Stats */}
        {items.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Chip label="Pending"  value={stats.pending}  color="amber"   />
            <Chip label="Approved" value={stats.approved} color="emerald" />
            <Chip label="Rejected" value={stats.rejected} color="rose"    />
            <Chip label="Total"    value={items.length}   color="slate"   />
          </div>
        )}

        {/* Tabs + filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Tab active={tab === "all"}      onClick={() => setTab("all")}>All</Tab>
          <Tab active={tab === "borrowed"} onClick={() => setTab("borrowed")}>We Borrowed</Tab>
          <Tab active={tab === "lent"}     onClick={() => setTab("lent")}>We Lent</Tab>

          <div className="ml-auto flex gap-2 flex-wrap">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm bg-white text-slate-700 shadow-sm"
            >
              <option value="all">Loan + Repayment</option>
              <option value="loan">Loans only</option>
              <option value="repayment">Repayments only</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm bg-white text-slate-700 shadow-sm"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Cards */}
        {displayed.length === 0 ? (
          <div className="text-center py-20 space-y-2">
            <p className="text-slate-400 text-sm">
              {items.length === 0
                ? "No loan activity yet for this branch."
                : "No results match the current filters."}
            </p>
            {items.length > 0 && (
              <button
                onClick={() => { setTab("all"); setTypeFilter("all"); setStatusFilter("all"); }}
                className="text-indigo-600 text-sm underline underline-offset-2"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {displayed.map((item) => (
              <LoanCard key={item.id} item={item} branchId={branchId} currency={currency} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
