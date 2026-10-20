// exportData: the excel part (moved from exportData.js unchanged).
 
import { format } from "date-fns";
import * as XLSX from "xlsx";
import "jspdf-autotable";
import { toast } from "@/app/components/ui/notify";

import { personName } from "@/lib/people";
import { formatDate, renderCreatedAt, tendersFromSale, tendersUnionFromSales } from "./helpers";

/** =========================================================
 *  Single-sale exports (dynamic tenders + notes)
 *  ========================================================= */

/**
 * exportToExcel(sale, branchData, tendersOpt?)
 */
export const exportToExcel = (sale, branchData, tendersOpt = null) => {
  try {
  const branchName = Array.isArray(branchData)
    ? branchData
        .map((b) => b?.name)
        .filter(Boolean)
        .join(", ")
    : branchData?.name || "N/A";

  const tenders =
    tendersOpt && tendersOpt.length ? tendersOpt : tendersFromSale(sale);
  const createdTime = renderCreatedAt(sale.createdAt);

  const rows = [
    ["Branch", branchName || "N/A", "Created At", createdTime],
    ["Date", sale.date],
  ];

  for (const t of tenders) {
    rows.push([
      t.label,
      sale?.[t.key] ?? "",
      "Note",
      sale?.notes?.[t.key] ?? "",
    ]);
  }

  const computedTotalCents = tenders
    .filter((t) => t.includeInTotal)
    .reduce(
      (sum, t) => sum + Math.round((parseFloat(sale?.[t.key]) || 0) * 100),
      0
    );
  const total = sale.total ?? (computedTotalCents / 100).toFixed(2);

  rows.push(["Total", total]);
  rows.push(["Added By", personName(sale.createdBy) || "Unknown"]);

  // 🔹 Add a Z Report link row at the end (images aren’t reliably embeddable with community SheetJS)
  if (sale.zReportUrl) {
    rows.push(["Z Report URL", sale.zReportUrl]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 18 }, { wch: 40 }, { wch: 12 }, { wch: 50 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sales Details");
  XLSX.writeFile(wb, `sales-${sale.date}.xlsx`);
  } catch (err) {
    console.error("Excel export failed:", err);
    toast.error("Failed to export Excel file. Please try again.");
  }
};

/** =========================================================
 *  Multi-sale exports (dynamic columns)
 *  ========================================================= */

/**
 * exportSalesToExcel(sales, branchData, filterType, dateRange, selectedMonth, tendersOpt?)
 */
export const exportSalesToExcel = (
  sales,
  branchData,
  filterType,
  dateRange = {},
  selectedMonth = "",
  tendersOpt = null
) => {
  try {
  if (!sales?.length) return toast.warning("No data to export!");

  const branchName = Array.isArray(branchData)
    ? branchData
        .map((b) => b?.name)
        .filter(Boolean)
        .join(", ")
    : branchData?.name || "N/A";

  // Filter text + file name part
  let filterText = "All Data";
  let fileFilterName = "all";
  switch (filterType) {
    case "weekly":
      filterText = "This Week";
      fileFilterName = "this_week";
      break;
    case "monthly":
      filterText = "This Month";
      fileFilterName = "this_month";
      break;
    case "last7days":
      filterText = "Last 7 Days";
      fileFilterName = "last_7_days";
      break;
    case "range":
      if (dateRange.from && dateRange.to) {
        const start = format(new Date(dateRange.from), "dd/MM/yyyy");
        const end = format(new Date(dateRange.to), "dd/MM/yyyy");
        filterText = `${start} - ${end}`;
        fileFilterName = `${start.replace(/\//g, "-")}_to_${end.replace(
          /\//g,
          "-"
        )}`;
      }
      break;
    case "month":
      if (selectedMonth) {
        const [year, month] = selectedMonth.split("-");
        const monthName = format(new Date(year, month - 1), "MMMM yyyy");
        filterText = monthName;
        fileFilterName = monthName.replace(/\s+/g, "_").toLowerCase();
      }
      break;
    default:
      filterText = "All Data";
      fileFilterName = "all";
  }

  // Determine column tenders (union across sales or provided)
  const tenders = tendersUnionFromSales(sales, tendersOpt);

  // Header row: Date + each tender label + Total + Proof + Created By + Created At
  const header = [
    "Date",
    ...tenders.map((t) => t.label),
    "Total",
    "Proof (URL)",
    "Created By",
    "Created At",
  ];

  const body = sales.map((s) => {
    // For each sale, we don't recompute total here; we trust saved total if present.
    // Tender values populate in tender order; missing keys become "0".
    const tenderCells = tenders.map((t) => s?.[t.key] ?? "0");
    const createdAtText = renderCreatedAt(s.createdAt);

    return [
      formatDate(s.date),
      ...tenderCells,
      s.total ?? "0",
      s.zReportUrl || "-",
      personName(s.createdBy) || "-",
      createdAtText,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([
    ["Sales Report"],
    ["Branch:", branchName],
    ["Filter:", filterText],
    ["Generated:", new Date().toLocaleString()],
    [],
    header,
    ...body,
  ]);

  // Column widths (first few + rest)
  const baseCols = [{ wch: 12 }];
  const tenderCols = tenders.map(() => ({ wch: 12 }));
  const tailCols = [{ wch: 12 }, { wch: 40 }, { wch: 20 }, { wch: 25 }];
  ws["!cols"] = [...baseCols, ...tenderCols, ...tailCols];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sales Report");
  XLSX.writeFile(wb, `sales-report_${fileFilterName}.xlsx`);
  } catch (err) {
    console.error("Excel export failed:", err);
    toast.error("Failed to export Excel file. Please try again.");
  }
};
