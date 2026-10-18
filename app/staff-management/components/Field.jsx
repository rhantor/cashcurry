'use client'

import React from 'react'

export default function Field ({
  label,
  required,
  error,
  children,
  className = ''
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className='text-xs font-semibold text-muted'>
        {label} {required && <span className='text-danger'>*</span>}
      </label>
      {children}
      {error && (
        <span className='text-[11px] text-danger mt-0.5'>{error}</span>
      )}
    </div>
  )
}
