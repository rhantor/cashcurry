/* eslint-disable react/prop-types */
"use client";
import React from "react";
import useCurrency from "@/app/hooks/useCurrency";

export default function BillMetaFields({
  vendorId,
  setVendorId,
  invoiceNo,
  setInvoiceNo,
  invoiceDate,
  setInvoiceDate,
  dueDate,
  setDueDate,
  total,
  setTotal,
  note,
  setNote,
  vendors = [], // [{id, name}]
  loading = false, // NEW: show loading state for vendors
  error = false, // NEW: show error state for vendors
  onRetry, // NEW: optional retry callback
}) {
  const currency = useCurrency();
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Vendor */}
      <div className="md:col-span-1">
        <label htmlFor="vendor" className="text-sm text-gray-600">
          Vendor
        </label>
        <div className="mt-1">
          <select
            id="vendor"
            value={vendorId}
            disabled={loading || error}
            onChange={(e) => setVendorId(e.target.value)}
            className={`w-full border rounded-lg p-2 bg-white ${
              loading || error ? "opacity-75 cursor-not-allowed" : ""
            }`}
          >
            {loading && <option>Loading vendors…</option>}
            {error && <option>Failed to load vendors</option>}
            {!loading && !error && (
              <>
                <option value="">Select a vendor</option>
                {vendors.length === 0 ? (
                  <option disabled>(No vendors)</option>
                ) : (
                  vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))
                )}
              </>
            )}
          </select>

          {error && (
            <div className="mt-1 text-xs text-red-600">
              Couldn’t load vendors.
              {onRetry && (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={onRetry}
                    className="underline text-red-700"
                  >
                    Try again
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Invoice No */}
      <div className="md:col-span-1">
        <label htmlFor="invoiceNo" className="text-sm text-gray-600">
          Invoice No
        </label>
        <input
          id="invoiceNo"
          value={invoiceNo}
          onChange={(e) => setInvoiceNo(e.target.value)}
          className="mt-1 w-full border rounded-lg p-2"
          placeholder="e.g. INV-1023"
          autoComplete="off"
          inputMode="text"
        />
      </div>

      {/* Invoice Date */}
      <div className="md:col-span-1">
        <label htmlFor="invoiceDate" className="text-sm text-gray-600">
          Invoice Date
        </label>
        <input
          id="invoiceDate"
          type="date"
          value={invoiceDate}
          onChange={(e) => setInvoiceDate(e.target.value)}
          className="mt-1 w-full border rounded-lg p-2"
        />
      </div>

      {/* Due Date */}
      <div className="md:col-span-1">
        <label htmlFor="dueDate" className="text-sm text-gray-600">
          Due Date
        </label>
        <input
          id="dueDate"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="mt-1 w-full border rounded-lg p-2"
        />
      </div>

      {/* Bill Total */}
      <div className="md:col-span-1">
        <label htmlFor="billTotal" className="text-sm text-gray-600">
          Bill Total ({currency})
        </label>
        <input
          id="billTotal"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          className="mt-1 w-full border rounded-lg p-2"
          placeholder="0.00"
        />
      </div>

      {/* Note */}
      <div className="md:col-span-2">
        <label htmlFor="note" className="text-sm text-gray-600">
          Note (optional)
        </label>
        <input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full border rounded-lg p-2"
          placeholder="Any extra info (e.g., delivered by Ali, PO-55)"
        />
      </div>
    </div>
  );
}
