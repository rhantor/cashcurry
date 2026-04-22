/* eslint-disable react/prop-types */
import React from 'react'
import { format } from 'date-fns'
import {
  exportAdvancesToExcel,
  exportAdvanceToPDF,
  shareAdvance
} from '@/utils/export/exportAdvanceData'
import useCurrency from '@/app/hooks/useCurrency'

export default function AdvanceModal ({ item, branchData, onClose, onEdit }) {
  const currency = useCurrency();
  if (!item) return null

  return (
    <div
      className='fixed inset-0 bg-black/80 flex items-center justify-center z-50'
      onClick={onClose}
    >
      <div
        className='bg-white rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto'
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-lg font-bold text-mint-600'>
            {Array.isArray(branchData)
              ? branchData.map(b => b.name).join(', ')
              : branchData?.name || 'Branch'}
          </h2>
          <h2 className='text-lg font-bold text-black'>
            Advance – {format(new Date(item.date), 'dd/MM/yyyy')}
          </h2>
        </div>

        {/* Advance details */}
        <div className='space-y-2 text-sm'>
          <div className='flex justify-between'>
            <span className='font-medium'>Staff Name</span>
            <span>{item.staffName}</span>
          </div>
          <div className='flex justify-between'>
            <span className='font-medium'>Advance Amount</span>
            <span className='text-mint-600 font-semibold'>
              {currency} {item.amount}
            </span>
          </div>
          <div className='flex justify-between'>
            <span className='font-medium'>Type</span>
            <span className='capitalize'>{item.advanceType || 'personal'}</span>
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
                  : 'bg-red-200 text-red-800'
              }`}
            >
              {item.status}
            </span>
          </div>

          {/* Deduction info */}
          {item.deductionMonth && (
            <>
              <div className='flex justify-between'>
                <span className='font-medium'>Deduction Month</span>
                <span className='text-mint-600'>{item.deductionMonth}</span>
              </div>
              <div className='flex justify-between'>
                <span className='font-medium'>Deducted</span>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    item.deducted
                      ? 'bg-green-200 text-green-800'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {item.deducted ? 'Yes' : 'Not yet'}
                </span>
              </div>
            </>
          )}

          <div className='flex justify-between mt-2'>
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

          {/* Approval notes */}
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

        {/* Footer buttons */}
        <div className='flex flex-wrap justify-end gap-2 sm:gap-3 mt-6 text-xs'>
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
          <button
            onClick={() => exportAdvanceToPDF(item, branchData)}
            className='px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white'
          >
            Export PDF
          </button>
          <button
            onClick={() => exportAdvancesToExcel(item, branchData)}
            className='px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white'
          >
            Export Excel
          </button>
          <button
            onClick={() => shareAdvance(item, branchData)}
            className='px-4 py-2 rounded-lg bg-mint-500 hover:bg-mint-600 text-white'
          >
            Share
          </button>
        </div>
      </div>
    </div>
  )
}
