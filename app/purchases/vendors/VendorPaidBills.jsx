"use client";
import React, { useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download } from "lucide-react";
import { useGetVendorPaymentsQuery } from "@/lib/redux/api/vendorPaymentsApiSlice";
import PaymentDetailsModal from "@/app/components/purchases/PaymentDetailsModal";
import useCurrency from "@/app/hooks/useCurrency";

const METHOD_LABELS = {
  cash: "Cash",
  card: "Card",
  qr: "QR",
  online: "Online",
  bank_transfer: "Bank Transfer",
};

function formatDate(iso) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

export default function VendorPaidBills({ companyId, branchId, vendorId }) {
  const currency = useCurrency();
  const [selectedPayment, setSelectedPayment] = useState(null);

  const { data: payments = [], isLoading } = useGetVendorPaymentsQuery(
    companyId && branchId ? { companyId, branchId, vendorId } : null
  );

  const fmtRM = (v) =>
    `${currency} ${Number(v ?? 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.total ?? p.totalPaid ?? 0), 0);

  const handleExportPDF = () => {
    if (!payments.length) return;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Vendor Payment History", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Vendor: ${payments[0].vendorName || "N/A"}`, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 35);
    
    const tableData = payments.map(p => [
      formatDate(p.createdISO),
      p.paidMethod || "-",
      p.reference || "-",
      fmtRM(p.total ?? p.totalPaid)
    ]);
    
    autoTable(doc, {
      startY: 45,
      head: [["Paid Date", "Method", "Reference", "Amount"]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }, // mint-500
    });
    
    const finalY = doc.lastAutoTable.finalY;
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Total Paid: ${fmtRM(totalPaid)}`, 196, finalY + 10, { align: 'right' });
    
    doc.save(`Payment_History_${payments[0].vendorName?.replace(/\s+/g, '_') || 'Vendor'}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center text-gray-500 animate-pulse">
        Loading payment history...
      </div>
    );
  }

  if (!payments.length) {
    return (
      <div className="py-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-gray-500 font-medium">No payments found for this vendor.</p>
        <p className="text-xs text-gray-400 mt-1">Payments recorded in this branch will appear here.</p>
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
              <th className="px-4 py-3">Paid Date</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">
                  {formatDate(p.createdISO)}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600 font-bold uppercase">
                    {METHOD_LABELS[p.paidMethod] || p.paidMethod || "-"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 truncate max-w-[120px]">
                  {p.reference || "-"}
                </td>
                <td className="px-4 py-3 text-right font-black text-gray-900">
                  {fmtRM(p.total ?? p.totalPaid)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setSelectedPayment(p)}
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
              <td colSpan={3} className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-gray-400">
                Total Payments
              </td>
              <td className="px-4 py-3 text-right font-black text-mint-600 text-base">
                {fmtRM(payments.reduce((sum, p) => sum + Number(p.total ?? p.totalPaid ?? 0), 0))}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {selectedPayment && (
        <PaymentDetailsModal
          open={!!selectedPayment}
          onClose={() => setSelectedPayment(null)}
          payment={selectedPayment}
          companyId={companyId}
          branchId={branchId}
        />
      )}
    </div>
  );
}
