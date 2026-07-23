// Excel / PDF export for the monthly sales statement
// (app/reports/yearly-summary/[period]). Column layout comes from
// buildStatementColumns so the exports and the on-screen table never drift.

import { format, parseISO } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// xlsx-js-style is a drop-in fork of SheetJS that actually writes cell styles
// (fills, borders, fonts, number formats); the plain `xlsx` writer drops them.
// It's a full copy of SheetJS (~300 kB), so load it on demand — only when the
// user clicks Export Excel — instead of shipping it in the page's initial JS.
const loadXLSX = async () => (await import("xlsx-js-style")).default;

/* ----------------------- tiny helpers ----------------------- */
const num = (v) => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const isZeroish = (v) => Math.abs(num(v)) < 1e-9;

const fmtComma = (v, digits = 2) =>
  num(v).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const dashOrComma = (v) => (isZeroish(v) ? "-" : fmtComma(v));

const safeFilePart = (s) =>
  String(s || "statement").replace(/[^\w\-]+/g, "_").toLowerCase();

const fmtDay = (d) => {
  try {
    return format(parseISO(d), "d-MMM-yy");
  } catch {
    return String(d || "");
  }
};

export const monthTitle = (period) => {
  try {
    return format(parseISO(`${period}-01`), "MMMM yyyy");
  } catch {
    return period;
  }
};

export const STATEMENT_FOOTNOTES = [
  "FRONT OFFICE OPEX includes: daily inventories, food cost, maintenance, marketing, promotion, salaries.",
  "BACK OFFICE OPEX includes: utilities, subscriptions, water, license fees, electricity, travel and promotional expenditure, equipment purchases, salaries.",
];

/* ----------------------- shared layout ----------------------- */

// Flat header list plus the group bands that sit above it. Both exports build
// from this so a column added in one shows up in the other.
const buildHeaders = (cols) => {
  const { salesCols, siteCols, hqCols } = cols;

  const headers = [
    "Date",
    ...salesCols.map((c) => c.label),
    "Total Sales",
    ...siteCols.map((c) => c.label),
    "Salary",
    "Advances",
    "Staff Loans",
    "Loans Given",
    ...hqCols.map((c) => c.label),
    "Total Expenses",
    "Net Income / Loss",
    "Remarks",
  ];

  // [label, span] pairs aligned to the header row above
  const bands = [
    ["", 1],
    ["TOTAL SALES", salesCols.length + 1],
    // + salary + advances + staff loans + loans given
    ["(SITE OFFICE) — FRONT", siteCols.length + 4],
    ["(HQ OFFICE) — BACK", hqCols.length],
    ["", 3],
  ].filter(([, span]) => span > 0);

  return { headers, bands };
};

const rowToArray = (r, cols) => {
  const { salesCols, siteCols, hqCols } = cols;
  return [
    fmtDay(r.date),
    ...salesCols.map((c) => r.sales[c.key]),
    r.totalSales,
    ...siteCols.map((c) => r.siteCosts[c.key]),
    r.salary,
    r.advance,
    r.staffLoan,
    r.loansGiven,
    ...hqCols.map((c) => r.hqCosts[c.key]),
    r.totalExpenses,
    r.netIncome,
    "",
  ];
};

const totalsToArray = (t, cols) => {
  const { salesCols, siteCols, hqCols } = cols;
  return [
    "TOTAL",
    ...salesCols.map((c) => t.sales[c.key]),
    t.totalSales,
    ...siteCols.map((c) => t.siteCosts[c.key]),
    t.salary,
    t.advance,
    t.staffLoan,
    t.loansGiven,
    ...hqCols.map((c) => t.hqCosts[c.key]),
    t.totalExpenses,
    t.netIncome,
    "",
  ];
};

/* ----------------------- Excel ----------------------- */

const XL_FONT = "Calibri";
// Positive: comma-grouped. Negative: red with a minus. Zero: a dash — same
// convention as the on-screen table and the PDF.
const MONEY_FMT = '#,##0.00;[Red]-#,##0.00;"-"';

