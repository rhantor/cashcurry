// Staff loan report exports: each loan, or the totals per staff member, to
// Excel or PDF. Same call shape as the other report exports:
// (rows, branchData, filterType, { from, to }).
import { format, isValid, parseISO } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "@/app/components/ui/notify";

const num = (v) => Number(v) || 0;
const day = (v) => {
  const d = typeof v === "string" ? parseISO(v) : v ? new Date(v) : null;
  return d && isValid(d) ? format(d, "dd/MM/yyyy") : "-";
};
const periodText = (range = {}) => (range.from && range.to ? `${day(range.from)} – ${day(range.to)}` : "All");
const fileName = (kind, range = {}, ext) => `staff-loans_${kind}_${range.from || "all"}_${range.to || ""}.${ext}`.replace(/_\./, ".");
const paidOf = (l) => num(l.totalPaid) || (l.status === "closed" ? num(l.amount) : 0);
const leftOf = (l) => (l.status === "closed" ? 0 : Math.max(0, num(l.amount) - paidOf(l)));

/* the two tables */
const LOAN_HEAD = ["Date", "Staff", "Amount", "Months", "Monthly", "Paid back", "Still owed", "Reason", "Entered by"];
const loanRow = (l) => [day(l.date), l.staffName || "-", num(l.amount), num(l.durationMonths) || 1, num(l.emi) || Math.ceil(num(l.amount) / Math.max(1, num(l.durationMonths) || 1)), paidOf(l), leftOf(l), l.reason || "-", l.createdBy?.username || "-"];
const loanFoot = (rows) => ["", "Total", rows.reduce((n, l) => n + num(l.amount), 0), "", "", rows.reduce((n, l) => n + paidOf(l), 0), rows.reduce((n, l) => n + leftOf(l), 0), "", ""];

const STAFF_HEAD = ["Staff", "Loans", "Borrowed", "Paid back", "Still owed", "Last loan"];
const staffRow = (s) => [s.staffName, s.count, num(s.totalAmount), num(s.totalPaid), num(s.owed), day(s.lastDate)];
const staffFoot = (rows) => ["Total", rows.reduce((n, s) => n + s.count, 0), rows.reduce((n, s) => n + num(s.totalAmount), 0), rows.reduce((n, s) => n + num(s.totalPaid), 0), rows.reduce((n, s) => n + num(s.owed), 0), ""];

const MONEY_COLS = { loans: [2, 4, 5, 6], staff: [2, 3, 4] };

function toExcel(kind, rows, branchData, range) {
  try {
    if (!rows?.length) return toast.warning("Nothing to export");
    const [head, row, foot] = kind === "loans" ? [LOAN_HEAD, loanRow, loanFoot] : [STAFF_HEAD, staffRow, staffFoot];
    const aoa = [
      [`Staff loans${kind === "staff" ? " by staff" : ""} — ${branchData?.name || "Branch"}`],
      [`Period: ${periodText(range)}`],
      [],
      head,
      ...rows.map(row),
      foot(rows),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = head.map((h) => ({ wch: h === "Reason" ? 28 : 14 }));
    for (let r = 4; r < aoa.length; r++)
      for (const c of MONEY_COLS[kind]) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (ws[ref] && typeof ws[ref].v === "number") ws[ref].z = "#,##0.00";
      }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Staff loans");
    XLSX.writeFile(wb, fileName(kind, range, "xlsx"));
  } catch (err) {
    console.error("Export failed:", err);
    toast.error("Failed to export. Please try again.");
  }
}

function toPDF(kind, rows, branchData, range) {
  try {
    if (!rows?.length) return toast.warning("Nothing to export");
    const [head, row, foot] = kind === "loans" ? [LOAN_HEAD, loanRow, loanFoot] : [STAFF_HEAD, staffRow, staffFoot];
    const money = (v) => (typeof v === "number" ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v);
    const fmt = (r) => r.map((v, i) => (MONEY_COLS[kind].includes(i) ? money(v) : v));
    const doc = new jsPDF(kind === "loans" ? "landscape" : "portrait");
    doc.setFontSize(15);
    doc.text(`Staff loans${kind === "staff" ? " by staff" : ""}`, 14, 18);
    doc.setFontSize(10);
    doc.text(`Branch: ${branchData?.name || "-"}`, 14, 25);
    doc.text(`Period: ${periodText(range)}`, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 35);
    autoTable(doc, {
      startY: 41,
      head: [head],
      body: rows.map((r) => fmt(row(r))),
      foot: [fmt(foot(rows))],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [11, 77, 64] },
      footStyles: { fillColor: [45, 45, 45], textColor: 255, fontStyle: "bold" },
      columnStyles: Object.fromEntries(MONEY_COLS[kind].map((c) => [c, { halign: "right" }])),
    });
    doc.save(fileName(kind, range, "pdf"));
  } catch (err) {
    console.error("Export failed:", err);
    toast.error("Failed to export. Please try again.");
  }
}

export const exportStaffLoansToExcel = (rows, branchData, _type, range) => toExcel("loans", rows, branchData, range);
export const exportStaffLoansToPDF = (rows, branchData, _type, range) => toPDF("loans", rows, branchData, range);
export const exportStaffLoanTotalsToExcel = (rows, branchData, _type, range) => toExcel("staff", rows, branchData, range);
export const exportStaffLoanTotalsToPDF = (rows, branchData, _type, range) => toPDF("staff", rows, branchData, range);
