'use client'

import React from 'react'
import { fmtAmt, periodLabel } from '@/lib/payroll/calculations'
import useCurrency from '@/app/hooks/useCurrency'
import { currencyInfo } from '@/lib/region/currency'
import { TH, TD } from './printParts'

// ─── Full Payroll Sheet (Landscape, light ink) ────────────────────────────────

export function PayrollSummaryTable ({ slips, branchName, companyName, period, run }) {
  const status   = run?.status || 'draft'
  const currency = currencyInfo(useCurrency()).symbol

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
    bonus:          (acc.bonus          || 0) + (s.bonus          || 0),
    phPay:          (acc.phPay          || 0) + (s.phPay          || 0),
    penalty:        (acc.penalty        || 0) + (s.penalty        || 0),
  }), {})

  const showOT      = totals.otPay          > 0
  const showPH      = totals.phPay          > 0
  const showBonus   = totals.bonus          > 0
  const showAdvance = totals.advanceAmt     > 0
  const showLoan    = totals.loanAmt        > 0
  const showOtherE  = totals.otherEarnings  > 0
  const showOtherD  = totals.otherDeductions > 0
  const showPenalty = totals.penalty         > 0

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
    grand.phPay           += s.phPay           || 0
    grand.allowance       += s.allowance       || 0
    grand.bonus           += s.bonus           || 0
    grand.advanceAmt      += s.advanceAmt      || 0
    grand.loanAmt         += s.loanAmt         || 0
    grand.otherEarnings   += s.otherEarnings   || 0
    grand.penalty         += s.penalty         || 0
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
  const totalsCells = (data) => (
    <>
      <td style={TD({ textAlign:'right', fontWeight:700 })}>{currency} {fmtAmt(data.basePay||0)}</td>
      <td style={TD({ textAlign:'right', color:'#475569' })}>{fmtAmt(data.workedHours||0)}</td>
      {showOT && <>
        <td style={TD({ textAlign:'right' })}>{fmtAmt(data.otHours||0)}</td>
        <td style={TD({ textAlign:'right' })}>{currency} {fmtAmt(data.otPay||0)}</td>
      </>}
      {showPH && <td style={TD({ textAlign:'right' })}>{currency} {fmtAmt(data.phPay||0)}</td>}
      <td style={TD({ textAlign:'right' })}>{data.allowance>0?`${currency} ${fmtAmt(data.allowance)}`:'—'}</td>
      {showBonus && <td style={TD({ textAlign:'right', color:'#166534' })}>{data.bonus>0?`${currency} ${fmtAmt(data.bonus)}`:'—'}</td>}
      {statKeys.map(k=><td key={k} style={TD({ textAlign:'right', color:'#991b1b' })}>{data.stat?.[k]>0?`${currency} ${fmtAmt(data.stat[k])}`:'—'}</td>)}
      {showAdvance && <td style={TD({ textAlign:'right', color:'#991b1b' })}>{data.advanceAmt>0?`${currency} ${fmtAmt(data.advanceAmt)}`:'—'}</td>}
      {showLoan    && <td style={TD({ textAlign:'right', color:'#991b1b' })}>{data.loanAmt>0?`${currency} ${fmtAmt(data.loanAmt)}`:'—'}</td>}
      {showOtherE  && <td style={TD({ textAlign:'right', color:'#166534' })}>{data.otherEarnings>0?`${currency} ${fmtAmt(data.otherEarnings)}`:'—'}</td>}
      {showPenalty && <td style={TD({ textAlign:'right', color:'#991b1b' })}>{data.penalty>0?`${currency} ${fmtAmt(data.penalty)}`:'—'}</td>}
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
            <th style={TH()}>Basic/Rate</th>
            <th style={TH()}>Basic Pay</th>
            <th style={TH()}>Work Hrs</th>
            {showOT && <th colSpan={2} style={TH()}>Overtime</th>}
            {showPH && <th style={TH()}>PH Pay</th>}
            <th style={TH()}>Allowance</th>
            {showBonus && <th style={TH({ color:'#166534' })}>Bonus</th>}
            {statKeys.map(k=><th key={k} style={TH({ color:'#991b1b' })}>{statNames[k]}</th>)}
            {showAdvance && <th style={TH({ color:'#991b1b' })}>Advance</th>}
            {showLoan    && <th style={TH({ color:'#991b1b' })}>Loan</th>}
            {showOtherE  && <th style={TH({ color:'#166534' })}>Other Earn.</th>}
            {showPenalty && <th style={TH({ color:'#991b1b' })}>Penalty</th>}
            {showOtherD  && <th style={TH({ color:'#991b1b' })}>Deduction</th>}
            <th style={TH({ fontWeight:800 })}>Total Salary</th>
            <th style={TH({ fontWeight:800, color:'#166534' })}>Net Pay</th>
            <th style={TH({ textAlign:'left' })}>Remarks</th>
          </tr>
          {/* Sub-header */}
          <tr style={{ background:'#f8fafc' }}>
            <th style={TH({ width:22, fontSize:7.5 })}>#</th>
            <th style={TH({ textAlign:'left' })}>Name</th>
            <th style={TH({ fontSize:7.5 })}>Role</th>
            <th style={TH({ textAlign:'right', fontSize:7.5 })}>amt / rate</th>
            <th style={TH({ textAlign:'right' })}>{currency}</th>
            <th style={TH({ textAlign:'right' })}>hrs</th>
            {showOT && <>
              <th style={TH({ textAlign:'right', fontSize:7.5 })}>OT hrs</th>
              <th style={TH({ textAlign:'right' })}>OT Pay</th>
            </>}
            {showPH && <th style={TH({ textAlign:'right' })}>{currency}</th>}
            <th style={TH({ textAlign:'right' })}>{currency}</th>
            {showBonus && <th style={TH({ textAlign:'right', color:'#166534' })}>{currency}</th>}
            {statKeys.map(k=><th key={k} style={TH({ textAlign:'right', color:'#991b1b' })}>{currency}</th>)}
            {showAdvance && <th style={TH({ textAlign:'right', color:'#991b1b' })}>{currency}</th>}
            {showLoan    && <th style={TH({ textAlign:'right', color:'#991b1b' })}>{currency}</th>}
            {showOtherE  && <th style={TH({ textAlign:'right', color:'#166534' })}>{currency}</th>}
            {showPenalty && <th style={TH({ textAlign:'right', color:'#991b1b' })}>{currency}</th>}
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
              dt.bonus+=s.bonus||0; dt.phPay+=s.phPay||0; dt.penalty+=s.penalty||0
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
                    s.penalty > 0 && s.penaltyNote && `Penalty: ${s.penaltyNote}`,
                    s.otherDeductionsNote && s.otherDeductions > 0 && s.otherDeductionsNote,
                    s.otherEarningsNote   && s.otherEarnings   > 0 && s.otherEarningsNote,
                    s.extraNote,
                  ].filter(Boolean).join(' | ')
                  return (
                    <tr key={s.staffId||idx} style={{ background: idx%2===0?'#fff':'#f8fafc' }}>
                      <td style={TD({ textAlign:'center', color:'#94a3b8', fontSize:7.5 })}>{idx+1}</td>
                      <td style={TD({ fontWeight:600, textAlign:'left' })}>{s.staffName}</td>
                      <td style={TD({ color:'#475569', textAlign:'left', fontSize:8 })}>{s.designation||'—'}</td>
                      <td style={TD({ textAlign:'right', color:'#475569', fontSize:8 })}>{fmtAmt(s.basicSalary)} / {fmtAmt(isH ? (s.basicSalary / (s.standardHours || 208)) : (s.basicSalary / (s.workingDays || 26)))}</td>
                      <td style={TD({ textAlign:'right' })}>{currency} {fmtAmt(s.basePay)}</td>
                      <td style={TD({ textAlign:'right', color:'#475569' })}>{isH?fmtAmt(s.workedHours):`${s.workedDays||0}d`}</td>
                      {showOT&&<>
                        <td style={TD({ textAlign:'right', color:s.otHours>0?'#92400e':'#94a3b8' })}>{fmtAmt(s.otHours||0)}</td>
                        <td style={TD({ textAlign:'right', color:s.otPay>0?'#92400e':'#94a3b8' })}>{s.otPay>0?`${currency} ${fmtAmt(s.otPay)}`:'—'}</td>
                      </>}
                      {showPH && <td style={TD({ textAlign:'right', color:s.phPay>0?'#1e293b':'#94a3b8' })}>{s.phPay>0?`${currency} ${fmtAmt(s.phPay)}`:'—'}</td>}
                      <td style={TD({ textAlign:'right', color:s.allowance>0?'#1e293b':'#94a3b8' })}>{s.allowance>0?`${currency} ${fmtAmt(s.allowance)}`:'—'}</td>
                      {showBonus && <td style={TD({ textAlign:'right', color:s.bonus>0?'#166534':'#94a3b8' })}>{s.bonus>0?`${currency} ${fmtAmt(s.bonus)}`:'—'}</td>}
                      {statKeys.map(k=>{
                        const f=(s.statutory||[]).find(x=>x.key===k)
                        return <td key={k} style={TD({ textAlign:'right', color:f?.employeeAmt>0?'#991b1b':'#94a3b8' })}>{f?.employeeAmt>0?fmtAmt(f.employeeAmt):'—'}</td>
                      })}
                      {showAdvance&&<td style={TD({ textAlign:'right', color:s.advanceAmt>0?'#991b1b':'#94a3b8' })}>{s.advanceAmt>0?`${currency} ${fmtAmt(s.advanceAmt)}`:'—'}</td>}
                      {showLoan&&<td style={TD({ textAlign:'right', color:s.loanAmt>0?'#991b1b':'#94a3b8' })}>{s.loanAmt>0?`${currency} ${fmtAmt(s.loanAmt)}`:'—'}</td>}
                      {showOtherE&&<td style={TD({ textAlign:'right', color:s.otherEarnings>0?'#166534':'#94a3b8' })}>{s.otherEarnings>0?`${currency} ${fmtAmt(s.otherEarnings)}`:'—'}</td>}
                      {showPenalty&&<td style={TD({ textAlign:'right', color:s.penalty>0?'#991b1b':'#94a3b8' })}>{s.penalty>0?`${currency} ${fmtAmt(s.penalty)}`:'—'}</td>}
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
                    <td colSpan={4} style={TD({ fontWeight:700, textAlign:'left', fontSize:8.5, background:'#f1f5f9' })}>{dept} — Subtotal</td>
                    {totalsCells(dt)}
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr style={{ background:'#f1f5f9', borderTop:'2px solid #94a3b8' }}>
            <td colSpan={4} style={TD({ fontWeight:800, fontSize:9, textAlign:'left', background:'#f1f5f9' })}>
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
