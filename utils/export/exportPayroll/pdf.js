// exportPayroll: the pdf part (moved from exportPayroll.js unchanged).
/**
 * Payroll exporters — PDF (jsPDF + autoTable) and Excel (xlsx)
 * Mirrors the PayrollSummaryTable layout: landscape sheet + per-dept grouping.
 */

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { periodLabel } from '@/utils/payrollCalculations'
import { toast } from "@/app/components/ui/notify";
import { buildCols, buildHeaders, buildPDFHeaders, buildRow, buildTotalRow, drawCompactPayslipToPDF, drawCuttingLine, drawPayslipToPDF } from "./helpers";

// ─── PDF Export ───────────────────────────────────────────────────────────────

export function exportPayrollToPDF (slips = [], branchName = '', period = '', run = null, companyName = '') {
  try {
    const doc         = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
    const cols        = buildCols(slips)
    const flatHeaders = buildHeaders(cols)
    const pdfHeaders  = buildPDFHeaders(cols)
    const status      = run?.status || 'draft'

    // Title block
    let y = 14
    const pageWidth = doc.internal.pageSize.getWidth()
    
    if (companyName) {
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139)
      doc.text(companyName.toUpperCase(), pageWidth / 2, y, { align: 'center' })
      y += 6
    }
    doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59)
    doc.text(branchName, pageWidth / 2, y, { align: 'center' })
    y += 8
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(71, 85, 105)
    doc.text(`Salary Sheet — ${periodLabel(period)}   |   ${slips.length} Staff   |   Status: ${status.toUpperCase()}`, pageWidth / 2, y, { align: 'center' })
    if (run?.paidAt) {
      y += 5
      doc.text(`Paid: ${new Date(run.paidAt).toLocaleDateString()}`, pageWidth / 2, y, { align: 'center' })
    }
    y += 8

    // Group by dept
    const deptMap = {}
    for (const s of slips) {
      const dept = s.department || 'General'
      if (!deptMap[dept]) deptMap[dept] = []
      deptMap[dept].push(s)
    }
    const depts = Object.keys(deptMap)

    const bodyRows  = []
    const grandData = { basePay:0,workedHours:0,otHours:0,otPay:0,allowance:0,advanceAmt:0,loanAmt:0,otherEarnings:0,penalty:0,otherDeductions:0,bonus:0,phPay:0,grossEarnings:0,netPay:0,stat:{} }

    depts.forEach(dept => {
      const ds = deptMap[dept]
      const dt = { basePay:0,workedHours:0,otHours:0,otPay:0,allowance:0,advanceAmt:0,loanAmt:0,otherEarnings:0,penalty:0,otherDeductions:0,bonus:0,phPay:0,grossEarnings:0,netPay:0,stat:{} }

      // Dept header row
      bodyRows.push({ isDept: true, label: dept, colCount: flatHeaders.length })

      ds.forEach((s, idx) => {
        bodyRows.push({ isData: true, row: buildRow(s, idx, cols) })
        dt.basePay+=Number(s.basePay||0); dt.workedHours+=Number(s.workedHours||0); dt.otHours+=Number(s.otHours||0); dt.otPay+=Number(s.otPay||0)
        dt.allowance+=Number(s.allowance||0); dt.advanceAmt+=Number(s.advanceAmt||0); dt.loanAmt+=Number(s.loanAmt||0)
        dt.otherEarnings+=Number(s.otherEarnings||0); dt.penalty+=Number(s.penalty||0); dt.otherDeductions+=Number(s.otherDeductions||0)
        dt.bonus+=Number(s.bonus||0); dt.phPay+=Number(s.phPay||0)
        dt.grossEarnings+=Number(s.grossEarnings||0); dt.netPay+=Number(s.netPay||0)
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
      grandData.otherEarnings+=dt.otherEarnings; grandData.penalty+=dt.penalty; grandData.otherDeductions+=dt.otherDeductions
      grandData.bonus+=dt.bonus; grandData.phPay+=dt.phPay
      grandData.grossEarnings+=dt.grossEarnings; grandData.netPay+=dt.netPay
      for (const k of cols.statKeys) grandData.stat[k]=(grandData.stat[k]||0)+(dt.stat[k]||0)
    })

    bodyRows.push({ isGrand: true, row: buildTotalRow(`GRAND TOTAL (${slips.length} staff)`, grandData, cols) })

    // Convert to autoTable format
    const tableBody = bodyRows.map(r => {
      if (r.isDept)     return [{ content: r.label, colSpan: flatHeaders.length, styles: { fontStyle:'bold', fillColor:[241,245,249], textColor:[55,65,81], fontSize:10 } }]
      if (r.isSubtotal) return r.row.map((v) => ({ content: String(v), styles: { fontStyle:'bold', fillColor:[241,245,249], textColor:[55,65,81] } }))
      if (r.isGrand)    return r.row.map((v) => ({ content: String(v), styles: { fontStyle:'bold', fillColor:[226,232,240], textColor:[30,41,59], fontSize:11 } }))
      return r.row.map(v => String(v))
    })

    autoTable(doc, {
      startY: y + 1,
      head: pdfHeaders,
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 9.5, cellPadding: 3, overflow: 'linebreak', lineColor: [226, 232, 240], lineWidth: 0.1 },
      headStyles: { fillColor: [248,250,252], textColor: [71,85,105], fontStyle: 'bold', fontSize: 10, lineColor: [226,232,240], lineWidth: 0.1, halign: 'center' },
      alternateRowStyles: { fillColor: [250,252,253] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { halign: 'left', cellWidth: 40 },
        2: { halign: 'left', cellWidth: 32 },
        3: { halign: 'right' },
      },
      didParseCell (data) {
        const hName = flatHeaders[data.column.index]
        if (!hName) return
        
        const isStat = cols.statKeys.some(k => cols.statNames[k] === hName)
        const isRed = isStat || ['Advance', 'Loan', 'Penalty/Ded.', 'Penalty', 'Deduction'].includes(hName)
        const isGreen = ['Bonus', 'Other Earn.', 'Net Pay'].includes(hName)

        if (isRed) {
          data.cell.styles.textColor = [153, 27, 27]
        } else if (isGreen) {
          data.cell.styles.textColor = [22, 101, 52]
        }

        if (data.section === 'body' && !data.row.raw?.isDept) {
          if (hName === 'Net Pay' || hName === 'Total Salary' || hName === 'Gross Pay') {
            data.cell.styles.fontStyle = 'bold'
          }
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
    toast.error('PDF export failed. Please try again.')
  }
}

// ─── Individual Payslip PDF ───────────────────────────────────────────────────

export function exportPayslipToPDF (slip, branchName = '', period = '', companyName = '') {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    drawPayslipToPDF(doc, slip, branchName, period, companyName)
    doc.save(`Payslip_${slip.staffName?.replace(/\s+/g,'_') || 'staff'}_${period}.pdf`)
  } catch (err) {
    console.error('Payslip PDF export failed:', err)
    toast.error('PDF export failed. Please try again.')
  }
}

export function exportAllPayslipsToPDF (slips = [], branchName = '', period = '', companyName = '', twoPerPage = false) {
  if (!slips.length) return toast.warning('No payslips to export')
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    if (twoPerPage) {
      // Two compact payslips per page with cutting line
      for (let i = 0; i < slips.length; i += 2) {
        if (i > 0) doc.addPage()
        drawCompactPayslipToPDF(doc, slips[i], branchName, period, companyName, 8)
        if (i + 1 < slips.length) {
          drawCuttingLine(doc, 148)
          drawCompactPayslipToPDF(doc, slips[i + 1], branchName, period, companyName, 156)
        }
      }
    } else {
      slips.forEach((slip, index) => {
        if (index > 0) doc.addPage()
        drawPayslipToPDF(doc, slip, branchName, period, companyName)
      })
    }

    doc.save(`All_Payslips_${branchName.replace(/\s+/g,'_')}_${period}.pdf`)
  } catch (err) {
    console.error('All Payslips PDF export failed:', err)
    toast.error('PDF export failed. Please try again.')
  }
}
