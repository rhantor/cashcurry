/* eslint-disable react/prop-types */
"use client";

import React, { useState, useMemo } from "react";
import { exportSummaryToExcel, exportSummaryToPDF } from "@/utils/export/exportSummary";
import FilterBar from "@/app/components/common/FilterBar";
import SummaryModeSwitch from "./components/SummaryModeSwitch";
import KpiCards from "./components/KpiCards";
import SummaryTable from "./components/SummaryTable";
import { useSummaryReportLogic } from "@/hook/useSummaryReportLogic";
import { skipToken } from "@reduxjs/toolkit/query";

const SUMMARY_MODES = [
  { id: "front", label: "Front Office" },
  { id: "back", label: "Back Office" },
  { id: "all", label: "All" },
];

export default function SummaryReport() {
  // 1. UI State
  const [filterState, setFilterState] = useState({
    filterType: "last7days",
    dateRange: { from: "", to: "" },
    selectedMonth: "",
  });
  const [summaryMode, setSummaryMode] = useState("front");
  const [showDetails, setShowDetails] = useState(true);

  // 2. Logic & Data (Abstracted away)
  const {
    ready,
    branchName,
    companyName,
    computed,
    tenderDefs,
    finalSummary,
    filterBadgeText,
    commonMeta,
  } = useSummaryReportLogic(filterState, summaryMode);

  // 3. View-specific prep
  const modeLabel = SUMMARY_MODES.find((m) => m.id === summaryMode)?.label;

  // Filter rows for the table based on "Show Details" toggle
  const rowsForTable = useMemo(() => {
    if (showDetails) return computed.rows;
    return computed.rows.filter((r) => r.type === "balance" || r.type === "daily");
  }, [computed.rows, showDetails]);

  // Column visibility
  const hiddenCols = summaryMode === "back" ? { cash: true, cashInHand: true } : { cash: false, cashInHand: false };

  if (!ready) return <div className="p-6">Preparing…</div>;

  return (
    <div className="p-6">
      {/* --- HEADER --- */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 className="text-2xl font-bold capitalize">{branchName} Summary Report</h2>
        <div className="flex items-center gap-3">
          <SummaryModeSwitch
            modes={SUMMARY_MODES}
            value={summaryMode}
            onChange={setSummaryMode}
          />
          <DetailToggle showDetails={showDetails} setShowDetails={setShowDetails} />
        </div>
      </div>

      {/* --- CONTROLS & EXPORTS --- */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-3">
          <FilterBar
            filterType={filterState.filterType}
            dateRange={filterState.dateRange}
            selectedMonth={filterState.selectedMonth}
            onFilterChange={(update) => setFilterState((prev) => ({ ...prev, ...update }))}
            searchBarShow={false}
          />
          <Badge text={filterBadgeText} />
        </div>

        <ExportButtons
          computed={computed}
          commonMeta={{
            ...commonMeta,
            title: `${branchName} Summary`,
            companyName,
            branchName,
            modeLabel,
            hiddenCols,
            showRepayCashCols: summaryMode !== "back",
            showRepayBankCols: summaryMode !== "front",
          }}
        />
      </div>

      {/* --- KPIS --- */}
      <KpiCards
        mode={summaryMode}
        kpis={computed.kpis}
      />

      {/* --- TABLE --- */}
      <SummaryTable
        tenderDefs={tenderDefs}
        summaryRows={rowsForTable}
        mode={summaryMode}
        periodTotals={computed.periodTotals}
        periodTotalSales={computed.periodTotalSales}
        periodDeposits={computed.periodDeposits}
        periodWithdrawals={computed.periodWithdrawals}
        periodRepaySums={computed.periodRepaySums}
        hiddenCols={hiddenCols}
        showRepayCashCols={summaryMode !== "back"}
        showRepayBankCols={summaryMode !== "front"}
      />
    </div>
  );
}

// --- Tiny sub-components to clean up JSX ---

const DetailToggle = ({ showDetails, setShowDetails }) => (
  <button
    type="button"
    onClick={() => setShowDetails((v) => !v)}
    className={`relative inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition ${
      showDetails ? "bg-emerald-600 text-white shadow-sm" : "bg-slate-200 text-slate-700"
    }`}
  >
    <span className={`mr-2 h-2.5 w-2.5 rounded-full border ${showDetails ? "bg-white border-white" : "bg-slate-500 border-slate-500"}`} />
    {showDetails ? "Details On" : "Details Off"}
  </button>
);

const Badge = ({ text }) => (
  <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs">
    {text}
  </span>
);

const ExportButtons = ({ computed, commonMeta }) => (
  <div className="flex items-center gap-3">
    <button
      onClick={() => exportSummaryToExcel(computed.rows, computed.kpis, computed.periodTotals, computed.periodTotalSales, computed.periodDeposits, computed.periodWithdrawals, computed.periodRepaySums, computed.tenderDefs, commonMeta)}
      className="px-3 py-1.5 text-sm rounded bg-emerald-600 text-white"
    >
      Export Excel
    </button>
    <button
      onClick={() => exportSummaryToPDF(computed.rows, computed.kpis, computed.periodTotals, computed.periodTotalSales, computed.periodDeposits, computed.periodWithdrawals, computed.periodRepaySums, computed.tenderDefs, commonMeta)}
      className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white"
    >
      Export PDF
    </button>
  </div>
);