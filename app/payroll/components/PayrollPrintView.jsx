/* eslint-disable react/prop-types */
'use client'

import React from 'react'
import { fmtAmt, periodLabel } from '@/utils/payrollCalculations'

// ─── Print styles ─────────────────────────────────────────────────────────────

function PrintStyles ({ landscape }) {
  return (
    <style>{`
      @media print {
        @page { size: ${landscape ? 'A4 landscape' : 'A4 portrait'}; margin: 10mm; }
        body * { visibility: hidden; }
        .print-root, .print-root * { visibility: visible; }
        .print-root { position: absolute; left: 0; top: 0; width: 100%; }
        .no-print { display: none !important; }
      }
    `}</style>
  )
}

// ─── Light-ink cell style helpers ────────────────────────────────────────────

const TH = (extra = {}) => ({
  padding: '4px 6px',
  background: '#f1f5f9',
  color: '#1e293b',
  fontWeight: 700,
  fontSize: 8,
  letterSpacing: 0.2,
  whiteSpace: 'nowrap',
  border: '1px solid #cbd5e1',
  textAlign: 'center',
  ...extra,
})

const TD = (extra = {}) => ({
  padding: '3px 6px',
  fontSize: 8.5,
  border: '1px solid #e2e8f0',
  color: '#1e293b',
  whiteSpace: 'nowrap',
  ...extra,
})

// ─── Individual Salary Voucher ────────────────────────────────────────────────

