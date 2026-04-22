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
    <div className="space-y-4">
      {/* Mobile View: Card List */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {(vendors || []).map((v) => (
          <div key={v.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-lg leading-tight">{v.name}</h3>
                {v.code ? (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded uppercase tracking-wider">
                    {v.code}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400 italic block mt-1">No Code</span>
                )}
              </div>
              <RowActions
                busy={busy}
                onView={() => onView(v)}
                onEdit={() => onEdit(v)}
                onInc={() => onInc(v)}
                onDelete={() => onDelete(v)}
              />
            </div>

            <div className="grid grid-cols-2 gap-y-4 gap-x-2 pt-2 border-t border-gray-50">
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-0.5">AP Balance</p>
                <p className={`text-sm font-black ${Number(v.currentBalance || 0) > 0 ? "text-red-500" : "text-emerald-600"}`}>
                  {currency} {Number(v.currentBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-0.5">Last Payment</p>
                <p className="text-sm text-gray-600 font-medium">
                  {v.lastPaymentDate ? new Date(v.lastPaymentDate).toLocaleDateString() : "Never"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-0.5">Total Paid</p>
                <p className="text-sm text-blue-600 font-bold">
                  {currency} {Number(v.totalPaid || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-0.5">Total Billed</p>
                <p className="text-sm text-gray-700 font-bold">
                  {currency} {Number(v.totalBilled || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 mt-1 text-xs text-gray-500 border-t border-gray-50">
               <div className="flex items-center gap-1">
                 <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                 <span>{v.phone || "No phone"}</span>
               </div>
               <div className="flex items-center gap-1 truncate">
                 <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                 <span className="truncate">{v.email || "No email"}</span>
               </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop View: Table */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm p-4 overflow-x-auto border border-gray-100">
        <table className="min-w-full text-sm">
          <thead className="text-left text-gray-400">
            <tr className="uppercase text-[11px] font-black tracking-widest">
              <th className="pb-4 px-2">Name & Code</th>
              <th className="pb-4 px-2">Contact</th>
              <th className="pb-4 px-2">Total Billed ({currency})</th>
              <th className="pb-4 px-2">Total Paid ({currency})</th>
              <th className="pb-4 px-2">AP Balance ({currency})</th>
              <th className="pb-4 px-2">Last Payment</th>
              <th className="pb-4 px-2 w-24 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(vendors || []).map((v) => (
              <tr key={v.id} className="hover:bg-gray-50/50 transition-colors group">
                <td className="py-4 px-2">
                  <div className="font-bold text-gray-800">{v.name}</div>
                  {v.code ? (
                    <div className="text-[10px] text-gray-400 font-mono tracking-wide mt-0.5 uppercase">
                      Code: <span className="font-bold text-gray-500">{v.code}</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-300 italic mt-0.5">No Code</div>
                  )}
                </td>
                <td className="py-4 px-2 text-sm text-gray-600">
                  <div className="font-medium">{v.phone || "-"}</div>
                  <div className="text-xs text-gray-400">{v.email}</div>
                </td>
                <td className="py-4 px-2 text-gray-700 font-semibold">
                  {Number(v.totalBilled || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </td>
                <td className="py-4 px-2 text-blue-600 font-semibold">
                  {Number(v.totalPaid || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </td>
                <td className={`py-4 px-2 font-black ${Number(v.currentBalance || 0) > 0 ? "text-red-500" : "text-emerald-600"}`}>
                  {Number(v.currentBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </td>
                <td className="py-4 px-2 text-xs text-gray-500">
                  <div className="font-medium text-gray-600">
                    {v.lastPaymentDate ? new Date(v.lastPaymentDate).toLocaleDateString() : "Never"}
                  </div>
                </td>
                <td className="py-4 px-2 text-right">
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
          </tbody>
        </table>
      </div>

      {!vendors?.length && !busy && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-100 py-12 text-center">
          <div className="text-gray-300 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium">No vendors yet. Click “Add Vendor” to begin.</p>
        </div>
      )}
    </div>
  );
}