const BAND_FILL_HEX = {
  "TOTAL SALES": "DBEEDB",
  "(SITE OFFICE) — FRONT": "FBE4D5",
  "(HQ OFFICE) — BACK": "FCF3CF",
};
const HEADER_FILL = "E9ECEF";
const TOTAL_FILL = "C6E7C7";
const ZEBRA_FILL = "F6F8FA";

const XL_THIN = { style: "thin", color: { rgb: "D9D9D9" } };
const XL_MEDIUM = { style: "medium", color: { rgb: "808080" } };
const xlBorder = (isDivider) => ({
  top: XL_THIN,
  bottom: XL_THIN,
  left: XL_THIN,
  right: isDivider ? XL_MEDIUM : XL_THIN,
});

export const exportStatementToExcel = async (statementRows, totals, cols, meta = {}) => {
  try {
    if (!statementRows?.length) return alert("No data to export.");

    const XLSX = await loadXLSX();
    const { headers, bands } = buildHeaders(cols);
    const period = meta.period || "";
    const title = `${meta.branchName || "Branch"} — Sales Statement for ${monthTitle(period)}`;
    const ncol = headers.length;
    const nRows = statementRows.length;

    // Which columns get the heavier group-divider border on their right edge.
    const idxTotalSales = 1 + cols.salesCols.length;
    const idxLoansGiven = idxTotalSales + cols.siteCols.length + 4;
    const idxLastHq = idxLoansGiven + cols.hqCols.length;
    const dividerCols = new Set([0, idxTotalSales, idxLoansGiven, idxLastHq]);

    // Per-column band fill, so the band row is coloured by group.
    const colFill = [];
    bands.forEach(([label, span]) => {
      const fill = BAND_FILL_HEX[label] || null;
      for (let i = 0; i < span; i += 1) colFill.push(fill);
    });

    // Band row, then header row, then data. Numbers stay numeric so Excel can
    // sum them; only the date and remarks columns are text.
    const bandRow = [];
    bands.forEach(([label, span]) => {
      bandRow.push(label);
      for (let i = 1; i < span; i += 1) bandRow.push("");
    });

    const aoa = [
      [meta.companyName || ""],
      [title],
      [],
      bandRow,
      headers,
      ...statementRows.map((r) => rowToArray(r, cols)),
      totalsToArray(totals, cols),
      [],
      ["Please note:"],
      ...STATEMENT_FOOTNOTES.map((f) => [f]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    const R_BAND = 3;
    const R_HEADER = 4;
    const R_DATA0 = 5;
    const R_TOTAL = R_DATA0 + nRows;

    // Ensure a cell exists (aoa_to_sheet skips blanks) then apply style / format.
    const style = (r, c, s, z) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) ws[ref] = { t: "s", v: "" };
      ws[ref].s = s;
      if (z) ws[ref].z = z;
    };
    const isMoneyCol = (c) => c >= 1 && c <= ncol - 2;

    // Title banner
    style(0, 0, {
      font: { name: XL_FONT, bold: true, sz: 14, color: { rgb: "1F2937" } },
      alignment: { horizontal: "center" },
    });
    style(1, 0, {
      font: { name: XL_FONT, italic: true, sz: 11, color: { rgb: "555555" } },
      alignment: { horizontal: "center" },
    });

    // Band row (coloured by group, merged)
    for (let c = 0; c < ncol; c += 1) {
      style(R_BAND, c, {
        font: { name: XL_FONT, bold: true, sz: 9, color: { rgb: "333333" } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: colFill[c] ? { fgColor: { rgb: colFill[c] } } : undefined,
        border: xlBorder(dividerCols.has(c)),
      });
    }

    // Header row
    for (let c = 0; c < ncol; c += 1) {
      style(R_HEADER, c, {
        font: { name: XL_FONT, bold: true, sz: 8, color: { rgb: "212529" } },
        alignment: {
          horizontal: c === 0 || c === ncol - 1 ? "left" : "center",
          vertical: "center",
          wrapText: true,
        },
        fill: { fgColor: { rgb: HEADER_FILL } },
        border: xlBorder(dividerCols.has(c)),
      });
    }

    // Data rows (zebra striped)
    for (let i = 0; i < nRows; i += 1) {
      const r = R_DATA0 + i;
      const zebra = i % 2 === 1;
      for (let c = 0; c < ncol; c += 1) {
        style(
          r,
          c,
          {
            font: { name: XL_FONT, sz: 8 },
            alignment: {
              horizontal: c === 0 || c === ncol - 1 ? "left" : "right",
            },
            fill: zebra ? { fgColor: { rgb: ZEBRA_FILL } } : undefined,
            border: xlBorder(dividerCols.has(c)),
          },
          isMoneyCol(c) ? MONEY_FMT : undefined
        );
      }
    }

    // Total row
    for (let c = 0; c < ncol; c += 1) {
      style(
        R_TOTAL,
        c,
        {
          font: { name: XL_FONT, bold: true, sz: 8, color: { rgb: "14532D" } },
          alignment: {
            horizontal: c === 0 || c === ncol - 1 ? "left" : "right",
          },
          fill: { fgColor: { rgb: TOTAL_FILL } },
          border: { ...xlBorder(dividerCols.has(c)), top: XL_MEDIUM },
        },
        isMoneyCol(c) ? MONEY_FMT : undefined
      );
    }

    // Merges: title banner + band groups
    const merges = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: ncol - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: ncol - 1 } },
    ];
    let colCursor = 0;
    bands.forEach(([, span]) => {
      const start = colCursor;
      colCursor += span;
      if (span > 1) merges.push({ s: { r: R_BAND, c: start }, e: { r: R_BAND, c: start + span - 1 } });
    });
    ws["!merges"] = merges;

    ws["!cols"] = headers.map((h) => {
      if (h === "Date") return { wch: 11 };
      if (h === "Remarks") return { wch: 22 };
      return { wch: 13 };
    });

    // Taller band/header rows so the wrapped labels breathe.
    ws["!rows"] = [];
    ws["!rows"][R_BAND] = { hpt: 18 };
    ws["!rows"][R_HEADER] = { hpt: 26 };

    // Freeze the header block and the date column.
    ws["!freeze"] = { xSplit: 1, ySplit: R_DATA0, topLeftCell: "B6", activePane: "bottomRight", state: "frozen" };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, monthTitle(period).slice(0, 31));
    XLSX.writeFile(
      wb,
      `${safeFilePart(meta.branchName)}_statement_${safeFilePart(period)}.xlsx`
    );
  } catch (err) {
    console.error("Statement Excel export failed:", err);
    alert("Failed to export Excel. Please try again.");
  }
};

