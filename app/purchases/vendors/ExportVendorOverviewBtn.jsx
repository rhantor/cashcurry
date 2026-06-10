"use client";
import React, { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download } from "lucide-react";
import { useLazyGetVendorBillsQuery } from "@/lib/redux/api/vendorBillsApiSlice";
import useCurrency from "@/app/hooks/useCurrency";

function formatDate(iso) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch {
    return iso;
  }
}

export default function ExportVendorOverviewBtn({ companyId, branchId, vendor }) {
  const currency = useCurrency();
  const [fetchBills] = useLazyGetVendorBillsQuery();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!companyId || !branchId || !vendor?.id) return;
    setIsExporting(true);

    try {
      // Fetch all bills for this vendor
      const res = await fetchBills({ companyId, branchId, vendorId: vendor.id }).unwrap();
      const bills = [...(res || [])];

      // Sort bills by invoiceDate
      bills.sort((a, b) => ((a.invoiceDate || "") > (b.invoiceDate || "") ? -1 : 1));

      let totalPaidAmount = 0;
      let totalUnpaidAmount = 0;
      let paidCount = 0;
      let pendingCount = 0;

      const tableData = bills.map((b, i) => {
        const isPaid = b.status === "paid";
        const isPending = b.status === "unpaid" || b.status === "partially_paid";
        
        if (isPaid) {
          paidCount++;
          totalPaidAmount += Number(b.paid || 0);
        } else if (isPending) {
          pendingCount++;
          totalUnpaidAmount += Number(b.balance || 0);
        }

        // Determine last payment date if applicable
        let lastPaymentDate = "-";
        if (b.paymentHistory && b.paymentHistory.length > 0) {
          const sortedPayments = [...b.paymentHistory].sort((p1, p2) => {
            const t1 = p1.paidAt?.seconds ? p1.paidAt.seconds * 1000 : (p1.paidAtClient ? new Date(p1.paidAtClient).getTime() : 0);
            const t2 = p2.paidAt?.seconds ? p2.paidAt.seconds * 1000 : (p2.paidAtClient ? new Date(p2.paidAtClient).getTime() : 0);
            return t2 - t1;
          });
          const lastP = sortedPayments[0];
          const ts = lastP.paidAt?.seconds ? lastP.paidAt.seconds * 1000 : lastP.paidAtClient;
          if (ts) {
            lastPaymentDate = new Date(ts).toLocaleDateString();
          }
        }

        return [
          i + 1,
          formatDate(b.invoiceDate),
          b.invoiceNo || b.reference || "-",
          `${currency} ${Number(b.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          `${currency} ${Number(b.paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          `${currency} ${Number(b.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          b.status ? b.status.replace("_", " ").toUpperCase() : "UNKNOWN",
          lastPaymentDate
        ];
      });

      const doc = new jsPDF({ orientation: "landscape" });

      doc.setFontSize(18);
      doc.text("Vendor Full Details & Bills Summary", 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Vendor: ${vendor.name || "-"}`, 14, 28);
      doc.text(`Vendor Code: ${vendor.code || "-"}`, 14, 33);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 38);

      // Summary
      doc.setFontSize(10);
      doc.setTextColor(30);
      doc.text(`Total Bills: ${bills.length}`, 180, 28);
      doc.text(`Paid Bills: ${paidCount} (${currency} ${totalPaidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })})`, 180, 33);
      doc.text(`Pending Bills: ${pendingCount} (${currency} ${totalUnpaidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })})`, 180, 38);

      autoTable(doc, {
        startY: 45,
        head: [["#", "Inv. Date", "Invoice #", "Total", "Paid", "Balance", "Status", "Last Payment"]],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
        columnStyles: {
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' }
        },
        didParseCell(data) {
          if (data.section === 'body' && data.column.index === 6) { // Status column
            const val = data.cell.raw;
            if (val === 'PAID') data.cell.styles.textColor = [22, 101, 52]; // green
            else if (val === 'UNPAID') data.cell.styles.textColor = [153, 27, 27]; // red
            else if (val === 'PARTIALLY PAID') data.cell.styles.textColor = [180, 83, 9]; // amber
          }
        }
      });

      doc.save(`Vendor_Full_Details_${vendor.name?.replace(/\s+/g, "_") || "Vendor"}.pdf`);

    } catch (e) {
      console.error(e);
      alert("Failed to export vendor details.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="flex items-center gap-2 px-4 py-2 bg-mint-500 hover:bg-mint-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-mint-100 disabled:opacity-50"
    >
      <Download className="w-4 h-4" />
      {isExporting ? "Exporting..." : "Export Full Details"}
    </button>
  );
}
