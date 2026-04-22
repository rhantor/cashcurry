'use client'

import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'

// helpers
const toNum = v => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const fmt = n =>
  toNum(n).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

const safeText = (s = '') => String(s || '').trim()
const escapeCsv = (s = '') => `"${String(s ?? '').replace(/"/g, '""')}"`

/* =========================================================
   EXCEL EXPORT
========================================================= */
export function exportSalarySheetExcel ({
  month,
  title,
  standardHours,
  rows,
  totals,
  currency = 'RM'
}) {
  if (!rows?.length) return alert('No data to export')

  const sheetTitle = title || `Salary Sheet - ${month}`
  const exportDate = new Date().toLocaleDateString('en-MY')

  const excelData = [
    [sheetTitle],
    [`Month: ${month}`, '', '', `Export Date: ${exportDate}`],
    [`Standard Hours: ${standardHours}`],
    [],
    [
      `Staff Name`,
      `Basic Salary (${currency})`,
      `Allowance (${currency})`,
      'Basic Hours',
      'OT Hours',
      `OT Rate (${currency})`,
      `OT Pay (${currency})`,
      `Bonus (${currency})`,
      `Penalty (${currency})`,
      `Advance (${currency})`,
      `Loan (${currency})`,
      'Remarks',
      `Gross (${currency})`,
      `Net Pay (${currency})`
    ],
    ...rows.map(r => [
      safeText(r.staffName),
      toNum(r.basicSalary),
      toNum(r.allowance),
      toNum(r.basicHours),
      toNum(r.otHours),
      toNum(r.otRate),
      toNum(r.otPay),
      toNum(r.bonus),
      toNum(r.penalty),
      toNum(r.advance),
      toNum(r.loan),
      safeText(r.remarks),
      toNum(r.gross),
      toNum(r.netPay)
    ]),
    [
      'TOTALS',
      totals.basicSalary,
      totals.allowance,
      '',
      '',
      '',
      totals.otPay,
      totals.bonus,
      totals.penalty,
      totals.advance,
      totals.loan,
      '',
      totals.gross,
      totals.netPay
    ]
  ]

  const ws = XLSX.utils.aoa_to_sheet(excelData)

  ws['!cols'] = [
    { wch: 25 }, // Staff Name
    { wch: 15 }, // Basic Salary
    { wch: 15 }, // Allowance
    { wch: 12 }, // Basic Hours
    { wch: 10 }, // OT Hours
    { wch: 12 }, // OT Rate
    { wch: 12 }, // OT Pay
    { wch: 12 }, // Bonus
    { wch: 12 }, // Penalty
    { wch: 12 }, // Advance
    { wch: 12 }, // Loan
    { wch: 30 }, // Remarks
    { wch: 12 }, // Gross
    { wch: 15 } // Net Pay
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Salary Sheet')

  XLSX.writeFile(wb, `Salary_Sheet_${month.replace('-', '_')}.xlsx`)
}

/* =========================================================
   CSV EXPORT
========================================================= */
export function exportSalarySheetCSV ({
  month,
  title,
  standardHours,
  rows,
  totals,
  currency = 'RM'
}) {
  if (!rows?.length) return alert('No data to export')

  const sheetTitle = title || `Salary Sheet - ${month}`
  const exportDate = new Date().toLocaleDateString('en-MY')

  let csv = `${escapeCsv(sheetTitle)}\n`
  csv += `${escapeCsv(`Month: ${month}`)},,,${escapeCsv(
    `Export Date: ${exportDate}`
  )}\n`
  csv += `${escapeCsv(`Standard Hours: ${standardHours}`)}\n\n`

  csv += `"Staff Name","Basic Salary (${currency})","Allowance (${currency})","Basic Hours","OT Hours","OT Rate (${currency})","OT Pay (${currency})","Bonus (${currency})","Penalty (${currency})","Advance (${currency})","Loan (${currency})","Remarks","Gross (${currency})","Net Pay (${currency})"\n`

  for (const r of rows) {
    csv +=
      `${escapeCsv(safeText(r.staffName))},` +
      `${toNum(r.basicSalary)},${toNum(r.allowance)},${toNum(r.basicHours)},` +
      `${toNum(r.otHours)},${toNum(r.otRate)},${toNum(r.otPay)},` +
      `${toNum(r.bonus)},${toNum(r.penalty)},${toNum(r.advance)},${toNum(
        r.loan
      )},` +
      `${escapeCsv(safeText(r.remarks))},` +
      `${toNum(r.gross)},${toNum(r.netPay)}\n`
  }

  csv += `"TOTALS",${totals.basicSalary},${totals.allowance},"","","",${totals.otPay},${totals.bonus},${totals.penalty},${totals.advance},${totals.loan},"",${totals.gross},${totals.netPay}\n`

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Salary_Sheet_${month.replace('-', '_')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* =========================================================
   PDF EXPORT (jsPDF + optional AutoTable)
========================================================= */
async function loadAutoTable () {
  // ✅ Works for both common builds:
  // - import 'jspdf-autotable'
  // - import autoTable from 'jspdf-autotable'
  try {
    const mod = await import('jspdf-autotable')
    return mod.default || mod // function(doc, options)
  } catch (e) {
    console.warn('[exportSalarySheetPDF] Failed to load jspdf-autotable:', e)
    return null
  }
}

export async function exportSalarySheetPDF ({
  month,
  title,
  standardHours,
  rows,
  totals,
  companyName = '',
  branchName = '',
  currency = 'RM'
}) {
  if (!rows?.length) return alert('No data to export')

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const sheetTitle = title || `Salary Sheet - ${month}`
  const exportDate = new Date().toLocaleString('en-MY')

  // Header
  doc.setFontSize(14)
  doc.text(sheetTitle, 40, 45)

  doc.setFontSize(10)
  const metaLeft = [
    companyName ? `Company: ${companyName}` : null,
    branchName ? `Branch: ${branchName}` : null,
    `Month: ${month}`,
    `Standard Hours: ${standardHours}`
  ].filter(Boolean)

  metaLeft.forEach((t, i) => doc.text(t, 40, 65 + i * 14))
  doc.text(`Exported: ${exportDate}`, 40, 65 + metaLeft.length * 14)

  const autoTable = await loadAutoTable()

  const head = [
    [
      'Staff',
      'Basic',
      'Allow',
      'Basic Hrs',
      'OT Hrs',
      'OT Rate',
      'OT Pay',
      'Bonus',
      'Penalty',
      'Advance',
      'Loan',
      'Gross',
      'Net',
      'Remarks'
    ]
  ]

  const body = rows.map(r => [
    safeText(r.staffName),
    fmt(r.basicSalary),
    fmt(r.allowance),
    String(toNum(r.basicHours)),
    String(toNum(r.otHours)),
    fmt(r.otRate),
    fmt(r.otPay),
    fmt(r.bonus),
    fmt(r.penalty),
    fmt(r.advance),
    fmt(r.loan),
    fmt(r.gross),
    fmt(r.netPay),
    safeText(r.remarks)
  ])

  const foot = [
    [
      'TOTALS',
      fmt(totals.basicSalary),
      fmt(totals.allowance),
      '',
      '',
      '',
      fmt(totals.otPay),
      fmt(totals.bonus),
      fmt(totals.penalty),
      fmt(totals.advance),
      fmt(totals.loan),
      fmt(totals.gross),
      fmt(totals.netPay),
      ''
    ]
  ]

  // If autotable exists, use it (best)
  if (autoTable) {
    autoTable(doc, {
      startY: 65 + metaLeft.length * 14 + 22,
      head,
      body,
      foot,
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fontSize: 8 },
      footStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 80 }, // Staff
        13: { cellWidth: 110 } // Remarks
      },
      margin: { left: 40, right: 40 }
    })
  } else {
    // Fallback (no autotable): simple text table
    doc.setFontSize(9)
    let y = 65 + metaLeft.length * 14 + 30
    doc.text('Install "jspdf-autotable" for a better table layout.', 40, y)
    y += 16
    rows.slice(0, 30).forEach(r => {
      doc.text(
        `${safeText(r.staffName)}  | Net: ${currency} ${fmt(
          r.netPay
        )}  | Remark: ${safeText(r.remarks)}`,
        40,
        y
      )
      y += 12
    })
  }

  doc.save(`Salary_Sheet_${month.replace('-', '_')}.pdf`)
}
