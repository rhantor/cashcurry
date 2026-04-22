import { format, parseISO } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Fetch image → Base64 (same approach you used)
const getBase64ImageFromUrl = async (url) => {
  const res = await fetch(url, { mode: "cors" });
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/** =========================
 *  Single item: Excel/PDF/Share
 *  ========================= */

export const exportWithdrawalToExcel = (withdraw, branchData) => {
  try {
    const branchName = branchData?.name || "N/A";
    const createdTime = withdraw.createdAt
      ? (typeof withdraw.createdAt === "string"
          ? new Date(withdraw.createdAt)
          : withdraw.createdAt?.seconds
          ? new Date(withdraw.createdAt.seconds * 1000)
          : null
        )?.toLocaleString() || "Unknown"
      : "Unknown";

    const data = [
      ["Branch", branchName, "Created At", createdTime],
      ["Date", withdraw.date || "-"],
      ["Category", withdraw.category || "N/A"],
      ["Method", withdraw.method || "N/A"],
      [
        "Amount (RM)",
        Number(withdraw.amount || 0).toFixed(2),
        "Reference",
        withdraw.reference || "-",
      ],
      ["Receipt", withdraw.receiptUrl || "-"],
      [
        "Added By",
        withdraw.createdBy?.username || "Unknown",
        "Role",
        withdraw.createdBy?.role || "-",
      ],
      ["Notes", withdraw.notes || "-"],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 15 }, { wch: 32 }, { wch: 15 }, { wch: 40 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Withdrawal Details");
    XLSX.writeFile(wb, `withdrawal-${withdraw.date || "unknown"}.xlsx`);
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
};

export const exportWithdrawalToPDF = async (withdraw, branchData) => {
  try {
    const branchName = branchData?.name || "N/A";
    const doc = new jsPDF();

    // Header
    doc.setFontSize(16);
    doc.text("Withdrawal Report", 14, 20);
    doc.setFontSize(12);
    if (withdraw.date)
      doc.text(format(parseISO(withdraw.date), "dd/MM/yyyy"), 150, 20);

    const createdTime = withdraw.createdAt
      ? (typeof withdraw.createdAt === "string"
          ? new Date(withdraw.createdAt)
          : withdraw.createdAt?.seconds
          ? new Date(withdraw.createdAt.seconds * 1000)
          : null
        )?.toLocaleString() || "Unknown"
      : "Unknown";

    doc.setFontSize(11);
    doc.text(`Branch: ${branchName}`, 14, 28);
    doc.text(`Created At: ${createdTime}`, 135, 28);

    const tableData = [
      ["Category", withdraw.category || "N/A", "-"],
      ["Method", withdraw.method || "N/A", "-"],
      [
        "Amount (RM)",
        Number(withdraw.amount || 0).toFixed(2),
        `Ref: ${withdraw.reference || "-"}`,
      ],
      ["Receipt", withdraw.receiptUrl ? "See below 👇" : "-", "-"],
      [
        "Added By",
        withdraw.createdBy?.username || "Unknown",
        withdraw.createdBy?.role || "-",
      ],
    ];

    autoTable(doc, {
      startY: 36,
      head: [["Field", "Value", "Extra"]],
      body: tableData,
    });

    let finalY = doc.lastAutoTable.finalY + 10;

    if (withdraw.receiptUrl) {
      try {
        const imgData = await getBase64ImageFromUrl(withdraw.receiptUrl);
        doc.setFontSize(12);
        doc.text("Receipt:", 14, finalY);
        // fit width; keep height reasonable
        doc.addImage(imgData, "PNG", 14, finalY + 5, 90, 100);
        finalY += 110;
      } catch (err) {
        console.error("Receipt image load failed:", err);
        doc.text("⚠️ Receipt could not be loaded", 14, finalY);
        finalY += 10;
      }
    }

    const pageH = doc.internal.pageSize.height;
    doc.setFontSize(11);
    doc.text(`User Email: ${withdraw.createdBy?.email || "-"}`, 14, pageH - 10);

    doc.save(`withdrawal-${withdraw.date || "unknown"}.pdf`);
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
};

export const shareWithdrawal = async (withdraw, branchData) => {
  try {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Withdrawal Report", 14, 20);
    if (withdraw.date)
      doc.text(format(parseISO(withdraw.date), "dd/MM/yyyy"), 150, 20);

    const branchName = branchData?.name || "N/A";
    const createdTime = withdraw.createdAt
      ? (typeof withdraw.createdAt === "string"
          ? new Date(withdraw.createdAt)
          : withdraw.createdAt?.seconds
          ? new Date(withdraw.createdAt.seconds * 1000)
          : null
        )?.toLocaleString() || "Unknown"
      : "Unknown";

    doc.setFontSize(11);
    doc.text(`Branch: ${branchName}`, 14, 28);
    doc.text(`Created At: ${createdTime}`, 150, 28);

    const tableData = [
      ["Category", withdraw.category || "N/A", "-"],
      ["Method", withdraw.method || "N/A", "-"],
      [
        "Amount (RM)",
        Number(withdraw.amount || 0).toFixed(2),
        `Ref: ${withdraw.reference || "-"}`,
      ],
      ["Receipt", withdraw.receiptUrl ? "See below 👇" : "-", "-"],
      [
        "Added By",
        withdraw.createdBy?.username || "Unknown",
        withdraw.createdBy?.role || "-",
      ],
    ];

    autoTable(doc, {
      startY: 36,
      head: [["Field", "Value", "Extra"]],
      body: tableData,
    });

    let finalY = doc.lastAutoTable.finalY + 10;
    if (withdraw.receiptUrl) {
      try {
        const imgData = await getBase64ImageFromUrl(withdraw.receiptUrl);
        doc.setFontSize(12);
        doc.text("Receipt:", 14, finalY);
        doc.addImage(imgData, "PNG", 14, finalY + 5, 90, 100);
      } catch (err) {
        console.error("Receipt image load failed:", err);
        doc.text("⚠️ Receipt could not be loaded", 14, finalY);
      }
    }

    const fileName = `withdrawal-${withdraw.date || "unknown"}.pdf`;
    const pdfBlob = doc.output("blob");

    if (
      navigator.share &&
      navigator.canShare?.({
        files: [new File([pdfBlob], fileName, { type: "application/pdf" })],
      })
    ) {
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });
      await navigator.share({
        title: "Withdrawal Report",
        text: "Withdrawal report",
        files: [file],
      });
    } else if (navigator.share) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        await navigator.share({
          title: "Withdrawal Report",
          text: "Report:\n" + reader.result,
        });
      };
      reader.readAsDataURL(pdfBlob);
    } else {
      const link = `${window.location.origin}/cash-withdraw/${withdraw.id}`;
      await navigator.clipboard.writeText(link);
      alert("Link copied to clipboard ✅");
    }
  } catch (err) {
    console.error("Withdrawal share failed:", err);
  }
};