export function Payslip ({ slip, branchName, companyName, period }) {
  const isHours   = slip.salaryMode === 'hours'
  const currency  = 'RM'
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

  const statusColor = slip.status === 'paid' ? '#166534' : slip.status === 'finalized' ? '#1e40af' : '#92400e'

  return (
    <div className='print-root' style={{ fontFamily: 'Arial, sans-serif', maxWidth: 680, margin: '0 auto' }}>
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
          <div style={{ marginTop: 4 }}>
            <span style={{ fontSize: 8, padding: '2px 8px', border: `1px solid ${statusColor}`, borderRadius: 10, color: statusColor, fontWeight: 700, textTransform: 'uppercase' }}>
              {slip.status || 'draft'}
            </span>
          </div>
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

// ─── Full Payroll Sheet (Landscape, light ink) ────────────────────────────────

export function PayrollSummaryTable ({ slips, branchName, companyName, period, run }) {
  const status   = run?.status || 'draft'
  const currency = 'RM'

  // Statutory columns
  const statKeys  = []
  const statNames = {}
  for (const slip of slips) {
    for (const s of (slip.statutory || [])) {
      if (!statNames[s.key]) { statKeys.push(s.key); statNames[s.key] = s.name }
    }
  }

  // Column visibility
  const totals = slips.reduce((acc, s) => ({
    otPay:          (acc.otPay          || 0) + (s.otPay          || 0),
    allowance:      (acc.allowance      || 0) + (s.allowance      || 0),
    advanceAmt:     (acc.advanceAmt     || 0) + (s.advanceAmt     || 0),
    loanAmt:        (acc.loanAmt        || 0) + (s.loanAmt        || 0),
    otherEarnings:  (acc.otherEarnings  || 0) + (s.otherEarnings  || 0),
    otherDeductions:(acc.otherDeductions|| 0) + (s.otherDeductions|| 0),
  }), {})

  const showOT      = totals.otPay          > 0
  const showAdvance = totals.advanceAmt     > 0
  const showLoan    = totals.loanAmt        > 0
  const showOtherE  = totals.otherEarnings  > 0
  const showOtherD  = totals.otherDeductions > 0

  // Department grouping
  const deptMap = {}
  for (const slip of slips) {
    const dept = slip.department || 'General'
    if (!deptMap[dept]) deptMap[dept] = []
    deptMap[dept].push(slip)
  }
  const depts = Object.keys(deptMap)

  // Grand totals
  const grand = { basePay:0,workedHours:0,otHours:0,otPay:0,allowance:0,advanceAmt:0,loanAmt:0,otherEarnings:0,otherDeductions:0,grossEarnings:0,netPay:0,stat:{} }
  for (const s of slips) {
    grand.basePay         += s.basePay         || 0
    grand.workedHours     += s.workedHours     || 0
    grand.otHours         += s.otHours         || 0
    grand.otPay           += s.otPay           || 0
    grand.allowance       += s.allowance       || 0
    grand.advanceAmt      += s.advanceAmt      || 0
    grand.loanAmt         += s.loanAmt         || 0
    grand.otherEarnings   += s.otherEarnings   || 0
    grand.otherDeductions += s.otherDeductions || 0
    grand.grossEarnings   += s.grossEarnings   || 0
    grand.netPay          += s.netPay          || 0
    for (const k of statKeys) {
      const f = (s.statutory||[]).find(x=>x.key===k)
      grand.stat[k] = (grand.stat[k]||0) + (f?.employeeAmt||0)
    }
  }

  const statusColor = status==='paid'?'#166534':status==='finalized'?'#1e40af':'#92400e'

  // helpers
  const numCell = (v, color) => (
    <td style={TD({ textAlign:'right', color: v>0?(color||'#1e293b'):'#94a3b8' })}>
      {v > 0 ? `${currency} ${fmtAmt(v)}` : '—'}
    </td>
  )

  const totalsCells = (data) => (
    <>
      <td style={TD({ textAlign:'right', fontWeight:700 })}>{currency} {fmtAmt(data.basePay||0)}</td>
      <td style={TD({ textAlign:'right', color:'#475569' })}>{fmtAmt(data.workedHours||0)}</td>
      {showOT && <>
        <td style={TD({ textAlign:'right' })}>{fmtAmt(data.otHours||0)}</td>
        <td style={TD({ textAlign:'right' })}>{currency} {fmtAmt(data.otPay||0)}</td>
      </>}
      <td style={TD({ textAlign:'right' })}>{data.allowance>0?`${currency} ${fmtAmt(data.allowance)}`:'—'}</td>
      {statKeys.map(k=><td key={k} style={TD({ textAlign:'right', color:'#991b1b' })}>{data.stat?.[k]>0?`${currency} ${fmtAmt(data.stat[k])}`:'—'}</td>)}
      {showAdvance && <td style={TD({ textAlign:'right', color:'#991b1b' })}>{data.advanceAmt>0?`${currency} ${fmtAmt(data.advanceAmt)}`:'—'}</td>}
      {showLoan    && <td style={TD({ textAlign:'right', color:'#991b1b' })}>{data.loanAmt>0?`${currency} ${fmtAmt(data.loanAmt)}`:'—'}</td>}
      {showOtherE  && <td style={TD({ textAlign:'right', color:'#166534' })}>{data.otherEarnings>0?`${currency} ${fmtAmt(data.otherEarnings)}`:'—'}</td>}
      {showOtherD  && <td style={TD({ textAlign:'right', color:'#991b1b' })}>{data.otherDeductions>0?`${currency} ${fmtAmt(data.otherDeductions)}`:'—'}</td>}
      <td style={TD({ textAlign:'right', fontWeight:700 })}>{currency} {fmtAmt(data.grossEarnings||0)}</td>
      <td style={TD({ textAlign:'right', fontWeight:700, color:'#166534' })}>{currency} {fmtAmt(data.netPay||0)}</td>
      <td style={TD({ textAlign:'left', fontSize:7.5, color:'#64748b' })} />
    </>
  )

  return (
    <div className='print-root' style={{ fontFamily:'Arial, sans-serif', fontSize:9 }}>
      {/* Title */}
      <div style={{ textAlign:'center', marginBottom:10 }}>
        {companyName && <div style={{ fontSize:9, color:'#64748b', fontWeight:600, letterSpacing:1, textTransform:'uppercase', marginBottom:2 }}>{companyName}</div>}
        <div style={{ fontSize:15, fontWeight:900, color:'#1e293b' }}>{branchName}</div>
        <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginTop:2 }}>Salary Sheet — {periodLabel(period)}</div>
        <div style={{ display:'flex', justifyContent:'center', gap:14, marginTop:4, fontSize:8.5, color:'#64748b' }}>
          <span>{slips.length} Staff</span>
          <span>·</span>
          <span style={{ color:statusColor, fontWeight:700, border:`1px solid ${statusColor}`, padding:'1px 8px', borderRadius:10 }}>{status.toUpperCase()}</span>
          {run?.paidAt && <span>· Paid: {new Date(run.paidAt).toLocaleDateString()}</span>}
        </div>
      </div>

      <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'auto' }}>
        <thead>
          {/* Group row */}
          <tr>
            <th colSpan={2} style={TH({ textAlign:'left' })}>Employee</th>
            <th style={TH()}>Designation</th>
            <th style={TH()}>Basic Pay</th>
            <th style={TH()}>Work Hrs</th>
            {showOT && <th colSpan={2} style={TH()}>Overtime</th>}
            <th style={TH()}>Allowance</th>
            {statKeys.map(k=><th key={k} style={TH({ color:'#991b1b' })}>{statNames[k]}</th>)}
            {showAdvance && <th style={TH({ color:'#991b1b' })}>Advance</th>}
            {showLoan    && <th style={TH({ color:'#991b1b' })}>Loan</th>}
            {showOtherE  && <th style={TH({ color:'#166534' })}>Other Earn.</th>}
            {showOtherD  && <th style={TH({ color:'#991b1b' })}>Penalty/Ded.</th>}
            <th style={TH({ fontWeight:800 })}>Total Salary</th>
            <th style={TH({ fontWeight:800, color:'#166534' })}>Net Pay</th>
            <th style={TH({ textAlign:'left' })}>Remarks</th>
          </tr>
          {/* Sub-header */}
          <tr style={{ background:'#f8fafc' }}>
            <th style={TH({ width:22, fontSize:7.5 })}>#</th>
            <th style={TH({ textAlign:'left' })}>Name</th>
            <th style={TH({ fontSize:7.5 })}>Role</th>
            <th style={TH({ textAlign:'right' })}>{currency}</th>
            <th style={TH({ textAlign:'right' })}>hrs</th>
            {showOT && <>
              <th style={TH({ textAlign:'right', fontSize:7.5 })}>OT hrs</th>
              <th style={TH({ textAlign:'right' })}>OT Pay</th>
            </>}
            <th style={TH({ textAlign:'right' })}>{currency}</th>
            {statKeys.map(k=><th key={k} style={TH({ textAlign:'right', color:'#991b1b' })}>{currency}</th>)}
            {showAdvance && <th style={TH({ textAlign:'right', color:'#991b1b' })}>{currency}</th>}
            {showLoan    && <th style={TH({ textAlign:'right', color:'#991b1b' })}>{currency}</th>}
            {showOtherE  && <th style={TH({ textAlign:'right', color:'#166534' })}>{currency}</th>}
            {showOtherD  && <th style={TH({ textAlign:'right', color:'#991b1b' })}>{currency}</th>}
            <th style={TH({ textAlign:'right', fontWeight:800 })}>{currency}</th>
            <th style={TH({ textAlign:'right', fontWeight:800, color:'#166534' })}>{currency}</th>
            <th style={TH({ textAlign:'left', fontSize:7.5 })}>notes</th>
          </tr>
        </thead>
        <tbody>
          {depts.map(dept => {
            const ds = deptMap[dept]
            const dt = { basePay:0,workedHours:0,otHours:0,otPay:0,allowance:0,advanceAmt:0,loanAmt:0,otherEarnings:0,otherDeductions:0,grossEarnings:0,netPay:0,stat:{} }
            for (const s of ds) {
              dt.basePay+=s.basePay||0; dt.workedHours+=s.workedHours||0; dt.otHours+=s.otHours||0; dt.otPay+=s.otPay||0
              dt.allowance+=s.allowance||0; dt.advanceAmt+=s.advanceAmt||0; dt.loanAmt+=s.loanAmt||0
              dt.otherEarnings+=s.otherEarnings||0; dt.otherDeductions+=s.otherDeductions||0
              dt.grossEarnings+=s.grossEarnings||0; dt.netPay+=s.netPay||0
              for (const k of statKeys) {
                const f=(s.statutory||[]).find(x=>x.key===k)
                dt.stat[k]=(dt.stat[k]||0)+(f?.employeeAmt||0)
              }
            }
            return (
              <React.Fragment key={dept}>
                {/* Department header */}
                <tr>
                  <td colSpan={99} style={{ padding:'4px 8px', background:'#f1f5f9', color:'#374151', fontWeight:700, fontSize:8.5, letterSpacing:0.5, borderTop:'2px solid #cbd5e1', borderBottom:'1px solid #cbd5e1', textTransform:'uppercase' }}>
                    {dept}
                  </td>
                </tr>
                {ds.map((s, idx) => {
                  const isH = s.salaryMode === 'hours'
                  const remarks = [
                    s.loanAmt > 0 && `Loan: ${currency} ${fmtAmt(s.loanAmt)}`,
                    s.advanceAmt > 0 && `Advance: ${currency} ${fmtAmt(s.advanceAmt)}`,
                    s.otherDeductionsNote && s.otherDeductions > 0 && s.otherDeductionsNote,
                    s.otherEarningsNote   && s.otherEarnings   > 0 && s.otherEarningsNote,
                  ].filter(Boolean).join(' | ')
                  return (
                    <tr key={s.staffId||idx} style={{ background: idx%2===0?'#fff':'#f8fafc' }}>
                      <td style={TD({ textAlign:'center', color:'#94a3b8', fontSize:7.5 })}>{idx+1}</td>
                      <td style={TD({ fontWeight:600, textAlign:'left' })}>{s.staffName}</td>
                      <td style={TD({ color:'#475569', textAlign:'left', fontSize:8 })}>{s.designation||'—'}</td>
                      <td style={TD({ textAlign:'right' })}>{currency} {fmtAmt(s.basePay)}</td>
                      <td style={TD({ textAlign:'right', color:'#475569' })}>{isH?fmtAmt(s.workedHours):`${s.workedDays||0}d`}</td>
                      {showOT&&<>
                        <td style={TD({ textAlign:'right', color:s.otHours>0?'#92400e':'#94a3b8' })}>{fmtAmt(s.otHours||0)}</td>
                        <td style={TD({ textAlign:'right', color:s.otPay>0?'#92400e':'#94a3b8' })}>{s.otPay>0?`${currency} ${fmtAmt(s.otPay)}`:'—'}</td>
                      </>}
                      <td style={TD({ textAlign:'right', color:s.allowance>0?'#1e293b':'#94a3b8' })}>{s.allowance>0?`${currency} ${fmtAmt(s.allowance)}`:'—'}</td>
                      {statKeys.map(k=>{
                        const f=(s.statutory||[]).find(x=>x.key===k)
                        return <td key={k} style={TD({ textAlign:'right', color:f?.employeeAmt>0?'#991b1b':'#94a3b8' })}>{f?.employeeAmt>0?fmtAmt(f.employeeAmt):'—'}</td>
                      })}
                      {showAdvance&&<td style={TD({ textAlign:'right', color:s.advanceAmt>0?'#991b1b':'#94a3b8' })}>{s.advanceAmt>0?`${currency} ${fmtAmt(s.advanceAmt)}`:'—'}</td>}
                      {showLoan&&<td style={TD({ textAlign:'right', color:s.loanAmt>0?'#991b1b':'#94a3b8' })}>{s.loanAmt>0?`${currency} ${fmtAmt(s.loanAmt)}`:'—'}</td>}
                      {showOtherE&&<td style={TD({ textAlign:'right', color:s.otherEarnings>0?'#166534':'#94a3b8' })}>{s.otherEarnings>0?`${currency} ${fmtAmt(s.otherEarnings)}`:'—'}</td>}
                      {showOtherD&&<td style={TD({ textAlign:'right', color:s.otherDeductions>0?'#991b1b':'#94a3b8' })}>{s.otherDeductions>0?`${currency} ${fmtAmt(s.otherDeductions)}`:'—'}</td>}
                      <td style={TD({ textAlign:'right', fontWeight:600 })}>{currency} {fmtAmt(s.grossEarnings)}</td>
                      <td style={TD({ textAlign:'right', fontWeight:700, color:'#166534' })}>{currency} {fmtAmt(s.netPay)}</td>
                      <td style={TD({ textAlign:'left', fontSize:7.5, color:'#64748b', maxWidth:120 })}>{remarks||''}</td>
                    </tr>
                  )
                })}
                {/* Dept subtotal if multiple depts */}
                {depts.length > 1 && (
                  <tr style={{ background:'#f1f5f9', borderTop:'1px solid #cbd5e1', borderBottom:'1px solid #cbd5e1' }}>
                    <td colSpan={3} style={TD({ fontWeight:700, textAlign:'left', fontSize:8.5, background:'#f1f5f9' })}>{dept} — Subtotal</td>
                    {totalsCells(dt)}
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr style={{ background:'#f1f5f9', borderTop:'2px solid #94a3b8' }}>
            <td colSpan={3} style={TD({ fontWeight:800, fontSize:9, textAlign:'left', background:'#f1f5f9' })}>
              GRAND TOTAL ({slips.length} staff)
            </td>
            {totalsCells(grand)}
          </tr>
        </tfoot>
      </table>

      {/* Employer contributions */}
      {slips.some(s=>(s.statutory||[]).some(x=>x.employerAmt>0)) && (
        <div style={{ marginTop:8, border:'1px solid #e2e8f0', borderRadius:4, padding:'5px 10px', background:'#f8fafc', fontSize:8.5, color:'#374151', display:'flex', gap:16, flexWrap:'wrap' }}>
          <strong>Employer Contributions (not deducted):</strong>
          {statKeys.map(k=>{
            const total=slips.reduce((s,slip)=>s+((slip.statutory||[]).find(x=>x.key===k)?.employerAmt||0),0)
            return total>0?<span key={k}>{statNames[k]}: <strong>{currency} {fmtAmt(total)}</strong></span>:null
          })}
          <span>Total Cost: <strong>{currency} {fmtAmt(slips.reduce((s,slip)=>s+(slip.totalEmployerCost||0),0))}</strong></span>
        </div>
      )}

      {/* Signatures */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:40, marginTop:28 }}>
        {['Prepared By','Checked By','Approved By'].map(label=>(
          <div key={label} style={{ textAlign:'center' }}>
            <div style={{ height:32, borderBottom:'1px solid #94a3b8', marginBottom:5 }} />
            <div style={{ fontSize:8.5, color:'#475569', fontWeight:600 }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:12, borderTop:'1px dashed #e2e8f0', paddingTop:6, display:'flex', justifyContent:'space-between', fontSize:7.5, color:'#94a3b8' }}>
        <span>Generated: {new Date().toLocaleString()}</span>
        <span>{[companyName, branchName].filter(Boolean).join(' · ')} · {periodLabel(period)}</span>
      </div>
    </div>
  )
}

// ─── Screen Preview Components ─────────────────────────────────────────────────

const PreviewRow = ({ label, val, bold, red }) => (
  <div className={`flex justify-between ${bold?'font-bold':''} ${red?'text-red-600':'text-gray-700'}`}>
    <span className='text-gray-500'>{label}</span>
    <span>{val}</span>
  </div>
)

export function ScreenPreviewSingle ({ slip, period, branchName }) {
  return (
    <div className='bg-white rounded-xl border border-gray-200 p-5 text-xs space-y-3'>
      <div className='flex justify-between items-start pb-2 border-b'>
        <div>
          <p className='font-bold text-sm text-gray-900'>{branchName}</p>
          <p className='text-gray-400 text-[10px] uppercase tracking-wide'>Salary Slip · {periodLabel(period)}</p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${slip.status==='paid'?'bg-green-100 text-green-700':slip.status==='finalized'?'bg-blue-100 text-blue-700':'bg-yellow-100 text-yellow-700'}`}>{slip.status||'draft'}</span>
      </div>
      <div className='font-semibold text-gray-800 text-sm'>{slip.staffName}</div>
      <div className='grid grid-cols-2 gap-x-4 gap-y-1'>
        <PreviewRow label='Basic Pay'    val={fmtAmt(slip.basePay)} />
        {slip.allowance>0    &&<PreviewRow label='Allowance'   val={fmtAmt(slip.allowance)} />}
        {slip.otPay>0        &&<PreviewRow label='OT Pay'      val={fmtAmt(slip.otPay)} />}
        {slip.phPay>0        &&<PreviewRow label='PH Pay'      val={fmtAmt(slip.phPay)} />}
        {slip.otherEarnings>0&&<PreviewRow label='Other Earn.' val={fmtAmt(slip.otherEarnings)} />}
        <PreviewRow label='Gross' val={fmtAmt(slip.grossEarnings)} bold />
        {(slip.statutory||[]).map(s=><PreviewRow key={s.key} label={s.name} val={`- ${fmtAmt(s.employeeAmt)}`} red />)}
        {slip.advanceAmt>0   &&<PreviewRow label='Advance'    val={`- ${fmtAmt(slip.advanceAmt)}`} red />}
        {slip.loanAmt>0      &&<PreviewRow label='Loan EMI'   val={`- ${fmtAmt(slip.loanAmt)}`} red />}
        {slip.otherDeductions>0&&<PreviewRow label='Other Ded.' val={`- ${fmtAmt(slip.otherDeductions)}`} red />}
      </div>
      <div className='flex justify-between items-center border-2 border-gray-900 rounded-xl px-4 py-3'>
        <span className='font-semibold text-xs'>Net Pay</span>
        <span className='text-lg font-extrabold'>RM {fmtAmt(slip.netPay)}</span>
      </div>
    </div>
  )
}

export function ScreenPreviewAll ({ slips, period, branchName, status }) {
  const totals = slips.reduce((a,s)=>({
    gross:a.gross+(s.grossEarnings||0), ded:a.ded+(s.totalDeductions||0), net:a.net+(s.netPay||0),
    allowance:a.allowance+(s.allowance||0), otPay:a.otPay+(s.otPay||0), otherEarnings:a.otherEarnings+(s.otherEarnings||0),
  }),{gross:0,ded:0,net:0,allowance:0,otPay:0,otherEarnings:0})
  const showAllowance=totals.allowance>0, showOT=totals.otPay>0, showOtherE=totals.otherEarnings>0
  return (
    <div className='bg-white rounded-xl border border-gray-200 overflow-hidden text-xs'>
      <div className='flex justify-between items-center px-4 py-3 border-b'>
        <div>
          <p className='font-bold text-sm text-gray-900'>{branchName}</p>
          <p className='text-gray-400 text-[10px]'>Payroll · {periodLabel(period)} · <span className='capitalize'>{status}</span></p>
        </div>
        <p className='text-gray-500'>{slips.length} staff</p>
      </div>
      <table className='w-full'>
        <thead className='bg-gray-50 text-gray-500 uppercase text-[9px] tracking-wide'>
          <tr>
            <th className='px-3 py-2 text-left'>Employee</th>
            <th className='px-3 py-2 text-right'>Basic</th>
            {showAllowance&&<th className='px-3 py-2 text-right'>Allowance</th>}
            {showOT&&<th className='px-3 py-2 text-right'>OT</th>}
            {showOtherE&&<th className='px-3 py-2 text-right'>Other</th>}
            <th className='px-3 py-2 text-right'>Gross</th>
            <th className='px-3 py-2 text-right'>Deductions</th>
            <th className='px-3 py-2 text-right font-bold'>Net Pay</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-gray-100'>
          {slips.map((s,i)=>(
            <tr key={s.staffId||i} className='hover:bg-gray-50'>
              <td className='px-3 py-2 font-medium'>{s.staffName}</td>
              <td className='px-3 py-2 text-right text-gray-600'>{fmtAmt(s.basePay)}</td>
              {showAllowance&&<td className='px-3 py-2 text-right text-gray-600'>{fmtAmt(s.allowance||0)}</td>}
              {showOT&&<td className='px-3 py-2 text-right text-gray-600'>{fmtAmt(s.otPay||0)}</td>}
              {showOtherE&&<td className='px-3 py-2 text-right text-gray-600'>{fmtAmt(s.otherEarnings||0)}</td>}
              <td className='px-3 py-2 text-right font-semibold'>{fmtAmt(s.grossEarnings)}</td>
              <td className='px-3 py-2 text-right text-red-600'>{fmtAmt(s.totalDeductions)}</td>
              <td className='px-3 py-2 text-right font-bold text-green-700'>{fmtAmt(s.netPay)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className='border-t-2 border-gray-300 bg-gray-50'>
          <tr>
            <td className='px-3 py-2 font-bold'>Total ({slips.length})</td>
            <td className='px-3 py-2 text-right font-semibold'>{fmtAmt(totals.gross-(totals.allowance+totals.otPay+totals.otherEarnings))}</td>
            {showAllowance&&<td className='px-3 py-2 text-right'>{fmtAmt(totals.allowance)}</td>}
            {showOT&&<td className='px-3 py-2 text-right'>{fmtAmt(totals.otPay)}</td>}
            {showOtherE&&<td className='px-3 py-2 text-right'>{fmtAmt(totals.otherEarnings)}</td>}
            <td className='px-3 py-2 text-right font-bold'>{fmtAmt(totals.gross)}</td>
            <td className='px-3 py-2 text-right text-red-600 font-semibold'>{fmtAmt(totals.ded)}</td>
            <td className='px-3 py-2 text-right font-bold text-green-700'>{fmtAmt(totals.net)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Default export — modal with Print button ─────────────────────────────────

export default function PayrollPrintView ({ mode, singleSlip, slips, branchName, companyName, period, run, onClose }) {
  const slip        = singleSlip
  const isLandscape = mode === 'all'

  return (
    <>
      {/* Screen overlay */}
      <div className='no-print fixed inset-0 bg-black/60 z-50 flex flex-col'>
        <div className='flex items-center justify-between px-4 py-3 bg-white border-b shrink-0 gap-2'>
          <div className='min-w-0'>
            {companyName && <p className='text-[10px] text-gray-400'>{companyName}</p>}
            <p className='font-semibold text-gray-800 text-sm truncate'>
              {mode==='single'?`Payslip — ${slip?.staffName}`:`${branchName} — Payroll Sheet`}
            </p>
          </div>
          <div className='flex gap-2 shrink-0'>
            <button onClick={()=>window.print()} className='px-4 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700'>
              🖨 Print
            </button>
            <button onClick={onClose} className='px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50'>
              Close
            </button>
          </div>
        </div>
        <div className='flex-1 overflow-auto p-6 bg-gray-100'>
          <div className='bg-white rounded-xl shadow-xl p-8 max-w-5xl mx-auto'>
            {mode==='single'&&slip  &&<Payslip slip={slip} branchName={branchName} companyName={companyName} period={period}/>}
            {mode==='all'   &&slips &&<PayrollSummaryTable slips={slips} branchName={branchName} companyName={companyName} period={period} run={run}/>}
          </div>
        </div>
      </div>

      {/* Print-only render */}
      <div className='hidden print:block'>
        <PrintStyles landscape={isLandscape}/>
        {mode==='single'&&slip  &&<Payslip slip={slip} branchName={branchName} companyName={companyName} period={period}/>}
        {mode==='all'   &&slips &&<PayrollSummaryTable slips={slips} branchName={branchName} companyName={companyName} period={period} run={run}/>}
      </div>
    </>
  )
}
