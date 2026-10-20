// exportAdvanceData: the pdf part (moved from exportAdvanceData.js unchanged).
 
import { format, parseISO } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { toast } from "@/app/components/ui/notify";

import { personName } from "@/lib/people";
/* ==========================================================
   Helpers
========================================================== */
import { buildFilterMeta, calcStaffTotalsFromEntries, filterEntriesByMeta, getCreatedAtText } from "./helpers";

export const exportAdvanceToPDF = (advance, branchData) => {
  try {
    if (!advance) return toast.warning('No advance data!')

    const branchName = branchData?.name || 'N/A'
    const doc = new jsPDF()

    // Title
    doc.setFontSize(16)
    doc.text('Advance Report', 14, 20)

    // Date
    doc.setFontSize(12)
    try {
      doc.text(format(parseISO(advance.date), 'dd/MM/yyyy'), 150, 20)
    } catch {
      doc.text(String(advance.date || '-'), 150, 20)
    }

    // Branch & Created Time
    const createdTime = getCreatedAtText(advance)
    doc.setFontSize(11)
    doc.text(`Branch: ${branchName}`, 14, 28)
    doc.text(`Created At: ${createdTime}`, 120, 28)

    // Table
    const tableData = [
      ['Staff', advance.staffName || 'N/A', '-'],
      [
        'Amount',
        (Number(advance.amount) || 0).toFixed(2),
        `Reason: ${advance.reason || '-'}`
      ],
      ['Status', advance.status || 'Pending', '-'],
      [
        'Added By',
        personName(advance.createdBy) || 'Unknown',
        advance.createdBy?.role || '-'
      ],
      [
        'Approved By',
        advance.approvedBy?.name || '—',
        advance.approvedBy?.role || '-'
      ]
    ]

    autoTable(doc, {
      startY: 36,
      head: [['Field', 'Value', 'Extra']],
      body: tableData
    })

    // Footer
    const pageHeight = doc.internal.pageSize.height
    doc.setFontSize(10)
    doc.text(
      `User Email: ${advance.createdBy?.email || '-'}`,
      14,
      pageHeight - 10
    )

    const name = (advance.staffName || 'staff').replace(/\s+/g, '_')
    const date = advance.date || 'unknown-date'
    doc.save(`advance_${name}_${date}.pdf`)
  } catch (err) {
    console.error("Export failed:", err);
    toast.error("Failed to export. Please try again.");
  }
}

/* ==========================================================
   3) List (Filtered) -> Excel
   ✅ Added: Grand Total row at the bottom
========================================================== */

export const exportAdvancesToPDF = (
  advances,
  branchData,
  filterType,
  dateRange = {},
  selectedMonth = ''
) => {
  try {
    if (!advances?.length) return toast.warning('No advance data to export!')

    const branchName = branchData?.name || 'N/A'
    const doc = new jsPDF('landscape')
    const { filterText, fileFilterName } = buildFilterMeta(
      filterType,
      dateRange,
      selectedMonth
    )

    // ✅ Calculate grand total
    const grandTotal = advances.reduce(
      (sum, a) => sum + (Number(a.amount) || 0),
      0
    )

    // Header
    doc.setFontSize(16)
    doc.text('Advance Report', 14, 20)
    doc.setFontSize(11)
    doc.text(`Branch: ${branchName}`, 14, 28)
    doc.text(`Filter: ${filterText}`, 14, 34)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40)

    const tableData = advances.map(a => [
      a.date ? format(new Date(a.date), 'dd/MM/yyyy') : '—',
      a.staffName || 'N/A',
      (Number(a.amount) || 0).toFixed(2),
      a.reason || '-',
      a.status || 'Pending',
      personName(a.createdBy) || 'Unknown',
      a.createdBy?.email || '-',
      a.createdBy?.role || '-',
      a.approvedBy?.name || '—',
      a.approvedBy?.role || '-',
      getCreatedAtText(a)
    ])

    autoTable(doc, {
      startY: 50,
      head: [
        [
          'Date',
          'Staff Name',
          'Amount',
          'Reason',
          'Status',
          'Created By',
          'Email',
          'Role',
          'Approved By',
          'Approved Role',
          'Created At'
        ]
      ],
      body: tableData,
      // ✅ foot renders a sticky grand total row at the bottom
      foot: [
        ['', 'GRAND TOTAL', grandTotal.toFixed(2), '', '', '', '', '', '', '', '']
      ],
      styles: { fontSize: 8 },
      footStyles: {
        fillColor: [45, 45, 45],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8
      }
    })

    doc.save(`advance-report_${fileFilterName}.pdf`)
  } catch (err) {
    console.error("Export failed:", err);
    toast.error("Failed to export. Please try again.");
  }
}

