// The vendor list as Excel (contacts only, or with the money) and as a PDF.
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney } from "@/lib/region/currency";

export function exportVendorsExcel(vendors, mode) {
  const rows = vendors.map((v) => {
    const base = {
      "Vendor Name": v.name || "",
      "Vendor Code": v.code || "",
      "Incharge / Owner": v.ownerName || "",
      Phone: v.phone || "",
      "Primary Email": v.email || "",
      "Enquiries Email": v.enquiriesEmail || "",
      Website: v.website || "",
      Address: v.address || "",
      "Reg. Number": v.registrationNumber || "",
      "Tax Number": v.taxNumber || "",
      "Bank Name": v.bankName || "",
      "Bank Account": v.bankAccountNumber || "",
    };
    if (mode !== "full") return base;
    return {
      ...base,
      "Payment Terms (Days)": v.termsDays || 0,
      "Max Credit Bills": v.maxOpenBills || 0,
      "Total Billed": Number(v.totalBilled || 0),
      "Total Paid": Number(v.totalPaid || 0),
      "AP Balance": Number(v.currentBalance || 0),
      "Last Payment": v.lastPaymentDate ? new Date(v.lastPaymentDate).toLocaleDateString() : "Never",
    };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Vendors");
  XLSX.writeFile(wb, mode === "full" ? "Vendors_Full_Financials.xlsx" : "Vendors_Directory.xlsx");
}

export function exportVendorsPDF(vendors, currency) {
  const money = (v) => formatMoney(Number(v || 0), currency, { plain: true }); // PDF fonts have no ৳ or ₹
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.text("Vendor Financial Directory", 14, 22);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
  autoTable(doc, {
    startY: 40,
    head: [["#", "Vendor Name", "Code", "Phone", "Total Billed", "AP Balance"]],
    body: vendors.map((v, i) => [i + 1, v.name || "-", v.code || "-", v.phone || "-", money(v.totalBilled), money(v.currentBalance)]),
    theme: "striped",
    headStyles: { fillColor: [16, 185, 129] },
    columnStyles: { 4: { halign: "right" }, 5: { halign: "right" } },
  });
  doc.save(`Vendor_Directory_${Date.now()}.pdf`);
}
