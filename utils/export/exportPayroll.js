/**
 * Payroll exporters — PDF (jsPDF + autoTable) and Excel (xlsx)
 * Mirrors the PayrollSummaryTable layout: landscape sheet + per-dept grouping.
 */

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { fmtAmt, periodLabel } from '@/utils/payrollCalculations'

const RM = v => `RM ${fmtAmt(v || 0)}`
const n2 = v => Number(v || 0).toFixed(2)
const dash = v => (Number(v || 0) > 0 ? n2(v) : '-')

// ─── Build column definitions ─────────────────────────────────────────────────

function buildCols (slips) {
  const statKeys = []
  const statNames = {}
  for (const s of slips) {
    for (const d of (s.statutory || [])) {
      if (!statNames[d.key]) { statKeys.push(d.key); statNames[d.key] = d.name }
    }
  }
  const tot = slips.reduce((a, s) => ({
    otPay:          (a.otPay          || 0) + (s.otPay          || 0),
    allowance:      (a.allowance      || 0) + (s.allowance      || 0),
    advanceAmt:     (a.advanceAmt     || 0) + (s.advanceAmt     || 0),
    loanAmt:        (a.loanAmt        || 0) + (s.loanAmt        || 0),
    otherEarnings:  (a.otherEarnings  || 0) + (s.otherEarnings  || 0),
    otherDeductions:(a.otherDeductions|| 0) + (s.otherDeductions|| 0),
    bonus:          (a.bonus          || 0) + (s.bonus          || 0),
    phPay:          (a.phPay          || 0) + (s.phPay          || 0),
  }), {})
  return {
    statKeys, statNames,
    showOT:      tot.otPay          > 0,
    showPH:      tot.phPay          > 0,
    showBonus:   tot.bonus          > 0,
    showAdvance: tot.advanceAmt     > 0,
    showLoan:    tot.loanAmt        > 0,
    showOtherE:  tot.otherEarnings  > 0,
    showOtherD:  tot.otherDeductions > 0,
  }
}

// Build header and a row array for one slip
function buildHeaders (cols) {
  const h = ['#', 'Name', 'Designation', 'Basic Pay', 'Work Hrs']
  if (cols.showOT) { h.push('OT Hrs'); h.push('OT Pay') }
  if (cols.showPH) h.push('PH Pay')
  h.push('Allowance')
  if (cols.showBonus) h.push('Bonus')
  cols.statKeys.forEach(k => h.push(cols.statNames[k]))
  if (cols.showAdvance) h.push('Advance')
  if (cols.showLoan)    h.push('Loan')
  if (cols.showOtherE)  h.push('Other Earn.')
  if (cols.showOtherD)  h.push('Penalty/Ded.')
  h.push('Total Salary')
  h.push('Net Pay')
  h.push('Remarks')
  return h
}

function buildRow (s, idx, cols) {
  const isH = s.salaryMode === 'hours'
  const remarks = [
    s.loanAmt > 0 && `Loan: ${RM(s.loanAmt)}`,
    s.otherDeductionsNote && s.otherDeductions > 0 && s.otherDeductionsNote,
    s.otherEarningsNote   && s.otherEarnings   > 0 && s.otherEarningsNote,
  ].filter(Boolean).join(' | ')

  const row = [
    idx + 1,
    s.staffName,
    s.designation || '',
    n2(s.basePay),
    isH ? n2(s.workedHours) : `${s.workedDays || 0}d`,
  ]
  if (cols.showOT) { row.push(n2(s.otHours || 0)); row.push(n2(s.otPay || 0)) }
  if (cols.showPH) row.push(n2(s.phPay || 0))
  row.push(dash(s.allowance))
  if (cols.showBonus) row.push(dash(s.bonus))
  cols.statKeys.forEach(k => {
    const f = (s.statutory || []).find(x => x.key === k)
    row.push(dash(f?.employeeAmt))
  })
  if (cols.showAdvance) row.push(dash(s.advanceAmt))
  if (cols.showLoan)    row.push(dash(s.loanAmt))
  if (cols.showOtherE)  row.push(dash(s.otherEarnings))
  if (cols.showOtherD)  row.push(dash(s.otherDeductions))
  row.push(n2(s.grossEarnings))
  row.push(n2(s.netPay))
  row.push(remarks)
  return row
}