/** =========================
 *  Bulk exports (list) : Excel/PDF
 *  Same signature as your deposit helpers
 *  ========================= */

export const exportWithdrawalsToExcel = (
  withdrawals,
  branchData,
  filterType,
  dateRange = {},
  selectedMonth = ""
) => {
  try {
    if (!withdrawals.length) return alert("No withdrawal data to export!");
    const branchName = branchData?.name || "N/A";

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
          const [y, m] = selectedMonth.split("-");
          const monthName = format(new Date(y, m - 1), "MMMM yyyy");
          filterText = monthName;
          fileFilterName = monthName.replace(/\s+/g, "_").toLowerCase();
        }
        break;
      default: /* keep defaults */
    }

    const rows = withdrawals.map((w) => [
      w.date ? format(new Date(w.date + "T00:00:00"), "dd/MM/yyyy") : "-",
      Number(w.amount || 0).toFixed(2),
      w.category || "N/A",
      w.method || "N/A",
      w.reference || "-",
      w.receiptUrl || "-",
      w.createdBy?.username || "Unknown",
      w.createdBy?.email || "-",
      w.createdBy?.role || "-",
      w.createdAt
        ? (typeof w.createdAt === "string"
            ? new Date(w.createdAt)
            : w.createdAt?.seconds
            ? new Date(w.createdAt.seconds * 1000)
            : null
          )?.toLocaleString() || "Unknown"
        : "Unknown",
    ]);

    const ws = XLSX.utils.aoa_to_sheet([
      ["Withdrawal Report"],
      ["Branch:", branchName],
      ["Filter:", filterText],
      ["Generated:", new Date().toLocaleString()],
      [],
      [
        "Date",
        "Amount (RM)",
        "Category",
        "Method",
        "Reference",
        "Receipt URL",
        "Created By",
        "Email",
        "Role",
        "Created At",
      ],
      ...rows,
    ]);

    ws["!cols"] = [
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
      { wch: 20 },
      { wch: 40 },
      { wch: 20 },
      { wch: 25 },
      { wch: 14 },
      { wch: 25 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Withdrawal Report");
    XLSX.writeFile(wb, `withdrawal-report_${fileFilterName}.xlsx`);
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
};

export const exportWithdrawalsToPDF = (
  withdrawals,
  branchData,
  filterType,
  dateRange = {},
  selectedMonth = ""
) => {
  try {
    if (!withdrawals.length) return alert("No withdrawal data to export!");
    const branchName = branchData?.name || "N/A";
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
          const [y, m] = selectedMonth.split("-");
          const monthName = format(new Date(y, m - 1), "MMMM yyyy");
          filterText = monthName;
          fileFilterName = monthName.replace(/\s+/g, "_").toLowerCase();
        }
        break;
      default: /* keep defaults */
    }

    // Header
    doc.setFontSize(16);
    doc.text("Withdrawal Report", 14, 20);
    doc.setFontSize(11);
    doc.text(`Branch: ${branchName}`, 14, 28);
    doc.text(`Filter: ${filterText}`, 14, 34);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40);

    const tableData = withdrawals.map((w) => [
      w.date ? format(new Date(w.date + "T00:00:00"), "dd/MM/yyyy") : "-",
      Number(w.amount || 0).toFixed(2),
      w.category || "N/A",
      w.method || "N/A",
      w.reference || "-",
      "", // clickable link cell
      w.createdBy?.username || "Unknown",
      w.createdBy?.email || "-",
      w.createdBy?.role || "-",
      w.createdAt
        ? (typeof w.createdAt === "string"
            ? new Date(w.createdAt)
            : w.createdAt?.seconds
            ? new Date(w.createdAt.seconds * 1000)
            : null
          )?.toLocaleString() || "Unknown"
        : "Unknown",
    ]);

    autoTable(doc, {
      startY: 50,
      head: [
        [
          "Date",
          "Amount (RM)",
          "Category",
          "Method",
          "Reference",
          "Receipt",
          "Created By",
          "Email",
          "Role",
          "Created At",
        ],
      ],
      body: tableData,
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 22 },
        2: { cellWidth: 28 },
        3: { cellWidth: 22 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 },
        6: { cellWidth: 25 },
        7: { cellWidth: 40 },
        8: { cellWidth: 20 },
        9: { cellWidth: 35 },
      },
      didDrawCell: (data) => {
        if (data.section === "body" && data.column.index === 5) {
          const row = withdrawals[data.row.index];
          if (row?.receiptUrl) {
            const text = "View Receipt";
            const textWidth =
              (doc.getStringUnitWidth(text) * doc.internal.getFontSize()) /
              doc.internal.scaleFactor;
            const x = data.cell.x + (data.cell.width - textWidth) / 2;
            const y = data.cell.y + data.cell.height / 2 + 2;
            doc.setTextColor(0, 0, 255);
            doc.textWithLink(text, x, y, { url: row.receiptUrl });
            doc.setTextColor(0, 0, 0);
          }
        }
      },
    });

    doc.save(`withdrawal-report_${fileFilterName}.pdf`);
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
};
