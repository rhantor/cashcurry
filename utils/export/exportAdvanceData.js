/* eslint-disable no-useless-escape */
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  isWithinInterval
} from 'date-fns'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/* ==========================================================
   Helpers
========================================================== */

// Excel sheet name max 31 chars + cannot contain: \ / ? * [ ]
const safeSheetName = (name = 'Staff') => {
  return String(name || 'Staff')
    .replace(/[\\\/\?\*\[\]]/g, '')
    .slice(0, 31)
}

const getCreatedAtText = advance => {
  // Firestore timestamp object: { seconds, nanoseconds }
  if (advance?.createdAt?.seconds) {
    return new Date(advance.createdAt.seconds * 1000).toLocaleString()
  }
  // If you sometimes store ISO string
  if (typeof advance?.createdAt === 'string') {
    const d = new Date(advance.createdAt)
    if (!Number.isNaN(d.getTime())) return d.toLocaleString()
  }
  return 'Unknown'
}

const buildFilterMeta = (filterType, dateRange = {}, selectedMonth = '') => {
  let filterText = 'All Data'
  let fileFilterName = 'all'

  switch (filterType) {
    case 'weekly':
      filterText = 'This Week'
      fileFilterName = 'this_week'
      break
    case 'monthly':
      filterText = 'This Month'
      fileFilterName = 'this_month'
      break
    case 'last7days':
      filterText = 'Last 7 Days'
      fileFilterName = 'last_7_days'
      break
    case 'range':
      if (dateRange.from && dateRange.to) {
        const start = format(new Date(dateRange.from), 'dd/MM/yyyy')
        const end = format(new Date(dateRange.to), 'dd/MM/yyyy')
        filterText = `${start} - ${end}`
        fileFilterName = `${start.replace(/\//g, '-')}_to_${end.replace(
          /\//g,
          '-'
        )}`
      }
      break
    case 'month':
      if (selectedMonth) {
        const [year, month] = selectedMonth.split('-')
        const monthName = format(new Date(year, month - 1), 'MMMM yyyy')
        filterText = monthName
        fileFilterName = monthName.replace(/\s+/g, '_').toLowerCase()
      }
      break
  }

  return { filterText, fileFilterName }
}

/**
 * IMPORTANT FIX:
 * Staff view export must respect filters by filtering the staff.entries array,
 * then recalculating totals/count/lastDate from the filtered entries.
 */
const filterEntriesByMeta = (
  rows = [],
  filterType,
  dateRange = {},
  selectedMonth = ''
) => {
  const today = new Date()
  if (!filterType || filterType === 'all') return rows

  const inRange = d => {
    if (!d) return false
    const date = new Date(d)
    if (Number.isNaN(date.getTime())) return false

    if (filterType === 'weekly') {
      return isWithinInterval(date, {
        start: startOfWeek(today),
        end: endOfWeek(today)
      })
    }
    if (filterType === 'monthly') {
      return isWithinInterval(date, {
        start: startOfMonth(today),
        end: endOfMonth(today)
      })
    }
    if (filterType === 'last7days') {
      return isWithinInterval(date, {
        start: subDays(today, 7),
        end: today
      })
    }
    if (filterType === 'range' && dateRange?.from && dateRange?.to) {
      return isWithinInterval(date, {
        start: new Date(dateRange.from),
        end: new Date(dateRange.to)
      })
    }
    if (filterType === 'month' && selectedMonth) {
      const [y, m] = selectedMonth.split('-')
      return (
        date.getFullYear() === Number(y) && date.getMonth() + 1 === Number(m)
      )
    }
    return true
  }

  return rows.filter(r => inRange(r?.date))
}

const calcStaffTotalsFromEntries = (entries = []) => {
  const total = entries.reduce((sum, r) => sum + (Number(r?.amount) || 0), 0)
  const count = entries.length
  let lastDate = null
  for (const r of entries) {
    const d = r?.date ? new Date(r.date) : null
    if (d && !Number.isNaN(d.getTime())) {
      if (!lastDate || d > lastDate) lastDate = d
    }
  }
  return { total, count, lastDate }
}