function buildTotalRow (label, data, cols) {
  const row = ['', label, '', n2(data.basePay), n2(data.workedHours)]
  if (cols.showOT) { row.push(n2(data.otHours)); row.push(n2(data.otPay)) }
  if (cols.showPH) row.push(n2(data.phPay || 0))
  row.push(n2(data.allowance))
  if (cols.showBonus) row.push(n2(data.bonus || 0))
  cols.statKeys.forEach(k => row.push(n2(data.stat?.[k] || 0)))
  if (cols.showAdvance) row.push(n2(data.advanceAmt))
  if (cols.showLoan)    row.push(n2(data.loanAmt))
  if (cols.showOtherE)  row.push(n2(data.otherEarnings))
  if (cols.showOtherD)  row.push(n2(data.otherDeductions))
  row.push(n2(data.grossEarnings))
  row.push(n2(data.netPay))
  row.push('')
  return row
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

export function exportPayrollToPDF (slips = [], branchName = '', period = '', run = null, companyName = '') {
  try {
    const doc     = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const cols    = buildCols(slips)
    const headers = buildHeaders(cols)
    const status  = run?.status || 'draft'

    // Title block
    let y = 10
    if (companyName) {
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139)
      doc.text(companyName.toUpperCase(), 14, y)
      y += 5
    }
    doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59)
    doc.text(branchName, 14, y)
    y += 6
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105)
    doc.text(`Salary Sheet — ${periodLabel(period)}   |   ${slips.length} Staff   |   Status: ${status.toUpperCase()}`, 14, y)
    y += 5
    if (run?.paidAt) { doc.text(`Paid: ${new Date(run.paidAt).toLocaleDateString()}`, 14, y); y += 5 }

    // Group by dept
    const deptMap = {}
    for (const s of slips) {
      const dept = s.department || 'General'
      if (!deptMap[dept]) deptMap[dept] = []
      deptMap[dept].push(s)
    }
    const depts = Object.keys(deptMap)

    const bodyRows  = []
    const grandData = { basePay:0,workedHours:0,otHours:0,otPay:0,allowance:0,advanceAmt:0,loanAmt:0,otherEarnings:0,otherDeductions:0,grossEarnings:0,netPay:0,stat:{} }

    depts.forEach(dept => {
      const ds = deptMap[dept]
      const dt = { basePay:0,workedHours:0,otHours:0,otPay:0,allowance:0,advanceAmt:0,loanAmt:0,otherEarnings:0,otherDeductions:0,grossEarnings:0,netPay:0,stat:{} }

      // Dept header row
      bodyRows.push({ isDept: true, label: dept, colCount: headers.length })

      ds.forEach((s, idx) => {
        bodyRows.push({ isData: true, row: buildRow(s, idx, cols) })
        dt.basePay+=s.basePay||0; dt.workedHours+=s.workedHours||0; dt.otHours+=s.otHours||0; dt.otPay+=s.otPay||0
        dt.allowance+=s.allowance||0; dt.advanceAmt+=s.advanceAmt||0; dt.loanAmt+=s.loanAmt||0
        dt.otherEarnings+=s.otherEarnings||0; dt.otherDeductions+=s.otherDeductions||0
        dt.bonus+=s.bonus||0; dt.phPay+=s.phPay||0
        dt.grossEarnings+=s.grossEarnings||0; dt.netPay+=s.netPay||0
        for (const k of cols.statKeys) {
          const f=(s.statutory||[]).find(x=>x.key===k)
          dt.stat[k]=(dt.stat[k]||0)+(f?.employeeAmt||0)
        }
      })

      if (depts.length > 1) {
        bodyRows.push({ isSubtotal: true, row: buildTotalRow(`${dept} Subtotal`, dt, cols) })
      }

      // Accumulate grand
      grandData.basePay+=dt.basePay; grandData.workedHours+=dt.workedHours; grandData.otHours+=dt.otHours; grandData.otPay+=dt.otPay
      grandData.allowance+=dt.allowance; grandData.advanceAmt+=dt.advanceAmt; grandData.loanAmt+=dt.loanAmt
      grandData.otherEarnings+=dt.otherEarnings; grandData.otherDeductions+=dt.otherDeductions
      grandData.grossEarnings+=dt.grossEarnings; grandData.netPay+=dt.netPay
      for (const k of cols.statKeys) grandData.stat[k]=(grandData.stat[k]||0)+(dt.stat[k]||0)
    })

    bodyRows.push({ isGrand: true, row: buildTotalRow(`GRAND TOTAL (${slips.length} staff)`, grandData, cols) })

    // Convert to autoTable format
    const tableBody = bodyRows.map(r => {
      if (r.isDept)     return [{ content: r.label, colSpan: headers.length, styles: { fontStyle:'bold', fillColor:[241,245,249], textColor:[55,65,81], fontSize:7.5 } }]
      if (r.isSubtotal) return r.row.map((v,i) => ({ content: String(v), styles: { fontStyle:'bold', fillColor:[241,245,249], textColor:[55,65,81] } }))
      if (r.isGrand)    return r.row.map((v,i) => ({ content: String(v), styles: { fontStyle:'bold', fillColor:[226,232,240], textColor:[30,41,59], fontSize:8 } }))
      return r.row.map(v => String(v))
    })

    autoTable(doc, {
      startY: y + 1,
      head: [headers],
      body: tableBody,
      styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [241,245,249], textColor: [30,41,59], fontStyle: 'bold', lineColor: [203,213,225], lineWidth: 0.3 },
      alternateRowStyles: { fillColor: [248,250,252] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'left', cellWidth: 28 },
        2: { halign: 'left', cellWidth: 24 },
      },
      didParseCell (data) {
        // Net Pay column — green text
        if (data.section === 'body' && data.column.index === headers.length - 2) {
          data.cell.styles.textColor = [22, 101, 52]
          data.cell.styles.fontStyle = 'bold'
        }
      },
      margin: { left: 8, right: 8 },
    })

    // Signature lines
    const finalY = doc.lastAutoTable.finalY + 14
    ;['Prepared By', 'Checked By', 'Approved By'].forEach((label, i) => {
      const x = 14 + i * 90
      doc.setLineWidth(0.4)
      doc.line(x, finalY, x + 70, finalY)
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text(label, x + 35, finalY + 5, { align: 'center' })
    })

    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    const footerParts = ['Generated: ' + new Date().toLocaleString(), companyName, branchName, periodLabel(period)].filter(Boolean)
    doc.text(footerParts.join(' · '), 14, doc.lastAutoTable.finalY + 26)

    doc.save(`Payroll_${branchName}_${period}.pdf`)
  } catch (err) {
    console.error('Payroll PDF export failed:', err)
    alert('PDF export failed. Please try again.')
  }
}

