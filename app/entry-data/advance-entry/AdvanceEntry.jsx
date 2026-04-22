/* eslint-disable react/prop-types */
'use client'
import React, { useEffect, useRef, useState } from 'react'
import { NumericFormat } from 'react-number-format'
import {
  useAddAdvanceEntryMutation,
} from '@/lib/redux/api/AdvanceApiSlice'
import { useGetStaffListQuery } from '@/lib/redux/api/staffApiSlice'
import {
  useAddStaffLoanMutation,
} from '@/lib/redux/api/staffLoanApiSlice'

// ─── Constants ────────────────────────────────────────────────────────────────

const ADVANCE_TYPES = [
  { value: 'salary',    label: 'Salary Advance' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'personal',  label: 'Personal' }
]

const LOAN_DURATIONS = [3, 6, 9, 12, 18, 24]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getStaffName = staff => {
  if (!staff) return ''
  if (staff.firstName || staff.lastName)
    return `${staff.firstName || ''} ${staff.lastName || ''}`.trim()
  return staff.name || staff.staffName || ''
}

const inputCls =
  'w-full border-2 border-mint-300 rounded-lg px-3 py-2.5 text-sm bg-white ' +
  'focus:outline-none focus:border-mint-500 transition-colors'

const Field = ({ label, required, hint, children }) => (
  <div>
    <label className='block text-sm font-medium text-gray-700 mb-1.5'>
      {label}
      {required && <span className='text-red-500 ml-0.5'>*</span>}
      {hint && <span className='ml-1.5 text-xs font-normal text-gray-400'>{hint}</span>}
    </label>
    {children}
  </div>
)

const Section = ({ title, children }) => (
  <div className='px-5 py-4 space-y-4 border-b border-gray-100 last:border-b-0'>
    <p className='text-[11px] font-bold text-gray-400 uppercase tracking-widest'>{title}</p>
    {children}
  </div>
)

const Alert = ({ type, message }) => {
  const styles = {
    error:   'bg-red-50 border-red-300 text-red-700',
    success: 'bg-green-50 border-green-300 text-green-700',
    info:    'bg-blue-50 border-blue-200 text-blue-700',
    warning: 'bg-amber-50 border-amber-300 text-amber-800',
  }
  const icons = { error: '❌', success: '✅', info: 'ℹ️', warning: '⚠️' }
  return (
    <div className={`flex gap-2 items-start p-3.5 border rounded-xl text-sm ${styles[type]}`}>
      <span className='shrink-0'>{icons[type]}</span>
      <span>{message}</span>
    </div>
  )
}

// ─── Searchable Staff Dropdown ────────────────────────────────────────────────

