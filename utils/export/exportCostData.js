/* eslint-disable no-empty */
// /utils/export/exportCostData.js
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

/* ----------------------------- Helpers ----------------------------- */

// Robust Firestore timestamp → Date (supports {seconds,nanoseconds}, ISO strings, Date)
const toDate = (ts) => {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === "string") {
    const d = new Date(ts);
    return isNaN(d) ? null : d;
  }
  if (typeof ts === "object" && ts.seconds !== undefined) {
    return new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1_000_000);
  }
  return null;
};

const safe = (v, fallback = "-") =>
  v === undefined || v === null || v === "" ? fallback : v;

const normCategory = (c) => (c && String(c).trim()) || "Uncategorized";

// Legacy-safe derivations for new payment fields
const derivePaidFrom = (entry) => {
  if (entry?.paidFromOffice === "front" || entry?.paidFromOffice === "back") {
    return entry.paidFromOffice;
  }
  // heuristic: if method is non-cash, assume back office; else front/cash
  if (entry?.paidMethod && entry.paidMethod !== "cash") return "back";
  return "front";
};

const derivePaidMethod = (entry) => {
  if (entry?.paidMethod) return entry.paidMethod;
  return derivePaidFrom(entry) === "front" ? "cash" : "";
};

const paidFromLabel = (from) =>
  from === "back" ? "Back Office" : "Front Office (Cash)";

const methodLabel = (m) => {
  if (m === "cash") return "Cash";
  if (m === "card") return "Card";
  if (m === "qr") return "QR";
  if (m === "online") return "Online";
  if (m === "bank_transfer") return "Bank Transfer";
  return m || "-";
};

const fmtDate = (dLike, fmt = "dd/MM/yyyy") => {
  const d = toDate(dLike) || new Date(dLike);
  return d ? format(d, fmt) : "-";
};

const createdAtToStr = (createdAt) => {
  const d = toDate(createdAt);
  return d ? d.toLocaleString() : "-";
};

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
    ["Created By", cost.createdBy?.username || "-"],
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
    alert("Failed to export Excel file. Please try again.");
  }
};

/* ----------------------------- Single: PDF ------------------------------ */

export const exportCostToPDF = async (cost, branchData) => {
  try {
  const branchName = branchData?.name || "N/A";
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const allFiles = cost.attachments?.length > 0 ? cost.attachments : (cost.fileURL ? [cost.fileURL] : []);
  const allocations = cost.meta?.allocations || [];

  const marginLeft = 14;
  let cursorY = 20;

  // Header
  doc.setFontSize(16);
  doc.text("Cost Report", marginLeft, cursorY);
  doc.setFontSize(12);
  doc.text(fmtDate(cost.date), 160, cursorY, { align: "right" });
  cursorY += 10;

  doc.setFontSize(11);
  doc.text(`Branch: ${branchName}`, marginLeft, cursorY);
  doc.text(`Created At: ${createdAtToStr(cost.createdAt)}`, 160, cursorY, {
    align: "right",
  });

  const from = derivePaidFrom(cost);
  const method = derivePaidMethod(cost);

  const tableData = [
    ["Amount (RM)", safe(cost.amount)],
    ["Category", normCategory(cost.category)],
    ["Paid From", paidFromLabel(from)],
    ["Method", methodLabel(method)],
    ["Description", safe(cost.description)],
    ["Created By", cost.createdBy?.username || "-"],
  ];

  autoTable(doc, {
    startY: cursorY + 6,
    head: [["Field", "Value"]],
    body: tableData,
    styles: { cellPadding: 4, fontSize: 10 },
    headStyles: { fillColor: [41, 128, 185] },
    margin: { left: marginLeft, right: marginLeft },
  });

  let finalY = doc.lastAutoTable?.finalY || cursorY + 20;

  // Invoice breakdown table
  if (allocations.length > 0) {
    finalY += 6;
    doc.setFontSize(12);
    doc.setTextColor(33, 37, 41);
    doc.text(`Invoices Paid (${allocations.length})`, marginLeft, finalY + 6);

    autoTable(doc, {
      startY: finalY + 10,
      head: [["Invoice No", "Invoice Date", "Due Date", "Bill Total (RM)", "Amount Paid (RM)"]],
      body: allocations.map(a => [
        a.invoiceNo || a.billId || "-",
        a.invoiceDate || "-",
        a.dueDate || "-",
        Number(a.billTotal || 0).toFixed(2),
        Number(a.amount || 0).toFixed(2),
      ]),
      styles: { cellPadding: 3, fontSize: 9 },
      headStyles: { fillColor: [46, 204, 113], textColor: 255, fontStyle: 'bold' },
      margin: { left: marginLeft, right: marginLeft },
    });
    finalY = doc.lastAutoTable?.finalY || finalY + 20;
  }

  // Attachments links
  if (allFiles.length > 0) {
    finalY += 8;
    doc.setFontSize(10);
    doc.setTextColor(33, 37, 41);
    doc.text(`Attachments (${allFiles.length}):`, marginLeft, finalY);
    allFiles.forEach((url, i) => {
      finalY += 6;
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 255);
      doc.textWithLink(`📎 File ${i + 1}: ${i === allFiles.length - 1 ? 'Payment Proof' : `Invoice #${i + 1}`}`, marginLeft + 2, finalY, {
        url: url,
      });
    });
    doc.setTextColor(0, 0, 0);
  }

  doc.save(`cost-${fmtDate(cost.date, "yyyy-MM-dd")}.pdf`);
  } catch (err) {
    console.error("PDF export failed:", err);
    alert("Failed to generate PDF. Please try again.");
  }
};

