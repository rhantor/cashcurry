// exportSummary: the pdf part (moved from exportSummary.js unchanged).
 
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "@/app/components/ui/notify";
import { COL_GROUP_FILL, addLedgerToPDF, buildDetailColumnSpec, buildDetailRow, buildPeriodTotalsRow, buildSummaryColumnSpec, buildSummaryRow, dashOrComma, deriveModeKpis, kpiTone, normMode, safeFilePart, toneFill, tryFormatDate } from "./helpers";

/* ================= PDF ================= */
export const exportSummaryToPDF = (
  rows,
  _kpis,
  periodTotals,
  _periodTotalSales,
  periodDeposits,
  periodWithdrawals,
  periodRepaySums,
  tenderDefs,
  meta = {}
) => {
  try {
    if (!rows?.length) return toast.warning("No data!");

    meta = { ...meta, externalKpis: _kpis };

    const summarySpec = buildSummaryColumnSpec(tenderDefs, meta);
    const detailSpec = buildDetailColumnSpec();
    const includeDetailRows = meta.includeDetailRows !== false;

    const colCount = summarySpec.headers.length;
    const forceA3 = meta.forceA3 === true;
    const forceA4 = meta.forceA4 === true;
    const pageFormat = forceA4 ? "a4" : forceA3 ? "a3" : colCount > 14 ? "a3" : "a4";

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: pageFormat });
    const M = { left: 14, right: 14, top: 14, bottom: 12 };
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - M.left - M.right;
    let y = M.top;

    const hr = (yy, color = 225) => {
      doc.setDrawColor(color);
      doc.line(M.left, yy, pageWidth - M.right, yy);
    };
    const footer = (data) => {
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${doc.getNumberOfPages()}`,
        data.settings.margin.left,
        doc.internal.pageSize.height - 6
      );
    };

    // ---------- Page 1: Header + KPIs ----------
    const title      = meta.title       || "Summary Report";
    const company    = meta.companyName || "-";
    const branch     = meta.branchName  || "-";
    const modeLabel  = meta.modeLabel   || "All";
    const generated  = meta.generatedAt || new Date().toLocaleString();

    // Resolve actual date range string
    const fmtD = (d) => tryFormatDate(d, "dd/MM/yyyy");
    const dateFrom = meta.filterDateFrom ? fmtD(meta.filterDateFrom) : null;
    const dateTo   = meta.filterDateTo   ? fmtD(meta.filterDateTo)   : null;
    const dateRangeStr = dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : (meta.filterText || "All Data");
    // If label carries extra context (e.g. "April 2026") prepend it when it differs from the bare range
    const labelContext = meta.filterText && meta.filterText !== "All Data" && meta.filterText !== dateRangeStr
      ? `${meta.filterText}  (${dateRangeStr})`
      : dateRangeStr;

    // Title — plain bold text, no background
    doc.setTextColor(20);
    doc.setFontSize(15);
    doc.setFont(undefined, "bold");
    doc.text(title, M.left, y + 5);
    doc.setFont(undefined, "normal");
    y += 10;

    hr(y);
    y += 5;

    // Meta info in two columns
    doc.setTextColor(60);
    doc.setFontSize(9);
    const leftCol  = [`Company: ${company}`, `Branch: ${branch}`, `Mode: ${modeLabel}`];
    const rightCol = [`Period: ${labelContext}`, `Generated: ${generated}`];
    leftCol.forEach((line, i)  => doc.text(line, M.left, y + i * 4.5));
    rightCol.forEach((line, i) => doc.text(line, M.left + contentWidth / 2, y + i * 4.5));
    y += Math.max(leftCol.length, rightCol.length) * 4.5 + 4;

    hr(y);
    y += 6;

    // ---------- KPI Grid ----------
    const kpis = deriveModeKpis(rows, periodTotals, periodDeposits, periodWithdrawals, periodRepaySums, tenderDefs, meta);

    const perRow = contentWidth / 3 > 70 ? 3 : 2;
    const gap = 5;
    const cardW = (contentWidth - gap * (perRow - 1)) / perRow;
    const cardH = 18;

    doc.setFontSize(9);
    kpis.forEach((k, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const cx = M.left + col * (cardW + gap);
      const cy = y + row * (cardH + gap);

      const [r, g, b] = toneFill(kpiTone(k.label));
      doc.setDrawColor(210);
      doc.setFillColor(r, g, b);
      doc.roundedRect(cx, cy, cardW, cardH, 2.2, 2.2, "FD");

      doc.setTextColor(90);
      doc.setFontSize(8);
      doc.text(String(k.label), cx + 4, cy + 5.5);

      doc.setTextColor(20);
      doc.setFontSize(11);
      doc.setFont(undefined, "bold");
      doc.text(dashOrComma(k.value), cx + 4, cy + 13);
      doc.setFont(undefined, "normal");
    });

    const rowsCount = Math.ceil(kpis.length / perRow);
    y += rowsCount * (cardH + gap) + 6;

    // ---------- Page 2: Summary Table ----------
    doc.addPage();
    y = M.top;

    // Section title
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.setFont(undefined, "bold");
    doc.text("Daily Summary", M.left, y);
    doc.setFont(undefined, "normal");
    y += 6;

    const summaryBody = rows.map((r) => buildSummaryRow(r, summarySpec)).filter(Boolean);
    summaryBody.push(
      buildPeriodTotalsRow(rows, summarySpec, periodTotals, periodDeposits, periodWithdrawals, periodRepaySums)
    );

    autoTable(doc, {
      startY: y,
      head: [summarySpec.headers],
      body: summaryBody,
      theme: "grid",
      styles: {
        fontSize: 7.5,
        cellPadding: 1,
        overflow: "linebreak",
        valign: "middle",
        lineWidth: 0.1,
      },
      headStyles: {
        fontSize: 7.5,
        textColor: 30,
        lineWidth: 0.2,
        halign: "center",
        valign: "bottom",
        minCellHeight: 10,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      margin: { top: M.top, bottom: M.bottom, left: M.left, right: M.right },
      columnStyles: {
        0: { cellWidth: 20 },
        [summarySpec.headers.length - 1]: { cellWidth: 35 }, // Sales Notes
      },
      didParseCell: (data) => {
        if (data.section === "head") {
          const h = summarySpec.headers[data.column.index];
          const group = summarySpec.getColGroup(h);
          const [r, g, b] = COL_GROUP_FILL[group] || COL_GROUP_FILL.other;
          data.cell.styles.fillColor = [r, g, b];
        }
        if (data.section === "body") {
          const isDate = data.column.index === summarySpec.indexMap.get("Date");
          const isNotes = data.column.index === summarySpec.indexMap.get("Sales Notes");
          data.cell.styles.halign = isDate || isNotes ? "left" : "right";

          // Bold + blue background for Period Totals row
          const isTotal = data.row.index === summaryBody.length - 1;
          if (isTotal) {
            data.cell.styles.fillColor = [219, 234, 254];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      didDrawPage: footer,
    });

    // ---------- Page 3: Detail Transactions ----------
    const detailBody = rows.map((r) => buildDetailRow(r, detailSpec)).filter(Boolean);

    if (includeDetailRows && detailBody.length > 0) {
      doc.addPage();
      y = M.top;

      doc.setFontSize(11);
      doc.setTextColor(30);
      doc.setFont(undefined, "bold");
      doc.text("Detailed Transactions", M.left, y);
      doc.setFont(undefined, "normal");
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [detailSpec.headers],
        body: detailBody,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 1, overflow: "linebreak", valign: "middle", lineWidth: 0.1 },
        headStyles: {
          fontSize: 8,
          fillColor: [226, 232, 240],
          textColor: 30,
          lineWidth: 0.2,
          halign: "center",
          valign: "bottom",
          minCellHeight: 10,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [250, 251, 252] },
        margin: { top: M.top, bottom: M.bottom, left: M.left, right: M.right },
        columnStyles: {
          0: { cellWidth: 20, halign: "left" },
          1: { cellWidth: 35, halign: "left" },
          2: { cellWidth: contentWidth - 20 - 35 - 20, halign: "left" },
          3: { cellWidth: 20, halign: "right" },
        },
        didDrawPage: footer,
      });
    }

    // ---------- Ledger page(s) ----------
    addLedgerToPDF(doc, rows, tenderDefs, meta, M, normMode(meta));

    const safeName = safeFilePart(meta.filterText || "summary");
    doc.save(`summary_${safeName}.pdf`);
  } catch (err) {
    console.error("Export failed:", err);
    toast.error("Failed to export. Please try again.");
  }
};
