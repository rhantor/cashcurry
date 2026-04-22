/* eslint-disable react/prop-types */
"use client";
import React, { useMemo } from "react";

import { formatMoney } from "@/utils/formatMoney";
import useCurrency from "@/app/hooks/useCurrency";

function agingLabel(dueInDays) {
  if (dueInDays < 0) return `Overdue ${Math.abs(dueInDays)}d`;
  if (dueInDays === 0) return "Due today";
  return `Due in ${dueInDays}d`;
}

const chipClass = (days) =>
  days < 0
    ? "bg-red-100 text-red-700"
    : days === 0
    ? "bg-yellow-100 text-yellow-700"
    : "bg-green-100 text-green-700";

export default function DueBillsTable({
  bills = [], // [{id, vendorName, invoiceNo, dueDate, total, paid, balance, attachments, __dueInDays}]
  selectedIds = [],
  onToggleOne, // (id, checked)=>void
  onToggleAll, // (checked)=>void
}) {
  const allChecked = useMemo(
    () => bills.length > 0 && selectedIds.length === bills.length,
    [bills.length, selectedIds.length]
  );
  
  const currency = useCurrency();
  const fmt = (v) => formatMoney(v, currency);

  /* ---------- Mobile card list ---------- */
  if (!bills?.length) {
    return (
      <div className="bg-white rounded-xl shadow p-4 text-center text-sm text-gray-500">
        No due bills. Nice!
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-3 sm:p-4">
      {/* Mobile: “select all” */}
      <div className="flex items-center gap-2 sm:hidden mb-2">
        <input
          type="checkbox"
          className="h-5 w-5 accent-mint-500"
          checked={allChecked}
          onChange={(e) => onToggleAll?.(e.target.checked)}
          aria-label="Select all"
        />
        <span className="text-sm text-gray-700">Select all</span>
      </div>

      {/* Mobile card list */}
      <div className="space-y-3 sm:hidden">
        {bills.map((b) => {
          const checked = selectedIds.includes(b.id);
          return (
            <label
              key={b.id}
              className="block rounded-xl border border-gray-200 p-3 active:bg-gray-50"
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0 accent-mint-500"
                  checked={checked}
                  onChange={(e) => onToggleOne?.(b.id, e.target.checked)}
                  aria-label={`Select invoice ${b.invoiceNo || "-"}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium truncate">
                      {b.vendorName || "-"}
                    </p>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] ${chipClass(
                        b.__dueInDays
                      )}`}
                    >
                      {agingLabel(b.__dueInDays)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Invoice:{" "}
                    <span className="font-medium">{b.invoiceNo || "-"}</span>
                  </p>

                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-gray-50 p-2">
                      <p className="text-gray-500">Total</p>
                      <p className="font-semibold">{fmt(b.total)}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-2">
                      <p className="text-gray-500">Paid</p>
                      <p className="font-semibold">{fmt(b.paid)}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-2">
                      <p className="text-gray-500">Balance</p>
                      <p className="font-semibold">{fmt(b.balance)}</p>
                    </div>
                  </div>

                  <div className="mt-2">
                    {b.attachments?.length ? (
                      <a
                        href={b.attachments[0]}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-mint-600 underline"
                      >
                        View attachment
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">
                        No attachment
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {/* Desktop/tablet table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-gray-600">
            <tr>
              <th className="py-2 pl-2 pr-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-mint-500"
                  checked={allChecked}
                  onChange={(e) => onToggleAll?.(e.target.checked)}
                  aria-label="Select all"
                />
              </th>
              <th className="py-2 px-3">Vendor</th>
              <th className="py-2 px-3">Invoice</th>
              <th className="py-2 px-3">Due</th>
              <th className="py-2 px-3 text-right">Total</th>
              <th className="py-2 px-3 text-right">Paid</th>
              <th className="py-2 px-3 text-right">Balance</th>
              <th className="py-2 px-3">Attachment</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => {
              const checked = selectedIds.includes(b.id);
              return (
                <tr key={b.id} className="border-t">
                  <td className="py-2 pl-2 pr-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-mint-500"
                      checked={checked}
                      onChange={(e) => onToggleOne?.(b.id, e.target.checked)}
                      aria-label={`Select invoice ${b.invoiceNo || "-"}`}
                    />
                  </td>
                  <td className="py-2 px-3">{b.vendorName || "-"}</td>
                  <td className="py-2 px-3">{b.invoiceNo || "-"}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${chipClass(
                        b.__dueInDays
                      )}`}
                    >
                      {agingLabel(b.__dueInDays)}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">{fmt(b.total)}</td>
                  <td className="py-2 px-3 text-right text-gray-600">
                    {fmt(b.paid)}
                  </td>
                  <td className="py-2 px-3 text-right font-medium">
                    {fmt(b.balance)}
                  </td>
                  <td className="py-2 px-3">
                    {b.attachments?.length ? (
                      <a
                        href={b.attachments[0]}
                        target="_blank"
                        rel="noreferrer"
                        className="text-mint-600 hover:underline"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
