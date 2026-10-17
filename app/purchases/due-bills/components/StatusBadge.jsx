'use client'
import React from 'react'
import { AlertCircle, Calendar, CheckCircle2 } from 'lucide-react'

const StatusBadge = ({ dueDays }) => {
  if (dueDays < 0) {
    return (
      <span className='inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-medium text-danger'>
        <AlertCircle className='h-3 w-3' />
        Overdue {Math.abs(dueDays)} days
      </span>
    )
  }

  if (dueDays <= 3) {
    return (
      <span className='inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning'>
        <Calendar className='h-3 w-3' />
        Due in {dueDays} days
      </span>
    )
  }

  return (
    <span className='inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand'>
      <CheckCircle2 className='h-3 w-3' />
      Due in {dueDays} days
    </span>
  )
}

export default StatusBadge
