// exportAdvanceData: the excel part (moved from exportAdvanceData.js unchanged).
 
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { toast } from "@/app/components/ui/notify";

import { personName } from "@/lib/people";
/* ==========================================================
   Helpers
========================================================== */
import { buildFilterMeta, calcStaffTotalsFromEntries, filterEntriesByMeta, getCreatedAtText, safeSheetName } from "./helpers";

export const exportAdvanceToExcel = (advance, branchData) => {
  try {
    if (!advance) return toast.warning('No advance data!')

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
        personName(advance.createdBy) || 'Unknown',
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
    toast.error("Failed to export. Please try again.");
  }
}

/* ==========================================================
   2) Single Advance -> PDF
========================================================== */

export const exportAdvancesToExcel = (
  advances,
  branchData,
  filterType,
  dateRange = {},
  selectedMonth = ''
) => {
  try {
    if (!advances?.length) return toast.warning('No advance data to export!')

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
      personName(a.createdBy) || 'Unknown',
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
    toast.error("Failed to export. Please try again.");
  }
}

/* ==========================================================
   4) List (Filtered) -> PDF
   ✅ Added: Grand Total row at the bottom of the table
========================================================== */

export const exportAdvanceStaffSummaryToExcel = (
  staffSummary,
  branchData,
  filterType,
  dateRange = {},
  selectedMonth = ''
) => {
  try {
    if (!staffSummary?.length) return toast.warning('No staff summary data to export!')

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
    toast.error("Failed to export. Please try again.");
  }
}

/* ==========================================================
   6) Staff Summary (Grouped) -> PDF
   ✅ Added: Grand Total foot row
========================================================== */

export const exportAdvanceStaffDetailToExcel = (staff, branchData) => {
  try {
    if (!staff) return toast.warning('No staff data to export!')

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
      personName(a.createdBy) || 'Unknown',
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
    toast.error("Failed to export. Please try again.");
  }
}

/* ==========================================================
   9) ALL STAFF -> PDF (Summary + Details)
   ✅ FILTER-AWARE
   ✅ Grand Total foot row on summary table
   ✅ Fresh page after summary before details start,
      then all staff details flow continuously (no per-staff page break)
========================================================== */

export const exportAdvanceAllStaffToExcel = (
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
      personName(a.createdBy) || 'Unknown',
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
    toast.error("Failed to export. Please try again.");
  }
}

/* ==========================================================
   11) Share (PDF) – single advance (WhatsApp/Email share)
========================================================== */
