import { format, parseISO } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// 🔹 Helper: Fetch image and convert to Base64
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

// 🔹 Excel Export
export const exportDepositToExcel = (deposit, branchData) => {
  try {
    const branchName = branchData?.name || "N/A";
    const createdTime = deposit.createdAt?.seconds
      ? new Date(deposit.createdAt.seconds * 1000).toLocaleString()
      : "Unknown";

    const data = [
      ["Branch", branchName, "Created At", createdTime],
      ["Date", deposit.date],
      ["Bank", deposit.bankName || "N/A"],
      ["Amount", deposit.amount || "0.00", "Trace No", deposit.traceNo || "-"],
      ["Proof", deposit.fileURL || "-"],
      [
        "Added By",
        deposit.createdBy?.username || "Unknown",
        "Role",
        deposit.createdBy?.role || "-",
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 40 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Deposit Details");
    XLSX.writeFile(wb, `deposit-${deposit.date}.xlsx`);
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
};

// 🔹 PDF Export
export const exportDepositToPDF = async (deposit, branchData) => {
  try {
    const branchName = branchData?.name || "N/A";
    const doc = new jsPDF();

    // Title
    doc.setFontSize(16);
    doc.text("Deposit Report", 14, 20);

    // Date right side
    doc.setFontSize(12);
    doc.text(format(parseISO(deposit.date), "dd/MM/yyyy"), 150, 20);

    // Branch & Created Time
    const createdTime = deposit.createdAt?.seconds
      ? new Date(deposit.createdAt.seconds * 1000).toLocaleString()
      : "Unknown";
    doc.setFontSize(11);
    doc.text(`Branch: ${branchName}`, 14, 28);
    doc.text(`Created At: ${createdTime}`, 135, 28);

    // Table
    const tableData = [
      ["Bank", deposit.bankName || "N/A", "-"],
      ["Amount", deposit.amount || "0.00", `Trace No: ${deposit.traceNo || "-"}`],
      ["Proof", deposit.fileURL ? "See below 👇" : "-", "-"],
      [
        "Added By",
        deposit.createdBy?.username || "Unknown",
        deposit.createdBy?.role || "-",
      ],
    ];

    autoTable(doc, {
      startY: 36,
      head: [["Field", "Value", "Extra"]],
      body: tableData,
    });

    let finalY = doc.lastAutoTable.finalY + 10;

    // Embed proof image if exists
    if (deposit.fileURL) {
      try {
        const imgData = await getBase64ImageFromUrl(deposit.fileURL);
        doc.setFontSize(12);
        doc.text("Deposit Proof:", 14, finalY);

        // add image (fit width, max height ~100px)
        doc.addImage(imgData, "PNG", 14, finalY + 5, 90, 100);
        finalY += 110;
      } catch (err) {
        console.error("Image load failed:", err);
        doc.text("⚠️ Proof image could not be loaded", 14, finalY);
        finalY += 10;
      }
    }

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(11);
    doc.text(
      `User Email: ${deposit.createdBy?.email || "-"}`,
      14,
      pageHeight - 10
    );

    doc.save(`deposit-${deposit.date}.pdf`);
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
};

// 🔹 Share (PDF via Web Share API)
export const shareDeposit = async (deposit, branchData) => {
  const branchName = branchData?.name || "N/A";
  try {
    const fileName = `deposit-${deposit.date}.pdf`;
    const doc = new jsPDF();

    // Header
    doc.setFontSize(16);
    doc.text("Deposit Report", 14, 20);
    doc.text(format(parseISO(deposit.date), "dd/MM/yyyy"), 150, 20);

    const createdTime = deposit.createdAt?.seconds
      ? new Date(deposit.createdAt.seconds * 1000).toLocaleString()
      : "Unknown";
    doc.setFontSize(11);
    doc.text(`Branch: ${branchName}`, 14, 28);
    doc.text(`Created At: ${createdTime}`, 150, 28);

    // Table
    const tableData = [
      ["Bank", deposit.bankName || "N/A", "-"],
      [
        "Amount",
        deposit.amount || "0.00",
        `Trace No: ${deposit.traceNo || "-"}`,
      ],
      ["Proof", deposit.fileURL ? "See below 👇" : "-", "-"],
      [
        "Added By",
        deposit.createdBy?.username || "Unknown",
        deposit.createdBy?.role || "-",
      ],
    ];

    autoTable(doc, {
      startY: 36,
      head: [["Field", "Value", "Extra"]],
      body: tableData,
    });

    let finalY = doc.lastAutoTable.finalY + 10;

    // Embed image
    if (deposit.fileURL) {
      try {
        const imgData = await getBase64ImageFromUrl(deposit.fileURL);
        doc.setFontSize(12);
        doc.text("Deposit Proof:", 14, finalY);
        doc.addImage(imgData, "PNG", 14, finalY + 5, 90, 100);
      } catch (err) {
        console.error("Image load failed:", err);
        doc.text("⚠️ Proof image could not be loaded", 14, finalY);
      }
    }

    const pdfBlob = doc.output("blob");

    if (
      navigator.share &&
      navigator.canShare?.({
        files: [new File([pdfBlob], fileName, { type: "application/pdf" })],
      })
    ) {
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });
      await navigator.share({
        title: "Deposit Report",
        text: "Here is the deposit report",
        files: [file],
      });
    } else if (navigator.share) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        await navigator.share({
          title: "Deposit Report",
          text: "Here is the deposit report:\n" + reader.result,
        });
      };
      reader.readAsDataURL(pdfBlob);
    } else {
      const link = `${window.location.origin}/deposits/${deposit.id}`;
      await navigator.clipboard.writeText(link);
      alert("Link copied to clipboard ✅");
    }
  } catch (err) {
    console.error("Deposit share failed:", err);
  }
};

