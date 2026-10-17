"use client";
import { businessToday } from "@/lib/region";
import React, { useState, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, PartyPopper } from "lucide-react";
import { formatMoney } from "@/lib/region/currency";
import { Button } from "@/app/components/ui";
import { ListHead, Row, RowList, niceDate } from "./parts";
import { useGetVendorBillsQuery } from "@/lib/redux/api/vendorBillsApiSlice";
import ViewBillModal from "@/app/purchases/due-bills/components/ViewBillModal";
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

function daysBetween (aISO, bISO) {
  if (!aISO || !bISO) return 0
  const [ay, am, ad] = aISO.split('-').map(Number)
  const [by, bm, bd] = bISO.split('-').map(Number)
  const a = Date.UTC(ay, am - 1, ad)
  const b = Date.UTC(by, bm - 1, bd)
  return Math.round((a - b) / 86400000)
}

export default function VendorUnpaidBills({ companyId, branchId, vendorId }) {
  const currency = useCurrency();
  const [selectedBill, setSelectedBill] = useState(null);

  // Fetch unpaid
  const { data: unpaidRaw = [], isLoading: loadingUnpaid } = useGetVendorBillsQuery(
    companyId && branchId ? { companyId, branchId, vendorId, status: "unpaid" } : null
  );

  // Fetch partial
  const { data: partialRaw = [], isLoading: loadingPartial } = useGetVendorBillsQuery(
    companyId && branchId ? { companyId, branchId, vendorId, status: "partially_paid" } : null
  );

  const bills = useMemo(() => {
    const today = businessToday();
    return [...unpaidRaw, ...partialRaw]
      .map(b => ({
        ...b,
        __dueInDays: b.dueDate ? daysBetween(b.dueDate, today) : 0
      }))
      .sort((a, b) => (a.invoiceDate || "") > (b.invoiceDate || "") ? -1 : 1);
  }, [unpaidRaw, partialRaw]);

  const isLoading = loadingUnpaid || loadingPartial;

  const fmtRM = (v) => formatMoney(Number(v ?? 0), currency);
  const pdfRM = (v) => formatMoney(Number(v ?? 0), currency, { plain: true }); // PDF fonts have no ৳ or ₹

  const totalBalance = bills.reduce((sum, b) => sum + Number(b.balance ?? 0), 0);

  const handleExportPDF = () => {
    if (!bills.length) return;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Vendor Outstanding Statement", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Vendor: ${bills[0].vendorName || "N/A"}`, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 35);
    
    const tableData = bills.map(b => [
      formatDate(b.invoiceDate),
      b.invoiceNo || b.reference || "-",
      formatDate(b.dueDate),
      pdfRM(b.total),
      pdfRM(b.balance)
    ]);
    
    autoTable(doc, {
      startY: 45,
      head: [["Inv. Date", "Invoice #", "Due Date", "Total", "Balance"]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }, // mint-500
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' }
      }
    });
    
    const finalY = doc.lastAutoTable.finalY;
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Total Outstanding: ${pdfRM(totalBalance)}`, 196, finalY + 10, { align: 'right' });
    
    doc.save(`Outstanding_Statement_${bills[0].vendorName?.replace(/\s+/g, '_') || 'Vendor'}.pdf`);
  };

  const due = (b) => (b.__dueInDays < 0 ? `${-b.__dueInDays} day${b.__dueInDays === -1 ? "" : "s"} overdue` : b.__dueInDays === 0 ? "due today" : `due ${niceDate(b.dueDate)}`);

  return (
    <div>
      {bills.length > 0 && (
        <ListHead label={`${bills.length} unpaid · owed`} value={fmtRM(totalBalance)}>
          <Button size="sm" variant="secondary" icon={Download} onClick={handleExportPDF}>
            PDF
          </Button>
        </ListHead>
      )}
      <RowList
        loading={isLoading}
        rows={bills}
        empty={{ icon: PartyPopper, title: "Nothing owed", description: "Every bill from this vendor is paid in this branch." }}
      >
        {bills.map((b) => (
          <Row
            key={b.id}
            title={b.invoiceNo || b.reference || "No invoice no."}
            sub={`${niceDate(b.invoiceDate)} · ${due(b)}${Number(b.paid) > 0 ? ` · ${fmtRM(b.paid)} paid of ${fmtRM(b.total)}` : ""}`}
            amount={fmtRM(b.balance)}
            amountTone={b.__dueInDays < 0 ? "text-danger" : undefined}
            onClick={() => setSelectedBill(b)}
          />
        ))}
      </RowList>

      {selectedBill && <ViewBillModal isOpen={!!selectedBill} onClose={() => setSelectedBill(null)} bill={selectedBill} />}
    </div>
  );
}
