'use client'
import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CalendarClock, Download, FileSpreadsheet, FileText, Wallet } from 'lucide-react'
import { Button, Menu } from '@/app/components/ui'
import StatTiles from '@/app/components/purchases/StatTiles'

/**
 * The top of Due bills: what is owed in all, what is overdue and what falls
 * due this week (from the unpaid bills), export, and — once bills are ticked —
 * a bar at the bottom with their total and Pay.
 * bills carry `balance` and `__dueInDays` (negative = overdue).
 */
const DueBillsHeader = ({ bills = [], selectedCount = 0, totalSelectedBalance, canPay, onPayClick, fmtRM, onExportPDF, onExportExcel, isExporting }) => {
  const sum = list => list.reduce((n, b) => n + Number(b.balance || 0), 0)
  const overdue = bills.filter(b => b.__dueInDays < 0)
  const soon = bills.filter(b => b.__dueInDays >= 0 && b.__dueInDays <= 7)
  const tiles = [
    { label: 'Owed to vendors', value: fmtRM(sum(bills)), note: `${bills.length} unpaid bill${bills.length === 1 ? '' : 's'}`, icon: Wallet, tone: 'bg-info-soft text-info' },
    { label: 'Overdue', value: fmtRM(sum(overdue)), note: overdue.length ? `${overdue.length} bill${overdue.length === 1 ? '' : 's'} past the due date` : 'Nothing overdue', icon: AlertTriangle, tone: overdue.length ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-muted' },
    { label: 'Due this week', value: fmtRM(sum(soon)), note: `${soon.length} bill${soon.length === 1 ? '' : 's'} in the next 7 days`, icon: CalendarClock, tone: 'bg-warning-soft text-warning' },
  ]

  return (
    <>
      <div className='mb-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-start'>
        <div className='min-w-0 flex-1'>
          <StatTiles tiles={tiles} />
        </div>
        {(onExportPDF || onExportExcel) && (
          <div className='self-end sm:self-auto'>
          <Menu
            align='end'
            width={190}
            trigger={p => (
              <Button {...p} variant='secondary' icon={Download} loading={isExporting}>
                Export
              </Button>
            )}
            items={[
              onExportPDF && { label: 'PDF (with invoices)', icon: FileText, onSelect: onExportPDF },
              onExportExcel && { label: 'Excel', icon: FileSpreadsheet, onSelect: onExportExcel },
            ].filter(Boolean)}
          />
          </div>
        )}
      </div>

      {/* ticked bills: their total and Pay */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className='fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-2xl lg:bottom-5 lg:left-[calc(16rem+1.5rem)]'
          >
            <div className='flex items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 pl-4 shadow-float backdrop-blur'>
              <div className='min-w-0 flex-1'>
                <p className='text-[11px] font-semibold uppercase tracking-wider text-subtle'>
                  {selectedCount} bill{selectedCount === 1 ? '' : 's'} to pay
                </p>
                <p className='truncate text-lg font-bold tabular-nums text-fg'>{fmtRM(totalSelectedBalance)}</p>
                {!canPay && <p className='text-[11px] font-medium text-warning'>Pick bills from one vendor at a time</p>}
              </div>
              <Button size='lg' icon={Wallet} disabled={!canPay} onClick={onPayClick}>
                Pay
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default DueBillsHeader
