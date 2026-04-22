/* eslint-disable react/prop-types */
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
      <label className='text-xs font-bold text-[color:var(--color-accent)]/80 uppercase tracking-wide'>
        {label} {required && <span className='text-red-600'>*</span>}
      </label>
      {children}
      {error && (
        <span className='text-[11px] text-red-600 mt-0.5'>{error}</span>
      )}
    </div>
  )
}
