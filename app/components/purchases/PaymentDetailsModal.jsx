/* eslint-disable react/prop-types */
"use client";
import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import useCurrency from "@/app/hooks/useCurrency";

function makeFormatRM(currency) {
  return (n) => `${currency} ${Number(n || 0).toFixed(2)}`;
}

/**
 * Fetches invoiceNo for each billId in the allocations.
 * We resolve sequentially to avoid hammering; feel free to parallelize if needed.
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
          vendorName: b?.vendorName || "",
          dueDate: b?.dueDate || "",
          total: Number(b?.total || 0),
        });
      } else {
        out.push({
          billId,
          amount: Number(amount || 0),
          invoiceNo: "(deleted)",
          vendorName: "",
          dueDate: "",
          total: 0,
        });
      }
    } catch {
      out.push({
        billId,
        amount: Number(amount || 0),
        invoiceNo: "(error)",
        vendorName: "",
        dueDate: "",
        total: 0,
      });
    }
  }
  return out;
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

  const allocations = payment?.allocations || [];

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
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Payment Details</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-2 text-sm text-gray-700">
          <div className="grid md:grid-cols-2 gap-2">
            <div>
              <span className="text-gray-500">Vendor: </span>
              <strong>{payment?.vendorName || "-"}</strong>
            </div>
            <div>
              <span className="text-gray-500">Date: </span>
              <strong>{payment?.createdISO || "-"}</strong>
            </div>
            <div>
              <span className="text-gray-500">Office: </span>
              <strong>
                {payment?.paidFromOffice === "front" ? "Front" : "Back"}
              </strong>
            </div>
            <div>
              <span className="text-gray-500">Method: </span>
              <strong>{payment?.paidMethod || "-"}</strong>
            </div>
            {payment?.reference ? (
              <div className="md:col-span-2">
                <span className="text-gray-500">Reference: </span>
                <span>{payment.reference}</span>
              </div>
            ) : null}
            {payment?.receiptURL ? (
              <div className="md:col-span-2">
                <span className="text-gray-500">Receipt: </span>
                <a
                  href={payment.receiptURL}
                  className="text-mint-600 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  View
                </a>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 border rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-600 bg-gray-50">
              <tr>
                <th className="py-2 px-3">Invoice</th>
                <th className="py-2 px-3">Due</th>
                <th className="py-2 px-3 text-right">Bill Total</th>
                <th className="py-2 px-3 text-right">Paid Here</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-4 text-center text-gray-500" colSpan={4}>
                    Loading…
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((r) => (
                  <tr key={r.billId} className="border-t">
                    <td className="py-2 px-3">{r.invoiceNo}</td>
                    <td className="py-2 px-3">{r.dueDate || "-"}</td>
                    <td className="py-2 px-3 text-right">
                      {formatRM(r.total)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {formatRM(r.amount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-4 text-center text-gray-500" colSpan={4}>
                    No allocations recorded.
                  </td>
                </tr>
              )}
            </tbody>
            {!loading && rows.length > 0 && (
              <tfoot>
                <tr className="border-t bg-gray-50">
                  <td className="py-2 px-3 font-semibold" colSpan={3}>
                    Total Paid
                  </td>
                  <td className="py-2 px-3 font-semibold text-right">
                    {formatRM(
                      rows.reduce((s, x) => s + Number(x.amount || 0), 0)
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
