/* eslint-disable react/prop-types */
import React from 'react'
import { format } from 'date-fns'
import useCurrency from '@/app/hooks/useCurrency'

export default function LoanModal ({ item, branchData, onClose, onEdit }) {
  const currency = useCurrency();
  if (!item) return null

  const installments = item.installments || []
  const paidCount = installments.filter(i => i.status === 'paid').length

  return (
    <div
      className='fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4'
      onClick={onClose}
    >
      <div
        className='bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto'
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-lg font-bold text-blue-600'>
            {Array.isArray(branchData)
              ? branchData.map(b => b.name).join(', ')
              : branchData?.name || 'Branch'}
          </h2>
          <h2 className='text-lg font-bold text-black'>
            Loan – {format(new Date(item.date), 'dd/MM/yyyy')}
          </h2>
        </div>

        {/* Loan details */}
        <div className='space-y-3 text-sm mb-4'>
          <div className='flex justify-between'>
            <span className='font-medium'>Staff Name</span>
            <span>{item.staffName}</span>
          </div>
          <div className='flex justify-between'>
            <span className='font-medium'>Loan Amount</span>
            <span className='text-blue-600 font-semibold'>
              {currency} {item.amount}
            </span>
          </div>
          {item.source === 'migration' && (
            <div className='flex justify-between'>
              <span className='font-medium'>Source</span>
              <span className='px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700'>
                Migration (pre-existing)
              </span>
            </div>
          )}
          <div className='flex justify-between'>
            <span className='font-medium'>Duration</span>
            <span>{item.durationMonths} months</span>
          </div>
          <div className='flex justify-between'>
            <span className='font-medium'>Monthly EMI</span>
            <span className='font-semibold'>{currency} {item.emi || 0}</span>
          </div>
          <div className='flex justify-between'>
            <span className='font-medium'>Reason</span>
            <span>{item.reason || '-'}</span>
          </div>
          <div className='flex justify-between'>
            <span className='font-medium'>Status</span>
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                item.status === 'approved'
                  ? 'bg-green-200 text-green-800'
                  : item.status === 'pending'
                  ? 'bg-mint-200 text-mint-800'
                  : item.status === 'closed'
                  ? 'bg-gray-200 text-gray-800'
                  : 'bg-red-200 text-red-800'
              }`}
            >
              {item.status}
            </span>
          </div>

          {item.repaymentStartDate && (
            <div className='flex justify-between'>
              <span className='font-medium'>First EMI Month</span>
              <span>
                {format(new Date(item.repaymentStartDate), 'MMM yyyy')}
              </span>
            </div>
          )}

          <div className='flex justify-between mt-2 pt-2 border-t'>
            <span className='font-medium'>Requested By</span>
            <span>{item.createdBy?.username || 'Unknown'}</span>
          </div>
          <div className='flex justify-between'>
            <span className='font-medium'>Added Time</span>
            <span>
              {item.createdAt
                ? format(
                    new Date(
                      item.createdAt.seconds * 1000 +
                        (item.createdAt.nanoseconds || 0) / 1000000
                    ),
                    'HH:mm ~ dd/MM'
                  )
                : 'N/A'}
            </span>
          </div>

          {item.approvalNotes && (
            <div className='pt-2 border-t'>
              <div className='font-medium text-gray-700 mb-1'>
                Approval Notes
              </div>
              <div className='text-gray-600 text-xs bg-gray-50 p-2 rounded'>
                {item.approvalNotes}
              </div>
            </div>
          )}
        </div>

        {/* Payment summary */}
        <div className='grid grid-cols-3 gap-2 mb-4'>
          <div className='p-3 rounded bg-blue-50 border border-blue-200'>
            <div className='text-xs text-gray-600'>Total Paid</div>
            <div className='font-semibold text-blue-700'>
              {currency} {(item.totalPaid || 0).toLocaleString()}
            </div>
          </div>
          <div className='p-3 rounded bg-gray-50 border'>
            <div className='text-xs text-gray-600'>Remaining</div>
            <div className='font-semibold text-gray-700'>
              {currency} {(item.remainingAmount || 0).toLocaleString()}
            </div>
          </div>
          <div className='p-3 rounded bg-gray-50 border'>
            <div className='text-xs text-gray-600'>Paid / Total</div>
            <div className='font-semibold text-gray-700'>
              {paidCount} / {installments.length}
            </div>
          </div>
        </div>

        {/* Installment list */}
        {installments.length > 0 && (
          <div className='mb-4'>
            <h3 className='font-semibold text-gray-700 mb-2 text-sm'>
              EMI Schedule
            </h3>
            <div className='rounded-lg border border-gray-200 overflow-hidden max-h-64 overflow-y-auto'>
              <div className='divide-y divide-gray-100'>
                {installments.map((inst, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-3 py-2 text-sm ${
                      inst.status === 'paid' ? 'bg-green-50' : 'bg-white'
                    }`}
                  >
                    <div className='flex items-center gap-2'>
                      <span className='w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600'>
                        {inst.index}
                      </span>
                      <span className='text-gray-700'>{inst.month}</span>
                    </div>
                    <div className='flex items-center gap-3'>
                      <span className='font-medium text-gray-900'>
                        {currency} {inst.amount.toLocaleString()}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          inst.status === 'paid'
                            ? 'bg-green-200 text-green-800'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {inst.status === 'paid' ? '✓ Paid' : 'Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer buttons */}
        <div className='flex flex-wrap justify-end gap-2 sm:gap-3 text-xs'>
          <button
            onClick={onClose}
            className='px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700'
          >
            Close
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              className='px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white'
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
