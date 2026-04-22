/* eslint-disable react/prop-types */
'use client'

import React from 'react'
import { AlertTriangle } from 'lucide-react'

export default function DeleteConfirm ({ staff, onClose, onConfirm, busy }) {
  if (!staff) return null

  return (
    <div
      className='fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-200'
      onClick={onClose}
    >
      <div
        className='bg-[var(--color-background)] border border-black/10 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in slide-in-from-bottom-5 duration-200'
        onClick={e => e.stopPropagation()}
      >
        <div className='w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4 text-red-600 border border-red-100'>
          <AlertTriangle size={24} />
        </div>

        <h3 className='text-lg font-extrabold text-[color:var(--color-accent)] mb-2'>
          Delete Staff Member?
        </h3>

        <p className='text-sm text-black/60 leading-relaxed mb-6'>
          Are you sure you want to delete{' '}
          <strong className='text-black/80'>
            {staff.firstName} {staff.lastName}
          </strong>
          ? This action cannot be undone.
        </p>

        <div className='flex justify-end gap-3'>
          <button
            onClick={onClose}
            disabled={busy}
            className='px-4 py-2 rounded-xl border border-black/10 text-black/70 text-sm font-bold hover:bg-black/5 disabled:opacity-60'
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className='px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 shadow-lg shadow-red-600/20 disabled:opacity-60'
          >
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  )
}
