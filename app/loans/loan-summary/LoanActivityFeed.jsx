/* eslint-disable react/prop-types */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useGetLoanActivitiesQuery } from "@/lib/redux/api/loanApiSlice";
import { useGetBranchesBasicQuery } from "@/lib/redux/api/branchApiSlice";
import useCurrency from "@/app/hooks/useCurrency";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";

const fmtDate = (v) => {
  try {
    const ms = v?.seconds ? v.seconds * 1000 : Date.parse(v);
    if (!ms) return "-";
    return new Date(ms).toLocaleString();
  } catch {
    return "-";
  }
};

export default function LoanActivityFeed({ fromMs = null, toMs = null, periodLabel = "All Time" }) {
  const currency = useCurrency();
  const { ready, companyId, branchId, user } = useResolvedCompanyBranch();

  // UI filters
  const [direction, setDirection] = useState("incoming"); // "incoming" | "outgoing" | "all"
  const [status, setStatus] = useState("all"); // "all" | "pending" | "approved" | "rejected"
  const [type, setType] = useState("all"); // "all" | "loan" | "repayment"

  const { data: branches = [] } = useGetBranchesBasicQuery(companyId, {
    skip: !companyId,
  });
  const nameOf = (id) => branches.find((b) => b.id === id)?.name || id;

  const {
    data: items = [],
    isLoading,
    error,
  } = useGetLoanActivitiesQuery(
    ready && companyId && branchId
      ? { companyId, branchId, direction, status, type, fromMs, toMs, pageLimit: 150 }
      : { skip: true },
    { skip: !ready || !companyId, pollingInterval: 30000 }
  );

  // quick stats
  const stats = useMemo(() => {
    const pendingIncoming = items
      .filter((r) => r.status === "pending" && r._toBranchId === branchId)
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    const pendingOutgoing = items
      .filter((r) => r.status === "pending" && r._fromBranchId === branchId)
      .reduce((s, r) => s + Number(r.amount || 0), 0);

    const approvedRepayments = items.filter(
      (r) => r.type === "repayment" && r.status === "approved"
    ).length;
    const rejectedRepayments = items.filter(
      (r) => r.type === "repayment" && r.status === "rejected"
    ).length;

    // branch breakdown for pending
    const byBranch = {};
    items
      .filter((r) => r.status === "pending")
      .forEach((r) => {
        const key =
          direction === "incoming"
            ? r._fromBranchId
            : direction === "outgoing"
            ? r._toBranchId
            : r._fromBranchId === branchId
            ? r._toBranchId
            : r._fromBranchId; // in "all", group by "the other" branch
        if (!key) return;
        byBranch[key] = (byBranch[key] || 0) + Number(r.amount || 0);
      });

    return {
      pendingIncoming,
      pendingOutgoing,
      approvedRepayments,
      rejectedRepayments,
      byBranch,
    };
  }, [items, branchId, direction]);

  if (!ready) return <p className="p-4 text-sm text-gray-500">Syncing session...</p>;
  if (!companyId || !branchId) return null;

  return (
    <div className="bg-white rounded-2xl shadow p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold mr-2">Activity</div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          {periodLabel}
        </span>

        {/* Direction */}
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="incoming">Incoming to me</option>
          <option value="outgoing">Outgoing from me</option>
          <option value="all">All</option>
        </select>

        {/* Status */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        {/* Type */}
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="all">Loan + Repayment</option>
          <option value="loan">Loans only</option>
          <option value="repayment">Repayments only</option>
        </select>
      </div>

      {/* quick stats */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="px-2 py-1 rounded bg-amber-100 text-amber-800">
          Pending incoming: <b>{currency} {stats.pendingIncoming.toFixed(2)}</b>
        </span>
        <span className="px-2 py-1 rounded bg-amber-100 text-amber-800">
          Pending outgoing: <b>{currency} {stats.pendingOutgoing.toFixed(2)}</b>
        </span>
        <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800">
          Repayments approved: <b>{stats.approvedRepayments}</b>
        </span>
        <span className="px-2 py-1 rounded bg-rose-100 text-rose-800">
          Repayments rejected: <b>{stats.rejectedRepayments}</b>
        </span>
      </div>

      {/* pending by branch breakdown */}
      {Object.keys(stats.byBranch).length > 0 && (
        <div className="text-xs">
          <div className="font-semibold mb-1">Pending by branch</div>
          <ul className="grid md:grid-cols-2 gap-1">
            {Object.entries(stats.byBranch).map(([bid, amt]) => (
              <li
                key={bid}
                className="flex justify-between border rounded px-2 py-1"
              >
                <span>{nameOf(bid)}</span>
                <b>{currency} {Number(amt).toFixed(2)}</b>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* list */}
      {isLoading ? (
        <div className="text-sm text-gray-500">Loading activities…</div>
      ) : error ? (
        <div className="text-sm text-red-600">
          {error?.message || "Failed to load activities"}
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-500">No activities</div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => {
            const isRepayment = r.type === "repayment";
            const statusClasses =
              r.status === "approved"
                ? "bg-emerald-100 text-emerald-700"
                : r.status === "rejected"
                ? "bg-rose-100 text-rose-700"
                : "bg-amber-100 text-amber-700";

            return (
              <div key={r.id} className="border rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2 py-0.5 text-[11px] rounded ${
                      isRepayment
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {isRepayment ? "Repayment" : "Loan"}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[11px] rounded ${statusClasses}`}
                  >
                    {r.status}
                  </span>
                  <span className="ml-auto text-xs text-gray-500">
                    {fmtDate(r.createdAt)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <div className="text-gray-700">
                    <div>
                      <b>{r.requestFrom || nameOf(r._fromBranchId)}</b> →{" "}
                      <b>{r.requestedTo || nameOf(r._toBranchId)}</b>
                    </div>
                    <div className="text-[12px] text-gray-500">
                      Requested by:{" "}
                      <b>
                        {r.requestedBy?.username ||
                          r.createdBy?.username ||
                          "-"}
                      </b>
                      {r.approvedBy && (
                        <>
                          {" • "}Approved by:{" "}
                          <b>
                            {r.approvedBy?.name ||
                              r.approvedBy?.username ||
                              "-"}
                          </b>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold">
                      {currency} {Number(r.amount || 0).toFixed(2)}
                    </div>
                    <div className="text-[12px] text-gray-500">
                      {isRepayment
                        ? r.note
                          ? `Note: ${r.note}`
                          : "Repayment"
                        : r.reason || "Loan"}
                    </div>
                  </div>
                </div>

                {isRepayment && (
                  <div className="mt-1 text-[12px] text-gray-600 flex items-center gap-3">
                    <span>
                      Method: <b>{r.paymentMethod || "-"}</b>
                    </span>
                    {r.paymentMethod === "cash" && (
                      <span>
                        Voucher: <b>{r.voucherNo || "-"}</b>
                      </span>
                    )}
                    {r.paymentMethod === "online" && (
                      <>
                        <span>
                          Bank: <b>{r.bankName || "-"}</b>
                        </span>
                        <span>
                          Ref: <b>{r.referenceNo || "-"}</b>
                        </span>
                      </>
                    )}
                    {r.proofUrl && (
                      <a
                        href={r.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline"
                      >
                        View proof
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
