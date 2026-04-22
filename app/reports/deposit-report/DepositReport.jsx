"use client";
import React from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import ReportPage from "@/app/components/common/ReportPage";
import useReportData from "@/app/hooks/useReportData";
import {
  exportDepositsToExcel,
  exportDepositsToPDF,
} from "@/utils/export/exportDepositData";
import DepositModal from "./DepositModal";
import { useGetDepositEntryQuery } from "@/lib/redux/api/depositApiSlice";
import useCurrency from "@/app/hooks/useCurrency";

export default function DepositReport() {
  const { ready, args, setFetchArgs, branchData } = useReportData();
  const { data: deposits = [], isLoading } = useGetDepositEntryQuery(args);
  const currency = useCurrency();

  if (!ready) return <p className="p-4">Preparing…</p>;

  return (
    <ReportPage
      title="Deposit Report"
      data={deposits}
      isLoading={isLoading}
      branchData={branchData}
      onDateSync={(newDates) => setFetchArgs(newDates)}
      columns={[
        {
          key: "date",
          label: "Date",
          render: (val) => format(new Date(val), "dd/MM/yyyy"),
        },
        { key: "amount", label: `Amount (${currency})` },
        { key: "bankName", label: "Bank Name" },
        { key: "traceNo", label: "Trace No" },
        {
          key: "fileURL",
          label: "Invoice / File",
          render: (val, row) => {
            const files = row.attachments?.length > 0
              ? row.attachments
              : val
              ? [val]
              : [];
            if (files.length === 0) return <span className="text-gray-400">N/A</span>;
            return (
              <div className="flex items-center gap-1.5">
                {files.map((url, i) => (
                  <button
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(url, "_blank");
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
        {
          key: "createdBy",
          label: "Created By",
          render: (val) => val?.username || "Unknown",
        },
      ]}
      filterConfig={{
        dateField: "date",
        searchFields: ["bankName", "traceNo"],
      }}
      exportFunctions={{
        exportPDF: exportDepositsToPDF,
        exportExcel: exportDepositsToExcel,
      }}
      modalContentRenderer={(item, branchData, closeModal) => (
        <DepositModal
          item={item}
          branchData={branchData}
          onClose={closeModal}
        />
      )}
      searchBarShow={true}
      searchPlaceholder={"Search By Bank name || Trace No"}
    />
  );
}
