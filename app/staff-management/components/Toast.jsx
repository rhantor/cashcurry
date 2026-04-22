/* eslint-disable react/prop-types */
'use client'

import React from 'react'
import { CheckCircle, XCircle } from 'lucide-react'

export default function Toast({ type, msg }) {
  const ok = type === 'ok'
  return (
    <div
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border animate-in slide-in-from-bottom-5 fade-in duration-300
      ${
        ok
          ? 'bg-[var(--color-surface)] border-[color:var(--color-secondary)] text-[color:var(--color-accent)]'
          : 'bg-[var(--color-surface)] border-red-300 text-red-700'
      }`}
    >
      {ok ? <CheckCircle size={18} /> : <XCircle size={18} />}
      <span className='text-sm font-semibold'>{msg}</span>
    </div>
  )
}
