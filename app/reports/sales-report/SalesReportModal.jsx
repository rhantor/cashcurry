/* eslint-disable react/prop-types */
/* eslint-disable react/no-unknown-property */
"use client";
import React, { useMemo, useState, useRef } from "react";
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
  { key: "qr", label: "QR", enabled: true, includeInTotal: true, order: 3 },
  { key: "grab", label: "Grab", enabled: true, includeInTotal: true, order: 4 },
  { key: "foodpanda", label: "Foodpanda", enabled: true, includeInTotal: true, order: 5 },
  { key: "online", label: "Online", enabled: false, includeInTotal: true, order: 6 },
  { key: "cheque", label: "Cheque", enabled: false, includeInTotal: true, order: 7 },
  { key: "promotion", label: "Promotion", enabled: false, includeInTotal: false, order: 8 },
];

const fmt = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n.toFixed(2) : v ?? "0.00";
};

export default function ItemsReportModal({
  item,
  branchData,
  onClose,
  monthTotal,
}) {
  const [imgLoading, setImgLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const reportRef = useRef(null);
  const currency = useCurrency();

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
    const present = DEFAULT_TENDERS.filter((t) => Object.hasOwn(item, t.key));
    if (present.length) {
      return present.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    }
    return DEFAULT_TENDERS;
  }, [item]);

  const recalculatedTotal = useMemo(() => {
    if (!item) return "0.00";
    const cents = tenders
      .filter((t) => t.includeInTotal !== false)
      .reduce((sum, t) => sum + Math.round((parseFloat(item[t.key]) || 0) * 100), 0);
    return (cents / 100).toFixed(2);
  }, [tenders, item]);

  if (!item) return null;

  const branchTitle = Array.isArray(branchData)
    ? branchData.map((b) => b.name).join(", ")
    : branchData?.name || "Branch";

  const doExportPDF = () => exportToPDF(item, branchData, tenders, monthTotal);
  const doExportExcel = () => exportToExcel(item, branchData, tenders, monthTotal);
  const doShare = () => handleShare(item, branchData, tenders, monthTotal);

  const handleShareImage = async () => {
    if (!reportRef.current || isSharing) return;
    setIsSharing(true);
    try {
      // Use html-to-image to generate a high-quality PNG
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(reportRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });

      // Convert dataUrl to blob for sharing
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      const fileName = `sales-report-${item.date}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "Sales Report Image",
          text: `Sales report for ${format(new Date(item.date), "dd/MM/yyyy")}`,
          files: [file],
        });
      } else {
        // Fallback: Download
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = fileName;
        link.click();
        alert("Sharing not supported on this browser. The report has been downloaded as an image instead.");
      }
    } catch (err) {
      console.error("Image sharing failed:", err);
      alert("Failed to generate report image. Please try again or use PDF Export.");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div ref={reportRef} className="p-6 bg-white">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h2 className="text-lg font-bold text-gray-800">{branchTitle}</h2>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-600">Sales Report</p>
              <p className="text-xs text-gray-400">{format(new Date(item.date), "dd MMM yyyy")}</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            {tenders.map((t) => {
              const value = item[t.key];
              const note = item.notes?.[t.key];
              return (
                <div key={t.key} className="flex justify-between gap-3 items-start py-1 border-b border-gray-50 last:border-0">
                  <span className="font-medium text-gray-700">{t.label}</span>
                  <div className="text-right">
                    {note && (
                      <span className="block text-[10px] text-gray-400 italic leading-tight mb-1 max-w-[150px]">
                        Note: {note}
                      </span>
                    )}
                    <span className="font-semibold text-gray-900">{fmt(value)}</span>
                  </div>
                </div>
              );
            })}

            <div className="mt-4 pt-3 border-t-2 border-gray-100">
              <div className="flex justify-between font-bold text-base text-gray-900">
                <span>Daily Total</span>
                <span>{fmt(item.total ?? recalculatedTotal)}</span>
              </div>
            </div>

            <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
              <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                Monthly Grand Total
              </div>
              <div className="text-xl font-black text-emerald-700">
                {currency} {monthTotal}
              </div>
            </div>

            <div className="flex justify-between pt-4 text-gray-400 text-[10px] uppercase tracking-widest">
              <span>Added By: {item.createdBy?.username || "Unknown"}</span>
              <span>{format(new Date(), "HH:mm")}</span>
            </div>

            {item.zReportUrl && (
              <div className="mt-6 pt-4 border-t border-dashed border-gray-200">
                <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Z Report Attached:</p>
                <div className="w-full rounded-lg overflow-hidden border border-gray-100 relative min-h-[100px] flex items-center justify-center bg-gray-50">
                  {imgLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 z-10">
                      <div className="loader border-t-4 border-mint-500 w-8 h-8 rounded-full animate-spin"></div>
                    </div>
                  )}
                  <img
                    src={item.zReportUrl}
                    alt="Z Report Preview"
                    className="w-full object-contain max-h-[400px]"
                    onLoad={() => setImgLoading(false)}
                    onError={() => setImgLoading(false)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-50 p-6 flex flex-wrap justify-center gap-2 sm:gap-3 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 min-w-[80px] py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-semibold transition">
            Close
          </button>
          
          <button onClick={handleShareImage} disabled={isSharing} className="flex-1 min-w-[120px] py-2 rounded-lg bg-mint-500 hover:bg-mint-600 text-white text-xs font-bold shadow-sm transition disabled:opacity-50">
            {isSharing ? "Capturing..." : "Share as Image"}
          </button>

          <div className="w-full flex gap-2">
            <button onClick={doShare} className="flex-1 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-[10px] font-bold transition">
              Share PDF
            </button>
            <button onClick={doExportPDF} className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold transition">
              PDF
            </button>
            <button onClick={doExportExcel} className="flex-1 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold transition">
              Excel
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .loader {
          border-top-color: transparent;
          border-width: 4px;
        }
      `}</style>
    </div>
  );
}
