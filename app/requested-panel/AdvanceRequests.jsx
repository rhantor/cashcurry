"use client";
import React from "react";
import { format, parseISO } from "date-fns";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region";

// Pending advance and staff-loan requests. Approving does not pay anything out:
// approved requests move to "Waiting to be paid" (PayOutQueue).
const KIND_LABEL = { advance: "Advance", staffLoan: "Staff loan" };
const LEAVE_LABEL = { medical: "Medical leave", annual: "Annual leave" };

export default function AdvanceRequests({
  loading,
  error,
  errorMsg,
  items,
  workingId,
  onAction,
}) {
  const currency = useCurrency();
  if (loading) return <p className="p-4">Loading...</p>;
  if (error)
    return <p className="p-4 text-red-600">Failed to load advance requests.</p>;

  return (
    <>
      {errorMsg && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-gray-500">No pending advance or staff loan requests ✅</p>
      ) : (
        <div className="space-y-4">
          {items.map((req) => {
            const leave = LEAVE_LABEL[req.advanceType];
            return (
              <div
                key={`${req.kind}-${req.id}`}
                className="border border-gray-300 rounded-lg p-4 shadow-sm bg-white"
              >
                <p className="mb-1">
                  <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {leave || KIND_LABEL[req.kind] || "Advance"}
                  </span>
                </p>
                <p>
                  <span className="font-semibold">Staff:</span> {req.staffName}
                </p>
                {!leave && (
                  <p>
                    <span className="font-semibold">Amount:</span> {formatMoney(req.amount, currency)}
                    {req.kind === "staffLoan" && req.durationMonths ? ` over ${req.durationMonths} months` : ""}
                  </p>
                )}
                <p>
                  <span className="font-semibold">Reason:</span> {req.reason || "-"}
                </p>
                <p>
                  <span className="font-semibold">Date:</span>{" "}
                  {/^\d{4}-\d{2}-\d{2}$/.test(req.date || "") ? format(parseISO(req.date), "dd/MM/yyyy") : req.date || "-"}
                </p>
                <p>
                  <span className="font-semibold">Requested By:</span>{" "}
                  {req.createdBy?.username || req.createdBy?.name || "-"}
                </p>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => onAction(req, "approved")}
                    disabled={workingId === req.id}
                    className={`px-4 py-2 rounded-lg text-white ${
                      workingId === req.id
                        ? "bg-green-300 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                  >
                    {workingId === req.id ? "Processing..." : "Approve"}
                  </button>
                  <button
                    onClick={() => onAction(req, "rejected")}
                    disabled={workingId === req.id}
                    className={`px-4 py-2 rounded-lg text-white ${
                      workingId === req.id
                        ? "bg-red-300 cursor-not-allowed"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {workingId === req.id ? "Processing..." : "Reject"}
                  </button>
                </div>
                {!leave && (
                  <p className="mt-2 text-xs text-slate-500">
                    Approving does not pay it out — it then waits under “Waiting to be paid” until someone hands over the money.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
