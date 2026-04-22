/* eslint-disable react/prop-types */
"use client";
import React from "react";
import { format } from "date-fns";
import useCurrency from "@/app/hooks/useCurrency";

export default function AdvanceRequests({
  loading,
  error,
  errorMsg,
  items,
  workingId,
  onAction,
//   currentUser,
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
        <p className="text-gray-500">No pending advance requests ✅</p>
      ) : (
        <div className="space-y-4">
          {items.map((req) => (
            <div
              key={req.id}
              className="border border-gray-300 rounded-lg p-4 shadow-sm bg-white"
            >
              <p>
                <span className="font-semibold">Staff:</span> {req.staffName}
              </p>
              <p>
                <span className="font-semibold">Amount:</span> {currency}{" "}
                {Number(req.amount).toFixed(2)}
              </p>
              <p>
                <span className="font-semibold">Reason:</span> {req.reason}
              </p>
              <p>
                <span className="font-semibold">Date:</span>{" "}
                {req.date ? format(new Date(req.date), "dd/MM/yyyy") : "-"}
              </p>
              <p>
                <span className="font-semibold">Requested By:</span>{" "}
                {req.createdBy?.username || "-"}
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
            </div>
          ))}
        </div>
      )}
    </>
  );
}
