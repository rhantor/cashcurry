/* eslint-disable react/prop-types */
"use client";
import React from "react";
import { format } from "date-fns";
import useCurrency from "@/app/hooks/useCurrency";

/* props:
  loading, error, errorMsg,
  items,            // pending loans & repayments for THIS receiver branch
  workingId,        // id being processed
  onAction,         // (req, "approved"|"rejected")
  canApprove,       // role gate
  getBranchName,    // fn
*/
export default function LoanRequests({
  loading,
  error,
  errorMsg,
  items = [],
  workingId,
  onAction,
  canApprove,
  getBranchName,
}) {
  const currency = useCurrency();
  if (loading) return <p className="p-4">Loading...</p>;
  if (error)
    return <p className="p-4 text-red-600">Failed to load loan requests.</p>;

  const fmtDate = (v) => {
    if (!v) return "-";
    try {
      const ms = v?.seconds ? v.seconds * 1000 : Date.parse(v);
      if (!ms) return "-";
      return format(new Date(ms), "dd/MM/yyyy");
    } catch {
      return "-";
    }
  };

  if (!items.length)
    return (
      <p className="text-gray-500">No pending loan/repayment requests ✅</p>
    );

  return (
    <>
      {errorMsg && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="space-y-4">
        {items.map((req) => {
          const isRepayment = req.type === "repayment";
          return (
            <div
              key={req.id}
              className="border border-gray-300 rounded-lg p-4 shadow-sm bg-white"
            >
              {/* Type + status */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`px-2 py-0.5 text-xs rounded ${
                    isRepayment
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {isRepayment ? "Repayment" : "Loan"}
                </span>
                <span className="text-xs text-gray-500">pending</span>
              </div>

              {/* Common fields */}
              <p>
                <span className="font-semibold">
                  {isRepayment ? "Payer Branch" : req.staffName ? "Staff Name" : "Branch"}:
                </span>{" "}
                {req.staffName || getBranchName(req.fromBranchId ?? req.requestFromBranchId)}
              </p>

              <p>
                <span className="font-semibold">Amount:</span> {currency}{" "}
                {Number(req.amount || 0).toFixed(2)}
              </p>

              <p>
                <span className="font-semibold">
                  {isRepayment ? "Note" : "Reason"}:
                </span>{" "}
                {req.note || req.reason || "-"}
              </p>

              <p>
                <span className="font-semibold">Date:</span>{" "}
                {fmtDate(req.createdAt)}
              </p>

              <p>
                <span className="font-semibold">Requested By:</span>{" "}
                {req.requestedBy?.username || req.createdBy?.username || "-"}
              </p>

              {/* Repayment-only extras */}
              {isRepayment && (
                <div className="mt-2 text-sm">
                  <p>
                    <span className="font-semibold">Method:</span>{" "}
                    {req.paymentMethod || "-"}
                  </p>

                  {req.paymentMethod === "cash" ? (
                    <p>
                      <span className="font-semibold">Voucher #:</span>{" "}
                      {req.voucherNo || "-"}
                    </p>
                  ) : (
                    <>
                      <p>
                        <span className="font-semibold">Bank:</span>{" "}
                        {req.bankName || "-"}
                      </p>
                      <p>
                        <span className="font-semibold">Reference #:</span>{" "}
                        {req.referenceNo || "-"}
                      </p>
                    </>
                  )}

                  {req.proofUrl && (
                    <a
                      href={req.proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block mt-1 text-blue-600 underline"
                    >
                      View proof
                    </a>
                  )}
                </div>
              )}

              {/* Actions */}
              {canApprove ? (
                <div className="mt-4 flex gap-3">
                  <button
                    disabled={workingId === req.id}
                    onClick={() => onAction(req, "approved")}
                    className={`px-4 py-2 rounded-lg text-white ${
                      workingId === req.id
                        ? "bg-green-300 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                  >
                    {workingId === req.id ? "Processing..." : "Approve"}
                  </button>
                  <button
                    disabled={workingId === req.id}
                    onClick={() => onAction(req, "rejected")}
                    className={`px-4 py-2 rounded-lg text-white ${
                      workingId === req.id
                        ? "bg-red-300 cursor-not-allowed"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {workingId === req.id ? "Processing..." : "Reject"}
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-gray-500">
                  You don’t have approval permission.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