/* ----------------------------- Single: Share ---------------------------- */

export const handleCostShare = async (cost, branchData) => {
  const fileName = `cost-${fmtDate(cost.date, "yyyy-MM-dd")}.pdf`;
  const branchName = branchData?.name || "N/A";
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const allFiles = cost.attachments?.length > 0 ? cost.attachments : (cost.fileURL ? [cost.fileURL] : []);
  const allocations = cost.meta?.allocations || [];

  const marginLeft = 14;
  let cursorY = 20;

  doc.setFontSize(16);
  doc.text("Cost Report", marginLeft, cursorY);
  doc.setFontSize(12);
  doc.text(fmtDate(cost.date), 160, cursorY, { align: "right" });
  cursorY += 10;

  doc.setFontSize(11);
  doc.text(`Branch: ${branchName}`, marginLeft, cursorY);
  doc.text(`Created At: ${createdAtToStr(cost.createdAt)}`, 160, cursorY, {
    align: "right",
  });

  const from = derivePaidFrom(cost);
  const method = derivePaidMethod(cost);

  const tableData = [
    ["Amount (RM)", safe(cost.amount)],
    ["Category", normCategory(cost.category)],
    ["Paid From", paidFromLabel(from)],
    ["Method", methodLabel(method)],
    ["Description", safe(cost.description)],
    ["Created By", cost.createdBy?.username || "-"],
  ];

  autoTable(doc, {
    startY: cursorY + 6,
    head: [["Field", "Value"]],
    body: tableData,
    styles: { cellPadding: 4, fontSize: 10 },
    headStyles: { fillColor: [41, 128, 185] },
    margin: { left: marginLeft, right: marginLeft },
  });

  let finalY = doc.lastAutoTable?.finalY || cursorY + 20;

  // Invoice breakdown
  if (allocations.length > 0) {
    finalY += 6;
    doc.setFontSize(12);
    doc.setTextColor(33, 37, 41);
    doc.text(`Invoices Paid (${allocations.length})`, marginLeft, finalY + 6);
    autoTable(doc, {
      startY: finalY + 10,
      head: [["Invoice No", "Invoice Date", "Due Date", "Bill Total (RM)", "Amount Paid (RM)"]],
      body: allocations.map(a => [
        a.invoiceNo || a.billId || "-",
        a.invoiceDate || "-",
        a.dueDate || "-",
        Number(a.billTotal || 0).toFixed(2),
        Number(a.amount || 0).toFixed(2),
      ]),
      styles: { cellPadding: 3, fontSize: 9 },
      headStyles: { fillColor: [46, 204, 113], textColor: 255, fontStyle: 'bold' },
      margin: { left: marginLeft, right: marginLeft },
    });
    finalY = doc.lastAutoTable?.finalY || finalY + 20;
  }

  // Attachments links
  if (allFiles.length > 0) {
    finalY += 8;
    doc.setFontSize(10);
    doc.setTextColor(33, 37, 41);
    doc.text(`Attachments (${allFiles.length}):`, marginLeft, finalY);
    allFiles.forEach((url, i) => {
      finalY += 6;
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 255);
      doc.textWithLink(`📎 File ${i + 1}: ${i === allFiles.length - 1 ? 'Payment Proof' : `Invoice #${i + 1}`}`, marginLeft + 2, finalY, { url });
    });
    doc.setTextColor(0, 0, 0);
  }

  const pdfBlob = doc.output("blob");

  if (
    navigator.share &&
    navigator.canShare?.({
      files: [new File([pdfBlob], fileName, { type: "application/pdf" })],
    })
  ) {
    await navigator.share({
      title: "Cost Report",
      text: "Here is the cost report",
      files: [new File([pdfBlob], fileName, { type: "application/pdf" })],
    });
  } else {
    const link = `${window.location.origin}/cost/${cost.id}`;
    await navigator.clipboard.writeText(link);
    alert("Link copied to clipboard ✅ (paste it into WhatsApp/Email)");
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
  if (!costs?.length) return alert("No data to export!");

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
      c.createdBy?.username || "-",
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
    alert("Failed to export Excel file. Please try again.");
  }
};
/* ------------------------------ Bulk: PDF (A4 Landscape + KPIs) ------------------------------ */
/* Requires:
   import jsPDF from "jspdf";
   import autoTable from "jspdf-autotable";
*/

