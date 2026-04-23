/* eslint-disable react/prop-types */
"use client";
import React, { useMemo, useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useGetSalaryEntriesQuery } from "@/lib/redux/api/salaryApiSlice";
import ReportPage from "@/app/components/common/ReportPage";
import ReportErrorState from "@/app/components/common/ReportErrorState";
import useReportData from "@/app/hooks/useReportData";
import SalaryReportModal from "./SalaryReportModal";
import EditSalaryModal from "./EditSalaryModal"; // Import the new modal
import {
  exportSalariesToExcel,
  exportSalariesToPDF,
} from "@/utils/export/exportSalary";
import { FaCalendarAlt, FaMoneyBillWave, FaEdit, FaFilePdf } from "react-icons/fa";
import useCurrency from "@/app/hooks/useCurrency";
import { getCurrentUser, hasRole, ALLOWED_EDIT_ROLES } from "@/lib/authz/roles";

export default function SalaryReport() {
  const [dateMode, setDateMode] = useState("salary");
  const [editingItem, setEditingItem] = useState(null);
  const currency = useCurrency();

  const { ready, args: baseArgs, setFetchArgs, branchData, companyId, branchId } = useReportData();
  const canEdit = hasRole(getCurrentUser(), ALLOWED_EDIT_ROLES);

  const args = { ...baseArgs, dateField: dateMode === "salary" ? "month" : "paymentDate" };

  const { data: entries = [], isLoading, error: salaryError } = useGetSalaryEntriesQuery(args);

  // Prepare data: inject dateForFilter based on dateMode
  const prepared = useMemo(() => {
    return (entries || []).map((e) => {
      const salaryDateISO = e.month ? `${e.month}-01` : e.monthStart || "";
      const paymentISO = e.paymentDate || "";
      return {
        ...e,
        dateForFilter: dateMode === "salary" ? salaryDateISO : paymentISO,
      };
    });
  }, [entries, dateMode]);

  if (salaryError) return <ReportErrorState error={salaryError} title="Failed to load salary data" />;
  if (!ready) return <p className="p-4">Preparing…</p>;

  // Define Columns
  const columns = [
    {
      key: "staffName",
      label: "Staff / Type",
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-800">{val || "Branch Total"}</span>
          <span className="text-[10px] text-gray-400 uppercase tracking-tight">
            {row.source === 'payroll' ? 'Individual' : 'Manual Entry'}
          </span>
        </div>
      ),
    },
    {
      key: "month",
      label: "Salary Period",
      render: (val) => (
        <div className="flex items-center gap-2 font-medium text-gray-700">
           <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md"><FaCalendarAlt size={12}/></div>
           {val ? format(new Date(`${val}-01`), "MMM yyyy") : "—"}
        </div>
      ),
    },
    {
      key: "paymentDate",
      label: "Paid Date",
      render: (val) => val ? <span className="text-gray-600">{format(new Date(val), "dd MMM yyyy")}</span> : "—",
    },
    {
      key: "totalSalary",
      label: `Total (${currency})`,
      render: (val) => (
        <span className="font-bold text-gray-800">
          {parseFloat(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "pdfUrl",
      label: "Sheet",
      render: (val) =>
        val ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open(val, "_blank");
            }}
            className="flex items-center gap-1 text-xs font-semibold px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors border border-red-100"
          >
            <FaFilePdf /> View
          </button>
        ) : (
          <span className="text-gray-300 text-xs italic">No PDF</span>
        ),
    },
    {
      key: "createdBy",
      label: "Created By",
      render: (val) => (
        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
          {val?.username || "Unknown"}
        </span>
      ),
    },
  ];

  // If user has permission, add Actions column
  if (canEdit) {
    columns.push({
      key: "actions",
      label: "Actions",
      render: (_, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent opening the view modal
            setEditingItem(row);
          }}
          className="p-2 text-gray-400 hover:text-mint-600 hover:bg-mint-50 rounded-full transition-all"
          title="Edit Entry"
        >
          <FaEdit />
        </button>
      ),
    });
  }

  if (!ready) return <div className="p-8 text-center text-gray-500 animate-pulse">Initializing...</div>;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      
      {/* Header & Filter Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
           <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
             <FaMoneyBillWave className="text-green-500"/> Salary Report
           </h1>
           <p className="text-sm text-gray-400 mt-0.5">Manage and track staff payroll</p>
        </div>

        <div className="flex items-center bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setDateMode("salary")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              dateMode === "salary"
                ? "bg-white text-mint-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            By Period
          </button>
          <button
            onClick={() => setDateMode("payment")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              dateMode === "payment"
                ? "bg-white text-mint-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            By Payment Date
          </button>
        </div>
      </div>

      {/* Main Report Table */}
      <ReportPage
        title="" // Empty because we have a custom header above
        data={prepared}
        isLoading={isLoading}
        branchData={branchData}
        onDateSync={(newDates) => setFetchArgs(newDates)}
        columns={columns}
        filterConfig={{
          dateField: "dateForFilter",
          searchFields: ["staffName", "createdBy.username", "notes"], // Added notes to search
        }}
        exportFunctions={{
          exportPDF: (data, branch, type, range, month, q) =>
            exportSalariesToPDF(data, branch, { dateMode, filterType: type, range, selectedMonth: month, q }),
          exportExcel: (data, branch, type, range, month, q) =>
            exportSalariesToExcel(data, branch, { dateMode, filterType: type, range, selectedMonth: month, q }),
        }}
        modalContentRenderer={(item, branchData, closeModal) => (
          <SalaryReportModal
            item={item}
            branchData={branchData}
            onClose={closeModal}
          />
        )}
        searchBarShow
        searchPlaceholder="Search creator or notes..."
      />

      {/* Edit Modal (Rendered only when editingItem is set) */}
      {editingItem && (
        <EditSalaryModal 
          item={editingItem} 
          companyId={companyId}
          branchId={branchId}
          onClose={() => setEditingItem(null)} 
        />
      )}
    </div>
  );
}