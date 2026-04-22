'use client'
import React, { useState, useCallback, useRef } from 'react'
import { skipToken } from '@reduxjs/toolkit/query'

// Import Hooks
import { useGetStaffListQuery } from '@/lib/redux/api/staffApiSlice'
import { useGetAdvanceEntriesQuery } from '@/lib/redux/api/AdvanceApiSlice'
import { useGetStaffLoansQuery } from '@/lib/redux/api/staffLoanApiSlice'
import {
  useSaveSalarySheetMutation,
  useGetSalarySheetsQuery,
  useRevertSalarySheetMutation
} from '@/lib/redux/api/salarySheetApiSlice'
import { useGetSingleBranchQuery } from '@/lib/redux/api/branchApiSlice'
import useResolvedCompanyBranch from '@/utils/useResolvedCompanyBranch'

// Imports
import SalaryBuilder from './components/SalaryBuilder'
import Payslip from './components/Payslip'
import SalarySummary from './components/SalarySummary'
import { calcSalary, getMonthKey } from '@/utils/salaryCalculations.js'

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

const initRow = () => ({
  mode: 'hours',
  standardHours: 312,
  workedHours: 312,
  otHours: 0,
  phHours: 0,
  workingDays: 26,
  workedDays: 26,
  otherEarnings: 0,
  otherEarningsNote: '',
  otherDeductions: 0,
  otherDeductionsNote: '',
  enableEPF: false,
  enableSOCSO: false,
  enableEIS: false
})

