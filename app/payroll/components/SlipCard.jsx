'use client'
import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Printer } from 'lucide-react'
import { calcPayroll } from '@/lib/payroll/calculations'
import { Input, cn } from '@/app/components/ui'

/** A number box with a small label above it. */
const NumField = ({ label, value, onChange, placeholder, disabled }) => (
  <label className='block min-w-0'>
    <span className='mb-1 block truncate text-[11px] font-medium text-muted' title={label}>{label}</span>
    <Input
      type='number'
      inputMode='decimal'
      min='0'
      step='0.01'
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? '0'}
      disabled={disabled}
      className='tabular-nums disabled:opacity-60'
    />
  </label>
)

const NoteField = ({ placeholder, value, onChange }) => (
  <Input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className='mt-2 h-9 text-xs' />
)

const Group = ({ title, children }) => (
  <div>
    <p className='mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle'>{title}</p>
    {children}
  </div>
)

const Line = ({ label, value, tone, strong }) => (
  <div className={cn('flex justify-between gap-3', tone || 'text-muted', strong && 'mt-1.5 border-t border-line pt-1.5 font-semibold text-fg')}>
    <span className='min-w-0 truncate'>{label}</span>
    <span className='shrink-0 tabular-nums'>{value}</span>
  </div>
)

/**
 * One staff member's payslip in the payroll run: their net pay at a glance;
 * tap to open the hours, extras and deductions, with the slip worked out
 * below. The sums are calcPayroll's — this only lays them out.
 */
