/* eslint-disable react/prop-types */
'use client'
import React, { useState } from 'react'
import { useUpdateAdvanceEntryMutation, useDeleteAdvanceEntryMutation } from '@/lib/redux/api/AdvanceApiSlice'
import { getCurrentUser } from '@/lib/authz/roles'

const ADVANCE_TYPES = [
  { value: 'salary', label: 'Salary Advance' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'personal', label: 'Personal' }
]

export default function AdvanceEditModal ({
  item,
  companyId,
  branchId,
  onClose,
  onSuccess
}) {
  if (!item) return null

  const [form, setForm] = useState({
    amount: item.amount || '',
    advanceType: item.advanceType || 'personal',
    reason: item.reason || '',
    date: item.date || '',
    status: item.status || 'pending',
    approvalNotes: item.approvalNotes || ''
  })

  const [updateAdvance, { isLoading }] = useUpdateAdvanceEntryMutation()
  const [deleteAdvance, { isLoading: isDeleting }] = useDeleteAdvanceEntryMutation()

  const handleChange = e => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async e => {
    e.preventDefault()

    try {
      await updateAdvance({
        companyId,
        branchId,
        id: item.id,
        user: getCurrentUser(),
        data: {
          amount: Number(form.amount) || 0,
          advanceType: form.advanceType,
          reason: form.reason,
          date: form.date,
          status: form.status,
          approvalNotes: form.approvalNotes
        }
      }).unwrap()

      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('Failed to update advance:', err)
      alert('Failed to update advance. Please try again.')
    }
  }

  return (
    <div
      className='fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4'
      onClick={onClose}
    >
      <div
        className='bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto'
        onClick={e => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className='sticky top-0 bg-white border-b px-6 py-4 z-10'>
            <h2 className='text-xl font-bold text-mint-600'>Edit Advance</h2>
            <p className='text-sm text-gray-500 mt-1'>
              Staff: {item.staffName || 'Unknown'}
            </p>
          </div>

          {/* Form fields */}
          <div className='p-6 space-y-4'>
            {/* Type */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1.5'>
                Advance Type <span className='text-red-500'>*</span>
              </label>
              <select
                name='advanceType'
                value={form.advanceType}
                onChange={handleChange}
                required
                className='w-full border-2 border-mint-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-mint-500 transition-colors'
              >
                {ADVANCE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount + Date */}
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1.5'>
                  Amount (RM) <span className='text-red-500'>*</span>
                </label>
                <input
                  type='number'
                  name='amount'
                  value={form.amount}
                  onChange={handleChange}
                  min='1'
                  step='0.01'
                  required
                  className='w-full border-2 border-mint-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-mint-500 transition-colors'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1.5'>
                  Date <span className='text-red-500'>*</span>
                </label>
                <input
                  type='date'
                  name='date'
                  value={form.date}
                  onChange={handleChange}
                  required
                  className='w-full border-2 border-mint-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-mint-500 transition-colors'
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1.5'>
                Reason <span className='text-red-500'>*</span>
              </label>
              <textarea
                name='reason'
                value={form.reason}
                onChange={handleChange}
                rows={3}
                required
                className='w-full border-2 border-mint-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-mint-500 transition-colors resize-none'
                placeholder='Reason for the advance…'
              />
            </div>

            {/* Status */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1.5'>
                Status <span className='text-red-500'>*</span>
              </label>
              <select
                name='status'
                value={form.status}
                onChange={handleChange}
                required
                className='w-full border-2 border-mint-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-mint-500 transition-colors'
              >
                <option value='pending'>Pending</option>
                <option value='approved'>Approved</option>
                <option value='rejected'>Rejected</option>
              </select>
            </div>

            {/* Approval Notes */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1.5'>
                Approval Notes{' '}
                <span className='text-xs font-normal text-gray-400'>
                  (optional)
                </span>
              </label>
              <textarea
                name='approvalNotes'
                value={form.approvalNotes}
                onChange={handleChange}
                rows={2}
                className='w-full border-2 border-mint-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-mint-500 transition-colors resize-none'
                placeholder='Internal notes about this advance…'
              />
            </div>

            {/* Deduction info (read-only) */}
            {item.deductionMonth && (
              <div className='p-3 bg-mint-50 border border-mint-200 rounded-lg text-sm'>
                <div className='flex justify-between items-center'>
                  <span className='text-gray-600'>Deduction Month</span>
                  <span className='font-semibold text-mint-700'>
                    {item.deductionMonth}
                  </span>
                </div>
                <div className='flex justify-between items-center mt-1'>
                  <span className='text-gray-600'>Deducted</span>
                  <span
                    className={`font-semibold ${
                      item.deducted ? 'text-green-700' : 'text-gray-500'
                    }`}
                  >
                    {item.deducted ? 'Yes' : 'Not yet'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className='sticky bottom-0 bg-gray-50 border-t px-6 py-4'>
            <div className='flex justify-between items-center w-full'>
              <button
                type='button'
                onClick={async () => {
                  if (window.confirm('Are you sure you want to delete this advance entry? This action cannot be undone.')) {
                    try {
                      await deleteAdvance({ companyId, branchId, id: item.id, user: getCurrentUser() }).unwrap()
                      onSuccess?.()
                      onClose()
                    } catch (err) {
                      console.error('Delete failed:', err)
                      alert('Failed to delete entry.')
                    }
                  }
                }}
                disabled={isDeleting}
                className='px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-sm font-semibold transition-colors'
              >
                {isDeleting ? 'Deleting...' : 'Delete Entry'}
              </button>

              <div className='flex gap-3'>
                <button
                  type='button'
                  onClick={onClose}
                  className='px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium transition-colors'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={isLoading}
                  className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${
                    isLoading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-mint-600 hover:bg-mint-700'
                  }`}
                >
                  {isLoading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