const StaffDropdown = ({ staffList, value, onChange }) => {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    const close = e => { if (!containerRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const selected = staffList.find(s => s.id === value) ?? null
  const filtered = staffList.filter(s =>
    getStaffName(s).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div ref={containerRef} className='relative'>
      <div
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 border-2 rounded-lg px-3 py-2.5 bg-white cursor-text transition-colors
          ${open ? 'border-mint-500 ring-2 ring-mint-100' : 'border-mint-300'}`}
      >
        <svg className='w-4 h-4 text-gray-400 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z' />
        </svg>
        {selected ? (
          <>
            <span className='flex-1 text-sm font-medium text-gray-800'>
              {getStaffName(selected)}
              {selected.role && <span className='ml-1.5 text-xs font-normal text-gray-400 capitalize'>· {selected.role}</span>}
            </span>
            <button
              type='button'
              onClick={e => { e.stopPropagation(); onChange(null); setSearch('') }}
              className='text-gray-400 hover:text-gray-600 transition-colors text-base leading-none'
            >✕</button>
          </>
        ) : (
          <input
            type='text'
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder='Type to search staff…'
            className='flex-1 text-sm outline-none bg-transparent placeholder-gray-400'
          />
        )}
      </div>
      {open && !selected && (
        <ul className='absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto'>
          {filtered.length === 0 ? (
            <li className='px-4 py-3 text-sm text-gray-400 text-center'>No staff found</li>
          ) : (
            filtered.map(staff => (
              <li key={staff.id}>
                <button
                  type='button'
                  onClick={() => { onChange(staff); setSearch(''); setOpen(false) }}
                  className='w-full text-left px-4 py-2.5 hover:bg-mint-50 transition-colors'
                >
                  <p className='text-sm font-medium text-gray-800'>{getStaffName(staff)}</p>
                  {staff.role && <p className='text-xs text-gray-400 capitalize'>{staff.role}</p>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

// ─── Helper: compute next-month deduction label ───────────────────────────────

const getNextMonthDeduction = fromDateStr => {
  const base = fromDateStr ? new Date(fromDateStr) : new Date()
  base.setDate(1)
  base.setMonth(base.getMonth() + 1)
  const label = base.toLocaleString('default', { month: 'long', year: 'numeric' })
  const value = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`
  return { label, value }
}

// ─── ADVANCE FORM ─────────────────────────────────────────────────────────────

const AdvanceForm = ({ staffList, staffLoading, companyId, branchId, isAdminOrManager }) => {
  const today = new Date().toISOString().split('T')[0]

  const [staffId, setStaffId] = useState('')
  const [form, setForm] = useState({ amount: '', advanceType: 'personal', reason: '', date: today, paidFromOffice: 'front', approvalNotes: '' })
  const [successMsg, setSuccessMsg] = useState('')

  const [addAdvanceEntry, { isLoading, isError, error }] = useAddAdvanceEntryMutation()

  const set = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))
  const amount = Number(form.amount) || 0
  const canSubmit = !!staffId && amount > 0 && !!form.reason && !isLoading
  const deduction = getNextMonthDeduction(form.date)

  const handleSubmit = async e => {
    e.preventDefault()
    if (!canSubmit) return
    const createdBy = JSON.parse(localStorage.getItem('user') || '{}')
    const selectedStaff = staffList.find(s => s.id === staffId)
    const approved = isAdminOrManager

    try {
      await addAdvanceEntry({
        companyId,
        branchId,
        data: {
          staffId:        selectedStaff?.id || '',
          staffName:      getStaffName(selectedStaff),
          amount,
          advanceType:    form.advanceType,
          reason:         form.reason,
          date:           form.date,
          deductionMonth: deduction.value,
          paidFromOffice: form.paidFromOffice,  // 'front' | 'back'
          status:         approved ? 'approved' : 'pending',
          deducted:       false,
          approvalNotes:  approved ? form.approvalNotes : '',
          createdBy,
        }
      }).unwrap()

      setStaffId('')
      setForm({ amount: '', advanceType: 'personal', reason: '', date: today, paidFromOffice: 'front', approvalNotes: '' })
      setSuccessMsg(approved
        ? `Advance recorded. Deducted from ${form.paidFromOffice === 'back' ? 'back office (bank)' : 'front office (cash)'}.`
        : 'Advance request submitted — pending manager approval.')
      setTimeout(() => setSuccessMsg(''), 5000)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='bg-white rounded-2xl border border-gray-100 shadow-sm'>
      <div className='p-5 space-y-3'>
        {isError    && <Alert type='error'   message={error?.message || 'Failed to submit.'} />}
        {successMsg && <Alert type='success' message={successMsg} />}
      </div>

      <Section title='Staff'>
        <Field label='Staff Member' required>
          {staffLoading ? (
            <div className='border-2 border-dashed border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-400'>Loading staff…</div>
          ) : (
            <StaffDropdown staffList={staffList} value={staffId} onChange={s => setStaffId(s?.id || '')} />
          )}
        </Field>
      </Section>

      <Section title='Advance Details'>
        <Field label='Type' required>
          <select name='advanceType' value={form.advanceType} onChange={set} className={inputCls}>
            {ADVANCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>

        <div className='grid grid-cols-2 gap-3'>
          <Field label='Amount' required>
            <NumericFormat
              value={form.amount}
              thousandSeparator={true}
              decimalScale={2}
              allowNegative={false}
              placeholder="0.00"
              className={inputCls}
              onValueChange={(values) => {
                setForm(p => ({ ...p, amount: values.value }))
              }}
            />
          </Field>
          <Field label='Date Given' required>
            <input type='date' name='date' value={form.date} onChange={set} required className={inputCls} />
          </Field>
        </div>

        <Field label='Reason' required>
          <textarea name='reason' value={form.reason} onChange={set} rows={3} placeholder='Reason for advance…' required className={`${inputCls} resize-none`} />
        </Field>
      </Section>

      {/* Deduction info — read-only */}
      <Section title='Salary Deduction'>
        <div className='flex items-center justify-between px-4 py-3.5 bg-mint-50 border border-mint-200 rounded-xl'>
          <div>
            <p className='text-xs text-gray-500 font-medium uppercase tracking-wide'>Will be deducted in</p>
            <p className='text-sm font-semibold text-mint-700 mt-0.5'>{deduction.label}</p>
          </div>
          {amount > 0 && (
            <div className='text-right'>
              <p className='text-xs text-gray-500 font-medium uppercase tracking-wide'>Amount</p>
              <p className='text-sm font-semibold text-mint-700 mt-0.5'>{amount.toLocaleString()}</p>
            </div>
          )}
        </div>
      </Section>

      {/* Cash source — front or back office */}
      <Section title='Cash Given From'>
        <div className='grid grid-cols-2 gap-2'>
          {[
            { value: 'front', label: 'Front Office', sub: 'Deducts from cash on hand' },
            { value: 'back',  label: 'Back Office',  sub: 'Deducts from bank / back cash' },
          ].map(opt => (
            <label
              key={opt.value}
              className={`flex flex-col gap-0.5 px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${
                form.paidFromOffice === opt.value
                  ? 'border-mint-500 bg-mint-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <input
                type='radio'
                name='paidFromOffice'
                value={opt.value}
                checked={form.paidFromOffice === opt.value}
                onChange={set}
                className='hidden'
              />
              <span className={`text-sm font-semibold ${form.paidFromOffice === opt.value ? 'text-mint-700' : 'text-gray-700'}`}>
                {opt.label}
              </span>
              <span className='text-xs text-gray-400'>{opt.sub}</span>
            </label>
          ))}
        </div>
      </Section>

      {isAdminOrManager && (
        <Section title='Notes'>
          <Field label='Internal Notes' hint='(optional)'>
            <textarea name='approvalNotes' value={form.approvalNotes} onChange={set} rows={2} placeholder='Internal notes…' className={`${inputCls} resize-none`} />
          </Field>
        </Section>
      )}

      <div className='p-5'>
        <button
          type='submit'
          disabled={!canSubmit}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
            !canSubmit
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-mint-600 hover:bg-mint-700 active:scale-[0.98] text-white shadow-sm'
          }`}
        >
          {isLoading ? 'Saving…' : isAdminOrManager ? 'Record Advance & Deduct Cash' : 'Request Advance'}
        </button>
      </div>
    </form>
  )
}

// ─── LOAN FORM ────────────────────────────────────────────────────────────────

const LoanForm = ({ staffList, staffLoading, companyId, branchId, isAdminOrManager }) => {
  const today = new Date().toISOString().split('T')[0]

  const BLANK_FORM = { amount: '', durationMonths: '6', alreadyPaidMonths: '0', reason: '', date: today, repaymentStartDate: '', paidFromOffice: 'front', approvalNotes: '' }

  const [staffId, setStaffId] = useState('')
  const [form, setForm] = useState(BLANK_FORM)
  const [isMigration, setIsMigration] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const [addStaffLoan, { isLoading, isError, error }] = useAddStaffLoanMutation()

  const set = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const amount      = Number(form.amount) || 0
  const duration    = Number(form.durationMonths) || 1
  const alreadyPaid = isMigration ? Math.min(Number(form.alreadyPaidMonths) || 0, duration - 1) : 0
  const emi         = amount > 0 ? Math.ceil(amount / duration) : 0
  const canSubmit   = !!staffId && amount > 0 && !!form.reason && !isLoading

  // Schedule preview — for migration, already-paid months are shown greyed out
  const schedule = React.useMemo(() => {
    if (!emi || !form.repaymentStartDate) return []
    const base = new Date(form.repaymentStartDate)
    base.setDate(1)
    return Array.from({ length: duration }, (_, i) => {
      const d = new Date(base)
      d.setMonth(d.getMonth() + i)
      const isLast = i === duration - 1
      return {
        label:      d.toLocaleString('default', { month: 'short', year: 'numeric' }),
        amount:     isLast ? amount - emi * (duration - 1) : emi,
        alreadyPaid: i < alreadyPaid,
      }
    })
  }, [emi, duration, amount, form.repaymentStartDate, alreadyPaid])

  const handleSubmit = async e => {
    e.preventDefault()
    if (!canSubmit) return
    const createdBy = JSON.parse(localStorage.getItem('user') || '{}')
    const selectedStaff = staffList.find(s => s.id === staffId)
    const approved = isAdminOrManager

    try {
      await addStaffLoan({
        companyId,
        branchId,
        data: {
          staffId:             selectedStaff?.id || '',
          staffName:           getStaffName(selectedStaff),
          amount,
          durationMonths:      duration,
          alreadyPaidMonths:   alreadyPaid,   // API uses this to pre-mark installments
          reason:              form.reason,
          date:                form.date,
          repaymentStartDate:  form.repaymentStartDate || null,
          paidFromOffice:      form.paidFromOffice,
          source:              isMigration ? 'migration' : 'new',
          approvalNotes:       approved ? form.approvalNotes : '',
          status:              approved ? 'approved' : 'pending',
          createdBy,
        }
      }).unwrap()

      setStaffId('')
      setIsMigration(false)
      setForm(BLANK_FORM)
      setSuccessMsg(approved
        ? isMigration
          ? `Migration loan recorded. ${alreadyPaid} installment${alreadyPaid !== 1 ? 's' : ''} marked as already paid. No cash deduction.`
          : `Loan recorded. Deducted from ${form.paidFromOffice === 'back' ? 'back office (bank)' : 'front office (cash)'}.`
        : 'Loan request submitted — pending manager approval.')
      setTimeout(() => setSuccessMsg(''), 5000)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='bg-white rounded-2xl border border-gray-100 shadow-sm'>
      <div className='p-5 space-y-3'>
        {isError    && <Alert type='error'   message={error?.message || 'Failed to submit.'} />}
        {successMsg && <Alert type='success' message={successMsg} />}
      </div>

      <Section title='Staff'>
        <Field label='Staff Member' required>
          {staffLoading ? (
            <div className='border-2 border-dashed border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-400'>Loading staff…</div>
          ) : (
            <StaffDropdown staffList={staffList} value={staffId} onChange={s => setStaffId(s?.id || '')} />
          )}
        </Field>
      </Section>

      <Section title='Loan Details'>
        <div className='grid grid-cols-2 gap-3'>
          <Field label='Loan Amount' required>
            <NumericFormat
              value={form.amount}
              thousandSeparator={true}
              decimalScale={2}
              allowNegative={false}
              placeholder="0.00"
              className={inputCls}
              onValueChange={(values) => {
                setForm(p => ({ ...p, amount: values.value }))
              }}
            />
          </Field>
          <Field label='Issue Date' required>
            <input type='date' name='date' value={form.date} onChange={set} required className={inputCls} />
          </Field>
        </div>

        <div className={`grid gap-3 ${isMigration ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <Field label='Total Duration' required>
            <select name='durationMonths' value={form.durationMonths} onChange={set} className={inputCls}>
              {LOAN_DURATIONS.map(n => <option key={n} value={n}>{n} months</option>)}
            </select>
          </Field>

          {isMigration && (
            <Field label='Months Already Paid' hint='(paid before this app)'>
              <select name='alreadyPaidMonths' value={form.alreadyPaidMonths} onChange={set} className={inputCls}>
                {Array.from({ length: duration }, (_, i) => i).map(n => (
                  <option key={n} value={n}>{n === 0 ? '0 — none paid yet' : `${n} month${n !== 1 ? 's' : ''} already paid`}</option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <Field label='Reason' required>
          <textarea name='reason' value={form.reason} onChange={set} rows={3} placeholder={isMigration ? 'e.g. Staff took 900 RM loan in Jan, 600 already paid manually.' : 'Purpose of this loan…'} required className={`${inputCls} resize-none`} />
        </Field>
      </Section>

      <Section title={isMigration ? 'Remaining Repayment Schedule' : 'Repayment Schedule'}>
        <Field label={isMigration ? 'First Deduction Month' : 'First EMI Month'}>
          <input type='date' name='repaymentStartDate' value={form.repaymentStartDate} onChange={set} min={form.date || today} className={inputCls} />
        </Field>

        {emi > 0 && (
          <div className='flex justify-between items-center px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm'>
            <span className='text-gray-600'>Monthly EMI</span>
            <span className='font-semibold text-blue-700'>
              {emi.toLocaleString()}
              <span className='text-xs font-normal text-gray-500 ml-1'>× {duration} mo</span>
            </span>
          </div>
        )}

        {schedule.length > 0 && (
          <div className='rounded-xl border border-gray-200 overflow-hidden'>
            <div className='flex justify-between px-4 py-2 bg-gray-50 border-b border-gray-200'>
              <span className='text-xs font-semibold text-gray-500 uppercase tracking-wide'>Month</span>
              <span className='text-xs font-semibold text-gray-500 uppercase tracking-wide'>EMI</span>
            </div>
            <div className='divide-y divide-gray-100 max-h-44 overflow-y-auto'>
              {schedule.map((row, i) => (
                <div key={i} className={`flex justify-between items-center px-4 py-2.5 text-sm transition-colors ${row.alreadyPaid ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                  <div className='flex items-center gap-2'>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold ${row.alreadyPaid ? 'bg-green-200 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {row.alreadyPaid ? '✓' : i + 1}
                    </span>
                    <span className={row.alreadyPaid ? 'text-green-700 line-through' : 'text-gray-700'}>{row.label}</span>
                    {row.alreadyPaid && <span className='text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-medium'>already paid</span>}
                    {!row.alreadyPaid && i === schedule.length - 1 && <span className='text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium'>final</span>}
                  </div>
                  <span className={`font-medium ${row.alreadyPaid ? 'text-green-600' : 'text-gray-800'}`}>{row.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className='flex justify-between px-4 py-2.5 bg-gray-50 border-t border-gray-200 text-sm font-semibold'>
              <span className='text-gray-600'>Total · {alreadyPaid > 0 ? <span className='text-green-600'>{alreadyPaid} pre-paid</span> : null}</span>
              <span className='text-gray-900'>{amount.toLocaleString()}</span>
            </div>
          </div>
        )}

      </Section>

      {/* Migration loan toggle */}
      <Section title='Loan Source'>
        <label className={`flex items-start gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${
          isMigration ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'
        }`}>
          <input
            type='checkbox'
            checked={isMigration}
            onChange={e => setIsMigration(e.target.checked)}
            className='mt-0.5 accent-amber-500'
          />
          <div>
            <span className={`text-sm font-semibold block ${isMigration ? 'text-amber-700' : 'text-gray-700'}`}>
              Migration / Pre-existing Loan
            </span>
            <span className='text-xs text-gray-500'>
              Staff already had this loan before this app was adopted. No cash will be deducted — only tracks remaining repayment.
            </span>
          </div>
        </label>

        <div className='mt-3 grid grid-cols-2 gap-2'>
          {[
            {
              value: 'front',
              label: 'Front Office (Cash)',
              sub: isMigration ? 'Originally given from cash' : 'Deducts from cash on hand',
            },
            {
              value: 'back',
              label: 'Back Office (Bank)',
              sub: isMigration ? 'Originally given from bank' : 'Deducts from bank / back cash',
            },
          ].map(opt => (
            <label
              key={opt.value}
              className={`flex flex-col gap-0.5 px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${
                form.paidFromOffice === opt.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <input
                type='radio'
                name='paidFromOffice'
                value={opt.value}
                checked={form.paidFromOffice === opt.value}
                onChange={set}
                className='hidden'
              />
              <span className={`text-sm font-semibold ${form.paidFromOffice === opt.value ? 'text-blue-700' : 'text-gray-700'}`}>
                {opt.label}
              </span>
              <span className='text-xs text-gray-400'>{opt.sub}</span>
            </label>
          ))}
        </div>
      </Section>

      {isAdminOrManager && (
        <Section title='Notes'>
          <Field label='Internal Notes' hint='(optional)'>
            <textarea name='approvalNotes' value={form.approvalNotes} onChange={set} rows={2} placeholder='Internal notes about this loan…' className={`${inputCls} resize-none`} />
          </Field>
        </Section>
      )}

      <div className='p-5'>
        <button
          type='submit'
          disabled={!canSubmit}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
            !canSubmit
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-sm'
          }`}
        >
          {isLoading ? 'Saving…' : isAdminOrManager ? (isMigration ? 'Record Migration Loan' : 'Record Loan & Deduct Cash') : 'Request Loan'}
        </button>
      </div>
    </form>
  )
}

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────

const AdvanceLoanEntry = () => {
  const [tab, setTab] = useState('advance')
  const [companyId,       setCompanyId]       = useState(null)
  const [branchId,        setBranchId]        = useState(null)
  const [currentUserRole, setCurrentUserRole] = useState(null)

  useEffect(() => {
    const parsed = JSON.parse(localStorage.getItem('user') || '{}')
    setCompanyId(parsed.companyId || null)
    setBranchId(parsed.branchId   || null)
    setCurrentUserRole(parsed.role || null)
  }, [])

  const { data: staffList = [], isLoading: staffLoading } = useGetStaffListQuery(
    { companyId, branchId },
    { skip: !companyId || !branchId }
  )

  const isAdminOrManager = currentUserRole === 'branchAdmin' || currentUserRole === 'manager'

  const sharedProps = { staffList, staffLoading, companyId, branchId, isAdminOrManager }

  return (
    <div className='min-h-screen bg-gradient-to-b from-mint-50 to-gray-50 p-4 md:p-8'>
      <div className='w-full max-w-lg mx-auto space-y-5'>

        {/* Header */}
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Advance & Loan</h1>
          <p className='text-sm text-gray-500 mt-0.5'>
            {isAdminOrManager
              ? 'Record a cash advance or loan for staff. Cash deducts immediately from the daily summary.'
              : 'Submit a request — your manager will review it.'}
          </p>
        </div>

        {/* Non-admin notice */}
        {!isAdminOrManager && (
          <Alert type='warning' message='Your request will be sent to the manager for approval before cash is released.' />
        )}

        {/* Tabs */}
        <div className='flex gap-1 p-1 bg-gray-200/60 rounded-xl'>
          {[
            { key: 'advance', label: 'Advance',  sub: 'Full deduction next salary',  activeClass: 'text-mint-600' },
            { key: 'loan',    label: 'Loan',      sub: 'Monthly EMI from salary',     activeClass: 'text-blue-600' },
          ].map(t => (
            <button
              key={t.key}
              type='button'
              onClick={() => setTab(t.key)}
              className={`flex-1 flex flex-col items-center py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                tab === t.key
                  ? `bg-white shadow-sm ${t.activeClass}`
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              <span className='text-[11px] font-normal text-gray-400 mt-0.5'>{t.sub}</span>
            </button>
          ))}
        </div>

        {/* Form */}
        {tab === 'advance' ? <AdvanceForm {...sharedProps} /> : <LoanForm {...sharedProps} />}

        <p className='text-xs text-center text-gray-400 pb-4'>
          All entries are logged and visible to branch management.
        </p>
      </div>
    </div>
  )
}

export default AdvanceLoanEntry
