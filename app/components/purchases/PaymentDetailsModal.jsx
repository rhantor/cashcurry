/* eslint-disable react/prop-types */
"use client";
import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import useCurrency from "@/app/hooks/useCurrency";
import Modal from "@/app/components/common/Modal";

function makeFormatRM(currency) {
  return (n) => `${currency} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Fetches invoiceNo and invoiceDate for each billId in the allocations.
 */
async function loadBillInfos({ companyId, branchId, allocations }) {
  const out = [];
  for (const { billId, amount } of allocations || []) {
    try {
      const billRef = doc(
        db,
        "companies",
        companyId,
        "branches",
        branchId,
        "vendorBills",
        billId
      );
      const snap = await getDoc(billRef);
      if (snap.exists()) {
        const b = snap.data();
        out.push({
          billId,
          amount: Number(amount || 0),
          invoiceNo: b?.invoiceNo || "-",
          invoiceDate: b?.invoiceDate || "-",
          vendorName: b?.vendorName || "",
          dueDate: b?.dueDate || "-",
          total: Number(b?.total || 0),
          attachments: b?.attachments || [],
        });
      } else {
        out.push({
          billId,
          amount: Number(amount || 0),
          invoiceNo: "(deleted)",
          invoiceDate: "-",
          vendorName: "",
          dueDate: "-",
          total: 0,
          attachments: [],
        });
      }
    } catch {
      out.push({
        billId,
        amount: Number(amount || 0),
        invoiceNo: "(error)",
        invoiceDate: "-",
        vendorName: "",
        dueDate: "-",
        total: 0,
        attachments: [],
      });
    }
  }
  return out;
}

function formatDate(iso) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

export default function PaymentDetailsModal({
  open,
  onClose,
  payment,
  companyId,
  branchId,
}) {
  const currency = useCurrency();
  const formatRM = makeFormatRM(currency);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [hasAutoPreviewed, setHasAutoPreviewed] = useState(false);

  const allocations = payment?.allocations || [];

  useEffect(() => {
    if (!open) {
      setPreviewUrl(null);
      setHasAutoPreviewed(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || hasAutoPreviewed) return;
    if (payment?.receiptURL) {
      setPreviewUrl(payment.receiptURL);
      setHasAutoPreviewed(true);
    }
  }, [open, payment, hasAutoPreviewed]);

  useEffect(() => {
    if (!open || !rows.length || hasAutoPreviewed) return;
    const firstWithAttachment = rows.find(r => r.attachments && r.attachments.length > 0);
    if (firstWithAttachment) {
      setPreviewUrl(firstWithAttachment.attachments[0]);
    }
    setHasAutoPreviewed(true);
  }, [open, rows, hasAutoPreviewed]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!open || !payment || !companyId || !branchId) return;
      setLoading(true);
      try {
        const details = await loadBillInfos({
          companyId,
          branchId,
          allocations,
        });
        if (active) setRows(details);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, payment, companyId, branchId]);

  if (!open) return null;

  return (
    <Modal
      title="Payment Details"
      maxWidth={previewUrl ? "max-w-6xl" : "max-w-3xl"}
      onClose={onClose}
    >
      <div className={`grid grid-cols-1 ${previewUrl ? "lg:grid-cols-2 gap-6" : ""}`}>
        {/* Left Panel: Details and table */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">Vendor</span>
              <div className="font-bold text-gray-900">{payment?.vendorName || "-"}</div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">Paid Date</span>
              <div className="font-bold text-gray-900">{formatDate(payment?.createdISO)}</div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">Office / Method</span>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${payment?.paidFromOffice === 'front' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                  {payment?.paidFromOffice || '-'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-200 text-gray-700 font-bold uppercase">
                  {payment?.paidMethod || "-"}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">Reference / Receipt</span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-gray-600">{payment?.reference || "-"}</span>
                {payment?.receiptURL && (
                  <div className="flex items-center gap-2 text-xs font-sans">
                    <button
                      onClick={() => setPreviewUrl(payment.receiptURL)}
                      type="button"
                      className="text-blue-600 hover:underline font-bold focus:outline-none"
                    >
                      View Receipt
                    </button>
                    <span className="text-gray-300">|</span>
                    <a
                      href={payment.receiptURL}
                      download
                      className="text-emerald-600 hover:underline font-bold"
                    >
                      Download
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden border border-gray-100 rounded-2xl shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500 font-black uppercase tracking-widest text-[9px]">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Inv. Date</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 text-right">Bill Total</th>
                  <th className="px-4 py-3 text-right">Paid Here</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400 animate-pulse font-medium">
                      Fetching bill details...
                    </td>
                  </tr>
                ) : rows.length ? (
                  rows.map((r) => (
                    <tr key={r.billId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-gray-900 uppercase font-mono">
                        <div className="flex flex-col">
                          <span>{r.invoiceNo}</span>
                          {r.attachments && r.attachments.length > 0 && (
                            <div className="flex flex-col gap-1 mt-1 font-sans text-[11px] font-normal normal-case text-gray-500">
                              {r.attachments.map((url, i) => {
                                const label = r.attachments.length > 1 ? `Invoice #${i + 1}` : "Invoice";
                                return (
                                  <div key={i} className="flex items-center gap-1.5">
                                    <span className="font-semibold text-gray-700">{label}:</span>
                                    <button
                                      onClick={() => setPreviewUrl(url)}
                                      type="button"
                                      className="text-blue-600 hover:underline font-bold focus:outline-none"
                                    >
                                      View
                                    </button>
                                    <span className="text-gray-300">|</span>
                                    <a
                                      href={url}
                                      download
                                      className="text-emerald-600 hover:underline font-bold"
                                    >
                                      Download
                                    </a>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.invoiceDate}</td>
                      <td className="px-4 py-3 text-gray-600">{r.dueDate}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{formatRM(r.total)}</td>
                      <td className="px-4 py-3 text-right font-black text-gray-900">{formatRM(r.amount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400 italic">
                      No allocations recorded.
                    </td>
                  </tr>
                )}
              </tbody>
              {!loading && rows.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-100">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-gray-400">
                      Total Payment Applied
                    </td>
                    <td className="px-4 py-3 text-right font-black text-mint-600 text-base">
                      {formatRM(rows.reduce((s, x) => s + Number(x.amount || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Right Panel: Document Previewer */}
        {previewUrl && (
          <div className="flex flex-col border border-gray-200 rounded-2xl overflow-hidden bg-gray-50 p-4 h-full">
            <div className="flex items-center justify-between pb-3 border-b mb-3">
              <span className="text-[10px] uppercase font-black tracking-widest text-gray-500">Document Preview</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all"
                >
                  Open in tab
                </a>
                <button
                  onClick={() => setPreviewUrl(null)}
                  type="button"
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-all focus:outline-none"
                >
                  Close Preview
                </button>
              </div>
            </div>
            <div className="flex-1 bg-white rounded-xl border flex items-center justify-center p-2 min-h-[300px] lg:h-[55vh]">
              {previewUrl.match(/\.(pdf)(\?|$)/i) ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0 rounded-lg"
                  title="PDF Preview"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Document Preview"
                  className="max-w-full max-h-full object-contain rounded-lg shadow-sm bg-white"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
