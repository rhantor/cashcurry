"use client";
import React, { useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download } from "lucide-react";
import { useGetVendorBillsQuery } from "@/lib/redux/api/vendorBillsApiSlice";
import { useGetVendorPaymentsQuery } from "@/lib/redux/api/vendorPaymentsApiSlice";
import PaymentDetailsModal from "@/app/components/purchases/PaymentDetailsModal";
import ViewBillModal from "@/app/purchases/due-bills/components/ViewBillModal";
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
      day: 'numeric'
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso) {
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

/** "YYYY-MM-DD..." -> "YYYY-MM" */
function monthOf(iso) {
  return typeof iso === "string" ? iso.slice(0, 7) : "";
}

/** Month key N months away from the current one. */
function monthKey(offset = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  if (!key) return "All time";
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

/** Latest payment date recorded on a bill. */
function lastPaidOf(bill) {
  const history = Array.isArray(bill?.paymentHistory) ? bill.paymentHistory : [];
  return history.reduce((latest, p) => {
    const d = p?.paymentDate || (p?.paidAtClient || "").slice(0, 10);
    return d > latest ? d : latest;
  }, "");
}

export default function VendorPaidBills({ companyId, branchId, vendorId }) {
  const currency = useCurrency();
  const [view, setView] = useState("bills"); // "bills" | "payments"
  const [month, setMonth] = useState(""); // "" = all time, else "YYYY-MM"
  const [basis, setBasis] = useState("invoice"); // "invoice" | "paid"
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);

  const ready = Boolean(companyId && branchId);

  const { data: paidBills = [], isLoading: loadingBills } = useGetVendorBillsQuery(
    { companyId, branchId, vendorId, status: "paid" },
    { skip: !ready }
  );

  const { data: payments = [], isLoading: loadingPayments } = useGetVendorPaymentsQuery(
    { companyId, branchId, vendorId },
    { skip: !ready || view !== "payments" }
  );

  const fmtRM = (v) =>
    `${currency} ${Number(v ?? 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const bills = useMemo(() => {
    const rows = paidBills.map((b) => ({ ...b, __lastPaid: lastPaidOf(b) }));
    if (!month) return rows;
    return rows.filter(
      (b) => monthOf(basis === "paid" ? b.__lastPaid : b.invoiceDate) === month
    );
  }, [paidBills, month, basis]);

  const visiblePayments = useMemo(() => {
    if (!month) return payments;
    return payments.filter((p) => monthOf(p.paymentDate || p.createdISO) === month);
  }, [payments, month]);

  const billsTotal = bills.reduce((sum, b) => sum + Number(b.total ?? 0), 0);
  const paymentsTotal = visiblePayments.reduce(
    (sum, p) => sum + Number(p.total ?? p.totalPaid ?? 0),
    0
  );

  const vendorName = paidBills[0]?.vendorName || payments[0]?.vendorName || "Vendor";
  const isLoading = view === "bills" ? loadingBills : loadingPayments;
  const rowCount = view === "bills" ? bills.length : visiblePayments.length;

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const onBills = view === "bills";

    doc.setFontSize(18);
    doc.text(onBills ? "Vendor Paid Bills" : "Vendor Payment History", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Vendor: ${vendorName}`, 14, 30);
    doc.text(
      `Period: ${monthLabel(month)}${
        onBills && month ? ` (by ${basis === "paid" ? "paid" : "invoice"} date)` : ""
      }`,
      14,
      35
    );
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40);

    if (onBills) {
      autoTable(doc, {
        startY: 48,
        head: [["Inv. Date", "Invoice #", "Last Paid", "Payments", "Total"]],
        body: bills.map((b) => [
          formatDate(b.invoiceDate),
          b.invoiceNo || b.reference || "-",
          formatDate(b.__lastPaid),
          String(b.paymentHistory?.length || 0),
          fmtRM(b.total),
        ]),
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] }, // mint-500
        columnStyles: { 3: { halign: 'center' }, 4: { halign: 'right' } },
      });
    } else {
      autoTable(doc, {
        startY: 48,
        head: [["Paid Date", "Method", "Reference", "Amount"]],
        body: visiblePayments.map((p) => [
          formatDate(p.paymentDate || p.createdISO),
          METHOD_LABELS[p.paidMethod] || p.paidMethod || "-",
          p.reference || "-",
          fmtRM(p.total ?? p.totalPaid),
        ]),
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] }, // mint-500
        columnStyles: { 3: { halign: 'right' } },
      });
    }

    const finalY = doc.lastAutoTable.finalY;
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(
      onBills
        ? `${bills.length} bill(s) — Total: ${fmtRM(billsTotal)}`
        : `${visiblePayments.length} payment(s) — Total Paid: ${fmtRM(paymentsTotal)}`,
      196,
      finalY + 10,
      { align: 'right' }
    );

    const label = onBills ? "Paid_Bills" : "Payment_History";
    doc.save(`${label}_${vendorName.replace(/\s+/g, "_")}_${month || "all-time"}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* View switch + period filters */}
      <div className="flex flex-wrap items-center gap-2 justify-between px-1">
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setView("bills")}
            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${
              view === "bills"
                ? "bg-mint-500 text-white"
                : "bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            Bills
          </button>
          <button
            onClick={() => setView("payments")}
            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all border-l border-gray-200 ${
              view === "payments"
                ? "bg-mint-500 text-white"
                : "bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            Payments
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setMonth(monthKey(-1))}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
              month === monthKey(-1)
                ? "bg-mint-50 text-mint-700 border-mint-200"
                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
            }`}
          >
            Last Month
          </button>
          <button
            onClick={() => setMonth(monthKey(0))}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
              month === monthKey(0)
                ? "bg-mint-50 text-mint-700 border-mint-200"
                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
            }`}
          >
            This Month
          </button>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-mint-200"
          />
          {month && (
            <button
              onClick={() => setMonth("")}
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
            >
              All Time
            </button>
          )}
          <button
            onClick={handleExportPDF}
            disabled={!rowCount}
            className="flex items-center gap-2 px-3 py-1.5 bg-mint-50 text-mint-700 hover:bg-mint-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-all border border-mint-200"
          >
            <Download className="w-3.5 h-3.5" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
        <div>
          <span className="block text-[9px] uppercase font-black tracking-widest text-gray-400">
            {view === "bills" ? "Bills" : "Payments"}
          </span>
          <span className="text-lg font-black text-gray-900 tabular-nums">{rowCount}</span>
        </div>
        <div className="h-8 w-px bg-gray-200" />
        <div>
          <span className="block text-[9px] uppercase font-black tracking-widest text-gray-400">
            {view === "bills" ? "Billed Amount" : "Paid Amount"}
          </span>
          <span className="text-lg font-black text-mint-600 tabular-nums">
            {fmtRM(view === "bills" ? billsTotal : paymentsTotal)}
          </span>
        </div>
        <div className="h-8 w-px bg-gray-200" />
        <div>
          <span className="block text-[9px] uppercase font-black tracking-widest text-gray-400">
            Period
          </span>
          <span className="text-sm font-bold text-gray-700">{monthLabel(month)}</span>
        </div>
        {view === "bills" && month && (
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[9px] uppercase font-black tracking-widest text-gray-400 mr-1">
              Match on
            </span>
            {["invoice", "paid"].map((b) => (
              <button
                key={b}
                onClick={() => setBasis(b)}
                className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                  basis === b
                    ? "bg-white text-mint-700 border border-mint-200"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {b === "invoice" ? "Invoice Date" : "Paid Date"}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-gray-500 animate-pulse">
          {view === "bills" ? "Loading paid bills..." : "Loading payment history..."}
        </div>
      ) : !rowCount ? (
        <div className="py-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium">
            {view === "bills"
              ? "No fully paid bills for this vendor."
              : "No payments found for this vendor."}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {month
              ? `Nothing recorded in ${monthLabel(month)}.`
              : "Records in this branch will appear here."}
          </p>
        </div>
      ) : view === "bills" ? (
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500 font-black uppercase tracking-widest text-[9px]">
              <tr>
                <th className="px-4 py-3">Inv. Date</th>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Last Paid</th>
                <th className="px-4 py-3 text-center">Payments</th>
                <th className="px-4 py-3 text-right">Total</th>
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
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {formatDate(b.__lastPaid)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600 font-bold tabular-nums">
                      {b.paymentHistory?.length || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-black text-gray-900">
                    {fmtRM(b.total)}
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
                  {bills.length} Paid Bill{bills.length === 1 ? "" : "s"}
                </td>
                <td className="px-4 py-3 text-right font-black text-mint-600 text-base">
                  {fmtRM(billsTotal)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500 font-black uppercase tracking-widest text-[9px]">
              <tr>
                <th className="px-4 py-3">Paid Date</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3 text-center">Bills</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {visiblePayments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">
                    {p.paymentDate ? formatDate(p.paymentDate) : formatDateTime(p.createdISO)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600 font-bold uppercase">
                      {METHOD_LABELS[p.paidMethod] || p.paidMethod || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 truncate max-w-[120px]">
                    {p.reference || "-"}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 tabular-nums">
                    {p.allocations?.length || 0}
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
                <td colSpan={4} className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-gray-400">
                  Total Payments
                </td>
                <td className="px-4 py-3 text-right font-black text-mint-600 text-base">
                  {fmtRM(paymentsTotal)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {selectedBill && (
        <ViewBillModal
          isOpen={!!selectedBill}
          onClose={() => setSelectedBill(null)}
          bill={selectedBill}
        />
      )}

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
