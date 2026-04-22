/* eslint-disable react/prop-types */
// app/components/reports/ItemsReportModal.jsx
/* eslint-disable react/no-unknown-property */
"use client";
import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  exportToExcel,
  exportToPDF,
  handleShare,
} from "@/utils/export/exportData";
import useCurrency from "@/app/hooks/useCurrency";

const DEFAULT_TENDERS = [
  { key: "cash", label: "Cash", enabled: true, includeInTotal: true, order: 1 },
  { key: "card", label: "Card", enabled: true, includeInTotal: true, order: 2 },
  {
    key: "online",
    label: "Online",
    enabled: false,
    includeInTotal: true,
    order: 6,
  },
  { key: "qr", label: "QR", enabled: true, includeInTotal: true, order: 3 },
  { key: "grab", label: "Grab", enabled: true, includeInTotal: true, order: 4 },
  {
    key: "foodpanda",
    label: "Foodpanda",
    enabled: true,
    includeInTotal: true,
    order: 5,
  },
  {
    key: "cheque",
    label: "Cheque",
    enabled: false,
    includeInTotal: true,
    order: 7,
  },
  {
    key: "promotion",
    label: "Promotion",
    enabled: false,
    includeInTotal: false,
    order: 8,
  },
];

// Helper: format amounts safely
const fmt = (v) => {
  const n = parseFloat(v);
  if (Number.isFinite(n)) return n.toFixed(2);
  return v ?? "0.00";
};

export default function ItemsReportModal({
  item,
  branchData,
  onClose,
  monthTotal,
}) {
  const [imgLoading, setImgLoading] = useState(true);
  const currency = useCurrency();

  // 🔹 Prefer tenders snapshot saved on the entry (stable even if settings change later)
  //    Fallback to keys that exist on the item, then to DEFAULT_TENDERS.
  const tenders = useMemo(() => {
    if (!item) return DEFAULT_TENDERS;
    if (Array.isArray(item.tenderMeta) && item.tenderMeta.length) {
      return [...item.tenderMeta]
        .map((t) => ({
          key: t.key,
          label: t.label ?? t.key,
          includeInTotal: t.includeInTotal !== false,
          enabled: true,
          order: t.order ?? 9999,
        }))
        .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    }

    // If no snapshot, infer from the fields present on the item
    const present = DEFAULT_TENDERS.filter((t) => Object.hasOwn(item, t.key));
    if (present.length) {
      return present.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    }
    return DEFAULT_TENDERS;
  }, [item]);

  // Recalculate total (for display only) using includeInTotal
  const recalculatedTotal = useMemo(() => {
    if (!item) return "0.00";
    const cents = tenders
      .filter((t) => t.includeInTotal !== false)
      .reduce(
        (sum, t) => sum + Math.round((parseFloat(item[t.key]) || 0) * 100),
        0
      );
    return (cents / 100).toFixed(2);
  }, [tenders, item]);

  if (!item) return null;

  const handleImageLoad = () => setImgLoading(false);

  // Prepare a friendly branch title (list for multi-branch mode)
  const branchTitle = Array.isArray(branchData)
    ? branchData.map((b) => b.name).join(", ")
    : branchData?.name || "Branch";

  // Pass tender definitions to exporters so they can render columns/labels dynamically
  const doExportPDF = () => exportToPDF(item, branchData, tenders, monthTotal);
  const doExportExcel = () =>
    exportToExcel(item, branchData, tenders, monthTotal);
  const doShare = () => handleShare(item, branchData, tenders, monthTotal);

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{branchTitle}</h2>
          <h2 className="text-lg font-bold">
            Items Report – {format(new Date(item.date), "dd/MM/yyyy")}
          </h2>
        </div>

        {/* Dynamic tender rows */}
        <div className="space-y-2 text-sm">
          {tenders.map((t) => {
            const value = item[t.key];
            const note = item.notes?.[t.key];
            return (
              <div key={t.key} className="flex justify-between gap-3">
                <span className="shrink-0">{t.label}</span>
                <span className="text-right">
                  {note && (
                    <span className="block text-xs text-gray-500 italic mb-0.5">
                      Note: {note}
                    </span>
                  )}
                  {fmt(value)}
                </span>
              </div>
            );
          })}

          {/* Totals */}
          <div className="flex justify-between font-bold border-t pt-2 mt-2">
            <span>Total</span>
            <span>{fmt(item.total ?? recalculatedTotal)}</span>
          </div>
          <div className="mt-4 p-3 bg-green-50 rounded border border-green-200 flex items-center justify-around">
            <div className="text-sm text-green-700">
              Grand Total (This Month)
            </div>
            <div className="text-xl font-bold text-green-800">
              {currency} {monthTotal}
            </div>
          </div>

          {/* Meta */}
          <div className="flex justify-between border-t pt-2 mt-2 text-gray-600 text-sm">
            <span>Added By</span>
            <span>{item.createdBy?.username || "Unknown"}</span>
          </div>

          {/* Z Report Preview */}
          {item.zReportUrl && (
            <div className="mt-4 relative">
              <p className="text-sm font-medium mb-1">Z Report:</p>

              <div className="w-full border rounded-lg flex items-center justify-center relative overflow-hidden">
                {imgLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                    <div className="loader border-t-4 border-blue-500 w-8 h-8 rounded-full animate-spin"></div>
                  </div>
                )}
                <img
                  src={item.zReportUrl}
                  alt="Z Report Preview"
                  className="w-full max-w-sm rounded-lg border"
                  onLoad={handleImageLoad}
                />
              </div>

              <a
                href={item.zReportUrl}
                download={`ZReport-${item.date}.jpg`}
                className="inline-block mt-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm"
              >
                Download Z Report
              </a>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex flex-wrap justify-end gap-2 sm:gap-3 mt-6 text-xs">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
          >
            Close
          </button>
          <button
            onClick={doExportPDF}
            className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white"
          >
            Export PDF
          </button>
          <button
            onClick={doExportExcel}
            className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white"
          >
            Export Excel
          </button>
          <button
            onClick={doShare}
            className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white"
          >
            Share
          </button>
        </div>
      </div>

      {/* Loader CSS */}
      <style jsx>{`
        .loader {
          border-top-color: transparent;
          border-width: 4px;
        }
      `}</style>
    </div>
  );
}
