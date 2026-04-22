import React from 'react'
import PropTypes from 'prop-types'
import { format } from 'date-fns'
import useCurrency from '@/app/hooks/useCurrency'
import {
  exportAdvanceStaffDetailToExcel,
  exportAdvanceStaffDetailToPDF
} from '@/utils/export/exportAdvanceData'

function StaffSummaryModal ({
  staff,
  branchData,
  onClose,
  onOpenEntry,
  onEditEntry
}) {
  const currency = useCurrency();
  if (!staff) return null

  const entries = Array.isArray(staff.entries) ? staff.entries : []

  return (
    <div
      className='fixed inset-0 bg-black/80 flex items-center justify-center z-50'
      onClick={onClose}
    >
      <div
        className='bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto'
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex justify-between items-start gap-3 mb-4'>
          <div>
            <div className='text-sm text-gray-500'>
              {branchData?.name || 'Branch'}
            </div>
            <h2 className='text-xl font-bold text-mint-600'>
              {staff.staffName}
            </h2>
          </div>

          <div className='flex gap-2'>
            <button
              onClick={() => exportAdvanceStaffDetailToPDF(staff, branchData)}
              className='px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm'
            >
              Export PDF
            </button>

            <button
              onClick={() => exportAdvanceStaffDetailToExcel(staff, branchData)}
              className='px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm'
            >
              Export Excel
            </button>

            <button
              onClick={onClose}
              className='px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm'
            >
              Close
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-sm'>
          <div className='p-3 rounded bg-gray-50 border'>
            <div className='text-gray-500'>Total Taken</div>
            <div className='font-semibold text-mint-600'>
              {currency} {(Number(staff.totalAmount) || 0).toFixed(2)}
            </div>
          </div>

          <div className='p-3 rounded bg-gray-50 border'>
            <div className='text-gray-500'>Times</div>
            <div className='font-semibold'>{staff.count || 0}</div>
          </div>

          <div className='p-3 rounded bg-gray-50 border'>
            <div className='text-gray-500'>Avg / Entry</div>
            <div className='font-semibold'>
              {currency}{' '}
              {(staff.count ? staff.totalAmount / staff.count : 0).toFixed(2)}
            </div>
          </div>

          <div className='p-3 rounded bg-gray-50 border'>
            <div className='text-gray-500'>Last Date</div>
            <div className='font-semibold'>
              {staff.lastDate
                ? format(new Date(staff.lastDate), 'dd/MM/yyyy')
                : '—'}
            </div>
          </div>
        </div>

        {/* Entries list */}
        <div className='rounded-lg border overflow-hidden'>
          <div className='bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700'>
            Advance Entries
          </div>

          <div className='divide-y'>
            {entries.map(r => (
              <div
                key={r.id}
                className='px-4 py-3 hover:bg-mint-50 transition flex items-start justify-between gap-4'
              >
                <button
                  type='button'
                  onClick={() => onOpenEntry?.(r)}
                  className='flex-1 text-left min-w-0'
                >
                  <div className='font-medium text-gray-900'>
                    {r.date ? format(new Date(r.date), 'dd/MM/yyyy') : '—'}
                  </div>
                  <div className='text-xs text-gray-500 truncate'>
                    {r.reason || '—'}
                  </div>
                  <div className='text-xs text-gray-400'>
                    Status: {r.status || '—'}
                  </div>
                </button>

                <div className='flex items-center gap-3'>
                  <div className='font-semibold text-gray-900'>
                    {currency} {(Number(r.amount) || 0).toFixed(2)}
                  </div>
                  <button
                    type='button'
                    onClick={() => onEditEntry?.(r)}
                    className='px-2 py-1 rounded bg-green-500 hover:bg-green-600 text-white text-xs font-medium'
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}

            {entries.length === 0 && (
              <div className='px-4 py-6 text-center text-gray-500'>
                No entries found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

StaffSummaryModal.propTypes = {
  staff: PropTypes.object,
  branchData: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onOpenEntry: PropTypes.func,
  onEditEntry: PropTypes.func
}

export default StaffSummaryModal