/* ==========================================================
   5) Staff Summary (Grouped) -> Excel
   ✅ Added: Grand Total row at the bottom
   staffSummary = [{ staffName,totalAmount,count,lastDate,entries:[...] }]
========================================================== */

export const exportAdvanceStaffSummaryToPDF = (
  staffSummary,
  branchData,
  filterType,
  dateRange = {},
  selectedMonth = ''
) => {
  try {
    if (!staffSummary?.length) return toast.warning('No staff summary data to export!')

    const branchName = branchData?.name || 'N/A'
    const doc = new jsPDF('landscape')
    const { filterText, fileFilterName } = buildFilterMeta(
      filterType,
      dateRange,
      selectedMonth
    )

    // ✅ Grand totals
    const grandTotal = staffSummary.reduce(
      (sum, s) => sum + Number(s.totalAmount || s.total || 0),
      0
    )
    const grandCount = staffSummary.reduce(
      (sum, s) => sum + Number(s.count || 0),
      0
    )
    const grandAvg = grandCount ? grandTotal / grandCount : 0

    doc.setFontSize(16)
    doc.text('Advance Report – Staff Summary', 14, 20)
    doc.setFontSize(11)
    doc.text(`Branch: ${branchName}`, 14, 28)
    doc.text(`Filter: ${filterText}`, 14, 34)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40)

    const body = staffSummary.map((s, idx) => {
      const total = Number(s.totalAmount || s.total || 0)
      const count = Number(s.count || 0)
      const avg = count ? total / count : 0
      const lastDate = s.lastDate
        ? format(new Date(s.lastDate), 'dd/MM/yyyy')
        : '—'
      return [
        idx + 1,
        s.staffName || 'N/A',
        count,
        total.toFixed(2),
        avg.toFixed(2),
        lastDate
      ]
    })

    autoTable(doc, {
      startY: 50,
      head: [
        ['#', 'Staff Name', 'Times', 'Total (RM)', 'Avg/Entry', 'Last Date']
      ],
      body,
      foot: [
        [
          '',
          'GRAND TOTAL',
          grandCount,
          grandTotal.toFixed(2),
          grandAvg.toFixed(2),
          '—'
        ]
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [255, 165, 0] },
      footStyles: {
        fillColor: [45, 45, 45],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      }
    })

    doc.save(`advance-staff-summary_${fileFilterName}.pdf`)
  } catch (err) {
    console.error("Export failed:", err);
    toast.error("Failed to export. Please try again.");
  }
}

/* ==========================================================
   7) Single Staff Detail (Bulk entries) -> PDF
   Use inside StaffSummaryModal
========================================================== */

export const exportAdvanceStaffDetailToPDF = (staff, branchData) => {
  try {
    if (!staff) return toast.warning('No staff data to export!')

    const branchName = branchData?.name || 'N/A'
    const doc = new jsPDF('portrait')
    const staffName = staff.staffName || 'N/A'
    const total = Number(staff.totalAmount || staff.total || 0)
    const count = Number(staff.count || 0)
    const avg = count ? total / count : 0

    doc.setFontSize(16)
    doc.text('Advance Report – Staff Detail (Bulk)', 14, 18)
    doc.setFontSize(11)
    doc.text(`Branch: ${branchName}`, 14, 26)
    doc.text(`Staff: ${staffName}`, 14, 32)
    doc.text(`Total: RM ${total.toFixed(2)}`, 14, 38)
    doc.text(`Times: ${count}`, 14, 44)
    doc.text(`Avg/Entry: RM ${avg.toFixed(2)}`, 14, 50)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 56)

    const entries = Array.isArray(staff.entries) ? staff.entries : []

    const body = entries.map((a, idx) => [
      idx + 1,
      a.date ? format(new Date(a.date), 'dd/MM/yyyy') : '—',
      (Number(a.amount) || 0).toFixed(2),
      a.reason || '-',
      a.status || '-',
      personName(a.createdBy) || 'Unknown'
    ])

    autoTable(doc, {
      startY: 64,
      head: [['#', 'Date', 'Amount (RM)', 'Reason', 'Status', 'Created By']],
      body,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [255, 165, 0] },
      margin: { left: 14, right: 14 }
    })

    doc.save(`advance_staff_${staffName.replace(/\s+/g, '_')}.pdf`)
  } catch (err) {
    console.error("Export failed:", err);
    toast.error("Failed to export. Please try again.");
  }
}

/* ==========================================================
   8) Single Staff Detail (Bulk entries) -> Excel
========================================================== */

