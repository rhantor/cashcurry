// exportCostData: the share part (moved from exportCostData.js unchanged).
 
// /utils/export/exportCostData.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "@/app/components/ui/notify";

import { personName } from "@/lib/people";
import { createdAtToStr, derivePaidFrom, derivePaidMethod, fmtDate, methodLabel, normCategory, paidFromLabel, safe } from "./helpers";

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
    ["Created By", personName(cost.createdBy) || "-"],
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
    toast.success("Link copied to clipboard ✅ (paste it into WhatsApp/Email)");
  }
};