export const exportCostsToPDF = (
  costs,
  branchData,
  filterType,
  dateRange = {},
  selectedMonth = "",
  searchDesc
) => {
  try {
  if (!costs?.length) return alert("No data to export!");

  /* ---------- Tiny safe helpers ---------- */
  const num = (v) => {
    const n = typeof v === "string" ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const safe = (v) => (v ?? v === 0 ? num(v) : 0);
  const fmtComma = (v, digits = 2) =>
    num(v).toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });

  const tryFormat = (d, pattern = undefined) => {
    try {
      if (typeof format === "function" && pattern)
        return format(new Date(d), pattern);
    } catch {}
    try {
      const dt = d?.seconds
        ? new Date(d.seconds * 1000)
        : d instanceof Date
        ? d
        : new Date(d);
      if (!isNaN(dt)) return dt.toLocaleDateString();
    } catch {}
    return d ? String(d) : "-";
  };

  const fmtDate = (d) => tryFormat(d, "dd/MM/yyyy");
  const createdAtToStr = (v) => tryFormat(v, "dd/MM/yyyy HH:mm");

  const normCategory = (c) =>
    (c || "-")
      .toString()
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (m) => m.toUpperCase());

  // >>> Robust Back/Front detector (now includes `paidFromOffice`)
  const derivePaidFrom = (c) => {
    const raw =
      c?.paidFromOffice ?? // <— your field name, if present
      c?.paidFrom ??
      c?.from ??
      c?.paid_from ??
      c?.mode ??
      c?.source ??
      (c?.backOffice === true ? "back" : undefined) ??
      "front";

    const v = String(raw).toLowerCase().trim();
    if (
      ["back", "bo", "back_office", "back-office", "backoffice"].includes(v) ||
      v.includes("back")
    )
      return "back";
    if (
      ["front", "fo", "front_office", "front-office", "frontoffice"].includes(
        v
      ) ||
      v.includes("front")
    )
      return "front";
    // boolean hint
    if (c?.backOffice === true) return "back";
    return "front";
  };

  const paidFromLabel = (v) => (v === "back" ? "Back Office" : "Front Office");

  const derivePaidMethod = (c) => {
    const raw =
      c?.method ||
      c?.paymentMethod ||
      c?.methodType ||
      c?.tender ||
      c?.paidMethod ||
      "-";
    return String(raw).toLowerCase();
  };

  const methodLabel = (m) => {
    const map = {
      cash: "Cash",
      card: "Card",
      qr: "QR",
      online: "Online",
      bank_transfer: "Bank Transfer",
      bank: "Bank Transfer",
    };
    return map[m] || (m && m !== "-" ? m[0].toUpperCase() + m.slice(1) : "-");
  };

  /* ---------- Inputs ---------- */
  const branchName = Array.isArray(branchData)
    ? branchData
        .map((b) => b?.name)
        .filter(Boolean)
        .join(", ")
    : branchData?.name || "N/A";

  // Clone & optional search filter
  let filtered = [...costs];
  if (searchDesc && searchDesc.trim() !== "") {
    const q = searchDesc.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.description?.toLowerCase().includes(q) ||
        normCategory(c.category).toLowerCase().includes(q)
    );
  }

  // Filter text + file suffix
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
        const start = tryFormat(dateRange.from, "dd/MM/yyyy");
        const end = tryFormat(dateRange.to, "dd/MM/yyyy");
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
        const d = new Date(Number(year), Number(month) - 1);
        let monthName;
        try {
          monthName =
            typeof format === "function"
              ? format(d, "MMMM yyyy")
              : d.toLocaleString(undefined, { month: "long", year: "numeric" });
        } catch (e) {
          console.error(e);
          monthName = d.toLocaleString(undefined, {
            month: "long",
            year: "numeric",
          });
        }
        filterText = monthName;
        fileFilterName = String(monthName).replace(/\s+/g, "_").toLowerCase();
      }
      break;
    default:
      filterText = "All Data";
      fileFilterName = "all";
  }

  /* ---------- Aggregates for KPI + breakdown ---------- */
  const totals = {
    count: filtered.length,
    amount: 0,
    frontCount: 0,
    backCount: 0,
    frontAmount: 0,
    backAmount: 0,
  };
  const byMethod = {}; // { methodLabel: {count, total} }
  const byCategory = {}; // { category: {count, total} }

  for (const c of filtered) {
    const amt = safe(c.amount);
    const pf = derivePaidFrom(c);
    const meth = methodLabel(derivePaidMethod(c));
    const cat = normCategory(c.category);

    totals.amount += amt;
    if (pf === "back") {
      totals.backCount++;
      totals.backAmount += amt;
    } else {
      totals.frontCount++;
      totals.frontAmount += amt;
    }

    if (!byMethod[meth]) byMethod[meth] = { count: 0, total: 0 };
    byMethod[meth].count += 1;
    byMethod[meth].total += amt;

    if (!byCategory[cat]) byCategory[cat] = { count: 0, total: 0 };
    byCategory[cat].count += 1;
    byCategory[cat].total += amt;
  }

  /* ---------- PDF Setup: A4 Landscape, print-friendly ---------- */
  const margin = 36; // 0.5"
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Reusable head styles: BLACK & BOLD
  const headStylesBlack = {
    fillColor: [255, 255, 255], // white background
    textColor: [0, 0, 0], // black text
    fontStyle: "bold",
    lineWidth: 0.5,
  };

  // Header
  doc.setFontSize(16);
  doc.text("Cost Report", margin, 28);
  doc.setFontSize(11);
  doc.text(`Branch: ${branchName}`, margin, 46);
  doc.text(
    `Filter: ${searchDesc ? `Search: "${searchDesc}"` : filterText}`,
    margin,
    62
  );
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 78);

  let cursorY = 94;

  /* ---------- KPI Table ---------- */
  const kpiRows = [
    ["Total Bills", String(totals.count)],
    ["Total Amount (RM)", fmtComma(totals.amount)],
    [
      "Front Office Bills (Cash)",
      `${totals.frontCount} (${fmtComma(totals.frontAmount)})`,
    ],
    [
      "Back Office Bills (Bank)",
      `${totals.backCount} (${fmtComma(totals.backAmount)})`,
    ],
  ];

  // Method rows (append) — skip Cash since it's already shown as Front Office
  const methodKeys = Object.keys(byMethod)
    .filter((k) => k && k !== "-" && k !== "Cash")
    .sort();
  for (const m of methodKeys) {
    kpiRows.push([
      `Method · ${m}`,
      `${byMethod[m].count} (${fmtComma(byMethod[m].total)})`,
    ]);
  }

  autoTable(doc, {
    startY: cursorY,
    head: [["Key", "Value"]],
    body: kpiRows,
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: headStylesBlack, // <<< black & bold
    tableWidth: pageWidth * 0.42,
    margin: { left: margin, right: margin },
    theme: "grid",
  });
  const kpiEndY = doc.lastAutoTable.finalY;

  /* ---------- Category Breakdown ---------- */
  const catRows = Object.entries(byCategory)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([cat, v]) => [cat, String(v.count), fmtComma(v.total)]);

  const catTableLeft = pageWidth * 0.5;
  autoTable(doc, {
    startY: cursorY,
    head: [["Category", "Bills", "Total (RM)"]],
    body: catRows.length ? catRows : [["-", "0", "0.00"]],
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: headStylesBlack, // <<< black & bold
    theme: "grid",
    tableWidth: pageWidth - catTableLeft - margin,
    margin: { left: catTableLeft, right: margin },
  });
  const catEndY = doc.lastAutoTable.finalY;

  cursorY = Math.max(kpiEndY, catEndY) + 16;

  /* ---------- Detailed Rows Table ---------- */
  const head = [
    [
      "Date",
      "Amount (RM)",
      "Category",
      "Paid From",
      "Method",
      "Description",
      "Created By",
      "Proof",
      "Created At",
    ],
  ];

  // Build body rows — Proof is a single clean text line, no manual drawing
  const body = filtered.map((c) => {
    const from = derivePaidFrom(c);
    const method = derivePaidMethod(c);
    const allFiles = c.attachments?.length > 0 ? c.attachments : (c.fileURL ? [c.fileURL] : []);
    const invoices = (c.meta?.allocations || []).map(a => a.invoiceNo || a.billId || "").filter(Boolean);

    // Build compact proof text: "12345, 1234 (3 files)" or "1 file" or "-"
    let proofText = "-";
    const invPart = invoices.length > 0 ? invoices.join(", ") : "";
    const filePart = allFiles.length > 0
      ? (allFiles.length === 1 ? "1 file" : `${allFiles.length} files`)
      : "";

    if (invPart && filePart) {
      proofText = `${invPart} (${filePart})`;
    } else if (invPart) {
      proofText = invPart;
    } else if (filePart) {
      proofText = filePart;
    }

    return [
      fmtDate(c.date),
      fmtComma(safe(c.amount)),
      normCategory(c.category),
      paidFromLabel(from),
      methodLabel(method),
      c.description || "-",
      c.createdBy?.username || "-",
      proofText,
      createdAtToStr(c.createdAt),
    ];
  });

  autoTable(doc, {
    startY: cursorY,
    head,
    body,
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: headStylesBlack,
    theme: "grid",
    columnStyles: {
      0: { cellWidth: 52 },  // Date
      1: { cellWidth: 55 },  // Amount
      4: { cellWidth: 52 },  // Method
      5: { cellWidth: 130 }, // Description
      6: { cellWidth: 55 },  // Created By
      7: { cellWidth: 100 }, // Proof
    },
    margin: { left: margin, right: margin },
    didDrawCell: (data) => {
      // Render each file as a separate clickable link on one line: "12345 | 1234 | Receipt"
      if (data.section === "body" && data.column.index === 7) {
        const rowCost = filtered[data.row.index];
        const allFiles = rowCost?.attachments?.length > 0 ? rowCost.attachments : (rowCost?.fileURL ? [rowCost.fileURL] : []);
        if (allFiles.length === 0) return;

        const invoices = (rowCost.meta?.allocations || []).map(a => a.invoiceNo || a.billId || "").filter(Boolean);
        let curX = data.cell.x + 3;
        const curY = data.cell.y + 10;

        doc.setFontSize(7);
        allFiles.forEach((url, i) => {
          // Build label for this file
          let label;
          if (i < invoices.length) {
            label = invoices[i];
          } else if (i === allFiles.length - 1 && allFiles.length > 1) {
            label = "Receipt";
          } else {
            label = "File " + (i + 1);
          }

          // Draw clickable link in blue
          doc.setTextColor(0, 90, 180);
          doc.textWithLink(label, curX, curY, { url });

          // Advance cursor past the label + separator
          const labelWidth = doc.getTextWidth(label);
          curX += labelWidth;

          // Draw separator if not last
          if (i < allFiles.length - 1) {
            doc.setTextColor(150, 150, 150);
            doc.text(" | ", curX, curY);
            curX += doc.getTextWidth(" | ");
          }
        });

        doc.setTextColor(0, 0, 0);
      }
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 1) {
        hookData.cell.styles.halign = "right";
      }
      // Hide the auto-rendered text for proof cells that have files (we redraw it as a link)
      if (hookData.section === "body" && hookData.column.index === 7) {
        const rowCost = filtered[hookData.row.index];
        const allFiles = rowCost?.attachments?.length > 0 ? rowCost.attachments : (rowCost?.fileURL ? [rowCost.fileURL] : []);
        if (allFiles.length > 0) {
          hookData.cell.styles.textColor = [255, 255, 255]; // white = hidden
        }
      }
    },
    pageBreak: "auto",
  });

  doc.save(`costs-report_${fileFilterName}.pdf`);
  } catch (err) {
    console.error("PDF export failed:", err);
    alert("Failed to generate PDF. Please try again.");
  }
};
