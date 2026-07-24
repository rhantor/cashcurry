/* eslint-disable react/prop-types */
"use client";
import React from "react";
import { format } from "date-fns";
import { Clock, Sunrise } from "lucide-react";

// Early-OT approvals. Raised automatically by the kiosk when someone punches in
// well before their shift starts (threshold in Settings → Attendance).
// Approved → the extra minutes are paid as OT. Rejected → the day is paid from
// the shift start, as if they had arrived on time.
export default function OtRequests({
  loading,
  error,
  errorMsg,
  items,
  workingId,
  onAction,
  canApprove,
}) {
  if (loading) return <p className="p-4">Loading...</p>;
  if (error)
    return <p className="p-4 text-red-600">Failed to load early-OT requests.</p>;

  const fmtTime = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? "-"
      : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  return (
    <>
      {errorMsg && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {!canApprove && (
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
          You can view these requests but only a manager, GM, admin or owner can approve them.
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-gray-500">No pending early-OT requests ✅</p>
      ) : (
        <div className="space-y-4">
          {items.map((req) => (
            <div
              key={req.id}
              className="border border-gray-300 rounded-lg p-4 shadow-sm bg-white"
            >
              <div className="flex items-center gap-2 mb-2">
                <Sunrise className="text-amber-500" size={18} />
                <span className="font-semibold">{req.staffName}</span>
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200">
                  <Clock size={12} />
                  {req.earlyMinutes} min early
                </span>
              </div>

              <p>
                <span className="font-semibold">Date:</span>{" "}
                {req.date ? format(new Date(req.date), "dd/MM/yyyy") : "-"}
              </p>
              <p>
                <span className="font-semibold">Shift:</span>{" "}
                {req.shiftName || "-"} (starts {req.shiftStart || "-"})
              </p>
              <p>
                <span className="font-semibold">Punched in at:</span>{" "}
                {fmtTime(req.punchInAt)}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Approve to pay the extra {req.earlyMinutes} min as OT. Reject to pay this day from
                the shift start.
              </p>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => onAction(req, "approved")}
                  disabled={workingId === req.id || !canApprove}
                  className={`px-4 py-2 rounded-lg text-white ${
                    workingId === req.id || !canApprove
                      ? "bg-green-300 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {workingId === req.id ? "Processing..." : "Approve"}
                </button>
                <button
                  onClick={() => onAction(req, "rejected")}
                  disabled={workingId === req.id || !canApprove}
                  className={`px-4 py-2 rounded-lg text-white ${
                    workingId === req.id || !canApprove
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