export default function SalarySheetPage () {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [tab, setTab] = useState('builder')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [rows, setRows] = useState({})
  const [search, setSearch] = useState('')

  const printRef = useRef()
  const historyPrintRef = useRef()

  const { companyId, branchId } = useResolvedCompanyBranch()
  const period = getMonthKey(year, month)

  const args = companyId && branchId ? { companyId, branchId } : skipToken
  const historyArgs =
    companyId && branchId ? { companyId, branchId, period } : skipToken

  // Fetch Data
  const { data: branchData } = useGetSingleBranchQuery(args)
  const { data: staffList = [] } = useGetStaffListQuery(args)
  const { data: advances = [] } = useGetAdvanceEntriesQuery(args)
  const { data: loans = [] } = useGetStaffLoansQuery(args)
  const { data: savedSheets = [] } = useGetSalarySheetsQuery(historyArgs)

  const [saveSalarySheet] = useSaveSalarySheetMutation()
  const [revertSalarySheet] = useRevertSalarySheetMutation()

  // Identify Paid vs Unpaid Staff
  const paidStaffIds = new Set(savedSheets.map(sheet => sheet.staffId))
  const unpaidStaff = staffList.filter(s => !paidStaffIds.has(s.id))

  // Logic Helpers
  const getAdvanceAmt = staffId =>
    advances
      .filter(a => a.staffId === staffId && a.status === 'approved')
      .reduce((sum, a) => {
        const inst = a.installments.find(
          i => i.month === period && i.status === 'pending'
        )
        return sum + (inst ? inst.amount : 0)
      }, 0)

  const getLoanAmt = staffId =>
    loans
      .filter(l => l.staffId === staffId && l.status === 'approved')
      .reduce((sum, l) => {
        const inst = l.installments.find(
          i => i.month === period && i.status === 'pending'
        )
        return sum + (inst ? inst.amount : 0)
      }, 0)

  const getRow = useCallback(id => rows[id] || initRow(), [rows])
  const setRow = useCallback(
    (id, patch) =>
      setRows(p => ({ ...p, [id]: { ...(p[id] || initRow()), ...patch } })),
    []
  )

  const getCalc = staff => {
    const row = getRow(staff.id)
    return calcSalary({
      staff,
      mode: row.mode,
      ...row,
      allowance:
        row.customAllowance !== undefined
          ? row.customAllowance
          : parseFloat(staff.allowance) || 0,
      loanAmt:
        row.customLoanAmt !== undefined
          ? row.customLoanAmt
          : getLoanAmt(staff.id),
      advanceAmt: getAdvanceAmt(staff.id)
    })
  }

  // ✅ NEW: Smart Fetchers. If staff is paid, return Firebase data. If draft, return live calculation.
  const getSmartRow = useCallback(
    id => {
      const saved = savedSheets.find(s => s.staffId === id)
      return saved || getRow(id)
    },
    [savedSheets, getRow]
  )

  const getSmartCalc = useCallback(
    staff => {
      const saved = savedSheets.find(s => s.staffId === staff.id)
      return saved || getCalc(staff)
    },
    [savedSheets, getCalc]
  )

  const selectedStaff = staffList.filter(s => selectedIds.has(s.id))

  // Calculate how many UNPAID staff are currently selected (for the Save button)
  const activeUnpaidCount = Array.from(selectedIds).filter(
    id => !paidStaffIds.has(id)
  ).length

  // Handle Void / Edit
  const handleRevert = async staffId => {
    const sheetToRevert = savedSheets.find(s => s.staffId === staffId)
    if (!sheetToRevert) return

    if (
      !window.confirm(
        '⚠️ Are you sure you want to edit this salary?\n\nThis will temporarily VOID the saved slip and RESTORE their loan/advance balances for this month so you can edit it.\n\nYou MUST click "Save" again when you are done.'
      )
    )
      return

    await revertSalarySheet({
      companyId,
      branchId,
      salaryId: sheetToRevert.id,
      deductionMeta: sheetToRevert.deductionMeta
    })

    alert('✅ Salary unlocked! You can now edit the inputs and re-save.')
  }

  const handleSave = async () => {
    // 🔒 Safety: Only save staff who are currently UNPAID
    const idsToSave = Array.from(selectedIds).filter(
      id => !paidStaffIds.has(id)
    )

    if (idsToSave.length === 0) return

    if (
      !window.confirm(
        `Process salary for ${idsToSave.length} staff? This will update loans and save permanently.`
      )
    )
      return

    for (const id of idsToSave) {
      const staff = staffList.find(s => s.id === id)
      const row = getRow(staff.id)
      const calc = getCalc(staff)

      const deductionMeta = {
        advances: advances
          .filter(a => a.staffId === id && a.status === 'approved')
          .flatMap(a => {
            const inst = a.installments.find(
              i => i.month === period && i.status === 'pending'
            )
            return inst
              ? [{ docId: a.id, index: inst.index, amount: inst.amount }]
              : []
          }),
        loans: loans
          .filter(l => l.staffId === id && l.status === 'approved')
          .flatMap(l => {
            const inst = l.installments.find(
              i => i.month === period && i.status === 'pending'
            )
            const customLoan =
              row.customLoanAmt !== undefined
                ? row.customLoanAmt
                : inst
                ? inst.amount
                : 0
            return inst && customLoan > 0
              ? [{ docId: l.id, index: inst.index, amount: customLoan }]
              : []
          })
      }

      await saveSalarySheet({
        companyId,
        branchId,
        data: {
          staffId: id,
          staffName: `${staff.firstName} ${staff.lastName}`,
          period,
          ...row,
          ...calc
        },
        deductionMeta
      })
    }

    alert('Done! Salary saved successfully.')
  }

  return (
    <div className='min-h-screen bg-slate-50 font-sans text-slate-900 print:bg-white'>
      {/* Navbar */}
      <div className='bg-white border-b border-slate-200 px-6 sticky top-0 z-50 print:hidden'>
        <div className='max-w-[1600px] mx-auto h-16 flex items-center gap-6'>
          <div className='font-bold text-lg flex items-center gap-2'>
            <span className='text-2xl'>💼</span> Payroll
          </div>

          <div className='flex bg-slate-100 p-1 rounded-lg'>
            <select
              value={month}
              onChange={e => setMonth(+e.target.value)}
              className='bg-transparent text-sm font-bold px-2 py-1 outline-none cursor-pointer'
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={e => setYear(+e.target.value)}
              className='bg-transparent text-sm font-bold px-2 py-1 outline-none cursor-pointer'
            >
              {[2025, 2026, 2027].map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className='flex-1' />

          <div className='flex bg-slate-100 p-1 rounded-lg mr-4'>
            {[
              ['builder', `🔧 Builder`],
              ['preview', '👁 Preview'],
              ['summary', '📊 Summary'],
              ['history', `🗄️ Saved Slips (${savedSheets.length})`]
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                  tab === k
                    ? 'bg-white shadow-sm text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeUnpaidCount > 0 && tab === 'builder' && (
            <button
              onClick={handleSave}
              className='bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all'
            >
              💾 Pay Selected ({activeUnpaidCount})
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className='min-h-[calc(100vh-64px)]'>
        {/* BUILDER TAB */}
        {tab === 'builder' && (
          <SalaryBuilder
            staffList={staffList}
            paidStaffIds={paidStaffIds}
            savedSheets={savedSheets}
            onRevert={handleRevert}
            selectedIds={selectedIds}
            toggleSelect={id =>
              setSelectedIds(p => {
                const n = new Set(p)
                n.has(id) ? n.delete(id) : n.add(id)
                return n
              })
            }
            toggleAll={() =>
              setSelectedIds(
                selectedIds.size === unpaidStaff.length
                  ? new Set()
                  : new Set(unpaidStaff.map(s => s.id))
              )
            }
            search={search}
            setSearch={setSearch}
            getCalc={getCalc}
            getRow={getRow}
            setRow={setRow}
            getAdvanceAmt={getAdvanceAmt}
            getLoanAmt={getLoanAmt}
          />
        )}

        {/* SUMMARY TAB */}
        {tab === 'summary' && (
          <SalarySummary
            selectedStaff={selectedStaff}
            allStaff={staffList}
            getCalc={getSmartCalc} // ✅ Use the Smart Calc so it pulls Firebase data if paid!
            selectedIds={selectedIds}
            savedSheets={savedSheets}
            printAll={() => {
              setTab('history')
              setTimeout(() => window.print(), 500)
            }}
            month={month}
            year={year}
          />
        )}

        {/* PREVIEW TAB */}
        {tab === 'preview' && (
          <div className='max-w-4xl mx-auto py-12 px-6' ref={printRef}>
            <div className='flex justify-between items-center mb-8 print:hidden'>
              <button
                onClick={() => setTab('builder')}
                className='px-4 py-2 rounded-lg border border-slate-300 font-bold text-slate-600 hover:bg-white'
              >
                ← Back
              </button>
              <div className='bg-amber-100 text-amber-800 px-4 py-2 rounded-lg text-sm font-bold'>
                ⚠️ Draft Preview (Not Saved)
              </div>
              <button
                onClick={() => window.print()}
                className='px-5 py-2 bg-slate-900 text-white rounded-lg font-bold shadow-lg hover:bg-slate-800'
              >
                🖨 Print / PDF
              </button>
            </div>
            {selectedStaff.length === 0 ? (
              <div className='text-center py-20 text-slate-400'>
                No staff selected for preview
              </div>
            ) : (
              selectedStaff.map(staff => (
                <Payslip
                  key={staff.id}
                  staff={staff}
                  calc={getSmartCalc(staff)} // ✅ Use Smart Calc here too!
                  row={getSmartRow(staff.id)} // ✅ Use Smart Row here too!
                  year={year}
                  month={month}
                  advances={advances}
                  loans={loans}
                  branchData={branchData}
                />
              ))
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div className='max-w-4xl mx-auto py-12 px-6' ref={historyPrintRef}>
            <div className='flex justify-between items-center mb-8 print:hidden'>
              <div>
                <h2 className='text-2xl font-black text-slate-800'>
                  Processed Slips
                </h2>
                <p className='text-slate-500 text-sm mt-1'>
                  These salaries have been permanently saved.
                </p>
              </div>
              {savedSheets.length > 0 && (
                <button
                  onClick={() => window.print()}
                  className='px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700'
                >
                  🖨 Print All Saved Slips
                </button>
              )}
            </div>
            {savedSheets.length === 0 ? (
              <div className='text-center py-32 bg-white rounded-3xl border border-slate-200'>
                <div className='text-6xl mb-4'>📂</div>
                <div className='text-xl font-bold text-slate-700'>
                  No processed salaries yet
                </div>
              </div>
            ) : (
              savedSheets.map(savedData => {
                const staffProfile = staffList.find(
                  s => s.id === savedData.staffId
                ) || {
                  id: savedData.staffId,
                  firstName: savedData.staffName,
                  lastName: '',
                  department: 'Unknown',
                  role: 'Staff'
                }
                return (
                  <Payslip
                    key={savedData.id}
                    staff={staffProfile}
                    calc={savedData}
                    row={savedData}
                    year={year}
                    month={month}
                    advances={advances}
                    loans={loans}
                    branchData={branchData}
                  />
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
