// app/salary-report/SalaryReportModal.jsx
/* eslint-disable react/prop-types */
"use client";
import React from "react";
import { format } from "date-fns";
import {
  exportOneSalaryToExcel,
  exportOneSalaryToPDF,
  shareSalary,
} from "@/utils/export/exportSalary";
import useCurrency from "@/app/hooks/useCurrency";

export default function SalaryReportModal({ item, branchData, onClose }) {
  const currency = useCurrency();
  if (!item) return null;

  const branchName = Array.isArray(branchData)
    ? branchData.map((b) => b.name).join(", ")
    : branchData?.name || "Branch";

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
          <h2 className="text-lg font-bold">{branchName}</h2>
          <h2 className="text-lg font-bold">
            Salary –{" "}
            {item.month
              ? format(new Date(`${item.month}-01`), "MMM yyyy")
              : "-"}
          </h2>
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Payment Date</span>
            <span>
              {item.paymentDate
                ? format(new Date(item.paymentDate), "dd/MM/yyyy")
                : "-"}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Total ({currency})</span>
            <span>{Number(item.totalSalary || 0).toFixed(2)}</span>
          </div>

          {item.notes && (
            <div className="pt-2">
              <p className="text-sm font-medium">Notes</p>
              <p className="text-gray-700 whitespace-pre-wrap">{item.notes}</p>
            </div>
          )}

          {/* Payroll Breakdown (only for payroll source) */}
          {item.source === 'payroll' && (
            <div className="mt-4 pt-4 border-t border-dashed space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Breakdown</p>
              
              <div className="space-y-1">
                <div className="flex justify-between text-gray-500">
                  <span>Basic Pay</span>
                  <span>{item.basePay?.toFixed(2)}</span>
                </div>
                {item.allowance > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Allowance</span>
                    <span>{item.allowance.toFixed(2)}</span>
                  </div>
                )}
                {item.otPay > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Overtime ({item.otHours}h)</span>
                    <span>{item.otPay.toFixed(2)}</span>
                  </div>
                )}
                {item.phPay > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>PH Pay</span>
                    <span>{item.phPay.toFixed(2)}</span>
                  </div>
                )}
                {item.bonus > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Bonus</span>
                    <span>{item.bonus.toFixed(2)}</span>
                  </div>
                )}
                {item.otherEarnings > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Other Earn.</span>
                    <span>{item.otherEarnings.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1 border-t border-gray-50 pt-1">
                {(item.statutory || []).map(s => (
                  <div key={s.key} className="flex justify-between text-red-500 text-xs italic">
                    <span>{s.name} ({s.employeeRate}%)</span>
                    <span>-{s.employeeAmt.toFixed(2)}</span>
                  </div>
                ))}
                {item.advanceAmt > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>Advance</span>
                    <span>-{item.advanceAmt.toFixed(2)}</span>
                  </div>
                )}
                {item.loanAmt > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>Loan EMI</span>
                    <span>-{item.loanAmt.toFixed(2)}</span>
                  </div>
                )}
                {item.penalty > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>Penalty</span>
                    <span>-{item.penalty.toFixed(2)}</span>
                  </div>
                )}
                {item.otherDeductions > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>Other Ded.</span>
                    <span>-{item.otherDeductions.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between font-bold pt-1 text-gray-900">
                <span>Net Payable</span>
                <span>{currency} {Number(item.netPay || item.totalSalary).toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-between border-t pt-2 mt-2 text-gray-600 text-sm">
            <span>Added By</span>
            <span>{item.createdBy?.username || "Unknown"}</span>
          </div>

          {/* PDF link */}
          {item.pdfUrl && (
            <div className="mt-3">
              <a
                href={item.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm"
              >
                Open Salary Sheet (PDF)
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
            onClick={() => exportOneSalaryToPDF(item, branchData)}
            className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white"
          >
            Export PDF
          </button>
          <button
            onClick={() => exportOneSalaryToExcel(item, branchData)}
            className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white"
          >
            Export Excel
          </button>
          <button
            onClick={() => shareSalary(item, branchData)}
            className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white"
          >
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
