// Due bills' downloads: the all-vendors summary PDF, one vendor's statement
// PDF (with every bill's invoice appended), and the Excel versions. Moved out
// of page.jsx unchanged; the page passes in what they read.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { PDFDocument } from "pdf-lib";

const addAttachmentToPdf = async (doc, url, vendorName, refLabel, attachmentIndex) => {
  // eslint-disable-next-line no-async-promise-executor -- resolves from image callbacks below
  return new Promise(async (resolve) => {
    const isPdf = url.toLowerCase().split('?')[0].endsWith('.pdf');
    const pdfWidth = doc.internal.pageSize.getWidth();
    const pdfHeight = doc.internal.pageSize.getHeight();
    
    doc.addPage();
    
    // Simple, clean title
    doc.setFontSize(14);
    doc.setTextColor(33, 37, 41);
    doc.setFont("helvetica", "bold");
    const title = `Vendor: ${vendorName || 'Unknown Vendor'} | Ref: ${refLabel || 'N/A'} (${attachmentIndex})`;
    doc.text(title, 14, 20);

    if (isPdf) {
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139); // subtle gray
      doc.text("The attached PDF document follows on the next page.", 14, 30);
      resolve({ type: 'pdf', url: url });
      return;
    }

    // It's an image. We'll try loading it.
    const img = new window.Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = () => {
      const startY = 30;
      const imgRatio = img.width / img.height;
      let finalW = pdfWidth - 28;
      let finalH = finalW / imgRatio;
      const maxH = pdfHeight - startY - 14;
      
      if (finalH > maxH) {
        finalH = maxH;
        finalW = finalH * imgRatio;
      }
      const xPos = (pdfWidth - finalW) / 2;
      
      try {
        doc.addImage(img, 'JPEG', xPos, startY, finalW, finalH);
      } catch {
        try {
          doc.addImage(img, 'PNG', xPos, startY, finalW, finalH);
        } catch {
          doc.setFontSize(10);
          doc.setTextColor(220, 38, 38);
          doc.text("Failed to embed image. Click to view:", 14, startY + 10);
          doc.setTextColor(59, 130, 246);
          doc.textWithLink("Open Image", 14, startY + 20, { url });
        }
      }
      resolve(true);
    };

    img.onerror = () => {
      doc.setFontSize(10);
      doc.setTextColor(220, 38, 38);
      doc.text("Could not embed image directly due to browser security.", 14, 40);
      doc.setTextColor(59, 130, 246);
      doc.text("Click here to open the attachment.", 14, 50);
      doc.textWithLink(url.substring(0, 50) + "...", 14, 60, { url: url });
      resolve(false);
    };

    // Use our internal proxy to bypass Firebase Storage CORS restrictions
    img.src = `/api/proxy-image?url=${encodeURIComponent(url)}`;
  });
};

