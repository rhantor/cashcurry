// exportCostData: the excel part (moved from exportCostData.js unchanged).
 
// app/export/exportCostData.js
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "@/app/components/ui/notify";

import { personName } from "@/lib/people";
import { createdAtToStr, derivePaidFrom, derivePaidMethod, fmtDate, methodLabel, normCategory, paidFromLabel, safe } from "./helpers";

/* ----------------------------- Single: Excel ----------------------------- */

export const exportCostToExcel = (cost, branchData) => {
  try {
  const branchName = branchData?.name || "N/A";
  const from = derivePaidFrom(cost);
  const method = derivePaidMethod(cost);
  const allFiles = cost.attachments?.length > 0 ? cost.attachments : (cost.fileURL ? [cost.fileURL] : []);
  const allocations = cost.meta?.allocations || [];

  const data = [
    ["Branch", branchName, "Created At", createdAtToStr(cost.createdAt)],
    ["Date", fmtDate(cost.date)],
    ["Amount (RM)", safe(cost.amount)],
    ["Category", normCategory(cost.category)],
    ["Paid From", paidFromLabel(from)],
    ["Method", methodLabel(method)],
    [
      "Description",
      cost.description ? String(cost.description).replace(/\n/g, ", ") : "-",
    ],
    ["Created By", personName(cost.createdBy) || "-"],
    [],
  ];

  // Invoice breakdown
  if (allocations.length > 0) {
    data.push(["--- Invoices Paid ---"]);
    data.push(["Invoice No", "Invoice Date", "Due Date", "Bill Total", "Amount Paid"]);
    allocations.forEach(a => {
      data.push([
        a.invoiceNo || a.billId || "-",
        a.invoiceDate || "-",
        a.dueDate || "-",
        a.billTotal || "-",
        a.amount || "-",
      ]);
    });
    data.push([]);
  }

  // All attachments
  if (allFiles.length > 0) {
    data.push(["--- Attachments ---"]);
    allFiles.forEach((url, i) => {
      data.push([`File ${i + 1}`, url]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 18 }, { wch: 45 }, { wch: 15 }, { wch: 50 }, { wch: 15 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cost Details");
  XLSX.writeFile(wb, `cost-${fmtDate(cost.date, "yyyy-MM-dd")}.xlsx`);
  } catch (err) {
    console.error("Excel export failed:", err);
    toast.error("Failed to export Excel file. Please try again.");
  }
};

/* ----------------------------- Bulk: Excel ----------------------------- */

export const exportCostsToExcel = (
  costs,
  branchData,
  filterType,
  dateRange = {},
  selectedMonth = "",
  searchDesc
) => {
  try {
  if (!costs?.length) return toast.warning("No data to export!");

  const branchName = Array.isArray(branchData)
    ? branchData
        .map((b) => b?.name)
        .filter(Boolean)
        .join(", ")
    : branchData?.name || "N/A";

  // Optional search filter (kept from your original)
  let filtered = [...costs];
  if (searchDesc && searchDesc.trim() !== "") {
    const q = searchDesc.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.description?.toLowerCase().includes(q) ||
        normCategory(c.category).toLowerCase().includes(q)
    );
  }

  // Filter text for header/file name
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
        const monthName = format(
          new Date(Number(year), Number(month) - 1),
          "MMMM yyyy"
        );
        filterText = monthName;
        fileFilterName = monthName.replace(/\s+/g, "_").toLowerCase();
      }
      break;
    default:
      filterText = "All Data";
      fileFilterName = "all";
  }

  const header = [
    "Date",
    "Amount (RM)",
    "Category",
    "Paid From",
    "Method",
    "Description",
    "Created By",
    "Attachments",
    "Invoices",
    "Created At",
  ];

  const rows = filtered.map((c) => {
    const from = derivePaidFrom(c);
    const method = derivePaidMethod(c);
    const allFiles = c.attachments?.length > 0 ? c.attachments : (c.fileURL ? [c.fileURL] : []);
    const invoiceInfo = (c.meta?.allocations || []).map(a => a.invoiceNo || a.billId || "").filter(Boolean).join(", ");
    return [
      fmtDate(c.date),
      Number(c.amount || 0),
      normCategory(c.category),
      paidFromLabel(from),
      methodLabel(method),
      c.description ? String(c.description).replace(/\n/g, ", ") : "-",
      personName(c.createdBy) || "-",
      allFiles.length > 0 ? `${allFiles.length} file(s)` : "-",
      invoiceInfo || "-",
      createdAtToStr(c.createdAt),
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([
    ["Cost Report"],
    ["Branch:", branchName],
    ["Filter:", searchDesc ? `Search: "${searchDesc}"` : filterText],
    ["Generated:", new Date().toLocaleString()],
    [],
    header,
    ...rows,
  ]);

  ws["!cols"] = [
    { wch: 12 }, // Date
    { wch: 14 }, // Amount
    { wch: 18 }, // Category
    { wch: 20 }, // Paid From
    { wch: 16 }, // Method
    { wch: 40 }, // Description
    { wch: 18 }, // Created By
    { wch: 14 }, // Attachments
    { wch: 30 }, // Invoices
    { wch: 22 }, // Created At
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cost Report");
  XLSX.writeFile(wb, `costs-report_${fileFilterName}.xlsx`);
  } catch (err) {
    console.error("Excel export failed:", err);
    toast.error("Failed to export Excel file. Please try again.");
  }
};
/* ------------------------------ Bulk: PDF (A4 Landscape + KPIs) ------------------------------ */
/* Requires:
   import jsPDF from "jspdf";
   import autoTable from "jspdf-autotable";
*/
