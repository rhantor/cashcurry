// Advance report, "By salary month": PDF and Excel. report: salaryMonthReport(...)
import { format, parseISO } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "@/app/components/ui/notify";

const day = (d) => (d ? format(parseISO(d), "dd/MM/yyyy") : "-");
const money = (n) => (Number(n) || 0).toFixed(2);
const fileName = (branch, month) => `Advances-${month.replace(/\s+/g, "-")}-salary-${(branch?.name || "branch").trim().replace(/[^\w]+/g, "-")}`;

const table = (report) =>
  report.staff.flatMap((s) => [
    ...s.rows.map((r) => [r.staffName, day(r.date), r.reason || "-", r.taken ? "Taken" : "To take", money(r.amount)]),
    [`${s.staffName}: total`, "", "", "", money(s.amount)],
  ]);

export function exportSalaryMonthToPDF(report, branchData, month) {
  try {
    if (!report?.rows?.length) return toast.warning("No advances to export");
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Advances from ${month} salary`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Branch: ${branchData?.name || "N/A"}`, 14, 28);
    doc.text(`Total ${money(report.total)}  |  Taken ${money(report.taken)}  |  Still to take ${money(report.toTake)}  |  Given after the month ended ${money(report.givenLater)}`, 14, 34);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40);
    autoTable(doc, {
      startY: 46,
      head: [["Staff", "Given on", "Reason", "Status", "Amount"]],
      body: table(report),
      foot: [["Total", "", "", "", money(report.total)]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [11, 77, 64] },
      footStyles: { fillColor: [226, 240, 235], textColor: 20, fontStyle: "bold" },
      columnStyles: { 4: { halign: "right" } },
      didParseCell: (c) => {
        if (c.section === "body" && String(c.row.raw[0]).endsWith(": total")) c.cell.styles.fontStyle = "bold";
      },
    });
    doc.save(`${fileName(branchData, month)}.pdf`);
  } catch (e) {
    console.error(e);
    toast.error("Couldn't make the PDF");
  }
}

export function exportSalaryMonthToExcel(report, branchData, month) {
  try {
    if (!report?.rows?.length) return toast.warning("No advances to export");
    const sheet = XLSX.utils.aoa_to_sheet([
      [`Advances from ${month} salary`],
      [`Branch: ${branchData?.name || "N/A"}`],
      [],
      ["Total", report.total],
      ["Taken", report.taken],
      ["Still to take", report.toTake],
      ["Given after the month ended", report.givenLater],
      [],
      ["Staff", "Given on", "Reason", "Status", "Amount"],
      ...table(report).map((r) => [...r.slice(0, 4), Number(r[4])]),
      ["Total", "", "", "", report.total],
    ]);
    sheet["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 34 }, { wch: 10 }, { wch: 12 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Salary month");
    XLSX.writeFile(book, `${fileName(branchData, month)}.xlsx`);
  } catch (e) {
    console.error(e);
    toast.error("Couldn't make the Excel file");
  }
}
