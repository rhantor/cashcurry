/* eslint-disable react/prop-types */
'use client'
import React from 'react'


const DueBillsHeader = ({
  branchName,
  totalSelectedBalance,
  canPay,
  onPayClick,
  fmtRM,
  onExportPDF,
  onExportExcel
}) => {
  return (
    <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6'>
      <div>
        <h1 className='text-2xl font-bold text-gray-900'>
          {branchName ? `${branchName}’s` : ''} Due Bills
        </h1>
        <p className='text-sm text-gray-500 mt-1'>
          Manage your outstanding vendor payments
        </p>
      </div>

      <div className='flex items-center gap-4 bg-white p-2 pl-4 rounded-xl border shadow-sm'>
        <div>
          <span className='text-xs text-gray-500 uppercase'>
            Selected to Pay
          </span>
          <div className='text-lg font-bold'>{fmtRM(totalSelectedBalance)}</div>
        </div>

        <button
          disabled={!canPay}
          onClick={onPayClick}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold ${
            canPay
              ? 'bg-mint-600 text-white hover:bg-mint-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          Pay Selected
        </button>
      </div>

      {(onExportPDF || onExportExcel) && (
        <div className='flex items-center gap-2'>
          <button 
            onClick={onExportPDF}
            className='px-3 py-2 bg-red-50 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-100'
          >
            Export PDF
          </button>
          <button 
            onClick={onExportExcel}
            className='px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100'
          >
            Export Excel
          </button>
        </div>
      )}
    </div>
  )
}

export default DueBillsHeader
