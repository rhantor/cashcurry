"use client";
import React, { useState, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download } from "lucide-react";
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
    const today = new Date().toISOString().slice(0, 10);
    return [...unpaidRaw, ...partialRaw]
      .map(b => ({
        ...b,
        __dueInDays: b.dueDate ? daysBetween(b.dueDate, today) : 0
      }))
      .sort((a, b) => (a.invoiceDate || "") > (b.invoiceDate || "") ? -1 : 1);
  }, [unpaidRaw, partialRaw]);

  const isLoading = loadingUnpaid || loadingPartial;

  const fmtRM = (v) =>
    `${currency} ${Number(v ?? 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

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
      fmtRM(b.total),
      fmtRM(b.balance)
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
    doc.text(`Total Outstanding: ${fmtRM(totalBalance)}`, 196, finalY + 10, { align: 'right' });
    
    doc.save(`Outstanding_Statement_${bills[0].vendorName?.replace(/\s+/g, '_') || 'Vendor'}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center text-gray-500 animate-pulse">
        Loading outstanding bills...
      </div>
    );
  }

  if (!bills.length) {
    return (
      <div className="py-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </div>
        <p className="text-gray-500 font-medium">No outstanding bills for this vendor.</p>
        <p className="text-xs text-gray-400 mt-1">All bills are fully paid in this branch.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end px-1">
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-2 px-3 py-1.5 bg-mint-50 text-mint-700 hover:bg-mint-100 rounded-lg text-xs font-bold transition-all border border-mint-200"
        >
          <Download className="w-3.5 h-3.5" />
          Export PDF
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500 font-black uppercase tracking-widest text-[9px]">
            <tr>
              <th className="px-4 py-3">Inv. Date</th>
              <th className="px-4 py-3">Invoice #</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {bills.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {formatDate(b.invoiceDate)}
                </td>
                <td className="px-4 py-3 font-bold text-gray-900 uppercase font-mono">
                  {b.invoiceNo || b.reference || "-"}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {formatDate(b.dueDate)}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {fmtRM(b.total)}
                </td>
                <td className="px-4 py-3 text-right font-black text-red-600">
                  {fmtRM(b.balance)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setSelectedBill(b)}
                    className="text-mint-600 hover:text-mint-700 font-bold text-xs"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2 border-gray-100">
            <tr>
              <td colSpan={4} className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-gray-400">
                Total Outstanding
              </td>
              <td className="px-4 py-3 text-right font-black text-red-600 text-base">
                {fmtRM(bills.reduce((sum, b) => sum + Number(b.balance ?? 0), 0))}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {selectedBill && (
        <ViewBillModal
          isOpen={!!selectedBill}
          onClose={() => setSelectedBill(null)}
          bill={selectedBill}
        />
      )}
    </div>
  );
}
