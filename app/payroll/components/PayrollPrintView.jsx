'use client'

import { useState } from 'react'
import { PrintStyles } from './print/printParts'
import { Payslip } from './print/Payslip'
import { PayrollSummaryTable } from './print/PayrollSummaryTable'

// ─── Default export — modal with Print button ─────────────────────────────────

export default function PayrollPrintView ({ mode, singleSlip, slips, branchName, companyName, period, run, onClose }) {
  const [showLayoutMenu, setShowLayoutMenu] = useState(false)
  const slip        = singleSlip
  const isLandscape = mode === 'all'

  return (
    <>
      {/* Screen overlay */}
      <div className='no-print fixed inset-0 bg-black/60 z-50 flex flex-col'>
        <div className='flex items-center justify-between px-4 py-3 bg-white border-b shrink-0 gap-2'>
          <div className='min-w-0'>
            {companyName && <p className='text-[10px] text-gray-400'>{companyName}</p>}
            <p className='font-semibold text-gray-800 text-sm truncate'>
              {mode==='single'?`Payslip — ${slip?.staffName}`:`${branchName} — Payroll Sheet`}
            </p>
          </div>
          <div className='flex gap-2 shrink-0'>
            <button onClick={()=>window.print()} className='px-4 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700'>
              🖨 Print
            </button>
            {mode === 'single' ? (
              <button 
                onClick={() => {
                  if (slip) {
                    import('@/utils/export/exportPayroll').then(({ exportPayslipToPDF }) => {
                      exportPayslipToPDF(slip, branchName, period, companyName)
                    })
                  }
                }}
                className='px-4 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 flex items-center gap-1'
              >
                📄 Download PDF
              </button>
            ) : (
              <>
                <div className='relative'>
                  <button
                    onClick={() => setShowLayoutMenu(v => !v)}
                    className='px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 flex items-center gap-1'
                    title='Download PDF with all individual payslips'
                  >
                    📄 All Payslips PDF ▾
                  </button>
                  {showLayoutMenu && (
                    <>
                      <div className='fixed inset-0 z-40' onClick={() => setShowLayoutMenu(false)} />
                      <div className='absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 py-1 min-w-[210px] overflow-hidden'>
                        <button
                          onClick={() => {
                            setShowLayoutMenu(false)
                            if (slips) {
                              import('@/utils/export/exportPayroll').then(({ exportAllPayslipsToPDF }) => {
                                exportAllPayslipsToPDF(slips, branchName, period, companyName, false)
                              })
                            }
                          }}
                          className='w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-3'
                        >
                          <span className='text-base'>📄</span>
                          <div>
                            <div className='font-semibold text-gray-800'>1 per page</div>
                            <div className='text-[10px] text-gray-400'>Full-size payslip</div>
                          </div>
                        </button>
                        <div className='border-t border-gray-100' />
                        <button
                          onClick={() => {
                            setShowLayoutMenu(false)
                            if (slips) {
                              import('@/utils/export/exportPayroll').then(({ exportAllPayslipsToPDF }) => {
                                exportAllPayslipsToPDF(slips, branchName, period, companyName, true)
                              })
                            }
                          }}
                          className='w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-3'
                        >
                          <span className='text-base'>📑</span>
                          <div>
                            <div className='font-semibold text-gray-800'>2 per page</div>
                            <div className='text-[10px] text-gray-400'>Compact · saves paper</div>
                          </div>
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <button 
                  onClick={() => {
                    if (slips) {
                      import('@/utils/export/exportPayroll').then(({ exportPayrollToPDF }) => {
                        exportPayrollToPDF(slips, branchName, period, run, companyName)
                      })
                    }
                  }}
                  className='px-4 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 flex items-center gap-1'
                  title='Download the landscape master summary sheet'
                >
                  📄 Summary Sheet PDF
                </button>
              </>
            )}
            <button onClick={onClose} className='px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50'>
              Close
            </button>
          </div>
        </div>
        <div className='flex-1 overflow-auto p-6 bg-gray-100'>
          <div className='bg-white rounded-xl shadow-xl p-8 max-w-[1500px] w-full mx-auto overflow-x-auto'>
            {mode==='single'&&slip  &&<Payslip slip={slip} branchName={branchName} companyName={companyName} period={period}/>}
            {mode==='all'   &&slips &&<PayrollSummaryTable slips={slips} branchName={branchName} companyName={companyName} period={period} run={run}/>}
          </div>
        </div>
      </div>

      {/* Print-only render */}
      <div className='hidden print:block'>
        <PrintStyles landscape={isLandscape}/>
        {mode==='single'&&slip  &&<Payslip slip={slip} branchName={branchName} companyName={companyName} period={period}/>}
        {mode==='all'   &&slips &&<PayrollSummaryTable slips={slips} branchName={branchName} companyName={companyName} period={period} run={run}/>}
      </div>
    </>
  )
}
