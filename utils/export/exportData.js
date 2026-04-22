/* eslint-disable no-prototype-builtins */
import { format, parseISO } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";

/** ---------- Tender helpers ---------- */
const DEFAULT_TENDERS = [
  { key: "cash", label: "Cash", includeInTotal: true, order: 1 },
  { key: "card", label: "Card", includeInTotal: true, order: 2 },
  { key: "qr", label: "QR", includeInTotal: true, order: 3 },
  { key: "grab", label: "Grab", includeInTotal: true, order: 4 },
  { key: "foodpanda", label: "Foodpanda", includeInTotal: true, order: 5 },
  { key: "online", label: "Online", includeInTotal: true, order: 6 },
  { key: "cheque", label: "Cheque", includeInTotal: true, order: 7 },
  { key: "promotion", label: "Promotion", includeInTotal: false, order: 8 },
];

const normalizeTender = (t) => ({
  key: t.key,
  label: t.label ?? t.key,
  includeInTotal: t.includeInTotal !== false,
  order: t.order ?? 9999,
});

const tendersFromSale = (sale) => {
  if (Array.isArray(sale?.tenderMeta) && sale.tenderMeta.length) {
    return [...sale.tenderMeta]
      .map(normalizeTender)
      .sort((a, b) => a.order - b.order);
  }
  // Infer from present fields using default order
  const present = DEFAULT_TENDERS.filter((t) => sale?.hasOwnProperty(t.key));
  return (present.length ? present : DEFAULT_TENDERS)
    .map(normalizeTender)
    .sort((a, b) => a.order - b.order);
};

const tendersUnionFromSales = (sales, provided) => {
  if (provided?.length)
    return provided.map(normalizeTender).sort((a, b) => a.order - b.order);

  // Build union by order preference: prefer tenderMeta, else default order.
  const map = new Map();
  const push = (t) => {
    const k = t.key;
    if (!map.has(k)) map.set(k, normalizeTender(t));
  };

  for (const s of sales) {
    if (Array.isArray(s?.tenderMeta) && s.tenderMeta.length) {
      s.tenderMeta.forEach(push);
    } else {
      // fallback: infer from present fields against defaults
      DEFAULT_TENDERS.filter((t) => Object.hasOwn(s, t.key)).forEach(push);
    }
  }
  if (map.size === 0) DEFAULT_TENDERS.forEach(push);

  return Array.from(map.values()).sort((a, b) => a.order - b.order);
};

/** ---------- Format helpers ---------- */
const fmt = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n.toFixed(2) : v ?? "0.00";
};

const formatDate = (d) => {
  try {
    return format(new Date(d), "dd/MM/yyyy");
  } catch {
    try {
      return format(parseISO(d), "dd/MM/yyyy");
    } catch {
      return String(d ?? "");
    }
  }
};

const renderCreatedAt = (createdAt) => {
  // Firestore Timestamp
  if (createdAt?.toDate) return createdAt.toDate().toLocaleString();
  if (typeof createdAt === "object" && typeof createdAt?.seconds === "number") {
    return new Date(createdAt.seconds * 1000).toLocaleString();
  }
  // ISO/string
  const d = new Date(createdAt);
  return Number.isNaN(d.getTime()) ? "Unknown" : d.toLocaleString();
};
// --- Helpers to fetch/convert images to a DataURL for jsPDF ---
const blobToDataURL = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

/**
 * Fetch an image (zReportUrl) and convert to dataURL
 * Falls back to null on any error/CORS issues.
 */
const fetchImageAsDataURL = async (url) => {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await blobToDataURL(blob);
    return dataUrl; // e.g. "data:image/jpeg;base64,..."
  } catch {
    return null;
  }
};

/**
 * Draw an image on the current page, scaling to fit width and paginating if needed.
 * Returns the new Y position after drawing.
 */
