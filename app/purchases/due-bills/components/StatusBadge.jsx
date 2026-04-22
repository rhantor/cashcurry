/* eslint-disable react/prop-types */
'use client'
import React from 'react'
import { AlertCircle, Calendar, CheckCircle2 } from 'lucide-react'

const StatusBadge = ({ dueDays }) => {
  if (dueDays < 0) {
    return (
      <span className='inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800'>
        <AlertCircle className='h-3 w-3' />
        Overdue {Math.abs(dueDays)} days
      </span>
    )
  }

  if (dueDays <= 3) {
    return (
      <span className='inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800'>
        <Calendar className='h-3 w-3' />
        Due in {dueDays} days
      </span>
    )
  }

  return (
    <span className='inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800'>
      <CheckCircle2 className='h-3 w-3' />
      Due in {dueDays} days
    </span>
  )
}

export default StatusBadge
