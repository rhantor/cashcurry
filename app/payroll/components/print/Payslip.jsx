'use client'

import { fmtAmt, periodLabel } from '@/utils/payrollCalculations'
import useCurrency from '@/app/hooks/useCurrency'
import { currencyInfo } from '@/lib/region/currency'

// ─── Individual Salary Voucher ────────────────────────────────────────────────

export function Payslip ({ slip, branchName, companyName, period }) {
  const isHours   = slip.salaryMode === 'hours'
  const currency  = currencyInfo(useCurrency()).symbol
  const fmt       = v => `${currency} ${fmtAmt(v)}`
  const voucherNo = `${period}-${(slip.staffId || '').slice(-4).toUpperCase()}`

  const earnings = [
    {
      label: `Basic Pay${
        isHours && slip.workedHours < slip.standardHours
          ? ` (${slip.workedHours} / ${slip.standardHours} hrs)`
          : !isHours && slip.workedDays < slip.workingDays
          ? ` (${slip.workedDays} / ${slip.workingDays} days)`
          : ''
      }`,
      amount: slip.basePay,
    },
    slip.allowance > 0     && { label: 'Allowance',                                                                 amount: slip.allowance },
    slip.otPay > 0         && { label: `Overtime Pay (${slip.otHours || 0} hrs)`,                                   amount: slip.otPay },
    slip.phPay > 0         && { label: `Public Holiday Pay (${isHours ? `${slip.phHours||0} hrs` : `${slip.phDays||0} days`})`, amount: slip.phPay },
    slip.bonus > 0         && { label: slip.bonusNote ? `Bonus (${slip.bonusNote})` : 'Bonus',                       amount: slip.bonus },
    slip.otherEarnings > 0 && { label: slip.otherEarningsNote || 'Other Earnings',                                  amount: slip.otherEarnings },
  ].filter(Boolean)

  const deductions = [
    ...(slip.statutory || []).map(s => ({ label: `${s.name} (${s.employeeRate}%)`, amount: s.employeeAmt })),
    slip.advanceAmt > 0      && { label: 'Salary Advance',                                                                           amount: slip.advanceAmt },
    slip.loanAmt > 0         && { label: slip.loanNote ? `Loan Repayment (${slip.loanNote})` : 'Loan Repayment (EMI)',               amount: slip.loanAmt },
    slip.penalty > 0         && { label: slip.penaltyNote ? `Penalty (${slip.penaltyNote})` : 'Penalty',                             amount: slip.penalty },
    slip.otherDeductions > 0 && { label: slip.otherDeductionsNote || 'Other Deductions',                                             amount: slip.otherDeductions },
  ].filter(Boolean)

  return (
    <div id='payslip-print-root' className='print-root' style={{ fontFamily: 'Arial, sans-serif', maxWidth: 680, margin: '0 auto', background: '#ffffff', padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 10, borderBottom: '2px solid #1e293b', marginBottom: 12 }}>
        <div>
          {companyName && <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, letterSpacing: 0.5, marginBottom: 2 }}>{companyName}</div>}
          <div style={{ fontSize: 20, fontWeight: 900, color: '#1e293b' }}>{branchName}</div>
          <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 }}>Employee Salary Voucher</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, fontWeight: 700 }}>SALARY VOUCHER</div>
          <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>No: <strong>{voucherNo}</strong></div>
          <div style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>Period: <strong>{periodLabel(period)}</strong></div>
        </div>
      </div>

      {/* Employee info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 12, border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
        {[
          { label: 'Employee Name',  val: slip.staffName },
          { label: 'Designation',    val: slip.designation || '—' },
          { label: 'Pay Mode',       val: isHours ? 'Hourly (Monthly)' : 'Daily (Monthly)' },
          { label: 'Basic Salary',   val: fmt(slip.basicSalary) },
          { label: isHours ? 'Standard Hours' : 'Working Days',
            val: isHours ? `${slip.standardHours || 208} hrs/month` : `${slip.workingDays || 26} days/month` },
          { label: isHours ? 'Hourly Rate' : 'Daily Rate',
            val: isHours
              ? `${currency} ${fmtAmt(slip.basicSalary / (slip.standardHours || 208))}/hr`
              : `${currency} ${fmtAmt(slip.basicSalary / (slip.workingDays || 26))}/day` },
        ].map((item, i) => (
          <div key={i} style={{ padding: '7px 10px', background: '#f8fafc', borderRight: (i+1)%3!==0?'1px solid #e2e8f0':'none', borderTop: i>=3?'1px solid #e2e8f0':'none' }}>
            <div style={{ fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#1e293b', marginTop: 2 }}>{item.val}</div>
          </div>
        ))}
      </div>

      {/* Earnings + Deductions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>

        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
          <thead>
            <tr>
              <th colSpan={2} style={{ background: '#f0fdf4', color: '#166534', padding: '6px 10px', textAlign: 'left', fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, borderBottom: '1px solid #bbf7d0' }}>
                EARNINGS
              </th>
            </tr>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: 8, color: '#64748b', border: '1px solid #e2e8f0' }}>Description</th>
              <th style={{ padding: '4px 8px', textAlign: 'right', fontSize: 8, color: '#64748b', border: '1px solid #e2e8f0' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {earnings.map((e, i) => (
              <tr key={i} style={{ background: i%2===0?'#fff':'#fafafa' }}>
                <td style={{ padding: '5px 8px', fontSize: 9, color: '#374151', border: '1px solid #f1f5f9' }}>{e.label}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 9, color: '#1e293b', fontWeight: 500, border: '1px solid #f1f5f9' }}>{fmt(e.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f0fdf4', borderTop: '1px solid #bbf7d0' }}>
              <td style={{ padding: '6px 8px', fontWeight: 700, fontSize: 9.5, color: '#166534' }}>Gross Pay</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, fontSize: 9.5, color: '#166534' }}>{fmt(slip.grossEarnings)}</td>
            </tr>
          </tfoot>
        </table>

        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
          <thead>
            <tr>
              <th colSpan={2} style={{ background: '#fef2f2', color: '#991b1b', padding: '6px 10px', textAlign: 'left', fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, borderBottom: '1px solid #fecaca' }}>
                DEDUCTIONS
              </th>
            </tr>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: 8, color: '#64748b', border: '1px solid #e2e8f0' }}>Description</th>
              <th style={{ padding: '4px 8px', textAlign: 'right', fontSize: 8, color: '#64748b', border: '1px solid #e2e8f0' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {deductions.length === 0 && (
              <tr><td colSpan={2} style={{ padding: '8px', textAlign: 'center', fontSize: 9, color: '#94a3b8' }}>No deductions</td></tr>
            )}
            {deductions.map((d, i) => (
              <tr key={i} style={{ background: i%2===0?'#fff':'#fafafa' }}>
                <td style={{ padding: '5px 8px', fontSize: 9, color: '#374151', border: '1px solid #f1f5f9' }}>{d.label}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 9, color: '#991b1b', fontWeight: 500, border: '1px solid #f1f5f9' }}>{fmt(d.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#fef2f2', borderTop: '1px solid #fecaca' }}>
              <td style={{ padding: '6px 8px', fontWeight: 700, fontSize: 9.5, color: '#991b1b' }}>Total Deductions</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, fontSize: 9.5, color: '#991b1b' }}>{fmt(slip.totalDeductions)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Net Pay */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '2px solid #1e293b', borderRadius: 6, padding: '10px 18px', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1, textTransform: 'uppercase' }}>Net Pay (Take Home)</div>
          <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 2 }}>
            Gross {fmt(slip.grossEarnings)} − Deductions {fmt(slip.totalDeductions)}
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#1e293b' }}>{fmt(slip.netPay)}</div>
      </div>

      {/* Employer contributions */}
      {(slip.statutory || []).some(s => s.employerAmt > 0) && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: '5px 10px', marginBottom: 12, fontSize: 8.5, color: '#374151', background: '#f8fafc' }}>
          <strong>Employer Contributions (not deducted from employee):</strong>&nbsp;
          {(slip.statutory || []).filter(s => s.employerAmt > 0).map(s => (
            <span key={s.key} style={{ marginRight: 12 }}>{s.name}: <strong>{fmt(s.employerAmt)}</strong></span>
          ))}
          · Total: <strong>{fmt(slip.totalStatutoryEmployer)}</strong>
        </div>
      )}

      {/* Payment info */}
      {slip.status === 'paid' && (slip.paymentMethod || slip.paymentReference) && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: '5px 10px', marginBottom: 12, fontSize: 8.5, background: '#f8fafc', display: 'flex', gap: 16 }}>
          {slip.paymentMethod    && <span>Method: <strong>{slip.paymentMethod}</strong></span>}
          {slip.paymentReference && <span>Reference: <strong>{slip.paymentReference}</strong></span>}
          {slip.paidAt           && <span>Date: <strong>{new Date(slip.paidAt).toLocaleDateString()}</strong></span>}
        </div>
      )}

      {/* Extra Note / Remarks */}
      {slip.extraNote && (
        <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#b45309', marginBottom: 2, textTransform: 'uppercase' }}>Remarks</div>
          <div style={{ fontSize: 10, color: '#92400e' }}>{slip.extraNote}</div>
        </div>
      )}

      {/* Signatures */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginTop: 28 }}>
        {['Employee Signature', 'Accountant / HR', 'Authorized Signatory'].map(label => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ height: 36, borderBottom: '1px solid #94a3b8', marginBottom: 6 }} />
            <div style={{ fontSize: 8, color: '#64748b', fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, borderTop: '1px dashed #e2e8f0', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 7.5, color: '#94a3b8' }}>
        <span>Computer-generated salary voucher.</span>
        <span>{branchName} · {periodLabel(period)} · {new Date().toLocaleDateString()}</span>
      </div>
    </div>
  )
}