export default function SlipCard ({ staff, name, inputs, setInputs, payrollConfig, advanceDed, loanDed, locked, onPrint, money }) {
  const [open, setOpen] = useState(false)
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
  const deductions = calc.grossEarnings - calc.netPay
  const payBy = mode === 'hours' ? 'by the hour' : mode === 'days' ? 'by the day' : mode

  return (
    <div className={cn('overflow-hidden rounded-2xl border bg-surface shadow-card transition-colors', open ? 'border-brand/40' : 'border-line')}>
      <div className='flex items-center gap-2 p-3 sm:gap-3 sm:p-4'>
        <button type='button' onClick={() => setOpen(o => !o)} aria-expanded={open} className='flex min-w-0 flex-1 items-center gap-3 text-left'>
          <span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-sm font-bold text-brand'>
            {(name || '?').trim().charAt(0).toUpperCase()}
          </span>
          <span className='min-w-0 flex-1'>
            <span className='block truncate text-sm font-semibold text-fg'>{name}</span>
            <span className='block truncate text-[11px] text-muted'>
              <span className='capitalize'>{staff.role || 'staff'}</span> · paid {payBy} · basic {money(staffConfig.basicSalary)}
            </span>
          </span>
          <span className='shrink-0 text-right'>
            <span className={cn('block text-base font-bold tabular-nums', calc.netPay > 0 ? 'text-fg' : 'text-subtle')}>{money(calc.netPay)}</span>
            <span className='block text-[11px] text-subtle'>{deductions > 0 ? `${money(deductions)} taken off` : 'net pay'}</span>
          </span>
          <ChevronDown className={cn('size-4 shrink-0 text-subtle transition-transform', open && 'rotate-180')} />
        </button>
        <button type='button' onClick={onPrint} aria-label={`Print the payslip for ${name}`} className='flex size-9 shrink-0 items-center justify-center rounded-lg text-subtle hover:bg-surface-2 hover:text-fg'>
          <Printer className='size-4' />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className='overflow-hidden'>
            {!locked && (
              <div className='space-y-4 border-t border-line p-3 sm:p-4'>
                <Group title='Time worked'>
                  <div className='grid grid-cols-3 gap-2'>
                    {mode === 'hours' ? (
                      <>
                        <NumField label={`Hours (of ${stdHours})`} value={inputs.workedHours} onChange={v => set('workedHours', v)} />
                        <NumField label='OT hours' value={inputs.otHours} onChange={v => set('otHours', v)} />
                        <NumField label='Holiday hours' value={inputs.phHours} onChange={v => set('phHours', v)} />
                      </>
                    ) : (
                      <>
                        <NumField label={`Days (of ${wrkDays})`} value={inputs.workedDays} onChange={v => set('workedDays', v)} />
                        <NumField label='OT hours' value={inputs.otHours} onChange={v => set('otHours', v)} />
                        <NumField label='Holiday days' value={inputs.phDays} onChange={v => set('phDays', v)} />
                      </>
                    )}
                  </div>
                </Group>

                <Group title='Extra pay'>
                  <div className='grid grid-cols-3 gap-2'>
                    <NumField
                      label={`Allowance (usual ${money(parseFloat(staff.allowance) || 0)})`}
                      value={inputs.allowanceOverride}
                      onChange={v => set('allowanceOverride', v)}
                      placeholder={String(parseFloat(staff.allowance) || 0)}
                    />
                    <NumField label='Bonus' value={inputs.bonus} onChange={v => set('bonus', v)} />
                    <NumField label='Other' value={inputs.otherEarnings} onChange={v => set('otherEarnings', v)} />
                  </div>
                  {parseFloat(inputs.bonus) > 0 && <NoteField placeholder='What the bonus is for…' value={inputs.bonusNote} onChange={v => set('bonusNote', v)} />}
                  {parseFloat(inputs.otherEarnings) > 0 && <NoteField placeholder='What the other pay is for…' value={inputs.otherEarningsNote} onChange={v => set('otherEarningsNote', v)} />}
                </Group>

                <Group title='Taken off'>
                  <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
                    <NumField label='Penalty' value={inputs.penalty} onChange={v => set('penalty', v)} />
                    <NumField label='Other' value={inputs.otherDeductions} onChange={v => set('otherDeductions', v)} />
                    <NumField label={`Loan (due ${money(loanDed)})`} value={inputs.loanOverride} onChange={v => set('loanOverride', v)} placeholder={String(loanDed || 0)} />
                    <NumField label='Advance (fixed)' value={advanceDed} onChange={() => {}} disabled />
                  </div>
                  {parseFloat(inputs.penalty) > 0 && <NoteField placeholder='Why the penalty…' value={inputs.penaltyNote} onChange={v => set('penaltyNote', v)} />}
                  {parseFloat(inputs.otherDeductions) > 0 && <NoteField placeholder='What the other deduction is…' value={inputs.otherDeductionsNote} onChange={v => set('otherDeductionsNote', v)} />}
                  {inputs.loanOverride !== '' && <NoteField placeholder='Why the loan amount changed…' value={inputs.loanNote} onChange={v => set('loanNote', v)} />}
                </Group>

                <Group title='Note on the payslip'>
                  <Input value={inputs.extraNote || ''} onChange={e => set('extraNote', e.target.value)} placeholder='Optional' className='text-sm' />
                </Group>
              </div>
            )}

            <div className='space-y-1 border-t border-line bg-surface-2/50 p-3 text-xs sm:p-4'>
              <Line label='Basic pay' value={money(calc.basePay)} />
              {calc.allowance > 0 && <Line label='Allowance' value={money(calc.allowance)} />}
              {calc.otPay > 0 && <Line label='Overtime' value={money(calc.otPay)} />}
              {calc.phPay > 0 && <Line label='Public holiday' value={money(calc.phPay)} />}
              {calc.bonus > 0 && <Line label={`Bonus${inputs.bonusNote ? ` (${inputs.bonusNote})` : ''}`} value={`+ ${money(calc.bonus)}`} tone='text-success' />}
              {calc.otherEarnings > 0 && <Line label={`Other pay${inputs.otherEarningsNote ? ` (${inputs.otherEarningsNote})` : ''}`} value={money(calc.otherEarnings)} />}
              <Line label='Gross' value={money(calc.grossEarnings)} strong />
              {calc.statutory.map(st => (
                <Line key={st.key} label={`${st.name} (staff share)`} value={`− ${money(st.employeeAmt)}`} tone='text-danger' />
              ))}
              {calc.advanceAmt > 0 && <Line label='Advance' value={`− ${money(calc.advanceAmt)}`} tone='text-danger' />}
              {calc.loanAmt > 0 && (
                <Line label={`Loan${inputs.loanNote ? ` (${inputs.loanNote})` : ''}${inputs.loanOverride !== '' ? ' · changed' : ''}`} value={`− ${money(calc.loanAmt)}`} tone='text-danger' />
              )}
              {calc.penalty > 0 && <Line label={`Penalty${inputs.penaltyNote ? ` (${inputs.penaltyNote})` : ''}`} value={`− ${money(calc.penalty)}`} tone='text-danger' />}
              {calc.otherDeductions > 0 && (
                <Line label={`Other${inputs.otherDeductionsNote ? ` (${inputs.otherDeductionsNote})` : ''}`} value={`− ${money(calc.otherDeductions)}`} tone='text-danger' />
              )}
              {(calc.advanceDue > calc.advanceAmt || calc.loanDue > calc.loanAmt) && (
                <p className='rounded-md bg-warning/10 px-2 py-1 text-warning'>
                  Pay doesn&apos;t cover everything due — {money((calc.advanceDue - calc.advanceAmt) + (calc.loanDue - calc.loanAmt))} carries to next month.
                </p>
              )}
              <div className='mt-1.5 flex justify-between gap-3 border-t border-line pt-1.5 text-sm font-bold text-brand'>
                <span>Net pay</span>
                <span className='tabular-nums'>{money(calc.netPay)}</span>
              </div>
              {calc.totalStatutoryEmployer > 0 && <Line label='Employer also pays' value={money(calc.totalStatutoryEmployer)} tone='text-subtle' />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
