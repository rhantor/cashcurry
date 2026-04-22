// LoanStaffSummaryModal.jsx

import React from 'react'
import PropTypes from 'prop-types'
import { format } from 'date-fns'
import useCurrency from '@/app/hooks/useCurrency'

function LoanStaffSummaryModal ({
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
            <h2 className='text-xl font-bold text-blue-600'>
              {staff.staffName}
            </h2>
          </div>

          <button
            onClick={onClose}
            className='px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm'
          >
            Close
          </button>
        </div>

        {/* Summary cards */}
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-sm'>
          <div className='p-3 rounded bg-blue-50 border border-blue-200'>
            <div className='text-gray-600'>Total Borrowed</div>
            <div className='font-semibold text-blue-700'>
              {currency} {(Number(staff.totalAmount) || 0).toLocaleString()}
            </div>
          </div>

          <div className='p-3 rounded bg-green-50 border border-green-200'>
            <div className='text-gray-600'>Total Paid</div>
            <div className='font-semibold text-green-700'>
              {currency} {(Number(staff.totalPaid) || 0).toLocaleString()}
            </div>
          </div>

          <div className='p-3 rounded bg-gray-50 border'>
            <div className='text-gray-600'>Remaining</div>
            <div className='font-semibold text-gray-700'>
              {currency} {(Number(staff.totalRemaining) || 0).toLocaleString()}
            </div>
          </div>

          <div className='p-3 rounded bg-gray-50 border'>
            <div className='text-gray-600'>Loans Count</div>
            <div className='font-semibold'>{staff.count || 0}</div>
          </div>
        </div>

        {/* Entries list */}
        <div className='rounded-lg border overflow-hidden'>
          <div className='bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700'>
            Loan Entries
          </div>

          <div className='divide-y'>
            {entries.map(r => (
              <div
                key={r.id}
                className='px-4 py-3 hover:bg-blue-50 transition flex items-start justify-between gap-4'
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
                  <div className='flex items-center gap-2 mt-1'>
                    <span className='text-xs text-gray-400'>
                      {r.durationMonths} months
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        r.status === 'approved'
                          ? 'bg-green-200 text-green-800'
                          : r.status === 'closed'
                          ? 'bg-gray-200 text-gray-700'
                          : 'bg-mint-200 text-mint-800'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                </button>

                <div className='flex flex-col items-end gap-1'>
                  <div className='font-semibold text-gray-900'>
                    {currency} {(Number(r.amount) || 0).toLocaleString()}
                  </div>
                  <div className='text-xs text-gray-500'>
                    Paid: {currency} {(Number(r.totalPaid) || 0).toLocaleString()}
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
                No loan entries found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

LoanStaffSummaryModal.propTypes = {
  staff: PropTypes.object,
  branchData: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onOpenEntry: PropTypes.func,
  onEditEntry: PropTypes.func
}

export default LoanStaffSummaryModal