/* ----------------------- PDF ----------------------- */

const BAND_FILL = {
  "TOTAL SALES": [219, 237, 219],
  "(SITE OFFICE) — FRONT": [250, 226, 211],
  "(HQ OFFICE) — BACK": [252, 243, 207],
};

export const exportStatementToPDF = (statementRows, totals, cols, meta = {}) => {
  try {
    if (!statementRows?.length) return alert("No data to export.");

    const { headers, bands } = buildHeaders(cols);
    const period = meta.period || "";

    // This sheet is wide by nature; step up paper rather than shrink to illegible.
    const pageFormat = headers.length > 22 ? "a2" : headers.length > 14 ? "a3" : "a4";
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: pageFormat });

    const M = { left: 10, right: 10, top: 12, bottom: 12 };
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = M.top;

    doc.setTextColor(20);
    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text(meta.companyName || "", pageWidth / 2, y, { align: "center" });
    y += 6;

    doc.setFontSize(11);
    doc.setFont(undefined, "italic");
    doc.text(
      `${meta.branchName || "Branch"} — Sales Statement for ${monthTitle(period).toUpperCase()}`,
      pageWidth / 2,
      y,
      { align: "center" }
    );
    doc.setFont(undefined, "normal");
    y += 6;

    const bandRow = bands.map(([label, span]) => ({
      content: label,
      colSpan: span,
      styles: {
        halign: "center",
        fontStyle: "bold",
        fillColor: BAND_FILL[label] || [245, 245, 245],
        textColor: 30,
      },
    }));

    // Column indices where one group ends and the next begins. A heavier
    // vertical rule is drawn on the right edge of these so the sales / site /
    // HQ bands read as distinct blocks instead of one undifferentiated grid.
    const idxTotalSales = 1 + cols.salesCols.length;
    const idxLoansGiven = idxTotalSales + cols.siteCols.length + 4; // + salary, advances, staff loans, loans given
    const idxLastHq = idxLoansGiven + cols.hqCols.length;
    const dividerCols = new Set([0, idxTotalSales, idxLoansGiven, idxLastHq]);

    autoTable(doc, {
      startY: y,
      head: [bandRow, headers],
      body: statementRows.map((r) =>
        rowToArray(r, cols).map((v, i) => (i === 0 || i === headers.length - 1 ? v : dashOrComma(v)))
      ),
      foot: [
        totalsToArray(totals, cols).map((v, i) =>
          i === 0 || i === headers.length - 1 ? v : fmtComma(v)
        ),
      ],
      styles: { fontSize: 6.5, cellPadding: 1.2, overflow: "linebreak" },
      headStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: "bold", halign: "center" },
      footStyles: { fillColor: [198, 231, 199], textColor: 20, fontStyle: "bold", halign: "right" },
      bodyStyles: { halign: "right" },
      columnStyles: {
        0: { halign: "left", fontStyle: "bold", cellWidth: 18 },
        [headers.length - 1]: { halign: "left", cellWidth: 22 },
      },
      margin: { left: M.left, right: M.right },
      didParseCell: (data) => {
        // Net income / loss column — red when the month lost money.
        if (data.section === "body" || data.section === "foot") {
          if (data.column.index === headers.length - 2) {
            const raw =
              data.section === "foot"
                ? totals.netIncome
                : statementRows[data.row.index]?.netIncome;
            if (num(raw) < 0) data.cell.styles.textColor = [190, 30, 30];
          }
        }
      },
      didDrawCell: (data) => {
        // Group divider: heavy rule on the right edge of each band boundary.
        // On the band row every cell is itself a group, so all its edges qualify.
        const isBandRow = data.section === "head" && data.row.index === 0;
        if (isBandRow || dividerCols.has(data.column.index)) {
          const x = data.cell.x + data.cell.width;
          doc.setDrawColor(90, 90, 90);
          doc.setLineWidth(0.4);
          doc.line(x, data.cell.y, x, data.cell.y + data.cell.height);
        }
      },
      didDrawPage: (data) => {
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(
          `Page ${doc.getNumberOfPages()}`,
          data.settings.margin.left,
          doc.internal.pageSize.getHeight() - 5
        );
      },
    });

    let noteY = doc.lastAutoTable.finalY + 6;
    doc.setFontSize(7.5);
    doc.setTextColor(40);
    doc.setFont(undefined, "bold");
    doc.text("Please note:", M.left, noteY);
    doc.setFont(undefined, "normal");
    STATEMENT_FOOTNOTES.forEach((f) => {
      noteY += 4;
      doc.text(f, M.left, noteY);
    });

    doc.save(`${safeFilePart(meta.branchName)}_statement_${safeFilePart(period)}.pdf`);
  } catch (err) {
    console.error("Statement PDF export failed:", err);
    alert("Failed to export PDF. Please try again.");
  }
};

export default { exportStatementToExcel, exportStatementToPDF, monthTitle, STATEMENT_FOOTNOTES };
