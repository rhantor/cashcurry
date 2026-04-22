/* eslint-disable react/prop-types */
"use client";
import React from "react";

export default function BillPaidSection({
  paidNow,
  setPaidNow,
  paidFrom,
  setPaidFrom, // 'front' | 'back'
  method,
  setMethod, // 'cash' | 'card' | 'qr' | 'online' | 'bank_transfer'
  reference,
  setReference,
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <input
          id="paid-now"
          type="checkbox"
          checked={paidNow}
          onChange={(e) => {
            const checked = e.target.checked;
            setPaidNow(checked);
            if (checked && paidFrom === "") setPaidFrom("front");
            if (checked && paidFrom === "front") setMethod("cash");
          }}
        />
        <label htmlFor="paid-now" className="text-sm">
          Paid now?
        </label>
      </div>

      {paidNow && (
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm text-gray-600">Paid From</label>
            <select
              className="mt-1 w-full border rounded-lg p-2"
              value={paidFrom}
              onChange={(e) => {
                const v = e.target.value;
                setPaidFrom(v);
                if (v === "front") setMethod("cash");
                if (v === "back" && method === "cash") setMethod("");
              }}
            >
              <option value="front">Front Office (Cash)</option>
              <option value="back">Back Office</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600">Method</label>
            <select
              className="mt-1 w-full border rounded-lg p-2"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {/* Front = cash only */}
              {paidFrom === "front" ? (
                <option value="cash">Cash</option>
              ) : (
                <>
                  <option value="">Select method</option>
                  <option value="card">Card</option>
                  <option value="qr">QR</option>
                  <option value="online">Online</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </>
              )}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {paidFrom === "front"
                ? "Cash (fixed)"
                : method || "Select a method"}
            </p>
          </div>

          <div>
            <label className="text-sm text-gray-600">
              Reference (optional)
            </label>
            <input
              className="mt-1 w-full border rounded-lg p-2"
              placeholder="Bank ref / note"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
        </div>
      )}
    </>
  );
}
