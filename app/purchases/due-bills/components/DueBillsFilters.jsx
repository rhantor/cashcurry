/* eslint-disable react/prop-types */
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
    <div className='bg-white rounded-xl border shadow-sm p-4 mb-6'>
      <div className='flex flex-col md:flex-row gap-3'>
        {/* Search Input */}
        <div className='relative flex-1'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
          <input
            type='text'
            placeholder='Search vendor, reference #'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className='w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mint-500/20 focus:border-mint-500 transition-all'
          />
        </div>

        {/* Vendor Dropdown */}
        <div className='relative' ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(prev => !prev)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors w-full md:w-auto min-w-[180px] justify-between ${
              selectedVendor
                ? 'bg-mint-50 border-mint-300 text-mint-700'
                : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
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
                  className='hover:bg-mint-100 rounded-full p-0.5 cursor-pointer'
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
            <div className='absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden'>
              {/* All option */}
              <button
                onClick={() => handleSelectVendor(null)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                  !selectedVendor
                    ? 'bg-mint-50 text-mint-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                All Vendors
                {!selectedVendor && (
                  <span className='w-1.5 h-1.5 rounded-full bg-mint-500' />
                )}
              </button>

              <div className='border-t border-gray-100' />

              {/* Vendor list */}
              <div className='max-h-52 overflow-y-auto'>
                {vendors.length === 0 ? (
                  <div className='px-4 py-3 text-sm text-gray-400 text-center'>
                    No vendors available
                  </div>
                ) : (
                  vendors.map(vendor => (
                    <button
                      key={vendor.id}
                      onClick={() => handleSelectVendor(vendor.id)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                        selectedVendor === vendor.id
                          ? 'bg-mint-50 text-mint-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className='truncate'>{vendor.name}</span>
                      {selectedVendor === vendor.id && (
                        <span className='w-1.5 h-1.5 rounded-full bg-mint-500 shrink-0' />
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
        <div className='flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100'>
          {searchTerm && (
            <span className='inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium'>
              Search: &quot;{searchTerm}&quot;
              <button onClick={() => setSearchTerm('')}>
                <X className='h-3 w-3 hover:text-red-500 transition-colors' />
              </button>
            </span>
          )}
          {selectedVendor && selectedVendorName && (
            <span className='inline-flex items-center gap-1.5 px-3 py-1 bg-mint-100 text-mint-700 rounded-full text-xs font-medium'>
              Vendor: {selectedVendorName}
              <button onClick={() => setSelectedVendor(null)}>
                <X className='h-3 w-3 hover:text-red-500 transition-colors' />
              </button>
            </span>
          )}
          <button
            onClick={() => {
              setSearchTerm('')
              setSelectedVendor(null)
            }}
            className='text-xs text-gray-400 hover:text-red-500 transition-colors underline underline-offset-2'
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
