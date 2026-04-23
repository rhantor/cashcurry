'use client'
import React, { useMemo, useState } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { skipToken } from '@reduxjs/toolkit/query'

import { useGetAdvanceEntriesQuery } from '@/lib/redux/api/AdvanceApiSlice'
import useReportData from '@/app/hooks/useReportData'

import ReportPage from '@/app/components/common/ReportPage'
import ReportErrorState from '@/app/components/common/ReportErrorState'
import AdvanceModal from './AdvanceModal'
import AdvanceEditModal from './AdvanceEditModal'
import StaffSummaryModal from './StaffSummary'
import useCurrency from '@/app/hooks/useCurrency'
import { FaCalendarAlt, FaMoneyBillWave, FaEdit, FaFilePdf, FaUserTie } from 'react-icons/fa'

// ✅ Entries (list) exports
import {
  exportAdvancesToPDF,
  exportAdvancesToExcel,
  exportAdvanceAllStaffToPDF,
  exportAdvanceAllStaffToExcel
} from '@/utils/export/exportAdvanceData'

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
    const d = toDateSafe(r.date)

    if (!map.has(name)) {
      map.set(name, {
        id: name,
        staffName: name,
        totalAmount: 0,
        count: 0,
        lastDate: null,
        entries: []
      })
    }

    const agg = map.get(name)
    agg.totalAmount += amt
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
export default function AdvanceReport () {
  const currency = useCurrency()
  const { ready, args, setFetchArgs, branchData, companyId, branchId } = useReportData()

  const { data: advancesData, isLoading, error: advanceError } = useGetAdvanceEntriesQuery(args)

  const [viewMode, setViewMode] = useState('staff') // "entries" | "staff"
  const [viewModal, setViewModal] = useState(null) // single advance entry (view only)
  const [editModal, setEditModal] = useState(null) // single advance entry (edit)
  const [staffModal, setStaffModal] = useState(null) // aggregated staff object

  const advances = advancesData ?? []
  const branch = branchData ?? {}

  // ✅ only approved
  const approvedAdvances = useMemo(
    () => advances.filter(a => a.status === 'approved'),
    [advances]
  )

  // ✅ group by staff
  const staffSummary = useMemo(
    () => groupApprovedByStaff(approvedAdvances),
    [approvedAdvances]
  )

  if (advanceError) return <ReportErrorState error={advanceError} title="Failed to load advances data" />
  if (!ready) return <p className='p-4'>Preparing…</p>

  return (
    <div className='p-4 sm:p-6'>
      {/* Toggle */}
      <div className='flex items-center gap-2 mb-4'>
        <button
          onClick={() => setViewMode('entries')}
          className={
            viewMode === 'entries'
              ? 'px-3 py-2 rounded-lg text-sm font-medium bg-mint-600 text-white'
              : 'px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700'
          }
        >
          Entries
        </button>

        <button
          onClick={() => setViewMode('staff')}
          className={
            viewMode === 'staff'
              ? 'px-3 py-2 rounded-lg text-sm font-medium bg-mint-600 text-white'
              : 'px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700'
          }
        >
          Total by Staff
        </button>
      </div>

      {/* ===== View 1: Entries ===== */}
      {viewMode === 'entries' ? (
        <ReportPage
          title='Advance Report'
          data={approvedAdvances}
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
            { key: 'reason', label: 'Reason', truncate: true },
            {
              key: 'status',
              label: 'Status',
              render: val => (
                <span className='px-3 py-1 rounded-full text-sm font-semibold bg-green-500 text-white'>
                  {val || 'approved'}
                </span>
              )
            },
            {
              key: 'createdBy',
              label: 'Created By',
              render: val => val?.username || 'Unknown'
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (_, row) => (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditModal(row)
                  }}
                  className="p-2 text-gray-400 hover:text-mint-600 hover:bg-mint-50 rounded-full transition-all"
                  title="Edit Entry"
                >
                  <FaEdit />
                </button>
              )
            }
          ]}
          filterConfig={{
            dateField: 'date',
            searchFields: ['staffName', 'reason']
          }}
          exportFunctions={{
            exportPDF: exportAdvancesToPDF,
            exportExcel: exportAdvancesToExcel
          }}
          modalContentRenderer={(item, branchData, closeModal) => (
            <AdvanceModal
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
            theme: 'deposit'
          }}
          showTotalsFooter
        />
      ) : (
        /* ===== View 2: Staff totals ===== */
        <ReportPage
          title='Advance Report – Total by Staff'
          data={staffSummary}
        isLoading={isLoading}
          branchData={branch}
          onDateSync={(newDates) => setFetchArgs(newDates)}
          columns={[
            { key: 'staffName', label: 'Staff Name' },
            {
              key: 'totalAmount',
              label: `Total (${currency})`,
              align: 'right',
              render: val => `${currency} ${(Number(val) || 0).toFixed(2)}`
            },
            {
              key: 'count',
              label: 'Times',
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
            exportPDF: exportAdvanceAllStaffToPDF,
            exportExcel: exportAdvanceAllStaffToExcel
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
            theme: 'deposit'
          }}
          showTotalsFooter
        />
      )}

      {/* Staff Summary Modal */}
      {staffModal && (
        <StaffSummaryModal
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

      {/* View Modal (single entry) */}
      {viewModal && (
        <AdvanceModal
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
        <AdvanceEditModal
          item={editModal}
          companyId={companyId}
          branchId={branchId}
          onClose={() => setEditModal(null)}
          onSuccess={() => {
            setEditModal(null)
            // Data will auto-refresh via RTK Query cache invalidation
          }}
        />
      )}
    </div>
  )
}
