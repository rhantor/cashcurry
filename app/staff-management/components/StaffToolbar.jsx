/* eslint-disable react/prop-types */
'use client'

import React from 'react'
import { Search, Plus } from 'lucide-react'
import { ROLES } from '../lib/constants'

export default function StaffToolbar({
  search,
  setSearch,
  roleFilter,
  setRoleFilter,
  onAdd,
  filteredCount,
  totalCount,
  branchName
}) {
  return (
    <div className='mb-6'>
      <div className='flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5'>
        <div>
          <h1 className='text-3xl font-extrabold tracking-tight text-[color:var(--color-accent)]'>
            Staff Management
          </h1>
          <p className='text-sm text-black/55 mt-1'>
            Manage employee records for your branch
          </p>

          <div className='inline-flex items-center gap-2 mt-3 px-3 py-1 rounded-full text-xs font-bold border border-black/10 bg-[var(--color-surface)] text-[color:var(--color-accent)]'>
            <span className='w-2 h-2 rounded-full bg-[var(--color-primary)]' />
            Branch: {branchName}
          </div>
        </div>

        <button
          onClick={onAdd}
          className='flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-5 py-2.5 rounded-xl font-extrabold text-sm transition-all shadow-lg hover:shadow-[color:var(--color-primary)]/25 active:scale-[0.98]'
        >
          <Plus size={18} /> Add Staff
        </button>
      </div>

      <div className='flex flex-col md:flex-row items-center gap-3'>
        <div className='relative flex-1 w-full md:max-w-sm'>
          <Search
            className='absolute left-3 top-1/2 -translate-y-1/2 text-black/40'
            size={16}
          />
          <input
            type='text'
            placeholder='Search name, email, phone, IC...'
            value={search}
            onChange={e => setSearch(e.target.value)}
            className='w-full bg-white border border-black/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-black/80 outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-black/35'
          />
        </div>

        <div className='relative w-full md:w-auto'>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className='w-full md:w-[220px] appearance-none bg-white border border-black/10 rounded-xl pl-4 pr-10 py-2.5 text-sm text-black/80 outline-none focus:border-[var(--color-primary)] cursor-pointer'
          >
            <option value=''>All Roles</option>
            {ROLES.slice(1).map(r => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          <div className='absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black/40'>
            <svg width='10' height='6' viewBox='0 0 10 6' fill='none'>
              <path
                d='M1 1L5 5L9 1'
                stroke='currentColor'
                strokeWidth='1.5'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </div>
        </div>

        <div className='ml-auto text-xs text-black/50 font-bold hidden md:block'>
          Showing {filteredCount} of {totalCount} staff
        </div>
      </div>
    </div>
  )
}