// ─── Individual Payslip PDF ───────────────────────────────────────────────────

export function exportPayslipToPDF (slip, branchName = '', period = '', companyName = '') {
  try {
    const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const currency = 'RM'
    const fmt      = v => `${currency} ${fmtAmt(v || 0)}`
    const isHours  = slip.salaryMode === 'hours'

    // Header — left side: company + branch
    let y = 12
    if (companyName) {
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139)
      doc.text(companyName.toUpperCase(), 14, y)
      y += 5
    }
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59)
    doc.text(branchName, 14, y)
    y += 6
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139)
    doc.text('EMPLOYEE SALARY VOUCHER', 14, y)

    // Header — right side
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59)
    doc.text('SALARY VOUCHER', 196, 12, { align: 'right' })
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139)
    doc.text(`No: ${period}-${(slip.staffId || '').slice(-4).toUpperCase()}`, 196, 18, { align: 'right' })
    doc.text(`Period: ${periodLabel(period)}`, 196, 23, { align: 'right' })

    const dividerY = y + 5
    doc.setDrawColor(30, 41, 59); doc.setLineWidth(0.5)
    doc.line(14, dividerY, 196, dividerY)
    const afterHeader = dividerY + 4

    // Employee info
    const info = [
      ['Employee', slip.staffName || ''],
      ['Designation', slip.designation || '—'],
      ['Pay Mode', isHours ? 'Hourly (Monthly)' : 'Daily (Monthly)'],
      ['Basic Salary', fmt(slip.basicSalary)],
      [isHours ? 'Standard Hours' : 'Working Days', isHours ? `${slip.standardHours || 208} hrs/month` : `${slip.workingDays || 26} days/month`],
      [isHours ? 'Hourly Rate' : 'Daily Rate', isHours ? `${currency} ${fmtAmt(slip.basicSalary / (slip.standardHours || 208))}/hr` : `${currency} ${fmtAmt(slip.basicSalary / (slip.workingDays || 26))}/day`],
    ]
    autoTable(doc, {
      startY: afterHeader,
      body: info,
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40, textColor: [100, 116, 139] }, 1: { textColor: [30, 41, 59] } },
      tableWidth: 88,
    })

    // Earnings
    const earnings = [
      [`Basic Pay${isHours && slip.workedHours < slip.standardHours ? ` (${slip.workedHours}/${slip.standardHours} hrs)` : !isHours && slip.workedDays < slip.workingDays ? ` (${slip.workedDays}/${slip.workingDays} days)` : ''}`, fmt(slip.basePay)],
      ...(slip.allowance > 0     ? [['Allowance',                                    fmt(slip.allowance)]]     : []),
      ...(slip.otPay > 0         ? [[`OT Pay (${slip.otHours || 0} hrs)`,             fmt(slip.otPay)]]         : []),
      ...(slip.phPay > 0         ? [[`PH Pay`,                                        fmt(slip.phPay)]]         : []),
      ...(slip.otherEarnings > 0 ? [[slip.otherEarningsNote || 'Other Earnings',      fmt(slip.otherEarnings)]] : []),
    ]

    autoTable(doc, {
      startY: afterHeader,
      head: [['EARNINGS', 'Amount']],
      body: [...earnings, [{ content: 'Gross Pay', styles: { fontStyle: 'bold' } }, { content: fmt(slip.grossEarnings), styles: { fontStyle: 'bold', textColor: [22, 101, 52] } }]],
      styles: { fontSize: 8.5, cellPadding: 2 },
      headStyles: { fillColor: [240, 253, 244], textColor: [22, 101, 52], fontStyle: 'bold', lineColor: [187, 247, 208], lineWidth: 0.3 },
      columnStyles: { 0: { cellWidth: 65 }, 1: { halign: 'right', cellWidth: 30 } },
      tableWidth: 95,
      margin: { left: 105 },
    })

    // Deductions
    const deductions = [
      ...(slip.statutory || []).map(s => [`${s.name} (${s.employeeRate}%)`, fmt(s.employeeAmt)]),
      ...(slip.advanceAmt > 0      ? [['Salary Advance',                             fmt(slip.advanceAmt)]]      : []),
      ...(slip.loanAmt > 0         ? [['Loan Repayment (EMI)',                       fmt(slip.loanAmt)]]         : []),
      ...(slip.otherDeductions > 0 ? [[slip.otherDeductionsNote || 'Other Deductions', fmt(slip.otherDeductions)]] : []),
    ]

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 3,
      head: [['DEDUCTIONS', 'Amount']],
      body: deductions.length > 0
        ? [...deductions, [{ content: 'Total Deductions', styles: { fontStyle: 'bold' } }, { content: fmt(slip.totalDeductions), styles: { fontStyle: 'bold', textColor: [153, 27, 27] } }]]
        : [['No deductions', '']],
      styles: { fontSize: 8.5, cellPadding: 2 },
      headStyles: { fillColor: [254, 242, 242], textColor: [153, 27, 27], fontStyle: 'bold', lineColor: [254, 202, 202], lineWidth: 0.3 },
      columnStyles: { 0: { cellWidth: 65 }, 1: { halign: 'right', cellWidth: 30, textColor: [153, 27, 27] } },
      tableWidth: 95,
      margin: { left: 105 },
    })

    // Net Pay box
    const netY = Math.max(doc.lastAutoTable.finalY, 30 + (info.length * 6)) + 8
    doc.setDrawColor(30, 41, 59); doc.setLineWidth(0.7)
    doc.rect(14, netY, 182, 16)
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139)
    doc.text('NET PAY (TAKE HOME)', 20, netY + 6)
    doc.setFontSize(8)
    doc.text(`Gross ${fmt(slip.grossEarnings)} − Deductions ${fmt(slip.totalDeductions)}`, 20, netY + 12)
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59)
    doc.text(fmt(slip.netPay), 192, netY + 10, { align: 'right' })

    // Signatures
    const sigY = netY + 30
    ;['Employee Signature', 'Accountant / HR', 'Authorized Signatory'].forEach((label, i) => {
      const x = 14 + i * 63
      doc.setLineWidth(0.3); doc.setDrawColor(148, 163, 184)
      doc.line(x, sigY, x + 55, sigY)
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139)
      doc.text(label, x + 27, sigY + 5, { align: 'center' })
    })

    doc.setFontSize(7); doc.setTextColor(148, 163, 184)
    doc.text(`${branchName} · ${periodLabel(period)} · Generated: ${new Date().toLocaleDateString()}`, 14, sigY + 16)

    doc.save(`Payslip_${slip.staffName?.replace(/\s+/g,'_') || 'staff'}_${period}.pdf`)
  } catch (err) {
    console.error('Payslip PDF export failed:', err)
    alert('PDF export failed. Please try again.')
  }
}

