/* eslint-disable react/no-unknown-property */
/* eslint-disable react/prop-types */
"use client";
import React, { useState } from "react";
import { format } from "date-fns";
import {
  exportWithdrawalToExcel,
  exportWithdrawalToPDF,
  shareWithdrawal,
} from "@/utils/export/exportWithdrawData";

export default function WithdrawModal({ item, branchData, onClose }) {
  const [loading, setLoading] = useState(true);
  const [currentFile, setCurrentFile] = useState(0);
  if (!item) return null;

  // Build combined file list: prefer receiptUrls array, fallback to receiptUrl
  const allFiles = item.receiptUrls?.length > 0
    ? item.receiptUrls
    : item.receiptUrl
    ? [item.receiptUrl]
    : [];

  const url = allFiles[currentFile] || null;
  const match = url?.match(/\.([a-zA-Z0-9]+)(\?|$)/);
  const ext = match ? match[1].toLowerCase() : "";

  const handleLoad = () => setLoading(false);

  const goToFile = (idx) => {
    setLoading(true);
    setCurrentFile(idx);
  };

  // Firestore TS safe read
  const createdTs = item.createdAt
    ? typeof item.createdAt === "string"
      ? new Date(item.createdAt)
      : item.createdAt?.seconds
      ? new Date(item.createdAt.seconds * 1000)
      : null
    : null;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">
            {Array.isArray(branchData)
              ? branchData.map((b) => b.name).join(", ")
              : branchData?.name || "Branch"}
          </h2>
          <h2 className="text-lg font-bold">
            Withdrawal –{" "}
            {item.date
              ? format(new Date(item.date + "T00:00:00"), "dd/MM/yyyy")
              : "-"}
          </h2>
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Amount</span>
            <span>{Number(item.amount || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Category</span>
            <span>{item.category || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span>Method</span>
            <span>{item.method || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span>Reference</span>
            <span>{item.reference || "-"}</span>
          </div>

          {/* Receipt preview — supports multiple files */}
          {allFiles.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">
                  Receipt{allFiles.length > 1 ? ` (${currentFile + 1} of ${allFiles.length})` : ""}:
                </p>
                {allFiles.length > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => goToFile(Math.max(0, currentFile - 1))}
                      disabled={currentFile === 0}
                      className="px-2 py-0.5 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30"
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => goToFile(Math.min(allFiles.length - 1, currentFile + 1))}
                      disabled={currentFile === allFiles.length - 1}
                      className="px-2 py-0.5 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
              <div className="w-full h-[400px] border rounded-lg overflow-auto flex items-center justify-center relative">
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                    <div className="loader border-t-4 border-blue-500 w-8 h-8 rounded-full animate-spin"></div>
                  </div>
                )}
                {ext === "pdf" ? (
                  <iframe
                    src={url}
                    className="w-full h-full"
                    title="Receipt Preview"
                    onLoad={handleLoad}
                  />
                ) : ["jpg", "jpeg", "png", "gif", "webp"].includes(ext) ? (
                  <img
                    src={url}
                    alt={`Receipt ${currentFile + 1}`}
                    className="max-w-full max-h-full object-contain"
                    onLoad={handleLoad}
                  />
                ) : (
                  <p className="text-gray-500">Cannot preview this file type</p>
                )}
              </div>
              <a
                href={url}
                download={`Withdrawal-${item.date}-${currentFile + 1}`}
                className="inline-block mt-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm"
              >
                Download
              </a>
            </div>
          )}

          <div className="flex justify-between mt-2">
            <span>Created By</span>
            <span>{item.createdBy?.username || "Unknown"}</span>
          </div>

          <div className="flex justify-between">
            <span>Added Time</span>
            <span>
              {createdTs ? format(createdTs, "HH:mm ~ dd/MM") : "N/A"}
            </span>
          </div>

          {item.notes ? (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <div className="p-3 rounded border bg-gray-50 whitespace-pre-wrap">
                {item.notes}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer buttons */}
        <div className="flex flex-wrap justify-end gap-2 sm:gap-3 mt-6 text-xs">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
          >
            Close
          </button>
          <button
            onClick={() => exportWithdrawalToPDF(item, branchData)}
            className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white"
          >
            Export PDF
          </button>
          <button
            onClick={() => exportWithdrawalToExcel(item, branchData)}
            className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white"
          >
            Export Excel
          </button>
          <button
            onClick={() => shareWithdrawal(item, branchData)}
            className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white"
          >
            Share
          </button>
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
