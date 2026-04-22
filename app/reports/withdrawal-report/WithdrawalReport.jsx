"use client";
import React from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import ReportPage from "@/app/components/common/ReportPage";
import useReportData from "@/app/hooks/useReportData";
import { useGetWithdrawEntriesQuery } from "@/lib/redux/api/cashWithdrawApiSlice";

import {
  exportWithdrawalsToExcel,
  exportWithdrawalsToPDF,
} from "@/utils/export/exportWithdrawData";
import WithdrawModal from "./WithdrawModal";
import useCurrency from "@/app/hooks/useCurrency";

export default function WithdrawalReport() {
  const { ready, args, setFetchArgs, branchData } = useReportData();
  const currency = useCurrency();

  // Data fetch
  const { data: withdrawals = [], isLoading } =
    useGetWithdrawEntriesQuery(args);

  if (!ready) return <p className="p-4">Preparing…</p>;

  return (
    <div className="p-4">
      <ReportPage
        title=" Cash Withdrawal Report"
        data={withdrawals}
        isLoading={isLoading}
        branchData={branchData}
        onDateSync={(newDates) => setFetchArgs(newDates)}
        // Table columns
        columns={[
          {
            key: "date",
            label: "Date",
            render: (val) => {
              // val is "YYYY-MM-DD" string in your writer
              // Safe render:
              try {
                return format(new Date(val + "T00:00:00"), "dd/MM/yyyy");
              } catch {
                return val || "-";
              }
            },
          },
          {
            key: "amount",
            label: `Amount (${currency})`,
            className: "text-right",
            render: (v) => Number(v || 0).toFixed(2),
          },
          { key: "category", label: "Category" },
          { key: "method", label: "Method" },
          { key: "reference", label: "Reference" },
          {
            key: "createdBy",
            label: "Created By",
            render: (val) => val?.username || "Unknown",
          },
          {
            key: "receiptUrl",
            label: "Receipt",
            render: (url, row) => {
              const files = row.receiptUrls?.length > 0
                ? row.receiptUrls
                : url
                ? [url]
                : [];
              if (files.length === 0) return <span className="text-gray-400">N/A</span>;
              return (
                <div className="flex items-center gap-1.5">
                  {files.map((u, i) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(u, "_blank");
                      }}
                      className="text-blue-500 underline text-xs"
                    >
                      {files.length === 1 ? "View" : `File ${i + 1}`}
                    </button>
                  ))}
                </div>
              );
            },
          },
        ]}
        // Filters/Search (ReportPage does client-side filtering)
        filterConfig={{
          dateField: "date", // your date is a YYYY-MM-DD string; ReportPage likely compares strings or converts—works fine
          searchFields: ["category", "method", "reference"], // keep flat keys to avoid nested path issues
        }}
        // Export handlers
        exportFunctions={{
          exportPDF: exportWithdrawalsToPDF,
          exportExcel: exportWithdrawalsToExcel,
        }}
        // Row modal (detail view)
        modalContentRenderer={(item, branchData, closeModal) => (
          <WithdrawModal
            item={item}
            branchData={branchData}
            onClose={closeModal}
          />
        )}
        searchBarShow={true}
        searchPlaceholder={"Search by Category • Method • Reference"}
      />
    </div>
  );
}
