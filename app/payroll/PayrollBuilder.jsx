/* eslint-disable react/prop-types */
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useGetStaffListQuery } from '@/lib/redux/api/staffApiSlice'
import { useGetBranchSettingsQuery } from '@/lib/redux/api/branchSettingsApiSlice'
import { useGetCompanyDetailsQuery } from '@/lib/redux/api/authApiSlice'
import { useGetSingleBranchQuery } from '@/lib/redux/api/branchApiSlice'
import { useGetAdvanceEntriesQuery } from '@/lib/redux/api/AdvanceApiSlice'
import { useGetStaffLoansQuery } from '@/lib/redux/api/staffLoanApiSlice'
import {
  useGetPayrollRunsQuery,
  useGetPayrollSlipsQuery,
  useCreatePayrollDraftMutation,
  useSaveDraftSlipsMutation,
  useFinalizePayrollRunMutation,
  useRevertPayrollRunMutation,
  useMarkPayrollRunPaidMutation,
  useDeletePayrollRunMutation,
} from '@/lib/redux/api/payrollRunApiSlice'
import { calcPayroll, fmtAmt, toPeriodKey, periodLabel } from '@/utils/payrollCalculations'
import { exportPayrollToPDF, exportPayrollToExcel, exportPayslipToPDF } from '@/utils/export/exportPayroll'
import { skipToken } from '@reduxjs/toolkit/query'
import PayrollPrintView from './components/PayrollPrintView'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const today = new Date()
const currentYear  = today.getFullYear()
const currentMonth = today.getMonth() + 1

function getStaffName (s) {
  if (!s) return ''
  if (s.firstName || s.lastName) return `${s.firstName || ''} ${s.lastName || ''}`.trim()
  return s.name || s.staffName || ''
}

