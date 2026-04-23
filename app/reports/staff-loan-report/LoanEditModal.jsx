/* eslint-disable react/prop-types */
'use client'
import { useUpdateStaffLoanMutation, useDeleteStaffLoanMutation } from '@/lib/redux/api/staffLoanApiSlice'
import { getCurrentUser } from '@/lib/authz/roles'
import React, { useState, useMemo } from 'react'
import useCurrency from '@/app/hooks/useCurrency'

const LOAN_DURATIONS = [3, 6, 9, 12, 18, 24]

export default function LoanEditModal ({
  item,
  companyId,
  branchId,
  onClose,
  onSuccess
}) {
  const currency = useCurrency();
  if (!item) return null

  const [form, setForm] = useState({
    amount: item.amount || '',
    durationMonths: item.durationMonths || 6,
    reason: item.reason || '',
    date: item.date || '',
    repaymentStartDate: item.repaymentStartDate || '',
    status: item.status || 'pending',
    approvalNotes: item.approvalNotes || ''
  })

  const [updateLoan, { isLoading }] = useUpdateStaffLoanMutation()
  const [deleteLoan, { isLoading: isDeleting }] = useDeleteStaffLoanMutation()

  const handleChange = e => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const amount = Number(form.amount) || 0
  const duration = Number(form.durationMonths) || 1
  const emi = amount > 0 ? Math.ceil(amount / duration) : 0

  // Generate preview schedule
  const schedule = useMemo(() => {
    if (!emi || !form.repaymentStartDate) return []
    const base = new Date(form.repaymentStartDate)
    base.setDate(1)
    return Array.from({ length: duration }, (_, i) => {
      const d = new Date(base)
      d.setMonth(d.getMonth() + i)
      const isLast = i === duration - 1
      return {
        label: d.toLocaleString('default', { month: 'short', year: 'numeric' }),
        amount: isLast ? amount - emi * (duration - 1) : emi
      }
    })
  }, [emi, duration, amount, form.repaymentStartDate])

  const handleSubmit = async e => {
    e.preventDefault()

    try {
      const newAmount = Number(form.amount) || 0
      const newDuration = Number(form.durationMonths) || 1
      const newEmi = Math.ceil(newAmount / newDuration)

      // Rebuild installment schedule if amount or duration changed
      let newInstallments = item.installments || []
      if (
        newAmount !== item.amount ||
        newDuration !== item.durationMonths ||
        form.repaymentStartDate !== item.repaymentStartDate
      ) {
        const base = form.repaymentStartDate
          ? new Date(form.repaymentStartDate)
          : new Date()
        base.setDate(1)

        newInstallments = Array.from({ length: newDuration }, (_, i) => {
          const d = new Date(base)
          d.setMonth(d.getMonth() + i)
          const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
            2,
            '0'
          )}`
          const isLast = i === newDuration - 1

          // Preserve paid status if installment already exists
          const existingInst = item.installments?.[i]
          const status = existingInst?.status || 'pending'
          const paidAt = existingInst?.paidAt || null

          return {
            index: i + 1,
            month,
            amount: isLast ? newAmount - newEmi * (newDuration - 1) : newEmi,
            status,
            paidAt
          }
        })
      }

      // Recalculate totals
      const totalPaid = newInstallments
        .filter(i => i.status === 'paid')
        .reduce((sum, i) => sum + i.amount, 0)
      const remainingAmount = newAmount - totalPaid
      const allPaid = newInstallments.every(i => i.status === 'paid')

      await updateLoan({
        companyId,
        branchId,
        id: item.id,
        user: getCurrentUser(),
        data: {
          amount: newAmount,
          durationMonths: newDuration,
          emi: newEmi,
          reason: form.reason,
          date: form.date,
          repaymentStartDate: form.repaymentStartDate || null,
          installments: newInstallments,
          totalPaid,
          remainingAmount,
          status: allPaid ? 'closed' : form.status,
          approvalNotes: form.approvalNotes
        }
      }).unwrap()

      onSuccess?.()
      onClose()
    }
  }

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this loan entry? This action cannot be undone.')) {
      try {
        await deleteLoan({ companyId, branchId, id: item.id, user: getCurrentUser() }).unwrap()
        onSuccess?.()
        onClose()
      } catch (err) {
        console.error('Failed to delete loan:', err)
        alert('Failed to delete loan. Please try again.')
      }
    }
  }

  return (
    <div
      className='fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4'
      onClick={onClose}
    >
      <div
        className='bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto'
        onClick={e => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className='sticky top-0 bg-white border-b px-6 py-4 z-10'>
            <h2 className='text-xl font-bold text-blue-600'>Edit Loan</h2>
            <p className='text-sm text-gray-500 mt-1'>
              Staff: {item.staffName || 'Unknown'}
            </p>
          </div>

          {/* Form fields */}
          <div className='p-6 space-y-4'>
            {/* Amount + Issue Date */}
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1.5'>
                  Loan Amount ({currency}) <span className='text-red-500'>*</span>
                </label>
                <input
                  type='number'
                  name='amount'
                  value={form.amount}
                  onChange={handleChange}
                  min='1'
                  step='0.01'
                  required
                  className='w-full border-2 border-blue-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-500 transition-colors'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1.5'>
                  Issue Date <span className='text-red-500'>*</span>
                </label>
                <input
                  type='date'
                  name='date'
                  value={form.date}
                  onChange={handleChange}
                  required
                  className='w-full border-2 border-blue-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-500 transition-colors'
                />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1.5'>
                Duration <span className='text-red-500'>*</span>
              </label>
              <select
                name='durationMonths'
                value={form.durationMonths}
                onChange={handleChange}
                required
                className='w-full border-2 border-blue-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-500 transition-colors'
              >
                {LOAN_DURATIONS.map(n => (
                  <option key={n} value={n}>
                    {n} months
                  </option>
                ))}
              </select>
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
                className='w-full border-2 border-blue-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-500 transition-colors resize-none'
                placeholder='Purpose of this loan…'
              />
            </div>

            {/* Repayment Start Date */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1.5'>
                First EMI Month
              </label>
              <input
                type='date'
                name='repaymentStartDate'
                value={form.repaymentStartDate}
                onChange={handleChange}
                min={form.date}
                className='w-full border-2 border-blue-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-500 transition-colors'
              />
            </div>

            {/* EMI preview */}
            {emi > 0 && (
              <div className='flex justify-between items-center px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm'>
                <span className='text-gray-600'>Monthly EMI</span>
                <span className='font-semibold text-blue-700'>
                  {currency} {emi.toLocaleString()}
                  <span className='text-xs font-normal text-gray-500 ml-1'>
                    × {duration} months
                  </span>
                </span>
              </div>
            )}

            {/* Installment preview table */}
            {schedule.length > 0 && (
              <div className='rounded-xl border border-gray-200 overflow-hidden'>
                <div className='flex justify-between px-4 py-2 bg-gray-50 border-b border-gray-200'>
                  <span className='text-xs font-semibold text-gray-500 uppercase tracking-wide'>
                    Month
                  </span>
                  <span className='text-xs font-semibold text-gray-500 uppercase tracking-wide'>
                    EMI
                  </span>
                </div>
                <div className='divide-y divide-gray-100 max-h-44 overflow-y-auto'>
                  {schedule.map((row, i) => (
                    <div
                      key={i}
                      className='flex justify-between items-center px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors'
                    >
                      <div className='flex items-center gap-2'>
                        <span className='w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500'>
                          {i + 1}
                        </span>
                        <span className='text-gray-700'>{row.label}</span>
                        {i === schedule.length - 1 && (
                          <span className='text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium'>
                            final
                          </span>
                        )}
                      </div>
                      <span className='font-medium text-gray-800'>
                        {currency} {row.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                <div className='flex justify-between px-4 py-2.5 bg-gray-50 border-t border-gray-200 text-sm font-semibold'>
                  <span className='text-gray-600'>Total</span>
                  <span className='text-gray-900'>
                    {currency} {amount.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

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
                className='w-full border-2 border-blue-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-500 transition-colors'
              >
                <option value='pending'>Pending</option>
                <option value='approved'>Approved</option>
                <option value='rejected'>Rejected</option>
                <option value='closed'>Closed</option>
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
                className='w-full border-2 border-blue-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-500 transition-colors resize-none'
                placeholder='Internal notes about this loan…'
              />
            </div>

            {/* Installment status (read-only) */}
            {item.installments && item.installments.length > 0 && (
              <div className='p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm space-y-1'>
                <div className='flex justify-between items-center'>
                  <span className='text-gray-600'>Total Paid</span>
                  <span className='font-semibold text-blue-700'>
                    {currency} {(item.totalPaid || 0).toLocaleString()}
                  </span>
                </div>
                <div className='flex justify-between items-center'>
                  <span className='text-gray-600'>Remaining</span>
                  <span className='font-semibold text-gray-700'>
                    {currency} {(item.remainingAmount || 0).toLocaleString()}
                  </span>
                </div>
                <div className='flex justify-between items-center'>
                  <span className='text-gray-600'>Installments Paid</span>
                  <span className='font-semibold text-gray-700'>
                    {item.installments.filter(i => i.status === 'paid').length}{' '}
                    / {item.installments.length}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className='sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-between items-center'>
            <button
              type='button'
              onClick={handleDelete}
              disabled={isLoading || isDeleting}
              className='px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-sm font-medium transition-colors disabled:opacity-50'
            >
              {isDeleting ? 'Deleting…' : 'Delete Entry'}
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
                disabled={isLoading || isDeleting}
                className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${
                  isLoading || isDeleting
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isLoading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
