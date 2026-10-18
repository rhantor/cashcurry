// exportPayroll: the excel part (moved from exportPayroll.js unchanged).
/**
 * Payroll exporters — PDF (jsPDF + autoTable) and Excel (xlsx)
 * Mirrors the PayrollSummaryTable layout: landscape sheet + per-dept grouping.
 */

import * as XLSX from 'xlsx'
import { periodLabel } from '@/utils/payrollCalculations'
import { toast } from "@/app/components/ui/notify";
import { buildCols, buildHeaders, buildRow, buildTotalRow, num } from "./helpers";

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
    const grandData = { basePay:0,workedHours:0,otHours:0,otPay:0,allowance:0,advanceAmt:0,loanAmt:0,otherEarnings:0,penalty:0,otherDeductions:0,bonus:0,phPay:0,grossEarnings:0,netPay:0,stat:{} }

    depts.forEach(dept => {
      const ds = deptMap[dept]
      const dt = { basePay:0,workedHours:0,otHours:0,otPay:0,allowance:0,advanceAmt:0,loanAmt:0,otherEarnings:0,penalty:0,otherDeductions:0,bonus:0,phPay:0,grossEarnings:0,netPay:0,stat:{} }

      wsData.push([dept.toUpperCase()])

      ds.forEach((s, idx) => {
        wsData.push(buildRow(s, idx, cols).map(v => {
          if (typeof v === 'string') {
            const numStr = v.replace(/,/g, '')
            if (!isNaN(numStr) && numStr.trim() !== '') return Number(numStr)
          }
          return v
        }))
        dt.basePay+=s.basePay||0; dt.workedHours+=s.workedHours||0; dt.otHours+=s.otHours||0; dt.otPay+=s.otPay||0
        dt.allowance+=s.allowance||0; dt.advanceAmt+=s.advanceAmt||0; dt.loanAmt+=s.loanAmt||0
        dt.otherEarnings+=s.otherEarnings||0; dt.penalty+=s.penalty||0; dt.otherDeductions+=s.otherDeductions||0
        dt.bonus+=s.bonus||0; dt.phPay+=s.phPay||0
        dt.grossEarnings+=s.grossEarnings||0; dt.netPay+=s.netPay||0
        for (const k of cols.statKeys) {
          const f=(s.statutory||[]).find(x=>x.key===k)
          dt.stat[k]=(dt.stat[k]||0)+(f?.employeeAmt||0)
        }
      })

      if (depts.length > 1) {
        wsData.push(buildTotalRow(`${dept} Subtotal`, dt, cols).map(v => {
          if (typeof v === 'string') {
            const numStr = v.replace(/,/g, '')
            if (!isNaN(numStr) && numStr.trim() !== '') return Number(numStr)
          }
          return v
        }))
      }

      grandData.basePay+=dt.basePay; grandData.workedHours+=dt.workedHours; grandData.otHours+=dt.otHours; grandData.otPay+=dt.otPay
      grandData.allowance+=dt.allowance; grandData.advanceAmt+=dt.advanceAmt; grandData.loanAmt+=dt.loanAmt
      grandData.otherEarnings+=dt.otherEarnings; grandData.penalty+=dt.penalty; grandData.otherDeductions+=dt.otherDeductions
      grandData.bonus+=dt.bonus; grandData.phPay+=dt.phPay
      grandData.grossEarnings+=dt.grossEarnings; grandData.netPay+=dt.netPay
      for (const k of cols.statKeys) grandData.stat[k]=(grandData.stat[k]||0)+(dt.stat[k]||0)
    })

    wsData.push([])
    wsData.push(buildTotalRow(`GRAND TOTAL (${slips.length} staff)`, grandData, cols).map(v => {
      if (typeof v === 'string') {
        const numStr = v.replace(/,/g, '')
        if (!isNaN(numStr) && numStr.trim() !== '') return Number(numStr)
      }
      return v
    }))
    wsData.push([])
    wsData.push([`Generated: ${new Date().toLocaleString()}`])

    const ws1 = XLSX.utils.aoa_to_sheet(wsData)

    // Column widths
    ws1['!cols'] = [
      { wch: 5 }, { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 10 },
      ...(cols.showOT ? [{ wch: 8 }, { wch: 12 }] : []),
      ...(cols.showPH ? [{ wch: 12 }] : []),
      { wch: 12 },
      ...(cols.showBonus ? [{ wch: 12 }] : []),
      ...cols.statKeys.map(() => ({ wch: 12 })),
      ...(cols.showAdvance ? [{ wch: 12 }] : []),
      ...(cols.showLoan    ? [{ wch: 12 }] : []),
      ...(cols.showOtherE  ? [{ wch: 12 }] : []),
      ...(cols.showPenalty ? [{ wch: 12 }] : []),
      ...(cols.showOtherD  ? [{ wch: 12 }] : []),
      { wch: 14 }, { wch: 14 }, { wch: 28 },
    ]

    // ── Sheet 2: Individual slips ───────────────────────────────────────────
    const ws2Data = [
      [`${branchName} — Individual Payslips — ${periodLabel(period)}`],
      [],
    ]
    for (const s of slips) {
      ws2Data.push([`STAFF: ${s.staffName}`, `Designation: ${s.designation||''}`, `Dept: ${s.department||''}`])
      ws2Data.push(['EARNINGS', '', 'DEDUCTIONS', ''])
      ws2Data.push(['Basic Pay', num(s.basePay), 'Statutory Deductions', ''])
      ;(s.statutory||[]).forEach(d => ws2Data.push(['', '', `  ${d.name} (${d.employeeRate}%)`, num(d.employeeAmt)]))
      const eArr = []
      if (s.allowance > 0) eArr.push(['Allowance', num(s.allowance)])
      if (s.otPay > 0) eArr.push([`OT Pay`, num(s.otPay)])
      if (s.phPay > 0) eArr.push([`PH Pay`, num(s.phPay)])
      if (s.bonus > 0) eArr.push([`Bonus`, num(s.bonus)])
      if (s.otherEarnings > 0) eArr.push(['Other Earn.', num(s.otherEarnings)])

      const dArr = []
      if (s.advanceAmt > 0) dArr.push(['Salary Advance', num(s.advanceAmt)])
      if (s.loanAmt > 0) dArr.push(['Loan Repayment', num(s.loanAmt)])
      if (s.penalty > 0) dArr.push(['Penalty', num(s.penalty)])
      if (s.otherDeductions > 0) dArr.push(['Other Ded.', num(s.otherDeductions)])

      const maxLen = Math.max(eArr.length, dArr.length)
      for (let i = 0; i < maxLen; i++) {
        ws2Data.push([
          eArr[i] ? eArr[i][0] : '',
          eArr[i] ? eArr[i][1] : '',
          dArr[i] ? dArr[i][0] : '',
          dArr[i] ? dArr[i][1] : ''
        ])
      }
      ws2Data.push(['GROSS PAY', num(s.grossEarnings), 'TOTAL DEDUCTIONS', num(s.totalDeductions)])
      ws2Data.push(['', '', '', ''])
      ws2Data.push(['NET PAY', num(s.netPay), '', ''])
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
      ['Total Basic Pay',     num(grandData.basePay)],
      ['Total Allowance',     num(grandData.allowance)],
      ['Total OT Pay',        num(grandData.otPay)],
      ['Total PH Pay',        num(grandData.phPay)],
      ['Total Bonus',         num(grandData.bonus)],
      ...cols.statKeys.map(k => [cols.statNames[k], num(grandData.stat[k]||0)]),
      ['Total Advance',       num(grandData.advanceAmt)],
      ['Total Loan',          num(grandData.loanAmt)],
      ['Total Other Earn.',   num(grandData.otherEarnings)],
      ['Total Penalty',       num(grandData.penalty)],
      ['Total Other Ded.',    num(grandData.otherDeductions)],
      [],
      ['GROSS TOTAL',         num(grandData.grossEarnings)],
      ['NET TOTAL PAYABLE',   num(grandData.netPay)],
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
    toast.error('Excel export failed. Please try again.')
  }
}