// ─── Excel Export ─────────────────────────────────────────────────────────────

export function exportPayrollToExcel (slips = [], branchName = '', period = '', run = null) {
  try {
    const cols    = buildCols(slips)
    const headers = buildHeaders(cols)
    const status  = run?.status || 'draft'

    // ── Sheet 1: Full sheet (like PDF) ──────────────────────────────────────
    const wsData = [
      [branchName],
      [`Salary Sheet — ${periodLabel(period)}`],
      [`${slips.length} Staff   |   Status: ${status.toUpperCase()}${run?.paidAt ? `   |   Paid: ${new Date(run.paidAt).toLocaleDateString()}` : ''}`],
      [],
      headers,
    ]

    const deptMap = {}
    for (const s of slips) {
      const dept = s.department || 'General'
      if (!deptMap[dept]) deptMap[dept] = []
      deptMap[dept].push(s)
    }
    const depts = Object.keys(deptMap)
    const grandData = { basePay:0,workedHours:0,otHours:0,otPay:0,allowance:0,advanceAmt:0,loanAmt:0,otherEarnings:0,otherDeductions:0,grossEarnings:0,netPay:0,stat:{} }

    depts.forEach(dept => {
      const ds = deptMap[dept]
      const dt = { basePay:0,workedHours:0,otHours:0,otPay:0,allowance:0,advanceAmt:0,loanAmt:0,otherEarnings:0,otherDeductions:0,grossEarnings:0,netPay:0,stat:{} }

      wsData.push([dept.toUpperCase()])

      ds.forEach((s, idx) => {
        wsData.push(buildRow(s, idx, cols).map(v => isNaN(v) ? v : Number(v) || v))
        dt.basePay+=s.basePay||0; dt.workedHours+=s.workedHours||0; dt.otHours+=s.otHours||0; dt.otPay+=s.otPay||0
        dt.allowance+=s.allowance||0; dt.advanceAmt+=s.advanceAmt||0; dt.loanAmt+=s.loanAmt||0
        dt.otherEarnings+=s.otherEarnings||0; dt.otherDeductions+=s.otherDeductions||0
        dt.bonus+=s.bonus||0; dt.phPay+=s.phPay||0
        dt.grossEarnings+=s.grossEarnings||0; dt.netPay+=s.netPay||0
        for (const k of cols.statKeys) {
          const f=(s.statutory||[]).find(x=>x.key===k)
          dt.stat[k]=(dt.stat[k]||0)+(f?.employeeAmt||0)
        }
      })

      if (depts.length > 1) wsData.push(buildTotalRow(`${dept} Subtotal`, dt, cols))

      grandData.basePay+=dt.basePay; grandData.workedHours+=dt.workedHours; grandData.otHours+=dt.otHours; grandData.otPay+=dt.otPay
      grandData.allowance+=dt.allowance; grandData.advanceAmt+=dt.advanceAmt; grandData.loanAmt+=dt.loanAmt
      grandData.otherEarnings+=dt.otherEarnings; grandData.otherDeductions+=dt.otherDeductions
      grandData.bonus+=dt.bonus; grandData.phPay+=dt.phPay
      grandData.grossEarnings+=dt.grossEarnings; grandData.netPay+=dt.netPay
      for (const k of cols.statKeys) grandData.stat[k]=(grandData.stat[k]||0)+(dt.stat[k]||0)
    })

    wsData.push([])
    wsData.push(buildTotalRow(`GRAND TOTAL (${slips.length} staff)`, grandData, cols))
    wsData.push([])
    wsData.push([`Generated: ${new Date().toLocaleString()}`])

    const ws1 = XLSX.utils.aoa_to_sheet(wsData)

    // Column widths
    ws1['!cols'] = [
      { wch: 5 }, { wch: 22 }, { wch: 20 }, { wch: 12 }, { wch: 10 },
      ...(cols.showOT ? [{ wch: 8 }, { wch: 12 }] : []),
      { wch: 12 },
      ...cols.statKeys.map(() => ({ wch: 12 })),
      ...(cols.showAdvance ? [{ wch: 12 }] : []),
      ...(cols.showLoan    ? [{ wch: 12 }] : []),
      ...(cols.showOtherE  ? [{ wch: 12 }] : []),
      ...(cols.showOtherD  ? [{ wch: 12 }] : []),
      { wch: 14 }, { wch: 14 }, { wch: 28 },
    ]

    // ── Sheet 2: Individual slips ───────────────────────────────────────────
    const ws2Data = [
      [`${branchName} — Individual Payslips — ${periodLabel(period)}`],
      [],
    ]
    for (const s of slips) {
      const isH = s.salaryMode === 'hours'
      ws2Data.push([`STAFF: ${s.staffName}`, `Designation: ${s.designation||''}`, `Dept: ${s.department||''}`])
      ws2Data.push(['EARNINGS', '', 'DEDUCTIONS', ''])
      ws2Data.push(['Basic Pay', Number(n2(s.basePay)), 'Statutory Deductions', ''])
      ;(s.statutory||[]).forEach(d => ws2Data.push(['', '', `  ${d.name} (${d.employeeRate}%)`, Number(n2(d.employeeAmt))]))
      if (s.allowance > 0)     ws2Data.push(['Allowance',    Number(n2(s.allowance)),     s.advanceAmt>0?'Salary Advance':  '', s.advanceAmt>0?Number(n2(s.advanceAmt)):''])
      if (s.otPay > 0)         ws2Data.push([`OT Pay`,       Number(n2(s.otPay)),          s.loanAmt>0?'Loan Repayment':   '', s.loanAmt>0?Number(n2(s.loanAmt)):''])
      if (s.otherEarnings > 0) ws2Data.push(['Other Earn.',  Number(n2(s.otherEarnings)),  s.otherDeductions>0?'Other Ded.':'', s.otherDeductions>0?Number(n2(s.otherDeductions)):''])
      ws2Data.push(['GROSS PAY', Number(n2(s.grossEarnings)), 'TOTAL DEDUCTIONS', Number(n2(s.totalDeductions))])
      ws2Data.push(['', '', '', ''])
      ws2Data.push(['NET PAY', Number(n2(s.netPay)), '', ''])
      ws2Data.push([])
    }
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data)
    ws2['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 28 }, { wch: 14 }]

    // ── Sheet 3: Summary KPIs ───────────────────────────────────────────────
    const kpiData = [
      ['Summary', periodLabel(period)],
      ['Branch', branchName],
      ['Status', status],
      ['Staff Count', slips.length],
      [],
      ['', 'Amount (RM)'],
      ['Total Basic Pay',     Number(n2(grandData.basePay))],
      ['Total Allowance',     Number(n2(grandData.allowance))],
      ['Total OT Pay',        Number(n2(grandData.otPay))],
      ...cols.statKeys.map(k => [cols.statNames[k], Number(n2(grandData.stat[k]||0))]),
      ['Total Advance',       Number(n2(grandData.advanceAmt))],
      ['Total Loan',          Number(n2(grandData.loanAmt))],
      ['Total Other Earn.',   Number(n2(grandData.otherEarnings))],
      ['Total Penalty/Ded.',  Number(n2(grandData.otherDeductions))],
      [],
      ['GROSS TOTAL',         Number(n2(grandData.grossEarnings))],
      ['NET TOTAL PAYABLE',   Number(n2(grandData.netPay))],
    ]
    const ws3 = XLSX.utils.aoa_to_sheet(kpiData)
    ws3['!cols'] = [{ wch: 22 }, { wch: 16 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws1, 'Salary Sheet')
    XLSX.utils.book_append_sheet(wb, ws2, 'Individual Slips')
    XLSX.utils.book_append_sheet(wb, ws3, 'Summary KPIs')
    XLSX.writeFile(wb, `Payroll_${branchName}_${period}.xlsx`)
  } catch (err) {
    console.error('Payroll Excel export failed:', err)
    alert('Excel export failed. Please try again.')
  }
}
