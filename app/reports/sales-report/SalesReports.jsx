// app/reports/sales-report/page.jsx
"use client";
import React, { useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { skipToken } from "@reduxjs/toolkit/query";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import ReportPage from "@/app/components/common/ReportPage";
import ReportErrorState from "@/app/components/common/ReportErrorState";
import useReportData from "@/app/hooks/useReportData";
import { useGetSalesEntriesQuery } from "@/lib/redux/api/salesApiSlice";
import SalesReportModal from "./SalesReportModal";
import SalesEditModal from "./SalesEditModal";
import {
  exportSalesToExcel,
  exportSalesToPDF,
} from "@/utils/export/exportData";
import useCurrency from "@/app/hooks/useCurrency";

export default function SalesReport() {
  const { ready, args, setFetchArgs, branchData, companyId, branchId } = useReportData();
  const { data: sales = [], isLoading, error: salesError } = useGetSalesEntriesQuery(args);
  const currency = useCurrency();
  const [editingItem, setEditingItem] = useState(null);

  if (!ready) return <p className="p-4 text-gray-500">Preparing…</p>;
  if (salesError) return <ReportErrorState error={salesError} title="Failed to load sales data" />;

  return (
    <>
      <ReportPage
        title={"Sales Report"}
        data={sales}
        isLoading={isLoading}
        branchData={branchData}
        onDateSync={(newDates) => setFetchArgs(newDates)}
        // NEW:
        chartConfig={{
          enabled: true,
          type: "area", // "area" | "bar"
          valueField: "total", // which numeric field to plot/sum
          theme: "sales", // "sales" | "cost" | "deposit" | { stroke, fill }
          height: 260, // optional
        }}
        columns={[
          {
            key: "date",
            label: "Date",
            render: (val) => (val ? format(new Date(val), "dd/MM/yyyy") : "-"),
          },
          {
            key: "total",
            label: `Total (${currency})`,
            render: (val) => Number(val ?? 0).toFixed(2),
          },
          {
            key: "zReportUrl",
            label: "Z Report",
            render: (val) =>
              val ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(val, "_blank");
                  }}
                  className="flex items-center"
                >
                  {String(val).toLowerCase().endsWith(".pdf") ? (
                    <span className="text-blue-500 underline">PDF</span>
                  ) : (
                    <img
                      src={val}
                      alt="Z Report"
                      className="w-12 h-12 object-cover rounded border"
                    />
                  )}
                </button>
              ) : (
                <span className="text-gray-400">N/A</span>
              ),
          },
          {
            key: "createdBy",
            label: "Created By",
            render: (val) => val?.username || "Unknown",
          },
          // 👇 New Actions column
          {
            key: "__actions",
            label: "Actions",
            render: (_val, row) => (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingItem(row);
                }}
                className="px-3 py-1 rounded bg-mint-100 hover:bg-mint-200 text-mint-700 text-xs font-medium"
              >
                Edit
              </button>
            ),
          },
        ]}
        filterConfig={{
          dateField: "date",
          searchFields: ["createdBy.username"],
        }}
        showTotalsFooter={true}
        exportFunctions={{
          exportPDF: exportSalesToPDF,
          exportExcel: exportSalesToExcel,
        }}
        modalContentRenderer={(item, branchData, closeModal, monthTotal) => (
          <SalesReportModal
            item={item}
            branchData={branchData}
            monthTotal={monthTotal}
            onClose={closeModal}
          />
        )}
        // optional: show search bar if you want
        // searchBarShow
      />

      {/* Edit popup */}
      {editingItem && (
        <SalesEditModal
          item={editingItem}
          branchData={branchData}
          companyId={companyId}
          branchId={branchId}
          onClose={() => setEditingItem(null)}
        />
      )}
    </>
  );
}