function buildDefaultInputs () {
  return {
    workedHours: '',  workedDays: '',
    otHours: '',      phHours: '',  phDays: '',
    allowanceOverride: '',
    bonus: '',        bonusNote: '',
    otherEarnings: '', otherEarningsNote: '',
    penalty: '',      penaltyNote: '',
    otherDeductions: '', otherDeductionsNote: '',
    loanOverride: '', loanNote: '',
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

const Badge = ({ status }) => {
  const cls = {
    draft:     'bg-yellow-100 text-yellow-700',
    finalized: 'bg-blue-100 text-blue-700',
    paid:      'bg-green-100 text-green-700',
  }[status] || 'bg-gray-100 text-gray-500'
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${cls}`}>
      {status}
    </span>
  )
}

const InputNum = ({ label, value, onChange, placeholder, disabled }) => (
  <div>
    <label className='block text-[11px] font-medium text-gray-500 mb-0.5'>{label}</label>
    <input
      type='number'
      min='0'
      step='0.01'
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? '0'}
      disabled={disabled}
      className='w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-1 focus:ring-mint-400 outline-none disabled:opacity-40 disabled:bg-gray-50'
    />
  </div>
)

// ─── Staff slip card ───────────────────────────────────────────────────────────

function StaffSlipCard ({
  staff,
  inputs,
  setInputs,
  payrollConfig,
  advanceDed,
  loanDed,
  locked,
  onPrint,
  onExportPDF,
}) {
  const mode = staff.salaryMode || payrollConfig?.defaultPayMode || 'hours'
  const stdHours = parseFloat(staff.standardHours) || parseFloat(payrollConfig?.standardHoursPerMonth) || 208
  const wrkDays  = parseFloat(staff.workingDays)   || parseFloat(payrollConfig?.workingDaysPerMonth)   || 26

  const effectiveAllowance = inputs.allowanceOverride !== ''
    ? (parseFloat(inputs.allowanceOverride) || 0)
    : (parseFloat(staff.allowance) || 0)

  const staffConfig = {
    basicSalary:      parseFloat(staff.basicSalary)   || 0,
    allowance:        effectiveAllowance,
    salaryMode:       mode,
    standardHours:    stdHours,
    workingDays:      wrkDays,
    OTPerHour:        parseFloat(staff.OTPerHour)     || null,
    otMultiplier:     staff.otMultiplier  ?? payrollConfig?.otMultiplier  ?? 1.5,
    phMultiplier:     staff.phMultiplier  ?? payrollConfig?.phMultiplier  ?? 2.0,
    deductionSettings: staff.deductionSettings || {},
  }

  const effectiveLoan = inputs.loanOverride !== ''
    ? (parseFloat(inputs.loanOverride) || 0)
    : loanDed

  const calc = useMemo(() => calcPayroll(
    staffConfig,
    {
      workedHours:      parseFloat(inputs.workedHours)      || 0,
      workedDays:       parseFloat(inputs.workedDays)       || 0,
      otHours:          parseFloat(inputs.otHours)          || 0,
      phHours:          parseFloat(inputs.phHours)          || 0,
      phDays:           parseFloat(inputs.phDays)           || 0,
      bonus:            parseFloat(inputs.bonus)            || 0,
      otherEarnings:    parseFloat(inputs.otherEarnings)    || 0,
      penalty:          parseFloat(inputs.penalty)          || 0,
      otherDeductions:  parseFloat(inputs.otherDeductions)  || 0,
      advanceAmt:       advanceDed,
      loanAmt:          effectiveLoan,
    },
    payrollConfig?.statutoryDeductions || [],
    {
      otMultiplier: payrollConfig?.otMultiplier ?? 1.5,
      phMultiplier: payrollConfig?.phMultiplier ?? 2.0,
    }
  ), [inputs, staffConfig, advanceDed, effectiveLoan, payrollConfig])

  const set = (key, val) => setInputs(prev => ({ ...prev, [key]: val }))

  return (
    <div className='bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden'>
      {/* Staff header */}
      <div className='flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100'>
        <div>
          <p className='text-sm font-semibold text-gray-800'>{getStaffName(staff)}</p>
          <p className='text-xs text-gray-400 capitalize mt-0.5'>
            {staff.role || 'staff'} · {mode} mode · Basic {fmtAmt(staffConfig.basicSalary)}
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <p className={`text-base font-bold ${calc.netPay > 0 ? 'text-mint-700' : 'text-gray-400'}`}>
            {fmtAmt(calc.netPay)}
          </p>
          <button
            type='button'
            onClick={onPrint}
            title='Print payslip'
            className='text-gray-400 hover:text-gray-600 text-sm transition-colors'
          >
            🖨
          </button>
          <button
            type='button'
            onClick={onExportPDF}
            title='Download payslip PDF'
            className='text-red-400 hover:text-red-600 text-xs font-semibold transition-colors border border-red-200 rounded px-1.5 py-0.5'
          >
            PDF
          </button>
        </div>
      </div>

      {/* Attendance inputs */}
      {!locked && (
        <div className='px-4 py-3 border-b border-gray-100'>
          <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2'>Attendance</p>
          <div className='grid grid-cols-3 gap-2'>
            {mode === 'hours' ? (
              <>
                <InputNum
                  label={`Hours Worked (std: ${stdHours})`}
                  value={inputs.workedHours}
                  onChange={v => set('workedHours', v)}
                />
                <InputNum label='OT Hours' value={inputs.otHours} onChange={v => set('otHours', v)} />
                <InputNum label='PH Hours' value={inputs.phHours} onChange={v => set('phHours', v)} />
              </>
            ) : (
              <>
                <InputNum
                  label={`Days Worked (std: ${wrkDays})`}
                  value={inputs.workedDays}
                  onChange={v => set('workedDays', v)}
                />
                <InputNum label='OT Hours' value={inputs.otHours} onChange={v => set('otHours', v)} />
                <InputNum label='PH Days' value={inputs.phDays} onChange={v => set('phDays', v)} />
              </>
            )}
          </div>
          {/* Earnings adjustments */}
          <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2 mb-1'>Earnings</p>
          <div className='grid grid-cols-3 gap-2'>
            <InputNum
              label={`Allowance (default: ${fmtAmt(parseFloat(staff.allowance) || 0)})`}
              value={inputs.allowanceOverride}
              onChange={v => set('allowanceOverride', v)}
              placeholder={String(parseFloat(staff.allowance) || 0)}
            />
            <InputNum label='Bonus' value={inputs.bonus} onChange={v => set('bonus', v)} />
            <InputNum label='Other Earnings' value={inputs.otherEarnings} onChange={v => set('otherEarnings', v)} />
          </div>
          {parseFloat(inputs.bonus) > 0 && (
            <input type='text' placeholder='Bonus note…' value={inputs.bonusNote}
              onChange={e => set('bonusNote', e.target.value)}
              className='mt-1.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-mint-400 outline-none' />
          )}
          {parseFloat(inputs.otherEarnings) > 0 && (
            <input type='text' placeholder='Other earnings note…' value={inputs.otherEarningsNote}
              onChange={e => set('otherEarningsNote', e.target.value)}
              className='mt-1.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-mint-400 outline-none' />
          )}

          {/* Deduction adjustments */}
          <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-3 mb-1'>Deductions</p>
          <div className='grid grid-cols-3 gap-2'>
            <InputNum label='Penalty' value={inputs.penalty} onChange={v => set('penalty', v)} />
            <InputNum label='Other Deductions' value={inputs.otherDeductions} onChange={v => set('otherDeductions', v)} />
            <InputNum
              label={`Loan Deduction (auto: ${fmtAmt(loanDed)})`}
              value={inputs.loanOverride}
              onChange={v => set('loanOverride', v)}
              placeholder={String(loanDed || 0)}
            />
          </div>
          {parseFloat(inputs.penalty) > 0 && (
            <input type='text' placeholder='Penalty note…' value={inputs.penaltyNote}
              onChange={e => set('penaltyNote', e.target.value)}
              className='mt-1.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-mint-400 outline-none' />
          )}
          {parseFloat(inputs.otherDeductions) > 0 && (
            <input type='text' placeholder='Other deductions note…' value={inputs.otherDeductionsNote}
              onChange={e => set('otherDeductionsNote', e.target.value)}
              className='mt-1.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-mint-400 outline-none' />
          )}
          {inputs.loanOverride !== '' && (
            <input type='text' placeholder='Loan override note…' value={inputs.loanNote}
              onChange={e => set('loanNote', e.target.value)}
              className='mt-1.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-mint-400 outline-none' />
          )}
        </div>
      )}

      {/* Breakdown summary */}
      <div className='px-4 py-3 space-y-1 text-xs'>
        <div className='flex justify-between text-gray-600'>
          <span>Base Pay</span>
          <span className='font-medium'>{fmtAmt(calc.basePay)}</span>
        </div>
        {calc.allowance > 0 && (
          <div className='flex justify-between text-gray-600'>
            <span>Allowance</span>
            <span className='font-medium'>{fmtAmt(calc.allowance)}</span>
          </div>
        )}
        {calc.otPay > 0 && (
          <div className='flex justify-between text-gray-600'>
            <span>OT Pay</span>
            <span className='font-medium'>{fmtAmt(calc.otPay)}</span>
          </div>
        )}
        {calc.phPay > 0 && (
          <div className='flex justify-between text-gray-600'>
            <span>PH Pay</span>
            <span className='font-medium'>{fmtAmt(calc.phPay)}</span>
          </div>
        )}
        {calc.bonus > 0 && (
          <div className='flex justify-between text-green-600'>
            <span>Bonus{inputs.bonusNote ? ` (${inputs.bonusNote})` : ''}</span>
            <span className='font-medium'>+ {fmtAmt(calc.bonus)}</span>
          </div>
        )}
        {calc.otherEarnings > 0 && (
          <div className='flex justify-between text-gray-600'>
            <span>Other Earnings{inputs.otherEarningsNote ? ` (${inputs.otherEarningsNote})` : ''}</span>
            <span className='font-medium'>{fmtAmt(calc.otherEarnings)}</span>
          </div>
        )}
        <div className='flex justify-between font-semibold text-gray-800 border-t border-gray-100 pt-1 mt-1'>
          <span>Gross</span>
          <span>{fmtAmt(calc.grossEarnings)}</span>
        </div>

        {/* Statutory deductions */}
        {calc.statutory.map(s => (
          <div key={s.key} className='flex justify-between text-red-600'>
            <span>{s.name} (emp)</span>
            <span>- {fmtAmt(s.employeeAmt)}</span>
          </div>
        ))}
        {calc.advanceAmt > 0 && (
          <div className='flex justify-between text-red-600'>
            <span>Advance</span>
            <span>- {fmtAmt(calc.advanceAmt)}</span>
          </div>
        )}
        {calc.loanAmt > 0 && (
          <div className='flex justify-between text-red-600'>
            <span>Loan EMI{inputs.loanNote ? ` (${inputs.loanNote})` : ''}{inputs.loanOverride !== '' ? ' ✎' : ''}</span>
            <span>- {fmtAmt(calc.loanAmt)}</span>
          </div>
        )}
        {calc.penalty > 0 && (
          <div className='flex justify-between text-red-600'>
            <span>Penalty{inputs.penaltyNote ? ` (${inputs.penaltyNote})` : ''}</span>
            <span>- {fmtAmt(calc.penalty)}</span>
          </div>
        )}
        {calc.otherDeductions > 0 && (
          <div className='flex justify-between text-red-600'>
            <span>Other Deductions{inputs.otherDeductionsNote ? ` (${inputs.otherDeductionsNote})` : ''}</span>
            <span>- {fmtAmt(calc.otherDeductions)}</span>
          </div>
        )}

        <div className='flex justify-between font-bold text-mint-700 border-t border-gray-100 pt-1 mt-1 text-sm'>
          <span>Net Pay</span>
          <span>{fmtAmt(calc.netPay)}</span>
        </div>
        {calc.totalStatutoryEmployer > 0 && (
          <div className='flex justify-between text-gray-400 text-[11px]'>
            <span>Employer contributions</span>
            <span>{fmtAmt(calc.totalStatutoryEmployer)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main PayrollBuilder ───────────────────────────────────────────────────────

export default function PayrollBuilder () {
  const [companyId, setCompanyId]   = useState(null)
  const [branchId, setBranchId]     = useState(null)
  const [currentUser, setCurrentUser] = useState({})
  const [role, setRole]             = useState(null)
  const [authReady, setAuthReady]   = useState(false)

  const [year,  setYear]  = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const period = toPeriodKey(year, month)

  // Per-staff attendance inputs: { [staffId]: inputs }
  const [slipInputs, setSlipInputs] = useState({})

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPaidModal, setShowPaidModal] = useState(false)
  const [paidForm, setPaidForm] = useState({ method: '', reference: '', paidAt: '' })
  const [printTarget, setPrintTarget] = useState(null) // { mode: 'single'|'all', slip? }

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || '{}')
    setCompanyId(u.companyId || null)
    setBranchId(u.branchId  || null)
    setCurrentUser(u)
    setRole(u.role || null)
    setAuthReady(true)
  }, [])

  const skip = !companyId || !branchId

  const { data: staffList = [] }    = useGetStaffListQuery({ companyId, branchId }, { skip })
  const { data: branchSettings }    = useGetBranchSettingsQuery(skip ? skipToken : { companyId, branchId })
  const { data: companyData }       = useGetCompanyDetailsQuery(companyId ?? skipToken)
  const { data: branchDoc }         = useGetSingleBranchQuery(skip ? skipToken : { companyId, branchId })

  const companyName = companyData?.name || ''
  const branchName  = branchDoc?.name || branchSettings?.basic?.name || 'Branch'
  const { data: advanceList = [] }  = useGetAdvanceEntriesQuery({ companyId, branchId }, { skip })
  const { data: loanList = [] }     = useGetStaffLoansQuery({ companyId, branchId }, { skip })
  const { data: runs = [] }         = useGetPayrollRunsQuery(skip ? skipToken : { companyId, branchId, period })

  // Existing run for this period (if any) — defined early so slips query can use runId
  const existingRun = runs.find(r => r.period === period) || null
  const runId       = existingRun?.id || null
  const locked      = existingRun?.status === 'finalized' || existingRun?.status === 'paid'

  const { data: savedSlips = [] } = useGetPayrollSlipsQuery(
    companyId && branchId && runId ? { companyId, branchId, runId } : skipToken
  )

  // Reset inputs when period changes so stale inputs from previous period don't carry over
  const [lastPeriod, setLastPeriod] = useState(period)
  useEffect(() => {
    if (period !== lastPeriod) {
      setSlipInputs({})
      setInputsRestoredFor(null)
      setLastPeriod(period)
    }
  }, [period, lastPeriod])

  // Restore attendance inputs from saved slips when a draft is loaded / period changes
  const [inputsRestoredFor, setInputsRestoredFor] = useState(null)
  useEffect(() => {
    if (!savedSlips.length) return
    if (inputsRestoredFor === runId) return   // already restored for this run
    const restored = {}
    for (const slip of savedSlips) {
      restored[slip.staffId] = {
        workedHours:          String(slip.workedHours      ?? ''),
        workedDays:           String(slip.workedDays       ?? ''),
        otHours:              String(slip.otHours          ?? ''),
        phHours:              String(slip.phHours          ?? ''),
        phDays:               String(slip.phDays           ?? ''),
        allowanceOverride:    String(slip.allowanceOverride ?? ''),
        bonus:                String(slip.bonus            ?? ''),
        bonusNote:            slip.bonusNote               || '',
        otherEarnings:        String(slip.otherEarnings    ?? ''),
        otherEarningsNote:    slip.otherEarningsNote       || '',
        penalty:              String(slip.penalty          ?? ''),
        penaltyNote:          slip.penaltyNote             || '',
        otherDeductions:      String(slip.otherDeductions  ?? ''),
        otherDeductionsNote:  slip.otherDeductionsNote     || '',
        loanOverride:         slip.loanOverride != null ? String(slip.loanOverride) : '',
        loanNote:             slip.loanNote               || '',
      }
    }
    setSlipInputs(restored)
    setInputsRestoredFor(runId)
  }, [savedSlips, runId, inputsRestoredFor])

  const [createDraft]    = useCreatePayrollDraftMutation()
  const [saveDraftSlips] = useSaveDraftSlipsMutation()
  const [finalize]       = useFinalizePayrollRunMutation()
  const [revert]         = useRevertPayrollRunMutation()
  const [markPaid]       = useMarkPayrollRunPaidMutation()
  const [deleteDraft]    = useDeletePayrollRunMutation()

  const payrollConfig = branchSettings?.payroll || null

  const isAdminOrManager = role === 'branchAdmin' || role === 'manager'

  // ── Advance/loan deductions per staff for this period ─────────────────────
  const advanceByStaff = useMemo(() => {
    const map = {}
    for (const adv of advanceList) {
      if (!adv.staffId || adv.status !== 'approved') continue
      const inst = (adv.installments || []).find(i => i.month === period && i.status === 'pending')
      if (!inst) continue
      map[adv.staffId] = (map[adv.staffId] || []).concat({
        docId: adv.id, index: inst.index, amount: inst.amount,
      })
    }
    return map
  }, [advanceList, period])

  const loanByStaff = useMemo(() => {
    const map = {}
    for (const ln of loanList) {
      if (!ln.staffId || ln.status !== 'approved') continue
      const inst = (ln.installments || []).find(i => i.month === period && i.status === 'pending')
      if (!inst) continue
      map[ln.staffId] = (map[ln.staffId] || []).concat({
        docId: ln.id, index: inst.index, amount: inst.amount,
      })
    }
    return map
  }, [loanList, period])

  // ── Totals for header ─────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let gross = 0, net = 0, empCost = 0
    for (const staff of staffList) {
      const inputs  = slipInputs[staff.id] || buildDefaultInputs()
      const advDed  = (advanceByStaff[staff.id] || []).reduce((s, a) => s + a.amount, 0)
      const loanDed = (loanByStaff[staff.id]    || []).reduce((s, a) => s + a.amount, 0)
      const mode    = staff.salaryMode || payrollConfig?.defaultPayMode || 'hours'
      const stdH    = parseFloat(staff.standardHours) || parseFloat(payrollConfig?.standardHoursPerMonth) || 208
      const wrkD    = parseFloat(staff.workingDays)   || parseFloat(payrollConfig?.workingDaysPerMonth)   || 26

      const effectiveLoanAmt = inputs.loanOverride !== ''
        ? (parseFloat(inputs.loanOverride) || 0)
        : loanDed
      const c = calcPayroll(
        {
          basicSalary: parseFloat(staff.basicSalary) || 0,
          allowance:   parseFloat(staff.allowance)   || 0,
          salaryMode: mode, standardHours: stdH, workingDays: wrkD,
          OTPerHour:   parseFloat(staff.OTPerHour)   || null,
          otMultiplier: staff.otMultiplier ?? payrollConfig?.otMultiplier ?? 1.5,
          phMultiplier: staff.phMultiplier ?? payrollConfig?.phMultiplier ?? 2.0,
          deductionSettings: staff.deductionSettings || {},
        },
        {
          workedHours:     parseFloat(inputs.workedHours)     || 0,
          workedDays:      parseFloat(inputs.workedDays)      || 0,
          otHours:         parseFloat(inputs.otHours)         || 0,
          phHours:         parseFloat(inputs.phHours)         || 0,
          phDays:          parseFloat(inputs.phDays)          || 0,
          bonus:           parseFloat(inputs.bonus)           || 0,
          otherEarnings:   parseFloat(inputs.otherEarnings)   || 0,
          penalty:         parseFloat(inputs.penalty)         || 0,
          otherDeductions: parseFloat(inputs.otherDeductions) || 0,
          advanceAmt: advDed, loanAmt: effectiveLoanAmt,
        },
        payrollConfig?.statutoryDeductions || [],
        { otMultiplier: payrollConfig?.otMultiplier ?? 1.5, phMultiplier: payrollConfig?.phMultiplier ?? 2.0 }
      )
      gross   += c.grossEarnings
      net     += c.netPay
      empCost += c.totalEmployerCost
    }
    return {
      gross:   Math.round(gross * 100) / 100,
      net:     Math.round(net * 100) / 100,
      empCost: Math.round(empCost * 100) / 100,
    }
  }, [staffList, slipInputs, advanceByStaff, loanByStaff, payrollConfig])

  function flash (type, msg) {
    if (type === 'error') setError(msg)
    else setSuccess(msg)
    setTimeout(() => { setError(''); setSuccess('') }, 5000)
  }

  // ── Build slips array from current inputs ─────────────────────────────────
  function buildSlips () {
    return staffList.map(staff => {
      const inputs  = slipInputs[staff.id] || buildDefaultInputs()
      const advItems = advanceByStaff[staff.id] || []
      const lnItems  = loanByStaff[staff.id]    || []
      const advDed   = advItems.reduce((s, a) => s + a.amount, 0)
      const loanDed  = lnItems.reduce((s,  a) => s + a.amount, 0)
      const mode    = staff.salaryMode || payrollConfig?.defaultPayMode || 'hours'
      const stdH    = parseFloat(staff.standardHours) || parseFloat(payrollConfig?.standardHoursPerMonth) || 208
      const wrkD    = parseFloat(staff.workingDays)   || parseFloat(payrollConfig?.workingDaysPerMonth)   || 26

      const effectiveSlipLoan = inputs.loanOverride !== ''
        ? (parseFloat(inputs.loanOverride) || 0)
        : loanDed

      // Build effective deductionMeta for loans:
      // - No override → use loan items as-is
      // - Override = 0 → skip all loan installments (don't mark any as paid)
      // - Override > 0 with one loan → store the override amount so finalizePayrollRun
      //   knows exactly how much was deducted (enables partial carry-over logic)
      let effectiveLnItems = lnItems
      if (inputs.loanOverride !== '') {
        const overrideAmt = parseFloat(inputs.loanOverride) || 0
        if (overrideAmt <= 0) {
          effectiveLnItems = []
        } else if (lnItems.length === 1) {
          effectiveLnItems = [{ ...lnItems[0], amount: overrideAmt }]
        }
        // Multiple loans with a single override: can't split cleanly, keep originals
      }

      const calc = calcPayroll(
        {
          basicSalary: parseFloat(staff.basicSalary) || 0,
          allowance:   parseFloat(staff.allowance)   || 0,
          salaryMode: mode, standardHours: stdH, workingDays: wrkD,
          OTPerHour:   parseFloat(staff.OTPerHour)   || null,
          otMultiplier: staff.otMultiplier ?? payrollConfig?.otMultiplier ?? 1.5,
          phMultiplier: staff.phMultiplier ?? payrollConfig?.phMultiplier ?? 2.0,
          deductionSettings: staff.deductionSettings || {},
        },
        {
          workedHours:     parseFloat(inputs.workedHours)     || 0,
          workedDays:      parseFloat(inputs.workedDays)      || 0,
          otHours:         parseFloat(inputs.otHours)         || 0,
          phHours:         parseFloat(inputs.phHours)         || 0,
          phDays:          parseFloat(inputs.phDays)          || 0,
          bonus:           parseFloat(inputs.bonus)           || 0,
          otherEarnings:   parseFloat(inputs.otherEarnings)   || 0,
          penalty:         parseFloat(inputs.penalty)         || 0,
          otherDeductions: parseFloat(inputs.otherDeductions) || 0,
          advanceAmt: advDed, loanAmt: effectiveSlipLoan,
        },
        payrollConfig?.statutoryDeductions || [],
        { otMultiplier: payrollConfig?.otMultiplier ?? 1.5, phMultiplier: payrollConfig?.phMultiplier ?? 2.0 }
      )

      return {
        staffId:      staff.id,
        staffName:    getStaffName(staff),
        designation:  staff.designation || staff.role || '',
        department:   staff.department  || staff.group || staff.role || '',
        calc,
        inputs: { ...inputs },
        deductionMeta: {
          advances: advItems,
          loans:    effectiveLnItems,
        },
      }
    })
  }

  // Build a single slip object for print (from current live inputs)
  function buildSingleSlipForPrint (staff) {
    const slipData = buildSlips().find(s => s.staffId === staff.id)
    if (!slipData) return null
    return {
      ...slipData.calc,
      staffId:      staff.id,
      staffName:    getStaffName(staff),
      designation:  staff.designation || staff.role || '',
      department:   staff.department  || staff.group || staff.role || '',
      status:       existingRun?.status || 'draft',
      bonusNote:           slipData.inputs?.bonusNote           || '',
      otherEarningsNote:   slipData.inputs?.otherEarningsNote   || '',
      penaltyNote:         slipData.inputs?.penaltyNote         || '',
      otherDeductionsNote: slipData.inputs?.otherDeductionsNote || '',
      loanNote:            slipData.inputs?.loanNote            || '',
    }
  }

  // Build all slips for print
  function buildAllSlipsForPrint () {
    return buildSlips().map(s => ({
      ...s.calc,
      staffId:      s.staffId,
      staffName:    s.staffName,
      designation:  s.designation || '',
      department:   s.department  || '',
      status:       existingRun?.status || 'draft',
      bonusNote:           s.inputs?.bonusNote           || '',
      otherEarningsNote:   s.inputs?.otherEarningsNote   || '',
      penaltyNote:         s.inputs?.penaltyNote         || '',
      otherDeductionsNote: s.inputs?.otherDeductionsNote || '',
      loanNote:            s.inputs?.loanNote            || '',
    }))
  }

  async function handleSaveDraft () {
    if (!isAdminOrManager) return
    setBusy(true); setError('')
    try {
      let activeRunId = runId
      if (!activeRunId) {
        const res = await createDraft({ companyId, branchId, period, createdBy: currentUser }).unwrap()
        activeRunId = res.id
      }
      await saveDraftSlips({
        companyId, branchId,
        runId: activeRunId,
        period,
        slips: buildSlips(),
      }).unwrap()
      flash('ok', 'Draft saved.')
    } catch (e) {
      flash('error', e.message || 'Failed to save draft')
    } finally {
      setBusy(false)
    }
  }

  async function handleFinalize () {
    if (!runId) return
    setBusy(true); setError('')
    try {
      // Save latest inputs first, then finalize
      await saveDraftSlips({ companyId, branchId, runId, period, slips: buildSlips() }).unwrap()
      await finalize({ companyId, branchId, runId, finalizedBy: currentUser }).unwrap()
      flash('ok', 'Payroll finalized. Advance/loan installments marked as paid.')
    } catch (e) {
      flash('error', e.message || 'Failed to finalize')
    } finally {
      setBusy(false)
    }
  }

  async function handleRevert () {
    if (!runId) return
    setBusy(true); setError('')
    try {
      await revert({ companyId, branchId, runId }).unwrap()
      flash('ok', 'Reverted to draft. Installments restored.')
    } catch (e) {
      flash('error', e.message || 'Failed to revert')
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkPaid () {
    if (!runId) return
    setBusy(true); setError('')
    try {
      await markPaid({
        companyId, branchId, runId,
        paidBy:           currentUser,
        paymentMethod:    paidForm.method,
        paymentReference: paidForm.reference,
        paidAt:           paidForm.paidAt || undefined,
      }).unwrap()
      setShowPaidModal(false)
      flash('ok', 'Payroll marked as paid.')
    } catch (e) {
      flash('error', e.message || 'Failed to mark paid')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete () {
    if (!runId || locked) return
    if (!confirm('Delete this draft payroll run?')) return
    setBusy(true)
    try {
      await deleteDraft({ companyId, branchId, runId }).unwrap()
      flash('ok', 'Draft deleted.')
    } catch (e) {
      flash('error', e.message || 'Failed to delete')
    } finally {
      setBusy(false)
    }
  }

  const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ]
  const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  if (!authReady) {
    return (
      <div className='flex items-center justify-center min-h-[50vh]'>
        <p className='text-gray-400 text-sm'>Loading…</p>
      </div>
    )
  }

  if (!isAdminOrManager) {
    return (
      <div className='flex items-center justify-center min-h-[50vh]'>
        <p className='text-gray-500 font-semibold'>Access restricted to branchAdmin and manager.</p>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-[var(--color-background)] p-4 md:p-8 pb-16'>
      <div className='max-w-5xl mx-auto space-y-6'>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>Run Payroll</h1>
            <p className='text-sm text-gray-500 mt-0.5'>Build, calculate, finalize, and pay staff for a period.</p>
          </div>

          {/* Period selector */}
          <div className='flex items-center gap-2'>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className='border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-mint-400 outline-none'
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className='border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-mint-400 outline-none'
            >
              {YEARS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Run status banner */}
        {existingRun && (
          <div className='flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3'>
            <div className='flex items-center gap-3'>
              <Badge status={existingRun.status} />
              <span className='text-sm text-gray-600'>
                {periodLabel(period)} payroll · {existingRun.staffCount || 0} staff
              </span>
            </div>
            <div className='flex items-center gap-3 text-sm'>
              <span className='text-gray-500'>Gross: <strong>{fmtAmt(existingRun.totalGross)}</strong></span>
              <span className='text-gray-500'>Net: <strong className='text-mint-700'>{fmtAmt(existingRun.totalNet)}</strong></span>
            </div>
          </div>
        )}

        {/* Totals summary */}
        {!existingRun && staffList.length > 0 && (
          <div className='grid grid-cols-3 gap-4'>
            {[
              { label: 'Total Gross',     val: totals.gross,   color: 'text-gray-800' },
              { label: 'Total Net Pay',   val: totals.net,     color: 'text-mint-700' },
              { label: 'Employer Cost',   val: totals.empCost, color: 'text-blue-700' },
            ].map(t => (
              <div key={t.label} className='bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 text-center'>
                <p className='text-xs font-medium text-gray-400 uppercase tracking-wide'>{t.label}</p>
                <p className={`text-xl font-bold mt-1 ${t.color}`}>{fmtAmt(t.val)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Alerts */}
        {error   && <div className='bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3'>{error}</div>}
        {success && <div className='bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3'>{success}</div>}

        {/* Action buttons */}
        <div className='flex flex-wrap gap-2'>
          {staffList.length > 0 && (
            <>
              <button
                onClick={() => setPrintTarget({ mode: 'all' })}
                className='px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors'
              >
                🖨 Print Payroll
              </button>
              <button
                onClick={() => exportPayrollToPDF(buildAllSlipsForPrint(), branchName, period, existingRun, companyName)}
                className='px-5 py-2.5 rounded-xl border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50 transition-colors'
              >
                PDF
              </button>
              <button
                onClick={() => exportPayrollToExcel(buildAllSlipsForPrint(), branchName, period, existingRun, companyName)}
                className='px-5 py-2.5 rounded-xl border border-green-200 text-green-700 text-sm font-medium hover:bg-green-50 transition-colors'
              >
                Excel
              </button>
            </>
          )}
          {!locked && (
            <button
              onClick={handleSaveDraft}
              disabled={busy || staffList.length === 0}
              className='px-5 py-2.5 rounded-xl bg-mint-500 hover:bg-mint-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors'
            >
              {busy ? 'Saving…' : runId ? 'Update Draft' : 'Save Draft'}
            </button>
          )}
          {runId && existingRun?.status === 'draft' && (
            <button
              onClick={handleFinalize}
              disabled={busy}
              className='px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors'
            >
              Finalize Payroll
            </button>
          )}
          {runId && existingRun?.status === 'finalized' && (
            <>
              <button
                onClick={() => setShowPaidModal(true)}
                disabled={busy}
                className='px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors'
              >
                Mark as Paid
              </button>
              <button
                onClick={handleRevert}
                disabled={busy}
                className='px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors'
              >
                Revert to Draft
              </button>
            </>
          )}
          {runId && existingRun?.status === 'draft' && (
            <button
              onClick={handleDelete}
              disabled={busy}
              className='px-5 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors'
            >
              Delete Draft
            </button>
          )}
        </div>

        {/* Staff cards */}
        {staffList.length === 0 ? (
          <p className='text-sm text-gray-400 text-center py-12'>No staff found for this branch.</p>
        ) : (
          <div className='grid md:grid-cols-2 gap-4'>
            {staffList.map(staff => (
              <StaffSlipCard
                key={staff.id}
                staff={staff}
                inputs={slipInputs[staff.id] || buildDefaultInputs()}
                setInputs={inp => setSlipInputs(prev => ({ ...prev, [staff.id]: inp(prev[staff.id] || buildDefaultInputs()) }))}
                payrollConfig={payrollConfig}
                advanceDed={(advanceByStaff[staff.id] || []).reduce((s, a) => s + a.amount, 0)}
                loanDed={(loanByStaff[staff.id] || []).reduce((s, a) => s + a.amount, 0)}
                locked={locked}
                onPrint={() => setPrintTarget({ mode: 'single', slip: buildSingleSlipForPrint(staff) })}
                onExportPDF={() => {
                  const slip = buildSingleSlipForPrint(staff)
                  if (slip) exportPayslipToPDF(slip, branchName, period, companyName)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Mark Paid Modal ──────────────────────────────────────────────── */}
      {showPaidModal && (
        <div className='fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4' onClick={() => setShowPaidModal(false)}>
          <div className='bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4' onClick={e => e.stopPropagation()}>
            <h2 className='text-base font-bold text-gray-800'>Mark Payroll as Paid</h2>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Payment Method</label>
              <input
                type='text'
                placeholder='e.g. Bank Transfer, Cash…'
                value={paidForm.method}
                onChange={e => setPaidForm(f => ({ ...f, method: e.target.value }))}
                className='w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-mint-400'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Reference <span className='text-gray-400 font-normal'>(optional)</span></label>
              <input
                type='text'
                placeholder='Transaction ID or note…'
                value={paidForm.reference}
                onChange={e => setPaidForm(f => ({ ...f, reference: e.target.value }))}
                className='w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-mint-400'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Paid Date <span className='text-gray-400 font-normal'>(optional)</span></label>
              <input
                type='date'
                value={paidForm.paidAt}
                onChange={e => setPaidForm(f => ({ ...f, paidAt: e.target.value }))}
                className='w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-mint-400'
              />
            </div>
            <div className='flex justify-end gap-2 pt-2'>
              <button onClick={() => setShowPaidModal(false)} className='px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50'>Cancel</button>
              <button onClick={handleMarkPaid} disabled={busy} className='px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50'>
                {busy ? 'Saving…' : 'Confirm Paid'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Print Modal ──────────────────────────────────────────────────── */}
      {printTarget && (
        <PayrollPrintView
          mode={printTarget.mode}
          singleSlip={printTarget.slip}
          slips={buildAllSlipsForPrint()}
          run={existingRun}
          branchName={branchName}
          companyName={companyName}
          period={period}
          onClose={() => setPrintTarget(null)}
        />
      )}
    </div>
  )
}
