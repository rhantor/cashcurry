'use client'
import React, { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, X, Building2 } from 'lucide-react'

export default function DueBillsFilters ({
  searchTerm,
  setSearchTerm,
  selectedVendor,
  setSelectedVendor,
  vendors = [] // [{ id, name }]
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedVendorName =
    vendors.find(v => v.id === selectedVendor)?.name ?? null

  const handleSelectVendor = id => {
    setSelectedVendor(id === selectedVendor ? null : id)
    setDropdownOpen(false)
  }

  const clearVendor = e => {
    e.stopPropagation()
    setSelectedVendor(null)
  }

  return (
    <div className='bg-surface rounded-xl border shadow-sm p-4 mb-6'>
      <div className='flex flex-col md:flex-row gap-3'>
        {/* Search Input */}
        <div className='relative flex-1'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-subtle' />
          <input
            type='text'
            placeholder='Search vendor, reference #'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className='w-full pl-10 pr-4 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--cc-ring)]/20 focus:border-brand transition-all'
          />
        </div>

        {/* Vendor Dropdown */}
        <div className='relative' ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(prev => !prev)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors w-full md:w-auto min-w-[180px] justify-between ${
              selectedVendor
                ? 'bg-brand-soft border-brand/30 text-brand'
                : 'bg-surface-2/60 hover:bg-surface-2 border-line text-fg'
            }`}
          >
            <div className='flex items-center gap-2 truncate'>
              <Building2 className='h-4 w-4 shrink-0' />
              <span className='truncate'>
                {selectedVendorName ?? 'All Vendors'}
              </span>
            </div>
            <div className='flex items-center gap-1 shrink-0'>
              {selectedVendor && (
                <span
                  onClick={clearVendor}
                  className='hover:bg-brand-soft rounded-full p-0.5 cursor-pointer'
                >
                  <X className='h-3 w-3' />
                </span>
              )}
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${
                  dropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          {/* Dropdown Panel */}
          {dropdownOpen && (
            <div className='absolute right-0 mt-1 w-64 bg-surface border border-line rounded-xl shadow-lg z-50 overflow-hidden'>
              {/* All option */}
              <button
                onClick={() => handleSelectVendor(null)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                  !selectedVendor
                    ? 'bg-brand-soft text-brand font-medium'
                    : 'text-fg hover:bg-surface-2'
                }`}
              >
                All Vendors
                {!selectedVendor && (
                  <span className='w-1.5 h-1.5 rounded-full bg-brand' />
                )}
              </button>

              <div className='border-t border-line' />

              {/* Vendor list */}
              <div className='max-h-52 overflow-y-auto'>
                {vendors.length === 0 ? (
                  <div className='px-4 py-3 text-sm text-subtle text-center'>
                    No vendors available
                  </div>
                ) : (
                  vendors.map(vendor => (
                    <button
                      key={vendor.id}
                      onClick={() => handleSelectVendor(vendor.id)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                        selectedVendor === vendor.id
                          ? 'bg-brand-soft text-brand font-medium'
                          : 'text-fg hover:bg-surface-2'
                      }`}
                    >
                      <span className='truncate'>{vendor.name}</span>
                      {selectedVendor === vendor.id && (
                        <span className='w-1.5 h-1.5 rounded-full bg-brand shrink-0' />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active filter chips */}
      {(searchTerm || selectedVendor) && (
        <div className='flex flex-wrap gap-2 mt-3 pt-3 border-t border-line'>
          {searchTerm && (
            <span className='inline-flex items-center gap-1.5 px-3 py-1 bg-surface-2 text-muted rounded-full text-xs font-medium'>
              Search: &quot;{searchTerm}&quot;
              <button onClick={() => setSearchTerm('')}>
                <X className='h-3 w-3 hover:text-danger transition-colors' />
              </button>
            </span>
          )}
          {selectedVendor && selectedVendorName && (
            <span className='inline-flex items-center gap-1.5 px-3 py-1 bg-brand-soft text-brand rounded-full text-xs font-medium'>
              Vendor: {selectedVendorName}
              <button onClick={() => setSelectedVendor(null)}>
                <X className='h-3 w-3 hover:text-danger transition-colors' />
              </button>
            </span>
          )}
          <button
            onClick={() => {
              setSearchTerm('')
              setSelectedVendor(null)
            }}
            className='text-xs text-subtle hover:text-danger transition-colors underline underline-offset-2'
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
