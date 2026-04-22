/* eslint-disable react/prop-types */
'use client'

import React from 'react'
import { Edit, Trash2, Eye, Key } from 'lucide-react'

export default function StaffTable ({
  rows,
  loading,
  onEdit,
  onDelete,
  onView,
  onGenerateLogin
}) {
  return (
    <div className='bg-white border border-black/10 rounded-2xl overflow-hidden shadow-sm'>
      {loading ? (
        <div className='py-16 flex flex-col items-center justify-center text-black/50'>
          <div className='h-9 w-9 rounded-full border-2 border-black/10 border-t-[var(--color-primary)] animate-spin mb-3' />
          <p className='text-sm font-semibold'>Loading staff records...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className='py-16 flex flex-col items-center justify-center text-black/50'>
          <div className='text-4xl mb-3'>👥</div>
          <p className='text-sm font-semibold'>
            No results match your filters.
          </p>
        </div>
      ) : (
        <div className='overflow-x-auto'>
          <table className='w-full text-left border-collapse'>
            <thead>
              <tr className='bg-[var(--color-surface)] border-b border-black/10 text-xs uppercase tracking-wider text-black/50 font-extrabold'>
                <th className='px-6 py-4'>Staff Member</th>
                <th className='px-6 py-4'>Email</th>
                <th className='px-6 py-4'>Phone</th>
                <th className='px-6 py-4'>IC/Passport Number</th>
                <th className='px-6 py-4'>Department</th>
                <th className='px-6 py-4 text-right'>Actions</th>
              </tr>
            </thead>

            <tbody className='divide-y divide-black/10'>
              {rows.map(s => (
                <tr
                  key={s.id}
                  className='hover:bg-[var(--color-surface)]/50 transition-colors group'
                >
                  {/* Clickable cells — clicking name/email/phone etc opens detail */}
                  <td
                    className='px-6 py-4 cursor-pointer'
                    onClick={() => onView?.(s)}
                  >
                    <div className='flex items-center gap-3'>
                      <div className='w-10 h-10 rounded-full bg-[var(--color-surface)] border border-black/10 flex items-center justify-center overflow-hidden text-lg'>
                        {s.photoUrl ? (
                          <img
                            src={s.photoUrl}
                            alt=''
                            className='w-full h-full object-cover'
                          />
                        ) : (
                          <span className='opacity-50'>👤</span>
                        )}
                      </div>
                      <div>
                        <div className='font-bold text-black/80'>
                          {s.firstName} {s.lastName}
                        </div>
                        {s.role && (
                          <span className='inline-block mt-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)] border border-[var(--color-primary)]/15'>
                            {s.role}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td
                    className='px-6 py-4 text-sm text-black/60 cursor-pointer'
                    onClick={() => onView?.(s)}
                  >
                    {s.email || '—'}
                  </td>

                  <td
                    className='px-6 py-4 text-sm text-black/60 cursor-pointer'
                    onClick={() => onView?.(s)}
                  >
                    {s.phone || '—'}
                  </td>

                  <td
                    className='px-6 py-4 text-sm font-mono text-black/60 cursor-pointer'
                    onClick={() => onView?.(s)}
                  >
                    {s.icNumber || s.passportNumber || '—'}
                  </td>

                  <td
                    className='px-6 py-4 text-sm text-black/60 cursor-pointer'
                    onClick={() => onView?.(s)}
                  >
                    {s.department || '—'}
                  </td>

                  {/* Actions — NOT clickable for row-open, has its own buttons */}
                  <td className='px-6 py-4 text-right'>
                    <div className='flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                      <button
                        onClick={() => onView?.(s)}
                        className='p-2 text-black/50 hover:bg-[var(--color-primary)]/8 hover:text-[var(--color-primary)] rounded-xl transition-colors'
                        title='View Details'
                      >
                        <Eye size={16} />
                      </button>
                      {!s.uid && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onGenerateLogin?.(s); }}
                          className='p-2 text-black/50 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors'
                          title='Generate Login'
                        >
                          <Key size={16} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(s); }}
                        className='p-2 text-black/50 hover:bg-black/5 hover:text-black/80 rounded-xl transition-colors'
                        title='Edit'
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(s); }}
                        className='p-2 text-black/50 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors'
                        title='Delete'
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
