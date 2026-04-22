// utils/exportSalary.js
// Minimal exporters mirroring your sales exporters’ signatures.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const branchLabel = (branchData) =>
  Array.isArray(branchData)
    ? branchData.map((b) => b.name).join(", ")
    : branchData?.name || "Branch";

const toRM = (n) => Number(n || 0).toFixed(2);

export function exportSalariesToPDF(list = [], branchData, meta = {}) {
  try {
    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text("Salary Report", 14, 16);
    doc.setFontSize(10);
    doc.text(`Branch: ${branchLabel(branchData)}`, 14, 22);

    const subtitle =
      meta.dateMode === "salary"
        ? "Filtered by Salary Period"
        : "Filtered by Payment Date";
    doc.text(subtitle, 14, 28);

    const rows = (list || []).map((e) => [
      e.month || "-",
      e.paymentDate || "-",
      toRM(e.totalSalary),
      e.createdBy?.username || "-",
    ]);

    autoTable(doc, {
      startY: 34,
      head: [["Salary Period", "Payment Date", "Total (RM)", "Created By"]],
      body: rows,
      styles: { fontSize: 9 },
    });

    const total = (list || []).reduce(
      (s, r) => s + (Number(r.totalSalary) || 0),
      0
    );
    doc.text(`Total: RM ${toRM(total)}`, 14, doc.lastAutoTable.finalY + 8);

    doc.save(`Salary_Report.pdf`);
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
}

export function exportSalariesToExcel(list = [], branchData, meta = {}) {
  try {
    const wsData = [
      ["Salary Report"],
      ["Branch:", branchLabel(branchData)],
      [
        meta.dateMode === "salary"
          ? "Filtered by Salary Period"
          : "Filtered by Payment Date",
      ],
      [],
      ["Salary Period", "Payment Date", "Total (RM)", "Created By"],
      ...(list || []).map((e) => [
        e.month || "-",
        e.paymentDate || "-",
        toRM(e.totalSalary),
        e.createdBy?.username || "-",
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Salary Report");
    XLSX.writeFile(wb, "Salary_Report.xlsx");
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
}

// Single item exports
export function exportOneSalaryToPDF(item, branchData) {
  try {
    if (!item) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Salary Entry", 14, 16);
    doc.setFontSize(10);
    doc.text(`Branch: ${branchLabel(branchData)}`, 14, 22);

    const rows = [
      ["Salary Period", item.month || "-"],
      ["Payment Date", item.paymentDate || "-"],
      ["Total (RM)", toRM(item.totalSalary)],
      ["Notes", item.notes || "-"],
      ["Created By", item.createdBy?.username || "-"],
    ];

    autoTable(doc, {
      startY: 30,
      body: rows,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: "bold" } },
    });

    doc.save(`Salary_${item.month || "entry"}.pdf`);
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
}

export function exportOneSalaryToExcel(item, branchData) {
  try {
    if (!item) return;
    const wsData = [
      ["Salary Entry"],
      ["Branch:", branchLabel(branchData)],
      [],
      ["Field", "Value"],
      ["Salary Period", item.month || "-"],
      ["Payment Date", item.paymentDate || "-"],
      ["Total (RM)", toRM(item.totalSalary)],
      ["Notes", item.notes || "-"],
      ["Created By", item.createdBy?.username || "-"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Salary Entry");
    XLSX.writeFile(wb, `Salary_${item.month || "entry"}.xlsx`);
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
}

export function shareSalary(item, branchData) {
  try {
    const text = `Salary – ${item.month || "-"}\nPayment: ${
      item.paymentDate || "-"
    }\nAmount: RM ${toRM(item.totalSalary)}\nBranch: ${branchLabel(
      branchData
    )}\n${item.notes ? `Notes: ${item.notes}` : ""}`;
    if (navigator.share) {
      navigator.share({ title: "Salary Entry", text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      alert("Copied to clipboard!");
    }
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
}
