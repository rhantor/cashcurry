/* eslint-disable react/prop-types */
import React from 'react'
import { fmt } from '@/utils/salaryCalculations.js'

export default function SalarySummary ({
  selectedStaff,
  allStaff,
  getCalc,
  printAll,
  month,
  year,
  selectedIds
}) {
  const displayStaff = selectedIds.size > 0 ? selectedStaff : allStaff

  // Calculate Totals
  const totals = displayStaff.reduce(
    (acc, staff) => {
      const calc = getCalc(staff)
      return {
        gross: acc.gross + calc.grossEarnings,
        epf: acc.epf + calc.epf.employee,
        socso: acc.socso + calc.socso.employee,
        eis: acc.eis + calc.eis.employee,
        loans: acc.loans + calc.advanceAmt + calc.loanAmt,
        net: acc.net + calc.netPay
      }
    },
    { gross: 0, epf: 0, socso: 0, eis: 0, loans: 0, net: 0 }
  )

  return (
    <div className='max-w-[1400px] mx-auto p-6 animate-in fade-in duration-500'>
      {/* Cards */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-8'>
        <SummaryCard
          label='Total Staff'
          value={displayStaff.length}
          icon='👥'
        />
        <SummaryCard
          label='Total Gross'
          value={fmt(totals.gross)}
          icon='💰'
          accent
        />
        <SummaryCard
          label='Total Deductions'
          value={fmt(totals.gross - totals.net)}
          icon='📉'
        />
        <SummaryCard
          label='Total Net Pay'
          value={fmt(totals.net)}
          icon='💳'
          accent
        />
      </div>

      <div className='bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden'>
        <div className='px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50'>
          <div className='font-bold text-slate-800'>
            Salary Summary — {month}/{year}
          </div>
          <button
            onClick={printAll}
            className='bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-800'
          >
            🖨 Print Report
          </button>
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-sm'>
            <thead>
              <tr className='bg-slate-50 text-slate-500 font-bold uppercase text-[11px] tracking-wider'>
                <th className='px-6 py-3'>Staff</th>
                <th className='px-6 py-3'>Gross</th>
                <th className='px-6 py-3'>EPF</th>
                <th className='px-6 py-3'>SOCSO</th>
                <th className='px-6 py-3'>EIS</th>
                <th className='px-6 py-3'>Loan/Adv</th>
                <th className='px-6 py-3'>Net Pay</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-50'>
              {displayStaff.map(staff => {
                const calc = getCalc(staff)
                return (
                  <tr key={staff.id} className='hover:bg-slate-50'>
                    <td className='px-6 py-3 font-medium text-slate-700'>
                      {staff.firstName} {staff.lastName}
                    </td>
                    <td className='px-6 py-3 font-mono text-emerald-600'>
                      {fmt(calc.grossEarnings)}
                    </td>
                    <td className='px-6 py-3 font-mono text-slate-500'>
                      {fmt(calc.epf.employee)}
                    </td>
                    <td className='px-6 py-3 font-mono text-slate-500'>
                      {fmt(calc.socso.employee)}
                    </td>
                    <td className='px-6 py-3 font-mono text-slate-500'>
                      {fmt(calc.eis.employee)}
                    </td>
                    <td className='px-6 py-3 font-mono text-rose-500'>
                      {fmt(calc.advanceAmt + calc.loanAmt)}
                    </td>
                    <td className='px-6 py-3 font-mono font-bold text-slate-900'>
                      {fmt(calc.netPay)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className='bg-slate-50 font-bold text-slate-900 border-t border-slate-200'>
              <tr>
                <td className='px-6 py-3'>TOTAL</td>
                <td className='px-6 py-3 font-mono text-emerald-600'>
                  {fmt(totals.gross)}
                </td>
                <td className='px-6 py-3 font-mono text-slate-500'>
                  {fmt(totals.epf)}
                </td>
                <td className='px-6 py-3 font-mono text-slate-500'>
                  {fmt(totals.socso)}
                </td>
                <td className='px-6 py-3 font-mono text-slate-500'>
                  {fmt(totals.eis)}
                </td>
                <td className='px-6 py-3 font-mono text-rose-500'>
                  {fmt(totals.loans)}
                </td>
                <td className='px-6 py-3 font-mono text-slate-900'>
                  {fmt(totals.net)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

function SummaryCard ({ label, value, icon, accent }) {
  return (
    <div
      className={`p-5 rounded-xl border shadow-sm flex flex-col justify-between h-28 ${
        accent
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-white text-slate-800 border-slate-200'
      }`}
    >
      <div className='flex justify-between items-start'>
        <span
          className={`text-[10px] uppercase tracking-widest font-bold ${
            accent ? 'opacity-60' : 'text-slate-500'
          }`}
        >
          {label}
        </span>
        <span className='text-xl'>{icon}</span>
      </div>
      <div className='font-mono text-2xl font-bold'>{value}</div>
    </div>
  )
}
