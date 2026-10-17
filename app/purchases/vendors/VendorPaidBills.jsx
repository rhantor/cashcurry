"use client";
import React, { useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, ReceiptText, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/region/currency";
import { Button, Select, Tabs } from "@/app/components/ui";
import { Chip } from "@/app/components/entry/Choices";
import { ListHead, Row, RowList, niceDate } from "./parts";
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
  bank_transfer: "Bank transfer",
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

  const fmtRM = (v) => formatMoney(Number(v ?? 0), currency);
  const pdfRM = (v) => formatMoney(Number(v ?? 0), currency, { plain: true }); // PDF fonts have no ৳ or ₹

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
          pdfRM(b.total),
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
          pdfRM(p.total ?? p.totalPaid),
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
        ? `${bills.length} bill(s) — Total: ${pdfRM(billsTotal)}`
        : `${visiblePayments.length} payment(s) — Total Paid: ${pdfRM(paymentsTotal)}`,
      196,
      finalY + 10,
      { align: 'right' }
    );

    const label = onBills ? "Paid_Bills" : "Payment_History";
    doc.save(`${label}_${vendorName.replace(/\s+/g, "_")}_${month || "all-time"}.pdf`);
  };

  // the last twelve months to pick from
  const months = Array.from({ length: 12 }, (_, i) => monthKey(-i));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          size="sm"
          value={view}
          onChange={setView}
          tabs={[
            { value: "bills", label: "Paid bills", icon: ReceiptText },
            { value: "payments", label: "Payments", icon: Wallet },
          ]}
        />
        <Select className="h-9 w-auto text-xs" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
          <option value="">All time</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </Select>
      </div>

      {view === "bills" && month && (
        <div className="flex items-center gap-1.5 text-xs text-muted">
          Month of the
          <Chip on={basis === "invoice"} onClick={() => setBasis("invoice")}>
            invoice
          </Chip>
          <Chip on={basis === "paid"} onClick={() => setBasis("paid")}>
            payment
          </Chip>
        </div>
      )}

      {rowCount > 0 && (
        <ListHead label={view === "bills" ? `${rowCount} paid bill${rowCount === 1 ? "" : "s"} ·` : `${rowCount} payment${rowCount === 1 ? "" : "s"} ·`} value={fmtRM(view === "bills" ? billsTotal : paymentsTotal)}>
          <Button size="sm" variant="secondary" icon={Download} onClick={handleExportPDF}>
            PDF
          </Button>
        </ListHead>
      )}

      {view === "bills" ? (
        <RowList
          loading={isLoading}
          rows={bills}
          empty={{ icon: ReceiptText, title: "No paid bills", description: month ? `Nothing in ${monthLabel(month)}.` : "Bills show here once they're fully paid." }}
        >
          {bills.map((b) => (
            <Row
              key={b.id}
              title={b.invoiceNo || b.reference || "No invoice no."}
              sub={`Dated ${niceDate(b.invoiceDate)} · paid ${niceDate(b.__lastPaid)}${b.paymentHistory?.length > 1 ? ` in ${b.paymentHistory.length} payments` : ""}`}
              amount={fmtRM(b.total)}
              onClick={() => setSelectedBill(b)}
            />
          ))}
        </RowList>
      ) : (
        <RowList
          loading={isLoading}
          rows={visiblePayments}
          empty={{ icon: Wallet, title: "No payments", description: month ? `Nothing in ${monthLabel(month)}.` : "Payments to this vendor show here." }}
        >
          {visiblePayments.map((p) => (
            <Row
              key={p.id}
              title={niceDate(p.paymentDate || p.createdISO)}
              sub={[METHOD_LABELS[p.paidMethod] || p.paidMethod, p.reference, `${p.allocations?.length || 0} bill${p.allocations?.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
              amount={fmtRM(p.total ?? p.totalPaid)}
              onClick={() => setSelectedPayment(p)}
            />
          ))}
        </RowList>
      )}

      {selectedBill && <ViewBillModal isOpen={!!selectedBill} onClose={() => setSelectedBill(null)} bill={selectedBill} />}
      {selectedPayment && (
        <PaymentDetailsModal open={!!selectedPayment} onClose={() => setSelectedPayment(null)} payment={selectedPayment} companyId={companyId} branchId={branchId} />
      )}
    </div>
  );
}