export const exportDepositsToExcel = (
  deposits,
  branchData,
  filterType,
  dateRange = {},
  selectedMonth = ""
) => {
  try {
    if (!deposits.length) return alert("No deposit data to export!");

    const branchName = branchData?.name || "N/A";

    // 🔹 Build filter text & filename part
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

    // 🔹 Build data rows
    const data = deposits.map((d) => [
      format(new Date(d.date), "dd/MM/yyyy"),
      d.bankName || "N/A",
      d.amount || "0.00",
      d.traceNo || "-",
      d.fileURL || "-", // Proof URL
      d.createdBy?.username || "Unknown",
      d.createdBy?.email || "-",
      d.createdBy?.role || "-",
      d.createdAt
        ? new Date(d.createdAt.seconds * 1000).toLocaleString()
        : "Unknown",
    ]);

    const ws = XLSX.utils.aoa_to_sheet([
      ["Deposit Report"],
      ["Branch:", branchName],
      ["Filter:", filterText],
      ["Generated:", new Date().toLocaleString()],
      [],
      [
        "Date",
        "Bank",
        "Amount",
        "Trace No",
        "Proof URL",
        "Created By",
        "Email",
        "Role",
        "Created At",
      ],
      ...data,
    ]);

    ws["!cols"] = [
      { wch: 12 },
      { wch: 20 },
      { wch: 12 },
      { wch: 15 },
      { wch: 40 },
      { wch: 20 },
      { wch: 25 },
      { wch: 15 },
      { wch: 25 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Deposit Report");
    XLSX.writeFile(wb, `deposit-report_${fileFilterName}.xlsx`);
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
};
//
export const exportDepositsToPDF = (
  deposits,
  branchData,
  filterType,
  dateRange = {},
  selectedMonth = ""
) => {
  try {
    if (!deposits.length) return alert("No deposit data to export!");

    const branchName = branchData?.name || "N/A";
    const doc = new jsPDF("landscape");

    // 🔹 Build filter text & filename part
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

    // Header
    doc.setFontSize(16);
    doc.text("Deposit Report", 14, 20);
    doc.setFontSize(11);
    doc.text(`Branch: ${branchName}`, 14, 28);
    doc.text(`Filter: ${filterText}`, 14, 34);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40);

    // Table Data
    const tableData = deposits.map((d) => [
      format(new Date(d.date), "dd/MM/yyyy"),
      d.bankName || "N/A",
      d.amount || "0.00",
      d.traceNo || "-",
      "", // clickable proof
      d.createdBy?.username || "Unknown",
      d.createdBy?.email || "-",
      d.createdBy?.role || "-",
      d.createdAt
        ? new Date(d.createdAt.seconds * 1000).toLocaleString()
        : "Unknown",
    ]);

    autoTable(doc, {
      startY: 50,
      head: [
        [
          "Date",
          "Bank",
          "Amount",
          "Trace No",
          "Proof",
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
        1: { cellWidth: 30 },
        2: { cellWidth: 20 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 }, // proof
        5: { cellWidth: 25 },
        6: { cellWidth: 40 },
        7: { cellWidth: 25 },
        8: { cellWidth: 35 },
      },
      didDrawCell: (data) => {
        if (data.section === "body" && data.column.index === 4) {
          const deposit = deposits[data.row.index];
          if (deposit?.fileURL) {
            const text = "View Proof";
            const textWidth =
              (doc.getStringUnitWidth(text) * doc.internal.getFontSize()) /
              doc.internal.scaleFactor;
            const x = data.cell.x + (data.cell.width - textWidth) / 2;
            const y = data.cell.y + data.cell.height / 2 + 2;

            doc.setTextColor(0, 0, 255);
            doc.textWithLink(text, x, y, { url: deposit.fileURL });
            doc.setTextColor(0, 0, 0);
          }
        }
      },
    });

    doc.save(`deposit-report_${fileFilterName}.pdf`);
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
};
