/* eslint-disable react/prop-types */
'use client'

import React from 'react'
import { ShieldAlert, ScanFace } from 'lucide-react'

// Warns that two or more staff records share the same enrolled face. Enrollment
// refuses this now, but records created before that guard existed are still in
// the database — and while they are, the kiosk will punch that person in under
// whichever name it scores marginally better.
export default function FaceConflictBanner ({ groups = [], onFix }) {
  if (!groups.length) return null

  return (
    <div className='mb-6 rounded-2xl border border-red-200 bg-red-50 p-5'>
      <div className='flex items-start gap-3'>
        <ShieldAlert className='text-red-600 flex-shrink-0 mt-0.5' size={22} />
        <div className='flex-1'>
          <h3 className='text-sm font-extrabold text-red-800'>
            {groups.length === 1
              ? 'Duplicate Face ID enrollment detected'
              : `${groups.length} duplicate Face ID enrollments detected`}
          </h3>
          <p className='mt-1 text-xs font-semibold text-red-700/80'>
            The same face is enrolled on more than one staff record. The kiosk cannot tell these
            people apart, so a punch may be recorded under the wrong name. Remove the Face ID from
            every record except the correct one.
          </p>

          <div className='mt-4 space-y-3'>
            {groups.map(group => (
              <div
                key={group.members.map(m => m.id).join('-')}
                className='rounded-xl border border-red-200 bg-white p-3'
              >
                <div className='flex items-center gap-2 mb-2'>
                  <ScanFace size={14} className='text-red-500' />
                  <span className='text-[11px] font-extrabold uppercase tracking-wider text-red-600'>
                    Same face on {group.members.length} records
                  </span>
                  <span className='text-[10px] font-bold text-black/35'>
                    match distance {group.distance.toFixed(2)}
                  </span>
                </div>
                <div className='flex flex-wrap gap-2'>
                  {group.members.map(m => (
                    <button
                      key={m.id}
                      type='button'
                      onClick={() => onFix?.(m.id)}
                      className='rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100'
                    >
                      {m.name} — review
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
