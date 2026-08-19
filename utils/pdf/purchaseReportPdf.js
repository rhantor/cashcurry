import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney } from "@/utils/formatMoney";
import { localDate } from "@/utils/reports/purchaseReport";

/**
 * Purchase report PDF — what was bought in a period, how much of it, at what price.
 *
 * Landscape, because the row is the point: nine columns of numbers per item read
 * far better across the page than wrapped down a portrait one.
 */

const MARGIN = 12;
const PAGE_W = 297; // A4 landscape, mm
const PAGE_H = 210;
const RIGHT = PAGE_W - MARGIN;
const INK = [15, 23, 42];
const MUTED = [100, 116, 139];
const MINT = [34, 160, 130];
const LINE = [226, 232, 240];
const PANEL = [248, 250, 252];

const text = (v) => String(v ?? "").trim();

export default function buildPurchaseReportPdf({
  items = [],
  totals = {},
  meta = {},
  branchBasic,
  currency = "RM",
  logoDataUrl = null,
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });

  /* ------------------------------- letterhead ------------------------------ */
  let y = MARGIN + 4;

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, MARGIN, MARGIN, 22, 12, undefined, "FAST");
      y = MARGIN + 17;
    } catch {
      /* an unreadable logo is not worth failing the report over */
    }
  }

  const title = text(meta.companyName) || text(meta.branchName);
  if (title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(title, MARGIN, y);
    y += 4.6;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  [text(meta.branchName), text(branchBasic?.phone)].filter(Boolean).forEach((line) => {
    doc.text(line, MARGIN, y);
    y += 3.8;
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text("PURCHASE REPORT", RIGHT, MARGIN + 5, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`${text(meta.periodLabel)}  ·  ${meta.startDate} to ${meta.endDate}`, RIGHT, MARGIN + 11, {
    align: "right",
  });

  // Say out loud which filters produced these numbers, so a printed page cannot
  // be mistaken for the full picture.
  const filters = [
    meta.vendorName && `Supplier: ${meta.vendorName}`,
    meta.category && `Category: ${meta.category}`,
    meta.search && `Search: "${meta.search}"`,
  ].filter(Boolean);
  if (filters.length) {
    doc.setFontSize(8);
    doc.text(filters.join("   ·   "), RIGHT, MARGIN + 16, { align: "right" });
  }

  y = Math.max(y, MARGIN + (filters.length ? 21 : 16)) + 3;

  /* -------------------------------- summary -------------------------------- */
  const tiles = [
    ["Total spend", formatMoney(totals.spend, currency)],
    ["Products bought", String(totals.itemCount ?? items.length)],
    ["Deliveries received", String(totals.orderCount ?? 0)],
    ["Average per delivery", formatMoney(totals.avgOrderValue, currency)],
  ];

  const tileW = (RIGHT - MARGIN - 3 * 3) / 4;
  tiles.forEach(([label, value], i) => {
    const x = MARGIN + i * (tileW + 3);
    doc.setFillColor(...(i === 0 ? [236, 253, 245] : PANEL));
    doc.roundedRect(x, y, tileW, 15, 2, 2, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(label, x + 4, y + 5.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...(i === 0 ? MINT : INK));
    doc.text(value, x + 4, y + 11.8);
  });

  y += 21;

  /* --------------------------------- table --------------------------------- */
  const body = items.map((r, index) => [
    index + 1,
    r.name,
    r.category,
    `${r.qty} ${r.unit}`,
    formatMoney(r.spend, currency),
    formatMoney(r.avgPrice, currency),
    r.minPrice === r.maxPrice ? "—" : `${Number(r.minPrice).toFixed(2)} – ${Number(r.maxPrice).toFixed(2)}`,
    String(r.orders),
    localDate(r.lastDate),
    (r.vendors || []).join(", "),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Item", "Category", "Quantity", "Spend", "Avg price", "Price range", "Times", "Last bought", "Supplier"]],
    body,
    foot: [[
      "", "Total", "", String(totals.qty ?? ""), formatMoney(totals.spend, currency), "", "", "", "", "",
    ]],
    theme: "striped",
    margin: { left: MARGIN, right: MARGIN, bottom: 16 },
    styles: { fontSize: 7.5, cellPadding: 1.9, textColor: INK, lineColor: LINE, lineWidth: 0.1 },
    headStyles: { fillColor: MINT, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
    footStyles: { fillColor: [241, 245, 249], textColor: INK, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: PANEL },
    columnStyles: {
      0: { halign: "center", cellWidth: 7 },
      1: { cellWidth: 52, fontStyle: "bold" },
      2: { cellWidth: 30 },
      3: { halign: "right", cellWidth: 22 },
      4: { halign: "right", cellWidth: 24 },
      5: { halign: "right", cellWidth: 22 },
      6: { halign: "right", cellWidth: 26 },
      7: { halign: "center", cellWidth: 12 },
      8: { halign: "right", cellWidth: 22 },
    },
  });

  /* --------------------------------- footer -------------------------------- */
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_H - 10, RIGHT, PAGE_H - 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(
      `Received goods at invoiced prices  ·  Generated ${new Date().toLocaleString()}`,
      MARGIN,
      PAGE_H - 6
    );
    doc.text(`Page ${page} of ${pages}`, RIGHT, PAGE_H - 6, { align: "right" });
  }

  doc.save(`Purchase-Report-${meta.startDate}-to-${meta.endDate}.pdf`);
}