const drawImageFitting = (
  doc,
  dataUrl,
  startY,
  left = 14,
  right = 14,
  top = 16,
  bottom = 16
) => {
  try {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const maxW = pageW - left - right;

    // jsPDF can auto-detect image type; we still need intrinsic ratio:
    // Create a temp <img> just to get width/height ratio (jsPDF has no direct reader)
    const img = new Image();
    img.src = dataUrl;

    // If not yet loaded, we can't block — assume portrait-ish 3:4 as a fallback.
    const naturalW = img.naturalWidth || 1200;
    const naturalH = img.naturalHeight || 1600;
    const ratio = naturalH / naturalW;

    const draw = (y) => {
      const h = maxW * ratio;
      const remaining = pageH - bottom - y;
      if (h > remaining) {
        doc.addPage();
        y = top;
      }
      doc.addImage(dataUrl, "JPEG", left, y, maxW, maxW * ratio);
      return y + h;
    };

    return draw(startY);
  } catch {
    return startY;
  }
};

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
  rows.push(["Added By", sale.createdBy?.username || "Unknown"]);

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
    alert("Failed to export Excel file. Please try again.");
  }
};

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
  doc.text(`Added By: ${sale.createdBy?.username || "Unknown"}`, 14, yPos);
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
    alert("Failed to generate PDF. Please try again.");
  }
};

/**
 * handleShare(sale, branchData, tendersOpt?)
 */
export const handleShare = async (
  sale,
  branchData,
  tendersOpt = null,
  monthTotal
) => {
  const branchName = Array.isArray(branchData)
    ? branchData
        .map((b) => b?.name)
        .filter(Boolean)
        .join(", ")
    : branchData?.name || "N/A";

  const doc = new jsPDF();
  const tenders =
    (tendersOpt && tendersOpt.length ? tendersOpt : tendersFromSale(sale)) ||
    [];

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

    didParseCell: (data) => {
      // ✅ Make ONLY "This Month Grand Total" row bold
      if (
        data.section === "body" &&
        data.row.raw?.[0] === "This Month Grand Total"
      ) {
        data.cell.styles.fontStyle = "bold";
      }
    },

    didDrawPage: (data) => {
      endY = data.cursor?.y ?? endY;
    },
  });

  // Added by (footer-like line)
  const pageH = doc.internal.pageSize.getHeight();
  let yPos = Math.min(endY + 6, pageH - 22);
  doc.setFontSize(11);
  doc.text(`Added By: ${sale.createdBy?.username || "Unknown"}`, 14, yPos);
  yPos += 8;

  // Z REPORT section (same behavior as exportToPDF)
  if (sale.zReportUrl) {
    if (yPos > pageH - 30) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(13);
    doc.text("Z Report", 14, yPos);
    yPos += 8;

    const dataUrl = await fetchImageAsDataURL(sale.zReportUrl);
    if (dataUrl) {
      yPos = drawImageFitting(doc, dataUrl, yPos);
    } else {
      doc.setTextColor(0, 0, 255);
      doc.textWithLink("View Z Report (link)", 14, yPos, {
        url: sale.zReportUrl,
      });
      doc.setTextColor(0, 0, 0);
    }
  }

  // ==== Share (instead of doc.save) ====
  const fileName = `sales-${sale.date}.pdf`;
  const pdfBlob = doc.output("blob");

  try {
    if (
      navigator.share &&
      navigator.canShare?.({
        files: [new File([pdfBlob], fileName, { type: "application/pdf" })],
      })
    ) {
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });
      await navigator.share({
        title: "Sales Report",
        text: `Sales report for ${formatDate(sale.date)} • ${branchName}`,
        files: [file],
      });
    } else if (navigator.share) {
      // Fallback for some mobile browsers: share a data URL
      const reader = new FileReader();
      reader.onloadend = async () => {
        await navigator.share({
          title: "Sales Report",
          text: `Sales report for ${formatDate(sale.date)} • ${branchName}`,
          url: reader.result,
        });
      };
      reader.readAsDataURL(pdfBlob);
    } else {
      // Desktop fallback: copy a link (adjust to your route if needed)
      const link = `${window.location.origin}/sales/${sale.id}`;
      await navigator.clipboard.writeText(link);
      alert("Link copied to clipboard ✅");
    }
  } catch (err) {
    console.error("Share failed:", err);
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
  if (!sales?.length) return alert("No data to export!");

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
      s.createdBy?.username || "-",
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
    alert("Failed to export Excel file. Please try again.");
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
  if (!sales?.length) return alert("No data to export!");

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
      s.createdBy?.username || "-",
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
    alert("Failed to generate PDF. Please try again.");
  }
};