export function makeDueBillsExports({ pdfRM, selectedVendor, filteredBills, vendorSummaryData, branchData, vendorList }) {
  const generateSummaryPDF = async (vendorIdsToInclude) => {
    const doc = new jsPDF();
    
    // Professional Header
    doc.setFontSize(18);
    doc.setTextColor(33, 37, 41);
    doc.text("Vendors Outstanding Statement", 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(108, 117, 125);
    doc.text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 14, 30);
    if (branchData?.name) doc.text(`Branch: ${branchData.name}`, 14, 36);
    
    const tableData = vendorSummaryData
      .filter(v => vendorIdsToInclude.includes(v.id))
      .map((v, i) => [
        i + 1,
        v.name,
        v.billsCount,
        v.lastPurchaseTimestamp ? new Date(v.lastPurchaseTimestamp).toLocaleDateString() : "-",
        pdfRM(v.totalPending),
        v.isEmergency
      ]);

    autoTable(doc, {
      startY: 45,
      head: [["#", "Vendor Name", "Bills", "Last Purchase", "Total Pending", "Remarks"]],
      body: tableData,
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [46, 204, 113], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      columnStyles: { 
        0: { cellWidth: 10 },
        2: { halign: 'center' },
        4: { halign: 'right' },
        5: { fontStyle: 'bold' } 
      },
      didParseCell: function (data) {
        if (data.column.index === 5 && data.cell.text[0] !== '-' && data.section === 'body') {
          data.cell.styles.textColor = [220, 38, 38];
        }
      }
    });

    const finalY = doc.lastAutoTable.finalY || 45;
    const totalPending = vendorSummaryData
      .filter(v => vendorIdsToInclude.includes(v.id))
      .reduce((acc, curr) => acc + curr.totalPending, 0);

    doc.setDrawColor(200, 200, 200);
    doc.line(14, finalY + 8, 196, finalY + 8); // separator line

    doc.setFontSize(14);
    doc.setTextColor(33, 37, 41);
    doc.setFont("helvetica", "bold");
    doc.text("Total Outstanding Balance:", 155, finalY + 18, { align: 'right' });
    
    doc.setTextColor(46, 204, 113);
    doc.text(`${pdfRM(totalPending)}`, 195, finalY + 18, { align: 'right' });
    
    doc.save(`Vendors_Summary_${Date.now()}.pdf`);
  };

  const generateSingleVendorPDF = async (vendorId) => {
    const vendorBills = filteredBills.filter(b => b.vendorId === vendorId);
    const fullVendorObj = vendorList.find(v => v.id === vendorId);
    const vendorName = fullVendorObj?.name || "Vendor";
    const vendorCode = fullVendorObj?.code || "";

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setTextColor(33, 37, 41);
    doc.text("Statement of Account", 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(108, 117, 125);
    doc.text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 14, 30);
    if (branchData?.name) doc.text(`Branch: ${branchData.name}`, 14, 36);
    
    doc.setFontSize(10);
    doc.setTextColor(33, 37, 41);
    doc.setFont("helvetica", "bold");
    doc.text("Vendor Details:", 135, 22);
    
    doc.setFontSize(9);
    doc.setTextColor(33, 37, 41);
    
    let yPos = 28;
    doc.setFont("helvetica", "bold");
    doc.text(vendorName, 135, yPos);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(108, 117, 125);
    yPos += 5;

    if (fullVendorObj?.ownerName) {
      doc.text(`Contact: ${fullVendorObj.ownerName}`, 135, yPos);
      yPos += 5;
    }
    if (fullVendorObj?.phone) {
      doc.text(`Phone: ${fullVendorObj.phone}`, 135, yPos);
      yPos += 5;
    }
    if (fullVendorObj?.email) {
      doc.text(`Email: ${fullVendorObj.email}`, 135, yPos);
      yPos += 5;
    }
    if (fullVendorObj?.bankName || fullVendorObj?.bankAccountNumber) {
      const bankInfo = [fullVendorObj.bankName, fullVendorObj.bankAccountNumber].filter(Boolean).join(" - ");
      doc.text(`Bank: ${bankInfo}`, 135, yPos);
      yPos += 5;
    }
    
    const tableData = vendorBills.map((b, i) => [
      i + 1,
      b.invoiceNo || b.reference || "-",
      b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000).toLocaleDateString() : "-",
      b.dueDate || "-",
      pdfRM(b.total),
      pdfRM(b.balance)
    ]);

    autoTable(doc, {
      startY: Math.max(45, yPos + 5),
      head: [["#", "Ref / Invoice", "Bill Date", "Due Date", "Total Amt", "Pending Bal"]],
      body: tableData,
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [46, 204, 113], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      columnStyles: {
        0: { cellWidth: 10 },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' }
      }
    });

    const finalY = doc.lastAutoTable.finalY || 45;
    const totalPending = vendorBills.reduce((acc, curr) => acc + curr.balance, 0);

    doc.setDrawColor(200, 200, 200);
    doc.line(14, finalY + 8, 196, finalY + 8); 

    doc.setFontSize(14);
    doc.setTextColor(33, 37, 41);
    doc.setFont("helvetica", "bold");
    doc.text("Total Outstanding Balance:", 155, finalY + 18, { align: 'right' });
    
    doc.setTextColor(46, 204, 113);
    doc.text(`${pdfRM(totalPending)}`, 195, finalY + 18, { align: 'right' });

    const pdfsToMerge = [];
    for (const bill of vendorBills) {
      if (bill.attachments && Array.isArray(bill.attachments)) {
        let attachmentCount = 1;
        for (const url of bill.attachments) {
          if (url) {
            const refLabel = bill.invoiceNo || bill.reference || "Unknown";
            const result = await addAttachmentToPdf(doc, url, vendorName, refLabel, attachmentCount, bill.attachments.length);
            if (result && result.type === 'pdf') {
              pdfsToMerge.push(result.url);
            }
            attachmentCount++;
          }
        }
      }
    }

    const shortName = vendorName.length > 20 ? vendorName.substring(0, 20).trim() : vendorName;
    const safeName = shortName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    const safeCode = vendorCode ? `_${vendorCode.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "")}` : "";
    const filename = `${safeName}${safeCode}_Statement.pdf`;

    if (pdfsToMerge.length === 0) {
      doc.save(filename);
      return;
    }

    try {
      const jsPdfBuffer = doc.output('arraybuffer');
      const mergedPdf = await PDFDocument.load(jsPdfBuffer);

      for (const pdfUrl of pdfsToMerge) {
        const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(pdfUrl)}`);
        if (!res.ok) continue;
        const pdfBytes = await res.arrayBuffer();
        const attachedPdf = await PDFDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(attachedPdf, attachedPdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const finalPdfBytes = await mergedPdf.save();
      const blob = new window.Blob([finalPdfBytes], { type: "application/pdf" });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.click();
    } catch (e) {
      console.error("PDF Merge failed", e);
      doc.save(filename);
    }
  };

  const exportExcel = () => {
    if (!selectedVendor) {
      const data = vendorSummaryData.map(v => ({
        "Vendor Name": v.name,
        "Bills": v.billsCount,
        "Last Purchase": v.lastPurchaseTimestamp ? new Date(v.lastPurchaseTimestamp).toLocaleDateString() : "-",
        "Total Pending": v.totalPending,
        "Remarks": v.isEmergency
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "All Vendors Summary");
      XLSX.writeFile(wb, `All_Vendors_Statement_${Date.now()}.xlsx`);
      return;
    }

    const fullVendorObj = vendorList.find(v => v.id === selectedVendor);
    const vendorName = fullVendorObj?.name || "Vendor";
    const vendorCode = fullVendorObj?.code || "";

    const data = filteredBills.map(b => ({
      "Vendor": b.vendorName,
      "Invoice / Ref": b.invoiceNo || b.reference || "-",
      "Bill Date": b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000).toLocaleDateString() : "-",
      "Due Date": b.dueDate || "-",
      "Total Amount": b.total,
      "Pending Balance": b.balance,
      "Status": b.status
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statement");
    
    const shortName = vendorName.length > 20 ? vendorName.substring(0, 20).trim() : vendorName;
    const safeName = shortName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    const safeCode = vendorCode ? `_${vendorCode.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "")}` : "";
    XLSX.writeFile(wb, `${safeName}${safeCode}_Statement.xlsx`);
  };

  return { generateSummaryPDF, generateSingleVendorPDF, exportExcel };
}
