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
      'Rate/Hr',
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
      toNum(toNum(r.basicSalary) / toNum(standardHours || 208)),
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
      '',
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
    { wch: 10 }, // Rate/Hr
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

  csv += `"Staff Name","Basic Salary (${currency})","Rate/Hr","Allowance (${currency})","Basic Hours","OT Hours","OT Rate (${currency})","OT Pay (${currency})","Bonus (${currency})","Penalty (${currency})","Advance (${currency})","Loan (${currency})","Remarks","Gross (${currency})","Net Pay (${currency})"\n`

  for (const r of rows) {
    csv +=
      `${escapeCsv(safeText(r.staffName))},` +
      `${toNum(r.basicSalary)},${toNum(toNum(r.basicSalary) / toNum(standardHours || 208))},${toNum(r.allowance)},${toNum(r.basicHours)},` +
      `${toNum(r.otHours)},${toNum(r.otRate)},${toNum(r.otPay)},` +
      `${toNum(r.bonus)},${toNum(r.penalty)},${toNum(r.advance)},${toNum(
        r.loan
      )},` +
      `${escapeCsv(safeText(r.remarks))},` +
      `${toNum(r.gross)},${toNum(r.netPay)}\n`
  }

  csv += `"TOTALS",${totals.basicSalary},"",${totals.allowance},"","","",${totals.otPay},${totals.bonus},${totals.penalty},${totals.advance},${totals.loan},"",${totals.gross},${totals.netPay}\n`

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

  // Set to landscape to fit more columns comfortably
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' })
  const sheetTitle = title || `Salary Sheet - ${month}`
  const exportDate = new Date().toLocaleString('en-MY')

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(30, 41, 59) // slate-800
  doc.text(sheetTitle, 40, 45)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139) // slate-500
  
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
      'Staff Name',
      `Basic (${currency})`,
      'Rate/Hr',
      `Allow (${currency})`,
      'Basic Hrs',
      'OT Hrs',
      'OT Rate',
      'OT Pay',
      'Bonus',
      'Penalty',
      'Advance',
      'Loan',
      'Gross Pay',
      'Net Pay',
      'Remarks'
    ]
  ]

  const body = rows.map(r => [
    safeText(r.staffName),
    fmt(r.basicSalary),
    fmt(toNum(r.basicSalary) / toNum(standardHours || 208)),
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
      '',
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
      startY: 65 + metaLeft.length * 14 + 15,
      head,
      body,
      foot,
      theme: 'grid',
      styles: { 
        fontSize: 8, 
        cellPadding: 4, 
        overflow: 'linebreak',
        font: 'helvetica'
      },
      headStyles: { 
        fillColor: [241, 245, 249], // slate-100
        textColor: [30, 41, 59], // slate-800
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center'
      },
      footStyles: { 
        fillColor: [241, 245, 249],
        textColor: [30, 41, 59],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252] // slate-50
      },
      columnStyles: {
        0: { cellWidth: 100, halign: 'left', fontStyle: 'bold', textColor: [51, 65, 85] }, // Staff
        1: { halign: 'right' }, // Basic
        2: { halign: 'right', textColor: [100, 116, 139] }, // Rate/Hr
        3: { halign: 'right' }, // Allow
        4: { halign: 'center' }, // Basic Hrs
        5: { halign: 'center' }, // OT Hrs
        6: { halign: 'right' }, // OT Rate
        7: { halign: 'right' }, // OT Pay
        8: { halign: 'right', textColor: [22, 101, 52] }, // Bonus (Green)
        9: { halign: 'right', textColor: [153, 27, 27] }, // Penalty (Red)
        10: { halign: 'right', textColor: [153, 27, 27] }, // Advance (Red)
        11: { halign: 'right', textColor: [153, 27, 27] }, // Loan (Red)
        12: { halign: 'right', fontStyle: 'bold' }, // Gross
        13: { halign: 'right', fontStyle: 'bold', textColor: [22, 101, 52] }, // Net (Green)
        14: { cellWidth: 110, halign: 'left', fontSize: 7, textColor: [100, 116, 139] } // Remarks
      },
      margin: { left: 30, right: 30 }
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
