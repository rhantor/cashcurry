/* eslint-disable react/prop-types */
import React from 'react'
import { fmt, getMonthKey } from '@/utils/salaryCalculations.js'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

const avatar = s =>
  s.photoUrl ||
  `https://ui-avatars.com/api/?name=${s.firstName}+${s.lastName}&background=1a3a5c&color=fff&size=80&bold=true`

export default function Payslip ({ staff, calc, row, year, month, branchData }) {
  const mk = getMonthKey(year, month)

  // Fallback to default if branchData is missing
  const companyName = branchData?.name || 'Your Company Name'
  const branchAddress = branchData?.address || 'HR & Payroll Dept'

  return (
    <div className='bg-white w-full max-w-3xl mx-auto mb-8 rounded-2xl shadow-xl overflow-hidden print:shadow-none print:mb-0 print:rounded-none break-after-page'>
      {/* Header with Gradient */}
      <div className='bg-gradient-to-br from-slate-900 to-blue-900 p-8 text-white print:bg-slate-900 print:text-white'>
        <div className='flex justify-between items-start'>
          <div>
            <div className='text-[10px] tracking-[0.25em] opacity-60 uppercase mb-1'>
              Payslip / Statement
            </div>
            <div className='text-3xl font-extrabold tracking-tight'>
              {MONTHS[month - 1]} {year}
            </div>
            <div className='font-mono text-xs opacity-50 mt-1'>
              Period: {mk}
            </div>
          </div>
          <div className='text-right'>
            <div className='font-bold text-base'>{companyName}</div>
            <div className='text-[10px] opacity-60 uppercase tracking-wider max-w-[200px] leading-tight mt-1 ml-auto'>
              {branchAddress}
            </div>
          </div>
        </div>

        {/* Staff Info Card */}
        <div className='flex items-center gap-5 mt-8 bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10'>
          <img
            src={avatar(staff)}
            alt=''
            className='w-14 h-14 rounded-full border-2 border-white/30 object-cover shadow-sm'
          />
          <div className='flex-1'>
            <div className='font-bold text-xl leading-none mb-1'>
              {staff.firstName} {staff.lastName}
            </div>
            <div className='text-xs opacity-70 font-medium'>
              {staff.department} · {staff.role || 'Staff'}
            </div>
          </div>
          <div className='flex gap-8 text-right'>
            <div>
              <div className='text-[9px] opacity-50 uppercase tracking-widest mb-1'>
                Basic Salary
              </div>
              <div className='font-mono text-sm font-bold'>
                {fmt(staff.basicSalary)}
              </div>
            </div>
            <div>
              <div className='text-[9px] opacity-50 uppercase tracking-widest mb-1'>
                Mode
              </div>
              <div className='font-mono text-sm font-bold capitalize'>
                {row.mode || calc.mode}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body: Two Columns */}
      <div className='grid grid-cols-2 divide-x divide-slate-100'>
        {/* Earnings Column */}
        <div className='p-6 bg-white'>
          <div className='flex items-center gap-2 mb-4'>
            <span className='w-2 h-2 rounded-full bg-emerald-500'></span>
            <span className='text-xs font-bold text-emerald-700 uppercase tracking-widest'>
              Earnings
            </span>
          </div>

          <table className='w-full text-sm'>
            <tbody className='divide-y divide-slate-50'>
              <tr>
                <td className='py-2 text-slate-500'>Base Pay (Earned)</td>
                <td className='py-2 text-right font-mono text-emerald-600 font-medium'>
                  +{fmt(calc.basePay)}
                </td>
              </tr>
              {calc.allowance > 0 && (
                <tr>
                  <td className='py-2 text-slate-500'>Allowance</td>
                  <td className='py-2 text-right font-mono text-emerald-600 font-medium'>
                    +{fmt(calc.allowance)}
                  </td>
                </tr>
              )}
              {calc.otPay > 0 && (
                <tr>
                  <td className='py-2 text-slate-500'>
                    OT Pay{' '}
                    <span className='text-[10px] text-slate-400'>
                      ({row.otHours || 0}h)
                    </span>
                  </td>
                  <td className='py-2 text-right font-mono text-emerald-600 font-medium'>
                    +{fmt(calc.otPay)}
                  </td>
                </tr>
              )}
              {calc.phPay > 0 && (
                <tr>
                  <td className='py-2 text-slate-500'>
                    PH Pay{' '}
                    <span className='text-[10px] text-slate-400'>
                      ({row.phHours || 0}h)
                    </span>
                  </td>
                  <td className='py-2 text-right font-mono text-emerald-600 font-medium'>
                    +{fmt(calc.phPay)}
                  </td>
                </tr>
              )}
              {calc.otherEarnings > 0 && (
                <tr>
                  <td className='py-2 text-slate-500'>
                    {row.otherEarningsNote ||
                      calc.otherEarningsNote ||
                      'Other Earnings'}
                  </td>
                  <td className='py-2 text-right font-mono text-emerald-600 font-medium'>
                    +{fmt(calc.otherEarnings)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className='mt-4 pt-3 border-t-2 border-emerald-50 flex justify-between items-center'>
            <span className='text-xs font-bold text-slate-700 uppercase'>
              Gross Earnings
            </span>
            <span className='font-mono font-bold text-emerald-600'>
              {fmt(calc.grossEarnings)}
            </span>
          </div>
        </div>

        {/* Deductions Column */}
        <div className='p-6 bg-slate-50/30'>
          <div className='flex items-center gap-2 mb-4'>
            <span className='w-2 h-2 rounded-full bg-rose-500'></span>
            <span className='text-xs font-bold text-rose-700 uppercase tracking-widest'>
              Deductions
            </span>
          </div>

          <table className='w-full text-sm'>
            <tbody className='divide-y divide-slate-100'>
              {calc.epf?.employee > 0 && (
                <tr>
                  <td className='py-2 text-slate-500'>EPF (Emp)</td>
                  <td className='py-2 text-right font-mono text-rose-600'>
                    -{fmt(calc.epf.employee)}
                  </td>
                </tr>
              )}
              {calc.socso?.employee > 0 && (
                <tr>
                  <td className='py-2 text-slate-500'>SOCSO</td>
                  <td className='py-2 text-right font-mono text-rose-600'>
                    -{fmt(calc.socso.employee)}
                  </td>
                </tr>
              )}
              {calc.eis?.employee > 0 && (
                <tr>
                  <td className='py-2 text-slate-500'>EIS</td>
                  <td className='py-2 text-right font-mono text-rose-600'>
                    -{fmt(calc.eis.employee)}
                  </td>
                </tr>
              )}

              {/* ✅ FIX: Now directly uses the calc snapshot for advances */}
              {calc.advanceAmt > 0 && (
                <tr>
                  <td className='py-2 text-slate-500'>Advance Repayment</td>
                  <td className='py-2 text-right font-mono text-rose-600'>
                    -{fmt(calc.advanceAmt)}
                  </td>
                </tr>
              )}

              {/* ✅ FIX: Now directly uses the calc snapshot for loans */}
              {calc.loanAmt > 0 && (
                <tr>
                  <td className='py-2 text-slate-500'>Loan Repayment</td>
                  <td className='py-2 text-right font-mono text-rose-600'>
                    -{fmt(calc.loanAmt)}
                  </td>
                </tr>
              )}

              {calc.otherDeductions > 0 && (
                <tr>
                  <td className='py-2 text-slate-500'>
                    {row.otherDeductionsNote ||
                      calc.otherDeductionsNote ||
                      'Other Deductions'}
                  </td>
                  <td className='py-2 text-right font-mono text-rose-600'>
                    -{fmt(calc.otherDeductions)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className='mt-4 pt-3 border-t-2 border-rose-100 flex justify-between items-center'>
            <span className='text-xs font-bold text-slate-700 uppercase'>
              Total Deductions
            </span>
            <span className='font-mono font-bold text-rose-600'>
              -{fmt(calc.totalDeductions)}
            </span>
          </div>
        </div>
      </div>

      {/* Footer / Net Pay */}
      <div className='bg-slate-900 p-6 flex justify-between items-center text-white print:bg-slate-900 print:text-white'>
        <div>
          <div className='text-[10px] uppercase tracking-widest opacity-60 mb-1'>
            Net Payable
          </div>
          <div className='text-xs opacity-40'>Transfer via Bank GIRO</div>
        </div>
        <div className='font-mono text-3xl font-bold tracking-tight'>
          {fmt(calc.netPay)}
        </div>
      </div>

      {/* Employer Cost */}
      <div className='bg-slate-50 px-6 py-2 border-t border-slate-200 flex justify-between text-[10px] text-slate-400'>
        <span>Generated: {new Date().toLocaleDateString('en-MY')}</span>
        <span>Employer Cost: {fmt(calc.totalEmployerCost)}</span>
      </div>
    </div>
  )
}