export const exportAdvanceAllStaffToPDF = (
  staffSummary,
  branchData,
  filterType,
  dateRange = {},
  selectedMonth = ''
) => {
  try {
  if (!staffSummary?.length) return toast.warning('No staff data to export!')

  const branchName = branchData?.name || 'N/A'
  const { filterText, fileFilterName } = buildFilterMeta(
    filterType,
    dateRange,
    selectedMonth
  )

  // ✅ Rebuild staff list based on filtered entries
  const filteredStaff = staffSummary
    .map(s => {
      const all = Array.isArray(s.entries) ? s.entries : []
      const entries = filterEntriesByMeta(
        all,
        filterType,
        dateRange,
        selectedMonth
      )
      const { total, count, lastDate } = calcStaffTotalsFromEntries(entries)
      return {
        staffName: s.staffName || 'N/A',
        entries,
        totalAmount: total,
        count,
        lastDate
      }
    })
    .filter(s => s.count > 0)
    .sort((a, b) => b.totalAmount - a.totalAmount)

  if (!filteredStaff.length) return toast.warning('No data for this filter!')

  // ✅ Grand totals
  const grandTotal = filteredStaff.reduce((sum, s) => sum + s.totalAmount, 0)
  const grandCount = filteredStaff.reduce((sum, s) => sum + s.count, 0)
  const grandAvg = grandCount ? grandTotal / grandCount : 0

  const doc = new jsPDF('portrait')
  let cursorY = 18

  doc.setFontSize(16)
  doc.text('Advance Report – All Staff (Filtered)', 14, cursorY)
  cursorY += 8

  doc.setFontSize(11)
  doc.text(`Branch: ${branchName}`, 14, cursorY)
  cursorY += 6
  doc.text(`Filter: ${filterText}`, 14, cursorY)
  cursorY += 6
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, cursorY)
  cursorY += 8

  // Summary table (filtered totals)
  const summaryBody = filteredStaff.map((s, i) => {
    const avg = s.count ? s.totalAmount / s.count : 0
    const lastDate = s.lastDate
      ? format(new Date(s.lastDate), 'dd/MM/yyyy')
      : '—'
    return [
      i + 1,
      s.staffName,
      s.count,
      s.totalAmount.toFixed(2),
      avg.toFixed(2),
      lastDate
    ]
  })

  autoTable(doc, {
    startY: cursorY,
    head: [
      ['#', 'Staff Name', 'Times', 'Total (RM)', 'Avg/Entry', 'Last Date']
    ],
    body: summaryBody,
    // ✅ Grand total foot row
    foot: [
      [
        '',
        'GRAND TOTAL',
        grandCount,
        grandTotal.toFixed(2),
        grandAvg.toFixed(2),
        '—'
      ]
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [255, 165, 0] },
    footStyles: {
      fillColor: [45, 45, 45],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9
    },
    margin: { left: 14, right: 14 }
  })

  // ✅ Fresh page — details section always starts on a new page
  doc.addPage()
  let yAfter = 18

  // Section heading on the new page
  doc.setFontSize(14)
  doc.text('Staff Details', 14, yAfter)
  yAfter += 8

  // Details for each staff — flow continuously, no per-staff page break
  filteredStaff.forEach((s, idx) => {
    // Only add spacing between staff blocks (not before the first one)
    if (idx > 0) {
      yAfter += 8
    }

    // If not enough room for heading + at least a small table, let jsPDF auto-page handle it
    // We only manually break if the heading itself won't fit
    if (yAfter > 255) {
      doc.addPage()
      yAfter = 18
    }

    doc.setFontSize(13)
    doc.text(`${idx + 1}. ${s.staffName}`, 14, yAfter)
    yAfter += 6

    doc.setFontSize(10)
    doc.text(
      `Total: RM ${s.totalAmount.toFixed(2)} | Times: ${s.count}`,
      14,
      yAfter
    )
    yAfter += 6

    const body = s.entries.map((a, i) => [
      i + 1,
      a.date ? format(new Date(a.date), 'dd/MM/yyyy') : '—',
      (Number(a.amount) || 0).toFixed(2),
      a.reason || '-',
      a.status || '-',
      personName(a.createdBy) || 'Unknown'
    ])

    autoTable(doc, {
      startY: yAfter,
      head: [['#', 'Date', 'Amount (RM)', 'Reason', 'Status', 'Created By']],
      body,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [240, 240, 240], textColor: 20 },
      margin: { left: 14, right: 14 }
    })

    // autoTable handles its own page breaks internally;
    // pick up wherever it ended
    yAfter = doc.lastAutoTable?.finalY || yAfter + 10
  })

  doc.save(`advance_all_staff_${fileFilterName}.pdf`)
  } catch (err) {
    console.error("Export failed:", err);
    toast.error("Failed to export. Please try again.");
  }
}

/* ==========================================================
   10) ALL STAFF -> Excel (SUMMARY + one sheet per staff)
   ✅ FILTER-AWARE
   ✅ Grand Total row added to SUMMARY sheet
========================================================== */
