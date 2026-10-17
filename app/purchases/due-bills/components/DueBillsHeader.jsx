'use client'
import React from 'react'


const DueBillsHeader = ({
  branchName,
  totalSelectedBalance,
  canPay,
  onPayClick,
  fmtRM,
  onExportPDF,
  onExportExcel,
  isExporting
}) => {
  return (
    <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6'>
      <div>
        <h1 className='text-2xl font-bold text-fg'>
          {branchName ? `${branchName}’s` : ''} Due Bills
        </h1>
        <p className='text-sm text-muted mt-1'>
          Manage your outstanding vendor payments
        </p>
      </div>

      <div className='flex items-center gap-4 bg-surface p-2 pl-4 rounded-xl border shadow-sm'>
        <div>
          <span className='text-xs text-muted uppercase'>
            Selected to Pay
          </span>
          <div className='text-lg font-bold'>{fmtRM(totalSelectedBalance)}</div>
        </div>

        <button
          disabled={!canPay}
          onClick={onPayClick}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold ${
            canPay
              ? 'bg-brand text-white hover:brightness-105'
              : 'bg-surface-2 text-subtle cursor-not-allowed'
          }`}
        >
          Pay Selected
        </button>
      </div>

      {(onExportPDF || onExportExcel) && (
        <div className='flex items-center gap-2'>
          <button 
            onClick={onExportPDF}
            disabled={isExporting}
            className={`px-3 py-2 bg-danger-soft text-danger rounded-lg text-xs font-semibold hover:bg-danger-soft flex items-center gap-1 ${isExporting ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isExporting ? (
              <>
                <svg className="animate-spin h-3 w-3 text-danger" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </>
            ) : 'Export PDF'}
          </button>
          <button 
            onClick={onExportExcel}
            className='px-3 py-2 bg-brand-soft text-brand rounded-lg text-xs font-semibold hover:bg-brand-soft'
          >
            Export Excel
          </button>
        </div>
      )}
    </div>
  )
}

export default DueBillsHeader