/* ==========================================================
   1) Single Advance -> Excel
========================================================== */
export const exportAdvanceToExcel = (advance, branchData) => {
  try {
    if (!advance) return alert('No advance data!')

    const branchName = branchData?.name || 'N/A'
    const createdTime = getCreatedAtText(advance)

    const data = [
      ['Branch', branchName, 'Created At', createdTime],
      ['Date', advance.date || '-'],
      ['Staff', advance.staffName || 'N/A'],
      [
        'Amount',
        (Number(advance.amount) || 0).toFixed(2),
        'Reason',
        advance.reason || '-'
      ],
      ['Status', advance.status || 'Pending'],
      [
        'Added By',
        advance.createdBy?.username || 'Unknown',
        'Role',
        advance.createdBy?.role || '-'
      ],
      [
        'Approved By',
        advance.approvedBy?.name || '—',
        'Role',
        advance.approvedBy?.role || '-'
      ]
    ]

    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 40 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Advance Details')

    const name = (advance.staffName || 'staff').replace(/\s+/g, '_')
    const date = advance.date || 'unknown-date'
    XLSX.writeFile(wb, `advance_${name}_${date}.xlsx`)
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
}

/* ==========================================================
   2) Single Advance -> PDF
========================================================== */
export const exportAdvanceToPDF = (advance, branchData) => {
  try {
    if (!advance) return alert('No advance data!')

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
        advance.createdBy?.username || 'Unknown',
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
    alert("Failed to export. Please try again.");
  }
}

/* ==========================================================
   3) List (Filtered) -> Excel
   ✅ Added: Grand Total row at the bottom
========================================================== */
export const exportAdvancesToExcel = (
  advances,
  branchData,
  filterType,
  dateRange = {},
  selectedMonth = ''
) => {
  try {
    if (!advances?.length) return alert('No advance data to export!')

    const branchName = branchData?.name || 'N/A'
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

    const data = advances.map(a => [
      a.date ? format(new Date(a.date), 'dd/MM/yyyy') : '—',
      a.staffName || 'N/A',
      (Number(a.amount) || 0).toFixed(2),
      a.reason || '-',
      a.status || 'Pending',
      a.createdBy?.username || 'Unknown',
      a.createdBy?.email || '-',
      a.createdBy?.role || '-',
      a.approvedBy?.name || '—',
      a.approvedBy?.role || '-',
      getCreatedAtText(a)
    ])

    // ✅ Grand Total row: label in col B, amount in col C, rest empty
    const totalRow = [
      '',
      'GRAND TOTAL',
      grandTotal.toFixed(2),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ]

    const ws = XLSX.utils.aoa_to_sheet([
      ['Advance Report'],
      ['Branch:', branchName],
      ['Filter:', filterText],
      ['Generated:', new Date().toLocaleString()],
      [],
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
      ],
      ...data,
      [], // blank spacer row
      totalRow
    ])

    ws['!cols'] = [
      { wch: 12 },
      { wch: 20 },
      { wch: 12 },
      { wch: 25 },
      { wch: 12 },
      { wch: 18 },
      { wch: 24 },
      { wch: 14 },
      { wch: 18 },
      { wch: 14 },
      { wch: 22 }
    ]

    // ✅ Bold the GRAND TOTAL row
    // Header row is row index 6 (0-based), data rows follow, blank = 6+1+data.length, total = 6+2+data.length
    const totalRowIndex = 6 + data.length + 2 // +1 header +1 blank spacer
    const totalCellB = XLSX.utils.encode_cell({ c: 1, r: totalRowIndex })
    const totalCellC = XLSX.utils.encode_cell({ c: 2, r: totalRowIndex })
    if (ws[totalCellB]) ws[totalCellB].s = { font: { bold: true } }
    if (ws[totalCellC]) ws[totalCellC].s = { font: { bold: true } }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Advance Report')
    XLSX.writeFile(wb, `advance-report_${fileFilterName}.xlsx`)
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
}

/* ==========================================================
   4) List (Filtered) -> PDF
   ✅ Added: Grand Total row at the bottom of the table
========================================================== */
export const exportAdvancesToPDF = (
  advances,
  branchData,
  filterType,
  dateRange = {},
  selectedMonth = ''
) => {
  try {
    if (!advances?.length) return alert('No advance data to export!')

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
      a.createdBy?.username || 'Unknown',
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
    alert("Failed to export. Please try again.");
  }
}

/* ==========================================================
   5) Staff Summary (Grouped) -> Excel
   ✅ Added: Grand Total row at the bottom
   staffSummary = [{ staffName,totalAmount,count,lastDate,entries:[...] }]
========================================================== */
export const exportAdvanceStaffSummaryToExcel = (
  staffSummary,
  branchData,
  filterType,
  dateRange = {},
  selectedMonth = ''
) => {
  try {
    if (!staffSummary?.length) return alert('No staff summary data to export!')

    const branchName = branchData?.name || 'N/A'
    const { filterText, fileFilterName } = buildFilterMeta(
      filterType,
      dateRange,
      selectedMonth
    )

    // ✅ Grand totals across all staff
    const grandTotal = staffSummary.reduce(
      (sum, s) => sum + Number(s.totalAmount || s.total || 0),
      0
    )
    const grandCount = staffSummary.reduce(
      (sum, s) => sum + Number(s.count || 0),
      0
    )
    const grandAvg = grandCount ? grandTotal / grandCount : 0

    const rows = staffSummary.map((s, idx) => {
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

    // ✅ Total row
    const totalRow = [
      '',
      'GRAND TOTAL',
      grandCount,
      grandTotal.toFixed(2),
      grandAvg.toFixed(2),
      '—'
    ]

    const ws = XLSX.utils.aoa_to_sheet([
      ['Advance Report – Staff Summary'],
      ['Branch:', branchName],
      ['Filter:', filterText],
      ['Generated:', new Date().toLocaleString()],
      [],
      ['#', 'Staff Name', 'Times', 'Total (RM)', 'Avg/Entry', 'Last Date'],
      ...rows,
      [], // blank spacer
      totalRow
    ])

    ws['!cols'] = [
      { wch: 5 },
      { wch: 22 },
      { wch: 10 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 }
    ]

    // ✅ Bold the total row cells (B, C, D, E)
    // Header is row 5 (0-based), data rows follow, blank spacer, then total
    const totalRowIndex = 5 + rows.length + 2 // +1 header +1 blank
    for (let c = 1; c <= 4; c++) {
      const cell = XLSX.utils.encode_cell({ c, r: totalRowIndex })
      if (ws[cell]) ws[cell].s = { font: { bold: true } }
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Staff Summary')
    XLSX.writeFile(wb, `advance-staff-summary_${fileFilterName}.xlsx`)
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
}

/* ==========================================================
   6) Staff Summary (Grouped) -> PDF
   ✅ Added: Grand Total foot row
========================================================== */
export const exportAdvanceStaffSummaryToPDF = (
  staffSummary,
  branchData,
  filterType,
  dateRange = {},
  selectedMonth = ''
) => {
  try {
    if (!staffSummary?.length) return alert('No staff summary data to export!')

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
    alert("Failed to export. Please try again.");
  }
}

/* ==========================================================
   7) Single Staff Detail (Bulk entries) -> PDF
   Use inside StaffSummaryModal
========================================================== */
export const exportAdvanceStaffDetailToPDF = (staff, branchData) => {
  try {
    if (!staff) return alert('No staff data to export!')

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
      a.createdBy?.username || 'Unknown'
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
    alert("Failed to export. Please try again.");
  }
}

/* ==========================================================
   8) Single Staff Detail (Bulk entries) -> Excel
========================================================== */
export const exportAdvanceStaffDetailToExcel = (staff, branchData) => {
  try {
    if (!staff) return alert('No staff data to export!')

    const branchName = branchData?.name || 'N/A'
    const staffName = staff.staffName || 'N/A'
    const total = Number(staff.totalAmount || staff.total || 0)
    const count = Number(staff.count || 0)
    const avg = count ? total / count : 0

    const entries = Array.isArray(staff.entries) ? staff.entries : []

    const rows = entries.map((a, idx) => [
      idx + 1,
      a.date ? format(new Date(a.date), 'dd/MM/yyyy') : '—',
      (Number(a.amount) || 0).toFixed(2),
      a.reason || '-',
      a.status || '-',
      a.createdBy?.username || 'Unknown',
      a.createdBy?.role || '-',
      a.createdBy?.email || '-'
    ])

    const ws = XLSX.utils.aoa_to_sheet([
      ['Advance Report – Staff Detail (Bulk)'],
      ['Branch:', branchName],
      ['Staff:', staffName],
      ['Total (RM):', total.toFixed(2)],
      ['Times:', count],
      ['Avg/Entry (RM):', avg.toFixed(2)],
      ['Generated:', new Date().toLocaleString()],
      [],
      [
        '#',
        'Date',
        'Amount (RM)',
        'Reason',
        'Status',
        'Created By',
        'Role',
        'Email'
      ],
      ...rows
    ])

    ws['!cols'] = [
      { wch: 5 },
      { wch: 12 },
      { wch: 14 },
      { wch: 25 },
      { wch: 12 },
      { wch: 18 },
      { wch: 12 },
      { wch: 24 }
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(staffName))
    XLSX.writeFile(wb, `advance_staff_${staffName.replace(/\s+/g, '_')}.xlsx`)
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
}

/* ==========================================================
   9) ALL STAFF -> PDF (Summary + Details)
   ✅ FILTER-AWARE
   ✅ Grand Total foot row on summary table
   ✅ Fresh page after summary before details start,
      then all staff details flow continuously (no per-staff page break)
========================================================== */
export const exportAdvanceAllStaffToPDF = (
  staffSummary,
  branchData,
  filterType,
  dateRange = {},
  selectedMonth = ''
) => {
  try {
  if (!staffSummary?.length) return alert('No staff data to export!')

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

  if (!filteredStaff.length) return alert('No data for this filter!')

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
      a.createdBy?.username || 'Unknown'
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
    alert("Failed to export. Please try again.");
  }
}

/* ==========================================================
   10) ALL STAFF -> Excel (SUMMARY + one sheet per staff)
   ✅ FILTER-AWARE
   ✅ Grand Total row added to SUMMARY sheet
========================================================== */
export const exportAdvanceAllStaffToExcel = (
  staffSummary,
  branchData,
  filterType,
  dateRange = {},
  selectedMonth = ''
) => {
  try {
  if (!staffSummary?.length) return alert('No staff data to export!')

  const branchName = branchData?.name || 'N/A'
  const { filterText, fileFilterName } = buildFilterMeta(
    filterType,
    dateRange,
    selectedMonth
  )

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

  if (!filteredStaff.length) return alert('No data for this filter!')

  // ✅ Grand totals
  const grandTotal = filteredStaff.reduce((sum, s) => sum + s.totalAmount, 0)
  const grandCount = filteredStaff.reduce((sum, s) => sum + s.count, 0)
  const grandAvg = grandCount ? grandTotal / grandCount : 0

  const wb = XLSX.utils.book_new()

  // SUMMARY sheet (filtered totals)
  const summaryRows = filteredStaff.map((s, i) => {
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

  // ✅ Grand Total row
  const totalRow = [
    '',
    'GRAND TOTAL',
    grandCount,
    grandTotal.toFixed(2),
    grandAvg.toFixed(2),
    '—'
  ]

  const wsSummary = XLSX.utils.aoa_to_sheet([
    ['Advance Report – All Staff (Filtered)'],
    ['Branch:', branchName],
    ['Filter:', filterText],
    ['Generated:', new Date().toLocaleString()],
    [],
    ['#', 'Staff Name', 'Times', 'Total (RM)', 'Avg/Entry', 'Last Date'],
    ...summaryRows,
    [], // blank spacer
    totalRow
  ])

  wsSummary['!cols'] = [
    { wch: 5 },
    { wch: 22 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 }
  ]

  // ✅ Bold the total row (row index = 5 header + summaryRows.length + 1 blank + 1 for 0-based = 5 + len + 2)
  const totalRowIndex = 5 + summaryRows.length + 2
  for (let c = 1; c <= 4; c++) {
    const cell = XLSX.utils.encode_cell({ c, r: totalRowIndex })
    if (wsSummary[cell]) wsSummary[cell].s = { font: { bold: true } }
  }

  XLSX.utils.book_append_sheet(wb, wsSummary, 'SUMMARY')

  // One sheet per staff (ONLY filtered entries)
  filteredStaff.forEach(s => {
    const staffName = s.staffName || 'N/A'
    const base = safeSheetName(staffName)
    const avg = s.count ? s.totalAmount / s.count : 0

    const rows = s.entries.map((a, idx) => [
      idx + 1,
      a.date ? format(new Date(a.date), 'dd/MM/yyyy') : '—',
      (Number(a.amount) || 0).toFixed(2),
      a.reason || '-',
      a.status || '-',
      a.createdBy?.username || 'Unknown',
      a.createdBy?.role || '-',
      a.createdBy?.email || '-'
    ])

    const ws = XLSX.utils.aoa_to_sheet([
      ['Advance Report – Staff Detail (Filtered)'],
      ['Branch:', branchName],
      ['Filter:', filterText],
      ['Staff:', staffName],
      ['Total (RM):', s.totalAmount.toFixed(2)],
      ['Times:', s.count],
      ['Avg/Entry (RM):', avg.toFixed(2)],
      ['Generated:', new Date().toLocaleString()],
      [],
      [
        '#',
        'Date',
        'Amount (RM)',
        'Reason',
        'Status',
        'Created By',
        'Role',
        'Email'
      ],
      ...rows
    ])

    ws['!cols'] = [
      { wch: 5 },
      { wch: 12 },
      { wch: 14 },
      { wch: 25 },
      { wch: 12 },
      { wch: 18 },
      { wch: 12 },
      { wch: 24 }
    ]

    // Unique sheet name
    let finalName = base
    let n = 2
    while (wb.SheetNames.includes(finalName)) {
      finalName = safeSheetName(`${base}_${n}`)
      n += 1
    }
    XLSX.utils.book_append_sheet(wb, ws, finalName)
  })

  XLSX.writeFile(wb, `advance_all_staff_${fileFilterName}.xlsx`)
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
}

/* ==========================================================
   11) Share (PDF) – single advance (WhatsApp/Email share)
========================================================== */
export const shareAdvance = async (advance, branchData) => {
  try {
    if (!advance) return alert('No advance data!')

    const branchName = branchData?.name || 'N/A'
    const fileName = `advance-${advance.date || 'unknown'}.pdf`
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const marginLeft = 14
    let cursorY = 20

    // Header
    doc.setFontSize(16)
    doc.text('Advance Report', marginLeft, cursorY)
    doc.setFontSize(12)
    doc.text(
      advance.date ? format(new Date(advance.date), 'dd/MM/yyyy') : '—',
      200 - marginLeft,
      cursorY,
      { align: 'right' }
    )
    cursorY += 10

    const createdTime = getCreatedAtText(advance)
    doc.setFontSize(11)
    doc.text(`Branch: ${branchName}`, marginLeft, cursorY)
    doc.text(`Created At: ${createdTime}`, 200 - marginLeft, cursorY, {
      align: 'right'
    })
    cursorY += 8

    const tableData = [
      ['Staff', advance.staffName || '-'],
      ['Amount (RM)', (Number(advance.amount) || 0).toFixed(2)],
      ['Reason', advance.reason || '-'],
      ['Status', advance.status || '-'],
      ['Created By', advance.createdBy?.username || '-'],
      ['Role', advance.createdBy?.role || '-']
    ]

    autoTable(doc, {
      startY: cursorY + 4,
      head: [['Field', 'Value']],
      body: tableData,
      styles: { cellPadding: 4, fontSize: 10 },
      headStyles: { fillColor: [255, 165, 0] }, // orange
      margin: { left: marginLeft, right: marginLeft }
    })

    let finalY = doc.lastAutoTable?.finalY || cursorY + 20

    // Optional file link
    if (advance.fileURL) {
      doc.setFontSize(12)
      doc.setTextColor(0, 0, 255)
      doc.textWithLink('📎 View Proof File', marginLeft, finalY + 12, {
        url: advance.fileURL
      })
      doc.setTextColor(0, 0, 0)
    }

    const pdfBlob = doc.output('blob')
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' })

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: 'Advance Report',
        text: 'Here is the advance report',
        files: [file]
      })
    } else {
      const link = `${window.location.origin}/advance/${advance.id || ''}`
      await navigator.clipboard.writeText(link)
      alert('Link copied to clipboard ✅ (paste it into WhatsApp/Email)')
    }
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export. Please try again.");
  }
}
