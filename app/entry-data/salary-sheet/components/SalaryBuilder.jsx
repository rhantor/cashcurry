/* eslint-disable react/prop-types */
import React from 'react'
import { fmt } from '@/utils/salaryCalculations.js'

const avatar = s =>
  s.photoUrl ||
  `https://ui-avatars.com/api/?name=${s.firstName}+${s.lastName}&background=4f46e5&color=fff&size=80&bold=true`

// Upgraded Input to support "disabled/read-only" styling natively
const Input = ({ label, className = '', disabled, ...props }) => (
  <div className={`mb-4 ${className}`}>
    {label && (
      <label className='block text-[11px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wider'>
        {label}
      </label>
    )}
    <input
      disabled={disabled}
      className={`w-full px-3.5 py-2.5 border rounded-xl text-sm transition-all font-medium ${
        disabled
          ? 'bg-slate-50/50 border-slate-100 text-slate-400 cursor-not-allowed shadow-inner'
          : 'bg-white border-slate-200 text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 placeholder:text-slate-300'
      }`}
      {...props}
    />
  </div>
)

export default function SalaryBuilder ({
  staffList,
  paidStaffIds = new Set(),
  savedSheets = [], // ✅ NEW: To display saved data
  onRevert, // ✅ NEW: To unlock the salary
  selectedIds,
  toggleSelect,
  toggleAll,
  search,
  setSearch,
  getCalc,
  getRow,
  setRow,
  getAdvanceAmt,
  getLoanAmt
}) {
  const filteredStaff = staffList.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase())
  )
  const selectedStaff = staffList.filter(s => selectedIds.has(s.id))

  const filteredUnpaidStaff = filteredStaff.filter(s => !paidStaffIds.has(s.id))
  const isAllSelected =
    selectedIds.size === filteredUnpaidStaff.length &&
    filteredUnpaidStaff.length > 0

  return (
    <div className='grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 p-6 max-w-[1600px] mx-auto animate-in fade-in zoom-in-95 duration-500'>
      {/* 1. Sidebar */}
      <div className='bg-white rounded-3xl shadow-sm border border-slate-200 p-5 h-[calc(100vh-100px)] sticky top-6 flex flex-col'>
        <div className='flex justify-between items-center mb-6 px-1'>
          <div className='font-black text-slate-800 text-lg tracking-tight'>
            Team Members{' '}
            <span className='text-slate-400 font-medium text-sm ml-1'>
              ({staffList.length})
            </span>
          </div>
          <button
            onClick={toggleAll}
            disabled={filteredUnpaidStaff.length === 0}
            className='text-xs font-bold text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 px-3.5 py-1.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {isAllSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div className='relative mb-5'>
          <span className='absolute left-3.5 top-2.5 text-slate-400'>🔍</span>
          <input
            className='w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all font-medium text-slate-700 placeholder:text-slate-400'
            placeholder='Search staff...'
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className='flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar'>
          {filteredStaff.map(s => {
            const isSelected = selectedIds.has(s.id)
            const isPaid = paidStaffIds.has(s.id)
            const autoDeduct = getAdvanceAmt(s.id) + getLoanAmt(s.id)

            return (
              <div
                key={s.id}
                onClick={() => toggleSelect(s.id)} // ✅ Now paid staff are clickable so we can view them!
                className={`group flex items-center gap-3 p-3 rounded-2xl border-2 transition-all duration-200 ${
                  isPaid && !isSelected
                    ? 'bg-slate-50 border-slate-100 opacity-70 hover:opacity-100 cursor-pointer'
                    : isPaid && isSelected
                    ? 'bg-emerald-50 border-emerald-200 shadow-sm cursor-pointer'
                    : isSelected
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-transparent shadow-md shadow-indigo-600/20 transform scale-[1.02] cursor-pointer'
                    : 'bg-white border-transparent hover:border-slate-100 hover:bg-slate-50 cursor-pointer'
                }`}
              >
                {/* Checkbox / Paid Badge */}
                {isPaid ? (
                  <div
                    className={`w-5 h-5 flex items-center justify-center font-bold text-[12px] rounded-md transition-colors ${
                      isSelected
                        ? 'bg-emerald-500 text-white'
                        : 'text-emerald-500 bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    ✓
                  </div>
                ) : (
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'border-white bg-white/20'
                        : 'border-slate-300 group-hover:border-indigo-400'
                    }`}
                  >
                    {isSelected && (
                      <div className='w-2 h-2 bg-white rounded-sm' />
                    )}
                  </div>
                )}

                <img
                  src={avatar(s)}
                  className={`w-10 h-10 rounded-full object-cover border-2 shadow-sm bg-white ${
                    isPaid && !isSelected
                      ? 'border-slate-200 grayscale opacity-60'
                      : isSelected && !isPaid
                      ? 'border-white/20'
                      : 'border-slate-100'
                  }`}
                  alt=''
                />

                <div className='flex-1 min-w-0'>
                  <div
                    className={`font-bold text-sm truncate ${
                      isPaid
                        ? 'text-slate-700'
                        : isSelected
                        ? 'text-white'
                        : 'text-slate-800'
                    }`}
                  >
                    {s.firstName} {s.lastName}
                  </div>
                  <div
                    className={`text-xs truncate font-medium mt-0.5 ${
                      isPaid
                        ? 'text-slate-400'
                        : isSelected
                        ? 'text-indigo-100'
                        : 'text-slate-500'
                    }`}
                  >
                    {s.department}
                  </div>
                </div>

                {isPaid ? (
                  <span
                    className={`text-[9px] font-black px-2 py-1 rounded-md tracking-wider ${
                      isSelected
                        ? 'bg-emerald-200 text-emerald-800'
                        : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    PAID
                  </span>
                ) : autoDeduct > 0 ? (
                  <span
                    className={`text-[9px] font-black px-2 py-1 rounded-md tracking-wider ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-rose-100 text-rose-600'
                    }`}
                  >
                    LOAN
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {/* 2. Editor Area */}
      <div>
        {selectedIds.size === 0 && (
          <div className='flex flex-col items-center justify-center h-full min-h-[600px] bg-white rounded-3xl border-2 border-dashed border-slate-200'>
            <div className='text-7xl mb-6 opacity-40 transform hover:scale-110 transition-transform cursor-default'>
              👈
            </div>
            <div className='text-2xl font-black text-slate-800 tracking-tight'>
              Select staff to begin
            </div>
            <div className='text-slate-500 text-sm mt-3 font-medium'>
              Choose employees from the sidebar to view or process their salary
            </div>
          </div>
        )}

        {selectedStaff.map(staff => {
          const isPaid = paidStaffIds.has(staff.id)
          // ✅ If Paid: Pull from Firebase. If Draft: Calculate live.
          const savedData = isPaid
            ? savedSheets.find(s => s.staffId === staff.id)
            : null

          const row = isPaid ? savedData : getRow(staff.id)
          const calc = isPaid ? savedData : getCalc(staff)
          const adv = isPaid
            ? savedData.advanceAmt || 0
            : getAdvanceAmt(staff.id)
          const originalLoan = isPaid
            ? savedData.loanAmt || 0
            : getLoanAmt(staff.id)
          const activeLoanDeduction = isPaid
            ? savedData.loanAmt || 0
            : calc.loanAmt

          return (
            <div
              key={staff.id}
              className={`bg-white rounded-3xl shadow-sm border mb-8 overflow-hidden animate-in slide-in-from-bottom-4 duration-500 ${
                isPaid
                  ? 'border-emerald-200 ring-4 ring-emerald-50'
                  : 'border-slate-200'
              }`}
            >
              {/* ✅ NEW: Locked Banner for Paid Staff */}
              {isPaid && (
                <div className='bg-emerald-50 border-b border-emerald-100 p-4 px-8 flex justify-between items-center'>
                  <div className='flex items-center gap-3 text-emerald-800 font-bold text-sm'>
                    <span className='text-xl'>🔒</span> This salary has been
                    processed and saved.
                  </div>
                  <button
                    onClick={() => onRevert(staff.id)}
                    className='px-5 py-2 bg-white border-2 border-emerald-200 text-emerald-700 font-black rounded-xl shadow-sm hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all text-xs tracking-wide uppercase'
                  >
                    ✏️ Unlock to Edit
                  </button>
                </div>
              )}

              {/* Card Header */}
              <div
                className={`${
                  isPaid
                    ? 'bg-white'
                    : 'bg-gradient-to-r from-slate-50 to-white'
                } px-8 py-6 flex items-center gap-5 border-b border-slate-100`}
              >
                <img
                  src={avatar(staff)}
                  className={`w-14 h-14 rounded-full object-cover shadow-sm ring-4 ring-white ${
                    isPaid ? 'grayscale opacity-80' : ''
                  }`}
                />
                <div className='flex-1'>
                  <div className='font-black text-slate-900 text-xl tracking-tight mb-1'>
                    {staff.firstName} {staff.lastName}
                  </div>
                  <div className='text-xs font-bold text-slate-500 flex flex-wrap gap-x-4 gap-y-2'>
                    <span className='bg-slate-100 px-2.5 py-1 rounded-md text-slate-600'>
                      {staff.department}
                    </span>
                    <span className='flex items-center'>
                      Basic:{' '}
                      <span className='text-slate-800 ml-1'>
                        {fmt(staff.basicSalary)}
                      </span>
                    </span>
                    <span className='flex items-center'>
                      Profile Allowance:{' '}
                      <span className='text-slate-800 ml-1'>
                        {fmt(staff.allowance || 0)}
                      </span>
                    </span>
                  </div>
                </div>
                {(adv > 0 || activeLoanDeduction > 0) && (
                  <div
                    className={`text-xs font-bold px-4 py-2.5 rounded-xl border flex items-center gap-2 shadow-sm ${
                      isPaid
                        ? 'bg-slate-50 text-slate-500 border-slate-200'
                        : 'bg-rose-50 text-rose-700 border-rose-100'
                    }`}
                  >
                    {!isPaid && (
                      <span className='w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]' />
                    )}
                    Auto Deduct: {fmt(adv + activeLoanDeduction)}
                  </div>
                )}
              </div>

              {/* Detailed 3-Column Inputs */}
              <div
                className={`p-8 grid grid-cols-1 md:grid-cols-3 gap-10 ${
                  isPaid ? 'opacity-80 pointer-events-none' : ''
                }`}
              >
                {/* Col 1: Attendance */}
                <div>
                  <div className='inline-block px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-black uppercase tracking-widest mb-5'>
                    Attendance
                  </div>

                  <div className='flex bg-slate-100 p-1 rounded-xl mb-6 shadow-inner'>
                    {['hours', 'days'].map(m => (
                      <button
                        key={m}
                        disabled={isPaid}
                        onClick={() => setRow(staff.id, { mode: m })}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg capitalize transition-all ${
                          row.mode === m
                            ? 'bg-white shadow-md text-indigo-700'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  {row.mode === 'hours' ? (
                    <>
                      <Input
                        label={`Standard Hours`}
                        type='number'
                        disabled={isPaid}
                        value={row.standardHours}
                        onChange={e =>
                          setRow(staff.id, { standardHours: +e.target.value })
                        }
                      />
                      <Input
                        label={`Worked Hours`}
                        type='number'
                        disabled={isPaid}
                        value={row.workedHours}
                        onChange={e =>
                          setRow(staff.id, { workedHours: +e.target.value })
                        }
                      />
                    </>
                  ) : (
                    <>
                      <Input
                        label={`Working Days`}
                        type='number'
                        disabled={isPaid}
                        value={row.workingDays}
                        onChange={e =>
                          setRow(staff.id, { workingDays: +e.target.value })
                        }
                      />
                      <Input
                        label={`Worked Days`}
                        type='number'
                        disabled={isPaid}
                        value={row.workedDays}
                        onChange={e =>
                          setRow(staff.id, { workedDays: +e.target.value })
                        }
                      />
                    </>
                  )}
                  <Input
                    label={`OT Hours (Rate: ${staff.OTPerHour})`}
                    type='number'
                    disabled={isPaid}
                    value={row.otHours}
                    onChange={e =>
                      setRow(staff.id, { otHours: +e.target.value })
                    }
                  />
                </div>

                {/* Col 2: Adjustments & Custom Deductions */}
                <div>
                  <div className='inline-block px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-black uppercase tracking-widest mb-5'>
                    Adjustments
                  </div>

                  {/* --- Editable Allowance --- */}
                  <Input
                    label={`Allowance (Default: ${fmt(
                      parseFloat(staff.allowance) || 0
                    )})`}
                    type='number'
                    disabled={isPaid}
                    placeholder='0.00'
                    className='mb-2'
                    value={
                      row.customAllowance !== undefined
                        ? row.customAllowance
                        : isPaid
                        ? row.allowance
                        : parseFloat(staff.allowance) || 0
                    }
                    onChange={e =>
                      setRow(staff.id, {
                        customAllowance:
                          e.target.value === '' ? 0 : +e.target.value
                      })
                    }
                  />

                  <div className='flex gap-3 mb-2'>
                    <div className='w-1/2'>
                      <Input
                        label='Other Earn'
                        type='number'
                        disabled={isPaid}
                        placeholder='0.00'
                        value={row.otherEarnings}
                        onChange={e =>
                          setRow(staff.id, { otherEarnings: +e.target.value })
                        }
                      />
                    </div>
                    <div className='w-1/2'>
                      <Input
                        label='Earn Note'
                        placeholder='e.g. Bonus'
                        disabled={isPaid}
                        value={row.otherEarningsNote}
                        onChange={e =>
                          setRow(staff.id, {
                            otherEarningsNote: e.target.value
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className='my-5 h-px bg-slate-100 w-full' />

                  <div className='flex gap-3'>
                    <div className='w-1/2'>
                      <Input
                        label='Other Ded.'
                        type='number'
                        disabled={isPaid}
                        placeholder='0.00'
                        value={row.otherDeductions}
                        onChange={e =>
                          setRow(staff.id, { otherDeductions: +e.target.value })
                        }
                      />
                    </div>
                    <div className='w-1/2'>
                      <Input
                        label='Ded. Note'
                        placeholder='e.g. Uniform'
                        disabled={isPaid}
                        value={row.otherDeductionsNote}
                        onChange={e =>
                          setRow(staff.id, {
                            otherDeductionsNote: e.target.value
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* --- Editable Loan Deduction --- */}
                  {originalLoan > 0 && (
                    <div
                      className={`mt-2 mb-4 p-4 rounded-2xl shadow-sm border ${
                        isPaid
                          ? 'bg-slate-50 border-slate-200'
                          : 'bg-mint-50 border-mint-200'
                      }`}
                    >
                      <Input
                        label={`Loan Deduction (Auto: ${fmt(originalLoan)})`}
                        type='number'
                        disabled={isPaid}
                        placeholder='0.00'
                        className='mb-1'
                        value={
                          row.customLoanAmt !== undefined
                            ? row.customLoanAmt
                            : originalLoan
                        }
                        onChange={e =>
                          setRow(staff.id, {
                            customLoanAmt:
                              e.target.value === '' ? 0 : +e.target.value
                          })
                        }
                      />
                      {!isPaid && (
                        <div className='text-[10px] text-mint-600 font-bold leading-tight mt-1 bg-mint-100/50 p-2 rounded-lg'>
                          * Override the auto amount. Set to 0 to defer for this
                          month.
                        </div>
                      )}
                    </div>
                  )}

                  <div className='flex gap-5 mt-5 bg-slate-50 p-3.5 rounded-xl border border-slate-100'>
                    <label className='flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer select-none'>
                      <input
                        type='checkbox'
                        disabled={isPaid}
                        className='w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 disabled:opacity-50'
                        checked={row.enableEPF}
                        onChange={e =>
                          setRow(staff.id, { enableEPF: e.target.checked })
                        }
                      />{' '}
                      EPF
                    </label>
                    <label className='flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer select-none'>
                      <input
                        type='checkbox'
                        disabled={isPaid}
                        className='w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 disabled:opacity-50'
                        checked={row.enableSOCSO}
                        onChange={e =>
                          setRow(staff.id, { enableSOCSO: e.target.checked })
                        }
                      />{' '}
                      SOCSO
                    </label>
                    <label className='flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer select-none'>
                      <input
                        type='checkbox'
                        disabled={isPaid}
                        className='w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 disabled:opacity-50'
                        checked={row.enableEIS}
                        onChange={e =>
                          setRow(staff.id, { enableEIS: e.target.checked })
                        }
                      />{' '}
                      EIS
                    </label>
                  </div>
                </div>

                {/* Col 3: Live Preview */}
                <div
                  className={`rounded-3xl p-7 border flex flex-col justify-between shadow-inner ${
                    isPaid
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-gradient-to-br from-slate-50 to-slate-100/50 border-slate-200'
                  }`}
                >
                  <div>
                    <div className='inline-block px-3 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-black uppercase tracking-widest mb-6'>
                      {isPaid ? 'Final Summary' : 'Live Summary'}
                    </div>

                    <div className='space-y-3.5'>
                      <div className='flex justify-between text-sm items-center'>
                        <span className='text-slate-600 font-bold'>
                          Gross Earnings
                        </span>
                        <span
                          className={`font-mono font-bold text-base ${
                            isPaid ? 'text-slate-600' : 'text-emerald-600'
                          }`}
                        >
                          {fmt(calc.grossEarnings)}
                        </span>
                      </div>
                      <div className='flex justify-between text-sm items-center'>
                        <span className='text-slate-600 font-bold'>
                          Deductions
                        </span>
                        <span
                          className={`font-mono font-bold text-base ${
                            isPaid ? 'text-slate-600' : 'text-rose-500'
                          }`}
                        >
                          -{fmt(calc.totalDeductions)}
                        </span>
                      </div>

                      <div className='flex flex-wrap gap-2 mt-2'>
                        {adv > 0 && (
                          <span
                            className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                              isPaid
                                ? 'bg-slate-200 text-slate-600'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            Adv: -{fmt(adv)}
                          </span>
                        )}
                        {activeLoanDeduction > 0 && (
                          <span
                            className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                              isPaid
                                ? 'bg-slate-200 text-slate-600'
                                : 'bg-mint-100 text-mint-700'
                            }`}
                          >
                            Loan: -{fmt(activeLoanDeduction)}
                          </span>
                        )}
                        {calc.statutory > 0 && (
                          <span className='bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-md'>
                            Statutory: -{fmt(calc.statutory)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className='border-t-2 border-slate-200 pt-6 mt-6'>
                    <div className='flex justify-between items-end'>
                      <span className='text-sm font-black text-slate-900 uppercase tracking-widest'>
                        Net Pay
                      </span>
                      <span
                        className={`font-mono text-3xl font-black tracking-tight ${
                          isPaid ? 'text-slate-700' : 'text-indigo-600'
                        }`}
                      >
                        {fmt(calc.netPay)}
                      </span>
                    </div>
                    <div className='text-xs font-semibold text-slate-400 text-right mt-2'>
                      Cost to Company:{' '}
                      <span className='text-slate-500'>
                        {fmt(calc.totalEmployerCost)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
