import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ─── helpers ─── */
const fmtAmt = (v) =>
  Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (ms) => {
  if (!ms) return "—";
  try { return new Date(ms).toLocaleDateString(); } catch { return "—"; }
};

const safeStr = (v) => (v == null ? "" : String(v));

/* ─── build flat rows for export ─── */
const buildRows = (visible, nameOf, currency) => {
  const rows = [];

  Object.entries(visible).forEach(([bid, s]) => {
    const branchName = nameOf(bid);

    // Branch summary header row
    rows.push({
      branch:   branchName,
      type:     "summary",
      provided: Number(s?.provided || 0),
      taken:    Number(s?.taken    || 0),
      net:      Number(s?.net      || 0),
    });

    // Provided loans (as lender)
    (s?.providedDetails || []).forEach((r) => {
      const counterparty = r.requestFrom || nameOf(r.fromBranchId);
      rows.push({
        branch:       branchName,
        type:         "provided",
        counterparty,
        reason:       safeStr(r.reason),
        original:     Number(r.amount      || 0),
        outstanding:  Number(r.outstanding ?? r.amount ?? 0),
        settled:      r.settled ? "Yes" : "No",
        requestedDate: fmtDate(r.createdAt),
        durationDays: r.durationDays ?? 0,
        requestedBy:  r.requestedBy?.username || "—",
        approvedBy:   r.approvedBy?.name || r.approvedBy?.username || "—",
      });
    });

    // Taken loans (as borrower)
    (s?.takenDetails || []).forEach((r) => {
      const counterparty = r.requestedTo || nameOf(r.toBranchId);
      rows.push({
        branch:       branchName,
        type:         "taken",
        counterparty,
        reason:       safeStr(r.reason),
        original:     Number(r.amount      || 0),
        outstanding:  Number(r.outstanding ?? r.amount ?? 0),
        settled:      r.settled ? "Yes" : "No",
        requestedDate: fmtDate(r.createdAt),
        durationDays: r.durationDays ?? 0,
        requestedBy:  r.requestedBy?.username || "—",
        approvedBy:   r.approvedBy?.name || r.approvedBy?.username || "—",
      });
    });
  });

  return rows;
};

