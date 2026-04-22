/* eslint-disable react/prop-types */
"use client";
import React from "react";
import RowActions from "./RowActions";
import useCurrency from "@/app/hooks/useCurrency";

export default function VendorTable({
  vendors,
  busy,
  onView,
  onEdit,
  onInc,
  onDelete,
}) {
  const currency = useCurrency();
  return (
    <div className="bg-white rounded-xl shadow p-4 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-gray-600">
          <tr>
            <th className="py-2">Name & Code</th>
            <th className="py-2">Contact</th>
            <th className="py-2">Total Billed ({currency})</th>
            <th className="py-2">Total Paid ({currency})</th>
            <th className="py-2">AP Balance ({currency})</th>
            <th className="py-2">Last Payment</th>
            <th className="py-2 w-24 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {(vendors || []).map((v) => (
            <tr key={v.id} className="border-t">
              <td className="py-2">
                <div className="font-semibold">{v.name}</div>
                {v.code ? (
                  <div className="text-[11px] text-gray-500 font-mono tracking-wide mt-0.5 uppercase">
                    Code: <span className="font-bold text-gray-700">{v.code}</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-400 italic mt-0.5">No Code</div>
                )}
              </td>
              <td className="py-2 text-sm text-gray-600">
                <div>{v.phone || "-"}</div>
                <div className="text-xs">{v.email}</div>
              </td>
              <td className="py-2 text-gray-700">
                {currency} {Number(v.totalBilled || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </td>
              <td className="py-2 text-blue-600">
                {currency} {Number(v.totalPaid || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </td>
              <td className={`py-2 font-bold ${Number(v.currentBalance || 0) > 0 ? "text-red-500" : "text-emerald-600"}`}>
                {currency} {Number(v.currentBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </td>
              <td className="py-2 text-xs text-gray-500">
                {v.lastPaymentDate ? new Date(v.lastPaymentDate).toLocaleDateString() : "Never"}
              </td>
              <td className="py-2 text-right">
                <RowActions
                  busy={busy}
                  onView={() => onView(v)}
                  onEdit={() => onEdit(v)}
                  onInc={() => onInc(v)}
                  onDelete={() => onDelete(v)}
                />
              </td>
            </tr>
          ))}
          {!vendors?.length && (
            <tr>
              <td className="py-6 text-center text-gray-500" colSpan={6}>
                No vendors yet. Click “Add Vendor”.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
