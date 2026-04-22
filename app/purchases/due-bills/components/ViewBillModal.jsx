/* eslint-disable react/prop-types */
'use client'
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  FileText,
  Building2,
  Calendar,
  Hash,
  DollarSign,
  Paperclip,
  User,
  Clock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Download,
  AlertCircle,
  CheckCircle2,
  Tag,
  Receipt
} from 'lucide-react'
import useCurrency from '@/app/hooks/useCurrency'

// ── helpers ──────────────────────────────────────────────────────────────────
const makeFmtRM = currency => v =>
  `${currency} ${Number(v ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`

const fmtDate = iso => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return new Date(Date.UTC(+y, +m - 1, +d)).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const fmtTimestamp = ts => {
  if (!ts) return '—'
  const secs = ts?.seconds ?? (ts instanceof Date ? ts.getTime() / 1000 : null)
  if (!secs) return '—'
  return new Date(secs * 1000).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function DueBadge ({ dueDays }) {
  if (dueDays === undefined || dueDays === null) return null
  if (dueDays < 0)
    return (
      <span className='inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700'>
        <AlertCircle className='w-3 h-3' />
        Overdue by {Math.abs(dueDays)}d
      </span>
    )
  if (dueDays <= 3)
    return (
      <span className='inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700'>
        <Clock className='w-3 h-3' />
        Due in {dueDays}d
      </span>
    )
  return (
    <span className='inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700'>
      <CheckCircle2 className='w-3 h-3' />
      Due in {dueDays}d
    </span>
  )
}

function StatusPill ({ status }) {
  const map = {
    unpaid: 'bg-red-100 text-red-700',
    partially_paid: 'bg-amber-100 text-amber-700',
    paid: 'bg-green-100 text-green-700'
  }
  const label = {
    unpaid: 'Unpaid',
    partially_paid: 'Partially Paid',
    paid: 'Paid'
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
        map[status] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {label[status] ?? status}
    </span>
  )
}

// ── Row helper ────────────────────────────────────────────────────────────────
function InfoRow ({ icon: Icon, label, value, mono = false }) {
  return (
    <div className='flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0'>
      <div className='mt-0.5 flex-shrink-0 w-7 h-7 bg-gray-100 rounded-md flex items-center justify-center'>
        <Icon className='w-3.5 h-3.5 text-gray-500' />
      </div>
      <div className='flex-1 min-w-0'>
        <p className='text-xs text-gray-400 mb-0.5'>{label}</p>
        <p
          className={`text-sm font-medium text-gray-800 break-all ${
            mono ? 'font-mono text-xs text-gray-500' : ''
          }`}
        >
          {value || '—'}
        </p>
      </div>
    </div>
  )
}

// ── Attachment Viewer ─────────────────────────────────────────────────────────
function AttachmentViewer ({ attachments }) {
  const [current, setCurrent] = useState(0)

  if (!attachments?.length)
    return (
      <div className='flex flex-col items-center justify-center h-36 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-sm gap-2'>
        <Paperclip className='w-5 h-5' />
        No attachments
      </div>
    )

  const url = attachments[current]
  const isPdf = url?.toLowerCase().includes('.pdf')
  const filename = decodeURIComponent(url.split('/').pop().split('?')[0])

  return (
    <div className='space-y-2'>
      {/* Preview */}
      <div className='relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center min-h-48 md:min-h-56'>
        {isPdf ? (
          <div className='flex flex-col items-center gap-2 py-8 text-gray-400 px-4 text-center'>
            <FileText className='w-8 h-8' />
            <span className='text-xs break-all'>{filename}</span>
          </div>
        ) : (
          <img
            src={url}
            alt={`Attachment ${current + 1}`}
            className='max-h-64 md:max-h-72 w-full object-contain'
            onError={e => {
              e.target.style.display = 'none'
            }}
          />
        )}
        {attachments.length > 1 && (
          <>
            <button
              onClick={() => setCurrent(p => Math.max(0, p - 1))}
              disabled={current === 0}
              className='absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow rounded-full p-1.5 disabled:opacity-30 transition'
            >
              <ChevronLeft className='w-4 h-4' />
            </button>
            <button
              onClick={() =>
                setCurrent(p => Math.min(attachments.length - 1, p + 1))
              }
              disabled={current === attachments.length - 1}
              className='absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow rounded-full p-1.5 disabled:opacity-30 transition'
            >
              <ChevronRight className='w-4 h-4' />
            </button>
          </>
        )}
      </div>

      {/* Filename + actions */}
      <div className='flex items-center justify-between gap-2 px-0.5'>
        <p className='text-xs text-gray-400 truncate flex-1'>{filename}</p>
        <div className='flex gap-1.5 flex-shrink-0'>
          <a
            href={url}
            target='_blank'
            rel='noreferrer'
            className='inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors'
          >
            <ExternalLink className='w-3 h-3' />
            Open
          </a>
          <a
            href={url}
            download
            className='inline-flex items-center gap-1 px-2.5 py-1.5 bg-mint-50 hover:bg-mint-100 text-mint-700 rounded-lg text-xs font-medium transition-colors'
          >
            <Download className='w-3 h-3' />
            Save
          </a>
        </div>
      </div>

      {/* Dots */}
      {attachments.length > 1 && (
        <div className='flex justify-center gap-1.5 pt-0.5'>
          {attachments.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i === current ? 'bg-mint-500 scale-125' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Payment History Section ───────────────────────────────────────────────────
function PaymentHistory ({ history, fmtRM }) {
  if (!history?.length) return null

  return (
    <div className='mt-4 pt-4 border-t border-gray-100'>
      <p className='text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5'>
        <Receipt className='w-3.5 h-3.5' />
        Payment History ({history.length})
      </p>
      <div className='space-y-2'>
        {history.map((p, i) => {
          const paidAt = p.paidAt
            ? fmtTimestamp(p.paidAt)
            : p.paidAtClient
            ? new Date(p.paidAtClient).toLocaleString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })
            : '—'

          const methodLabel = {
            cash: 'Cash',
            card: 'Card',
            qr: 'QR',
            online: 'Online',
            bank_transfer: 'Bank Transfer'
          }

          return (
            <div
              key={i}
              className='flex items-start gap-3 p-3 bg-gradient-to-r from-emerald-50/60 to-white rounded-xl border border-emerald-100'
            >
              <div className='w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5'>
                <DollarSign className='w-3.5 h-3.5 text-emerald-600' />
              </div>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='text-sm font-bold text-emerald-700 tabular-nums'>
                    {fmtRM(p.amount)}
                  </span>
                  <span className='text-[10px] text-gray-400 flex-shrink-0'>
                    {paidAt}
                  </span>
                </div>
                <div className='flex flex-wrap items-center gap-1.5 mt-1'>
                  {p.paidFrom && (
                    <span className='inline-flex px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-medium text-gray-600 capitalize'>
                      {p.paidFrom === 'front' ? 'Front Office' : 'Back Office'}
                    </span>
                  )}
                  {p.paidMethod && (
                    <span className='inline-flex px-1.5 py-0.5 rounded bg-blue-50 text-[10px] font-medium text-blue-600'>
                      {methodLabel[p.paidMethod] || p.paidMethod}
                    </span>
                  )}
                  {p.paidBy?.username && (
                    <span className='text-[10px] text-gray-400'>
                      by {p.paidBy.username}
                    </span>
                  )}
                </div>
                {p.note && (
                  <p className='text-xs text-gray-500 mt-1 italic'>
                    &ldquo;{p.note}&rdquo;
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function ViewBillModal ({ isOpen, onClose, bill }) {
  const currency = useCurrency()
  const fmtRM = makeFmtRM(currency)

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!bill) return null

  const paidAmount = Number(bill.paid ?? 0)
  const totalAmount = Number(bill.total ?? 0)
  const balanceAmount = Number(bill.balance ?? 0)
  const paymentPct = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0

  // ── shared inner content ───────────────────────────────────────────────────
  const ModalContent = (
    <>
      {/* ── Drag handle (mobile only — visual only, no drag on sheet) ── */}
      <div className='flex justify-center pt-3 pb-1 md:hidden flex-shrink-0'>
        <div className='w-10 h-1 rounded-full bg-gray-300' />
      </div>

      {/* ── Header ── */}
      <div className='flex items-start justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 flex-shrink-0'>
        <div>
          <h2 className='text-base md:text-lg font-bold text-gray-900'>
            Bill Details
          </h2>
          <p className='text-xs text-gray-400 mt-0.5'>
            {bill.invoiceNo || 'No Invoice #'}
          </p>
        </div>
        <button
          onClick={onClose}
          className='p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors -mt-1 -mr-1'
        >
          <X className='w-5 h-5' />
        </button>
      </div>

      {/* ── Scrollable Body ── */}
      <div className='flex-1 overflow-y-auto overscroll-contain' style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className='flex flex-col md:grid md:grid-cols-2 md:divide-x divide-gray-100'>
          {/* LEFT: Bill Info */}
          <div className='px-4 md:px-6 py-4 md:py-6'>
            <div className='flex flex-wrap items-center gap-2 mb-4'>
              <StatusPill status={bill.status} />
              <DueBadge dueDays={bill.__dueInDays} />
            </div>

            {/* Balance card */}
            <div className='bg-gradient-to-br from-mint-50 to-amber-50 rounded-xl p-4 mb-4 border border-mint-100'>
              <p className='text-xs text-mint-600 font-medium mb-1'>
                Balance Due
              </p>
              <p className='text-2xl md:text-3xl font-bold text-mint-700 tabular-nums'>
                {fmtRM(balanceAmount)}
              </p>
              {paidAmount > 0 && (
                <div className='mt-3 space-y-1.5'>
                  <div className='flex justify-between text-xs text-mint-600'>
                    <span>Paid {fmtRM(paidAmount)}</span>
                    <span>Total {fmtRM(totalAmount)}</span>
                  </div>
                  <div className='h-1.5 bg-mint-100 rounded-full overflow-hidden'>
                    <div
                      className='h-full bg-mint-400 rounded-full transition-all'
                      style={{ width: `${paymentPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Info rows */}
            <InfoRow icon={Building2} label='Vendor' value={bill.vendorName} />
            <InfoRow
              icon={Hash}
              label='Invoice No.'
              value={bill.invoiceNo || bill.reference}
            />
            <InfoRow icon={Tag} label='Vendor ID' value={bill.vendorId} mono />
            <InfoRow
              icon={Calendar}
              label='Invoice Date'
              value={fmtDate(bill.invoiceDate)}
            />
            <InfoRow
              icon={Calendar}
              label='Due Date'
              value={fmtDate(bill.dueDate)}
            />
            {bill.subtotal !== null && bill.subtotal !== undefined && (
              <InfoRow
                icon={DollarSign}
                label='Subtotal'
                value={fmtRM(bill.subtotal)}
              />
            )}
            {bill.tax !== null && bill.tax !== undefined && (
              <InfoRow icon={DollarSign} label='Tax' value={fmtRM(bill.tax)} />
            )}
            <InfoRow
              icon={DollarSign}
              label='Total'
              value={fmtRM(bill.total)}
            />

            {bill.notes && (
              <div className='mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100'>
                <p className='text-xs text-gray-400 mb-1'>Notes</p>
                <p className='text-sm text-gray-700'>{bill.notes}</p>
              </div>
            )}

            {/* ── Payment History ── */}
            <PaymentHistory history={bill.paymentHistory} fmtRM={fmtRM} />

            {bill.createdBy && (
              <div className='mt-4 pt-4 border-t border-gray-100'>
                <p className='text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2'>
                  Created By
                </p>
                <div className='flex items-center gap-3'>
                  <div className='w-8 h-8 bg-mint-100 rounded-full flex items-center justify-center flex-shrink-0'>
                    <User className='w-4 h-4 text-mint-600' />
                  </div>
                  <div className='min-w-0'>
                    <p className='text-sm font-medium text-gray-800 truncate'>
                      {bill.createdBy.username || bill.createdBy.email}
                    </p>
                    <p className='text-xs text-gray-400 capitalize'>
                      {bill.createdBy.role}
                    </p>
                  </div>
                </div>
                <div className='flex items-center gap-1.5 text-xs text-gray-400 mt-2'>
                  <Clock className='w-3 h-3 flex-shrink-0' />
                  {fmtTimestamp(bill.createdAt)}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Attachments */}
          <div className='px-4 md:px-6 py-4 md:py-6 border-t md:border-t-0 border-gray-100'>
            <p className='text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5'>
              <Paperclip className='w-3.5 h-3.5' />
              Attachments ({bill.attachments?.length ?? 0})
            </p>
            <AttachmentViewer attachments={bill.attachments} />
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className='flex justify-end px-4 md:px-6 py-3 md:py-4 border-t border-gray-100 bg-gray-50/60 flex-shrink-0'>
        <button
          onClick={onClose}
          className='w-full md:w-auto px-5 py-2.5 md:py-2 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors'
        >
          Close
        </button>
      </div>
    </>
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            key='backdrop'
            className='fixed inset-0 bg-black/40 backdrop-blur-sm z-50'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* ── MOBILE: simple bottom sheet (no drag — fixes scroll issues) ── */}
          <div className='md:hidden fixed inset-0 z-50 flex items-end justify-center pointer-events-none'>
            <motion.div
              key='sheet-mobile'
              className='pointer-events-auto bg-white flex flex-col overflow-hidden w-full rounded-t-2xl max-h-[92vh] shadow-2xl'
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              {ModalContent}
            </motion.div>
          </div>

          {/* ── DESKTOP: centered fade-in modal ── */}
          <div className='hidden md:flex fixed inset-0 z-50 items-center justify-center p-4 pointer-events-none'>
            <motion.div
              key='sheet-desktop'
              className='pointer-events-auto bg-white flex flex-col overflow-hidden w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl'
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              onClick={e => e.stopPropagation()}
            >
              {ModalContent}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
