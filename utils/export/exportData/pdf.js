// exportData: the pdf part (moved from exportData.js unchanged).
 
import { format } from "date-fns";
import jsPDF from "jspdf";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";
import { toast } from "@/app/components/ui/notify";

import { personName } from "@/lib/people";
import { drawImageFitting, fetchImageAsDataURL, fmt, formatDate, renderCreatedAt, tendersFromSale, tendersUnionFromSales } from "./helpers";

/**
 * exportToPDF(sale, branchData, tendersOpt?)
 */
export const exportToPDF = async (
  sale,
  branchData,
  tendersOpt = null,
  monthTotal
) => {
  try {
  const branchName = Array.isArray(branchData)
    ? branchData
        .map((b) => b?.name)
        .filter(Boolean)
        .join(", ")
    : branchData?.name || "N/A";

  const doc = new jsPDF();
  const tenders =
    tendersOpt && tendersOpt.length ? tendersOpt : tendersFromSale(sale);

  // Header
  doc.setFontSize(16);
  doc.text("Sales Report", 14, 20);
  doc.setFontSize(12);
  doc.text(formatDate(sale.date), 150, 20);

  const createdTime = renderCreatedAt(sale.createdAt);
  doc.setFontSize(11);
  doc.text(`Branch: ${branchName}`, 14, 28);
  doc.text(`Created At: ${createdTime}`, 135, 28);

  // Table
  const tableData = tenders.map((t) => [
    t.label,
    fmt(sale?.[t.key] ?? 0),
    sale?.notes?.[t.key] || "-",
  ]);

  const computedTotalCents = tenders
    .filter((t) => t.includeInTotal)
    .reduce(
      (sum, t) => sum + Math.round((parseFloat(sale?.[t.key]) || 0) * 100),
      0
    );
  const total = sale.total ?? (computedTotalCents / 100).toFixed(2);
  tableData.push(["Sale Total", fmt(total), "-"]);

  if (monthTotal != null) {
    tableData.push(["This Month Grand Total", fmt(monthTotal), "-"]);
  }

  let endY = 36;
  autoTable(doc, {
    startY: endY,
    head: [["Field", "Value", "Note"]],
    body: tableData,
    didDrawPage: (data) => {
      endY = data.cursor?.y ?? endY;
    },
  });

  // Added by (footer-like line just above bottom if space allows)
  const pageH = doc.internal.pageSize.getHeight();
  let yPos = Math.min(endY + 6, pageH - 22);
  doc.setFontSize(11);
  doc.text(`Added By: ${personName(sale.createdBy) || "Unknown"}`, 14, yPos);
  yPos += 8;

  // 🔹 Z REPORT section
  if (sale.zReportUrl) {
    // If not enough space, add a page title cleanly
    if (yPos > pageH - 30) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(13);
    doc.text("Z Report", 14, yPos);
    yPos += 8;

    // Try to embed the image
    const dataUrl = await fetchImageAsDataURL(sale.zReportUrl);
    if (dataUrl) {
      yPos = drawImageFitting(doc, dataUrl, yPos);
    } else {
      // Fallback: clickable link if image fails (CORS, etc.)
      doc.setTextColor(0, 0, 255);
      doc.textWithLink("View Z Report (link)", 14, yPos, {
        url: sale.zReportUrl,
      });
      doc.setTextColor(0, 0, 0);
    }
  }

  doc.save(`sales-${sale.date}.pdf`);
  } catch (err) {
    console.error("PDF export failed:", err);
    toast.error("Failed to generate PDF. Please try again.");
  }
};

/**
 * exportSalesToPDF(sales, branchData, filterType, dateRange, selectedMonth, tendersOpt?)
 */
export const exportSalesToPDF = (
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

  const doc = new jsPDF("landscape");

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

  // Determine column tenders
  const tenders = tendersUnionFromSales(sales, tendersOpt);

  // Header text
  doc.setFontSize(16);
  doc.text("Sales Report", 14, 20);
  doc.setFontSize(11);
  doc.text(`Branch: ${branchName}`, 14, 28);
  doc.text(`Filter: ${filterText}`, 14, 34);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40);

  // Build table head + body dynamically
  const head = [
    [
      "Date",
      ...tenders.map((t) => t.label),
      "Total (RM)",
      "Proof",
      "Created By",
      "Created At",
    ],
  ];

  const body = sales.map((s) => {
    const tenderCells = tenders.map((t) => s?.[t.key] ?? "-");
    const createdAtText = renderCreatedAt(s.createdAt);
    return [
      formatDate(s.date),
      ...tenderCells,
      s.total ?? 0,
      "", // Proof (link drawn in didDrawCell)
      personName(s.createdBy) || "-",
      createdAtText,
    ];
  });

  autoTable(doc, {
    startY: 50,
    head,
    body,
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 22 }, // Date
      [1 + tenders.length]: { cellWidth: 25 }, // Total
      [2 + tenders.length]: { cellWidth: 20 }, // Proof
      [3 + tenders.length]: { cellWidth: 25 }, // Created By
      [4 + tenders.length]: { cellWidth: 40 }, // Created At
    },
    didDrawCell: (data) => {
      // ✅ draw link in Proof column, not Total
      if (data.section === "body" && data.column.index === 2 + tenders.length) {
        const sale = sales[data.row.index];
        if (sale?.zReportUrl) {
          const text = "View Proof";
          const textWidth =
            (doc.getStringUnitWidth(text) * doc.internal.getFontSize()) /
            doc.internal.scaleFactor;
          const x = data.cell.x + (data.cell.width - textWidth) / 3;
          const y = data.cell.y + data.cell.height / 2 + 2;

          doc.setTextColor(0, 0, 255);
          doc.textWithLink(text, x, y, { url: sale.zReportUrl });
          doc.setTextColor(0, 0, 0);
        }
      }
    },
  });

  doc.save(`sales-report_${fileFilterName}.pdf`);
  } catch (err) {
    console.error("PDF export failed:", err);
    toast.error("Failed to generate PDF. Please try again.");
  }
};