/* ══════════════════════════════════════════════
   EXCEL EXPORT
══════════════════════════════════════════════ */
export const exportLoanSummaryToExcel = ({ visible, nameOf, currency, companyName, branchName, generatedAt }) => {
  try {
    const wb = XLSX.utils.book_new();

    /* ── Sheet 1: Summary ── */
    const summaryData = [
      [`${companyName || ""} — Loan Summary`],
      [branchName ? `Branch: ${branchName}` : "All Branches"],
      [`Generated: ${generatedAt || new Date().toLocaleString()}`],
      [],
      ["Branch", `Provided (${currency})`, `Taken (${currency})`, `Net (${currency})`],
    ];

    Object.entries(visible).forEach(([bid, s]) => {
      const name = nameOf(bid);
      summaryData.push([
        name,
        fmtAmt(s?.provided || 0),
        fmtAmt(s?.taken    || 0),
        fmtAmt(s?.net      || 0),
      ]);
    });

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary["!cols"] = [{ wch: 36 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    /* ── Sheet 2: Loan Details ── */
    const detailHeaders = [
      "Branch", "Direction", "Counterparty", "Reason",
      `Original (${currency})`, `Outstanding (${currency})`, "Settled",
      "Requested Date", "Duration (days)", "Requested By", "Approved By",
    ];
    const detailData = [detailHeaders];

    Object.entries(visible).forEach(([bid, s]) => {
      const branchLabel = nameOf(bid);

      (s?.providedDetails || []).forEach((r) => {
        detailData.push([
          branchLabel,
          "Provided (Lender)",
          r.requestFrom || nameOf(r.fromBranchId),
          r.reason || "",
          fmtAmt(r.amount),
          fmtAmt(r.outstanding ?? r.amount),
          r.settled ? "Yes" : "No",
          fmtDate(r.createdAt),
          r.durationDays ?? 0,
          r.requestedBy?.username || "—",
          r.approvedBy?.name || r.approvedBy?.username || "—",
        ]);
      });

      (s?.takenDetails || []).forEach((r) => {
        detailData.push([
          branchLabel,
          "Taken (Borrower)",
          r.requestedTo || nameOf(r.toBranchId),
          r.reason || "",
          fmtAmt(r.amount),
          fmtAmt(r.outstanding ?? r.amount),
          r.settled ? "Yes" : "No",
          fmtDate(r.createdAt),
          r.durationDays ?? 0,
          r.requestedBy?.username || "—",
          r.approvedBy?.name || r.approvedBy?.username || "—",
        ]);
      });
    });

    const wsDetail = XLSX.utils.aoa_to_sheet(detailData);
    wsDetail["!cols"] = [
      { wch: 28 }, { wch: 16 }, { wch: 28 }, { wch: 36 },
      { wch: 16 }, { wch: 16 }, { wch: 10 },
      { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDetail, "Loan Details");

    XLSX.writeFile(wb, `loan_summary_${Date.now()}.xlsx`);
  } catch (err) {
    console.error("Loan summary Excel export failed:", err);
    alert("Export failed. Please try again.");
  }
};

/* ══════════════════════════════════════════════
   PDF EXPORT
══════════════════════════════════════════════ */
export const exportLoanSummaryToPDF = ({ visible, nameOf, currency, companyName, branchName, generatedAt }) => {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const M = { left: 14, right: 14, top: 16, bottom: 14 };
    const BLACK = [20, 20, 20];
    const GREY  = [100, 100, 100];

    const drawPageFooter = () => {
      doc.setFontSize(8);
      doc.setTextColor(...GREY);
      doc.text(
        `Page ${doc.getNumberOfPages()}`,
        pageW - M.right,
        doc.internal.pageSize.getHeight() - 5,
        { align: "right" }
      );
      doc.setTextColor(...BLACK);
    };

    /* ── Page 1: Summary table ── */
    let y = M.top;
    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.setTextColor(...BLACK);
    doc.text("Loan Summary Report", M.left, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.setTextColor(...GREY);
    if (companyName) { doc.text(companyName, M.left, y); y += 5; }
    if (branchName)  { doc.text(`Branch: ${branchName}`, M.left, y); y += 5; }
    doc.text(`Generated: ${generatedAt || new Date().toLocaleString()}`, M.left, y);
    y += 8;
    doc.setTextColor(...BLACK);

    // Summary table
    const summaryRows = Object.entries(visible).map(([bid, s]) => [
      nameOf(bid),
      fmtAmt(s?.provided || 0),
      fmtAmt(s?.taken    || 0),
      fmtAmt(s?.net      || 0),
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Branch", `Provided (${currency})`, `Taken (${currency})`, `Net (${currency})`]],
      body: summaryRows,
      styles:     { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
      },
      didDrawPage: drawPageFooter,
    });

    /* ── Page 2+: Details per branch ── */
    Object.entries(visible).forEach(([bid, s]) => {
      const branchLabel = nameOf(bid);
      const provided = s?.providedDetails || [];
      const taken    = s?.takenDetails    || [];
      if (!provided.length && !taken.length) return;

      doc.addPage();
      drawPageFooter();
      let dy = M.top;

      doc.setFontSize(12);
      doc.setFont(undefined, "bold");
      doc.setTextColor(...BLACK);
      doc.text(branchLabel, M.left, dy);
      dy += 5;
      doc.setDrawColor(180);
      doc.setLineWidth(0.4);
      doc.line(M.left, dy, pageW - M.right, dy);
      dy += 6;
      doc.setFont(undefined, "normal");

      const detailCols = [
        { header: "Direction",        dataKey: "dir"  },
        { header: "Counterparty",     dataKey: "cp"   },
        { header: "Reason",           dataKey: "rsn"  },
        { header: `Original (${currency})`,     dataKey: "orig" },
        { header: `Outstanding (${currency})`,  dataKey: "out"  },
        { header: "Settled",          dataKey: "stl"  },
        { header: "Requested",        dataKey: "dt"   },
        { header: "By",               dataKey: "by"   },
      ];

      const detailRows = [
        ...provided.map((r) => ({
          dir:  "Provided",
          cp:   r.requestFrom  || nameOf(r.fromBranchId),
          rsn:  r.reason || "—",
          orig: fmtAmt(r.amount),
          out:  fmtAmt(r.outstanding ?? r.amount),
          stl:  r.settled ? "Yes" : "No",
          dt:   fmtDate(r.createdAt),
          by:   r.requestedBy?.username || "—",
        })),
        ...taken.map((r) => ({
          dir:  "Taken",
          cp:   r.requestedTo || nameOf(r.toBranchId),
          rsn:  r.reason || "—",
          orig: fmtAmt(r.amount),
          out:  fmtAmt(r.outstanding ?? r.amount),
          stl:  r.settled ? "Yes" : "No",
          dt:   fmtDate(r.createdAt),
          by:   r.requestedBy?.username || "—",
        })),
      ];

      autoTable(doc, {
        startY: dy,
        columns: detailCols,
        body: detailRows,
        styles:     { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
        headStyles: {
          fillColor: [50, 50, 50],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 8,
        },
        columnStyles: {
          dir:  { cellWidth: 18, fontStyle: "bold" },
          cp:   { cellWidth: 34 },
          rsn:  { cellWidth: 40 },
          orig: { halign: "right", cellWidth: 22 },
          out:  { halign: "right", cellWidth: 22 },
          stl:  { halign: "center", cellWidth: 14 },
          dt:   { cellWidth: 20 },
          by:   { cellWidth: 20 },
        },
        didDrawPage: drawPageFooter,
        // Colour rows: provided = light green, taken = light amber
        didParseCell(data) {
          if (data.section === "body") {
            const isProvided = data.row.raw?.dir === "Provided";
            data.cell.styles.fillColor = isProvided ? [240, 253, 244] : [255, 251, 235];
          }
        },
      });
    });

    doc.save(`loan_summary_${Date.now()}.pdf`);
  } catch (err) {
    console.error("Loan summary PDF export failed:", err);
    alert("Export failed. Please try again.");
  }
};
