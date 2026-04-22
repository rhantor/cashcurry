'use client'
import React, { useMemo, useState } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { skipToken } from '@reduxjs/toolkit/query'

import { useGetStaffLoansQuery } from '@/lib/redux/api/staffLoanApiSlice'
import useReportData from '@/app/hooks/useReportData'

import ReportPage from '@/app/components/common/ReportPage'
import ReportErrorState from '@/app/components/common/ReportErrorState'
import LoanModal from './LoanModal'
import LoanEditModal from './LoanEditModal'
import LoanStaffSummaryModal from './LoanStaffSummaryModal'
import useCurrency from '@/app/hooks/useCurrency'

/* ---------------------------
   Helpers
--------------------------- */
function toDateSafe (v) {
  try {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

function groupApprovedByStaff (rows = []) {
  const map = new Map()

  for (const r of rows) {
    const name = (r.staffName || 'Unknown').trim()
    const amt = Number(r.amount) || 0
    const paid = Number(r.totalPaid) || 0
    const remaining = Number(r.remainingAmount) || 0
    const d = toDateSafe(r.date)

    if (!map.has(name)) {
      map.set(name, {
        id: name,
        staffName: name,
        totalAmount: 0,
        totalPaid: 0,
        totalRemaining: 0,
        count: 0,
        lastDate: null,
        entries: []
      })
    }

    const agg = map.get(name)
    agg.totalAmount += amt
    agg.totalPaid += paid
    agg.totalRemaining += remaining
    agg.count += 1
    agg.entries.push(r)

    if (d && (!agg.lastDate || d > agg.lastDate)) agg.lastDate = d
  }

  const out = Array.from(map.values()).sort(
    (a, b) => b.totalAmount - a.totalAmount
  )

  out.forEach(s => {
    s.entries = [...s.entries].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    )
  })

  return out
}

/* ---------------------------
   Main Component
--------------------------- */
export default function LoanReport () {
  const { ready, args, setFetchArgs, branchData } = useReportData()

  const { data: staffLoansData, isLoading, error: loanError } = useGetStaffLoansQuery(args)

  const [viewMode, setViewMode] = useState('staff') // "entries" | "staff"
  const [viewModal, setViewModal] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [staffModal, setStaffModal] = useState(null)
  const currency = useCurrency()

  const staffLoans = staffLoansData ?? []
  const branch = branchData ?? {}
  console.log('staffLoans', staffLoans)
  // ✅ only approved
  const approvedLoans = useMemo(
    () => staffLoans.filter(l => l.status === 'approved'),
    [staffLoans]
  )

  // ✅ group by staff
  const staffSummary = useMemo(
    () => groupApprovedByStaff(approvedLoans),
    [approvedLoans]
  )

  if (loanError) return <ReportErrorState error={loanError} title="Failed to load loans data" />
  if (!ready) return <p className='p-4'>Preparing…</p>

  return (
    <div className='p-4 sm:p-6'>
      {/* Toggle */}
      <div className='flex items-center gap-2 mb-4'>
        <button
          onClick={() => setViewMode('entries')}
          className={
            viewMode === 'entries'
              ? 'px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white'
              : 'px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700'
          }
        >
          Entries
        </button>

        <button
          onClick={() => setViewMode('staff')}
          className={
            viewMode === 'staff'
              ? 'px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white'
              : 'px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700'
          }
        >
          Total by Staff
        </button>
      </div>

      {/* ===== View 1: Entries ===== */}
      {viewMode === 'entries' ? (
        <ReportPage
          title='Loan Report'
          data={approvedLoans}
          isLoading={isLoading}
          branchData={branch}
          onDateSync={(newDates) => setFetchArgs(newDates)}
          columns={[
            {
              key: 'date',
              label: 'Date',
              render: val => format(new Date(val), 'dd/MM/yyyy')
            },
            { key: 'staffName', label: 'Staff Name' },
            {
              key: 'amount',
              label: `Amount (${currency})`,
              align: 'right',
              render: val => `${currency} ${(Number(val) || 0).toFixed(2)}`
            },
            {
              key: 'durationMonths',
              label: 'Duration',
              align: 'center',
              render: val => `${val} mo`
            },
            {
              key: 'emi',
              label: `EMI (${currency})`,
              align: 'right',
              render: val => `${currency} ${(Number(val) || 0).toFixed(2)}`
            },
            { key: 'reason', label: 'Reason', truncate: true },
            {
              key: 'status',
              label: 'Status',
              render: val => (
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    val === 'approved'
                      ? 'bg-green-500 text-white'
                      : val === 'closed'
                      ? 'bg-gray-500 text-white'
                      : 'bg-mint-500 text-white'
                  }`}
                >
                  {val || 'approved'}
                </span>
              )
            },
            {
              key: 'createdBy',
              label: 'Created By',
              render: val => val?.username || 'Unknown'
            }
          ]}
          filterConfig={{
            dateField: 'date',
            searchFields: ['staffName', 'reason']
          }}
          exportFunctions={{
            exportPDF: () => alert('Loan PDF export - implement as needed'),
            exportExcel: () => alert('Loan Excel export - implement as needed')
          }}
          modalContentRenderer={(item, branchData, closeModal) => (
            <LoanModal
              item={item}
              branchData={branchData}
              onClose={closeModal}
              onEdit={() => {
                closeModal()
                setTimeout(() => setEditModal(item), 0)
              }}
            />
          )}
          searchBarShow
          searchPlaceholder='Search By Staff Name || Reason'
          chartConfig={{
            enabled: true,
            type: 'area',
            valueField: 'amount',
            theme: 'expense'
          }}
          showTotalsFooter
        />
      ) : (
        /* ===== View 2: Staff totals ===== */
        <ReportPage
          title='Loan Report – Total by Staff'
          data={staffSummary}
          isLoading={isLoading}
          branchData={branch}
          onDateSync={(newDates) => setFetchArgs(newDates)}
          columns={[
            { key: 'staffName', label: 'Staff Name' },
            {
              key: 'totalAmount',
              label: `Total Borrowed (${currency})`,
              align: 'right',
              render: val => `${currency} ${(Number(val) || 0).toFixed(2)}`
            },
            {
              key: 'totalPaid',
              label: `Paid (${currency})`,
              align: 'right',
              render: val => `${currency} ${(Number(val) || 0).toFixed(2)}`
            },
            {
              key: 'totalRemaining',
              label: `Remaining (${currency})`,
              align: 'right',
              render: val => `${currency} ${(Number(val) || 0).toFixed(2)}`
            },
            {
              key: 'count',
              label: 'Loans',
              align: 'center'
            },
            {
              key: 'lastDate',
              label: 'Last Date',
              render: val => (val ? format(new Date(val), 'dd/MM/yyyy') : '—')
            }
          ]}
          filterConfig={{
            dateField: 'lastDate',
            searchFields: ['staffName']
          }}
          exportFunctions={{
            exportPDF: () =>
              alert('Staff loan PDF export - implement as needed'),
            exportExcel: () =>
              alert('Staff loan Excel export - implement as needed')
          }}
          modalContentRenderer={(item, branchData, closeModal) => {
            setTimeout(() => setStaffModal(item), 0)
            closeModal?.()
            return null
          }}
          searchBarShow
          searchPlaceholder='Search staff name'
          chartConfig={{
            enabled: true,
            type: 'bar',
            valueField: 'totalAmount',
            theme: 'expense'
          }}
          showTotalsFooter
        />
      )}

      {/* Staff Summary Modal */}
      {staffModal && (
        <LoanStaffSummaryModal
          staff={staffModal}
          branchData={branch}
          onClose={() => setStaffModal(null)}
          onOpenEntry={entry => {
            setStaffModal(null)
            setViewModal(entry)
          }}
          onEditEntry={entry => {
            setStaffModal(null)
            setEditModal(entry)
          }}
        />
      )}

      {/* View Modal */}
      {viewModal && (
        <LoanModal
          item={viewModal}
          branchData={branch}
          onClose={() => setViewModal(null)}
          onEdit={() => {
            setViewModal(null)
            setEditModal(viewModal)
          }}
        />
      )}

      {/* Edit Modal */}
      {editModal && (
        <LoanEditModal
          item={editModal}
          companyId={companyId}
          branchId={branchId}
          onClose={() => setEditModal(null)}
          onSuccess={() => {
            setEditModal(null)
          }}
        />
      )}
    </div>
  )
}
