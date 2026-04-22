/* eslint-disable react/prop-types */
'use client'
import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import {
  X,
  Save,
  Building2,
  Hash,
  Calendar,
  DollarSign,
  FileText,
  AlertCircle,
  Paperclip,
  ExternalLink,
  Trash2,
  Upload,
  ImagePlus
} from 'lucide-react'
import useCurrency from '@/app/hooks/useCurrency'

// ── helpers ───────────────────────────────────────────────────────────────────
function addDaysISO (iso, days) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + Number(days || 0))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

const clampMoney = v => {
  const n = Number(String(v).replace(/[^\d.]/g, ''))
  if (!Number.isFinite(n) || n < 0) return '0.00'
  return n.toFixed(2)
}

// ── sub-components ────────────────────────────────────────────────────────────
function FieldLabel ({ children, required }) {
  return (
    <label className='block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5'>
      {children}
      {required && <span className='text-mint-500 ml-0.5'>*</span>}
    </label>
  )
}

function InputBase ({ className = '', ...props }) {
  return (
    <input
      className={`w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg
        focus:outline-none focus:ring-2 focus:ring-mint-500/25 focus:border-mint-500
        disabled:bg-gray-50 disabled:text-gray-400 transition-all ${className}`}
      {...props}
    />
  )
}

function SectionDivider ({ icon: Icon, title }) {
  return (
    <div className='flex items-center gap-2 pt-1'>
      <div className='w-6 h-6 bg-mint-100 rounded-md flex items-center justify-center flex-shrink-0'>
        <Icon className='w-3.5 h-3.5 text-mint-600' />
      </div>
      <span className='text-xs font-bold text-gray-500 uppercase tracking-wider'>{title}</span>
      <div className='flex-1 h-px bg-gray-100' />
    </div>
  )
}

// ── existing attachment row ───────────────────────────────────────────────────
function AttachmentRow ({ url, onRemove }) {
  const filename = (() => {
    try { return decodeURIComponent(url.split('/').pop().split('?')[0]) }
    catch { return url }
  })()
  return (
    <div className='flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg'>
      <Paperclip className='w-3.5 h-3.5 text-gray-400 flex-shrink-0' />
      <span className='text-xs text-gray-600 truncate flex-1'>{filename}</span>
      <a
        href={url}
        target='_blank'
        rel='noreferrer'
        className='text-gray-400 hover:text-blue-600 transition-colors p-1'
        title='Open'
      >
        <ExternalLink className='w-3.5 h-3.5' />
      </a>
      <button
        type='button'
        onClick={onRemove}
        className='text-gray-400 hover:text-red-500 transition-colors p-1'
        title='Remove attachment'
      >
        <Trash2 className='w-3.5 h-3.5' />
      </button>
    </div>
  )
}

// ── pending new file row (not yet uploaded) ───────────────────────────────────
function NewFileRow ({ file, onRemove }) {
  const previewUrl = file.type.startsWith('image/')
    ? URL.createObjectURL(file)
    : null

  return (
    <div className='flex items-center gap-2 p-2.5 bg-mint-50 border border-mint-200 rounded-lg'>
      {previewUrl
        ? <img src={previewUrl} alt='' className='w-8 h-8 rounded object-cover flex-shrink-0' />
        : <FileText className='w-4 h-4 text-mint-400 flex-shrink-0' />
      }
      <div className='flex-1 min-w-0'>
        <p className='text-xs text-mint-700 font-medium truncate'>{file.name}</p>
        <p className='text-xs text-mint-400'>{(file.size / 1024).toFixed(0)} KB · pending upload</p>
      </div>
      <button
        type='button'
        onClick={onRemove}
        className='text-mint-300 hover:text-red-500 transition-colors p-1 flex-shrink-0'
        title='Remove'
      >
        <Trash2 className='w-3.5 h-3.5' />
      </button>
    </div>
  )
}

// ── drop zone for adding new files ────────────────────────────────────────────
function FileDropZone ({ onFiles, disabled }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const accept = 'image/*,application/pdf'

  const handleFiles = files => {
    const valid = Array.from(files).filter(f =>
      f.type.startsWith('image/') || f.type === 'application/pdf'
    )
    if (valid.length) onFiles(valid)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault()
        setDragging(false)
        handleFiles(e.dataTransfer.files)
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-mint-400 hover:bg-mint-50/50'}
        ${dragging ? 'border-mint-400 bg-mint-50' : 'border-gray-200 bg-gray-50'}`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors
        ${dragging ? 'bg-mint-100' : 'bg-gray-100'}`}>
        <ImagePlus className={`w-4 h-4 ${dragging ? 'text-mint-500' : 'text-gray-400'}`} />
      </div>
      <div className='text-center'>
        <p className='text-xs font-medium text-gray-600'>
          Drop file here or <span className='text-mint-500'>browse</span>
        </p>
        <p className='text-xs text-gray-400 mt-0.5'>JPG, PNG, PDF · max 5 MB each</p>
      </div>
      <input
        ref={inputRef}
        type='file'
        accept={accept}
        multiple
        className='hidden'
        disabled={disabled}
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  )
}
export default function EditBillModal ({ isOpen, onClose, bill, onSave, isLoading }) {
  const currency = useCurrency()
  // ── framer drag (same pattern as ViewBillModal) ───────────────────────────
  const _dragY        = useMotionValue(0)
  const _sheetOpacity = useTransform(_dragY, [0, 300], [1, 0.4])
  if (isOpen) _dragY.set(0)

  // ── duplicate-submit guard (same as NewBillPage) ──────────────────────────
  const lastSubmitHashRef = useRef('')

  // ── form state ────────────────────────────────────────────────────────────
  const [vendorName,        setVendorName]        = useState('')
  const [invoiceNo,         setInvoiceNo]         = useState('')
  const [invoiceDate,       setInvoiceDate]       = useState('')
  const [dueDate,           setDueDate]           = useState('')
  const [userEditedDueDate, setUserEditedDueDate] = useState(false)
  const [autoFilledHint,    setAutoFilledHint]    = useState('')
  const [total,             setTotal]             = useState('')
  const [notes,             setNotes]             = useState('')
  const [status,            setStatus]            = useState('unpaid')
  const [attachments,       setAttachments]       = useState([])
  const [newFiles,          setNewFiles]          = useState([])   // pending — not yet uploaded
  const [errText,           setErrText]           = useState('')

  // ── seed from bill prop ───────────────────────────────────────────────────
  useEffect(() => {
    if (!bill) return
    setVendorName(bill.vendorName || '')
    setInvoiceNo(bill.invoiceNo || bill.reference || '')
    setInvoiceDate(bill.invoiceDate || '')
    setDueDate(bill.dueDate || '')
    setUserEditedDueDate(true)   // existing due date is intentional — don't auto-override
    setAutoFilledHint('')
    setTotal(bill.total != null ? String(bill.total) : '')
    setNotes(bill.notes || bill.note || '')
    setStatus(bill.status || 'unpaid')
    setAttachments(bill.attachments || [])
    setNewFiles([])
    setErrText('')
    lastSubmitHashRef.current = ''
  }, [bill])

  // ── auto-recalculate due date when invoice date changes ───────────────────
  // Mirrors NewBillPage: only fires when the user has NOT manually set due date.
  // vendorDueDays is not available here (we don't fetch vendor inside the modal),
  // so we derive the original offset from the bill itself and preserve it.
  useEffect(() => {
    if (!invoiceDate) return
    if (userEditedDueDate) return

    // Derive original payment term from the bill's own dates
    const originalDueDays = (() => {
      if (!bill?.invoiceDate || !bill?.dueDate) return 0
      const [y1, m1, d1] = bill.invoiceDate.split('-').map(Number)
      const [y2, m2, d2] = bill.dueDate.split('-').map(Number)
      return Math.round(
        (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000
      )
    })()

    const computed = addDaysISO(invoiceDate, originalDueDays)
    setDueDate(computed)
    setAutoFilledHint(
      `Auto-adjusted: ${originalDueDays} day${originalDueDays === 1 ? '' : 's'} from invoice date`
    )
  }, [invoiceDate, userEditedDueDate, bill])

  // ── body scroll lock ──────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // ── drag dismiss ──────────────────────────────────────────────────────────
  const handleDragEnd = (_, info) => {
    if (info.offset.y > 120 || info.velocity.y > 500) onClose()
    else _dragY.set(0)
  }

  // ── validation ────────────────────────────────────────────────────────────
  const validate = () => {
    if (!invoiceNo.trim())            return 'Invoice number is required.'
    if (!invoiceDate)                 return 'Invoice date is required.'
    if (!dueDate)                     return 'Due date is required.'
    if (dueDate < invoiceDate)        return 'Due date cannot be before invoice date.'
    if (!total || Number(total) <= 0) return 'Total must be greater than 0.'
    return null
  }

  // ── submit — with duplicate-submit guard ──────────────────────────────────
  const handleSubmit = () => {
    setErrText('')
    const normalizedTotal = clampMoney(total)
    setTotal(normalizedTotal)

    const err = validate()
    if (err) { setErrText(err); return }

    // Prevent ultra-fast double-clicks from firing twice
    const submitHash = JSON.stringify({
      billId: bill.id,
      invoiceNo: invoiceNo.trim(),
      invoiceDate,
      dueDate,
      total: normalizedTotal,
      status,
      notes: notes.trim()
    })
    if (lastSubmitHashRef.current === submitHash) return
    lastSubmitHashRef.current = submitHash

    onSave(bill.id, {
      invoiceNo:   invoiceNo.trim(),
      invoiceDate,
      dueDate,
      total:       Number(normalizedTotal),
      notes:       notes.trim(),
      attachments,  // existing URLs (may have some removed)
      newFiles      // new File objects to upload
    })

    // Reset hash after a short delay so re-editing the same values is allowed
    setTimeout(() => { lastSubmitHashRef.current = '' }, 1500)
  }

  if (!bill) return null

  // ── shared form content ───────────────────────────────────────────────────
  const FormContent = (
    <>
      {/* ── drag handle (mobile) ── */}
      <div
        className='flex justify-center pt-3 pb-1 md:hidden flex-shrink-0 cursor-grab active:cursor-grabbing'
        style={{ touchAction: 'none' }}
      >
        <motion.div
          className='w-10 h-1 rounded-full bg-gray-300'
          whileTap={{ scaleX: 1.3, backgroundColor: '#f97316' }}
          transition={{ duration: 0.15 }}
        />
      </div>

      {/* ── header ── */}
      <div className='flex items-start justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 flex-shrink-0'>
        <div>
          <h2 className='text-base md:text-lg font-bold text-gray-900'>Edit Bill</h2>
          <p className='text-xs text-gray-400 mt-0.5'>{bill.vendorName} · {bill.invoiceNo || bill.reference || 'No ref'}</p>
        </div>
        <button
          onClick={onClose}
          className='p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors -mt-1 -mr-1'
        >
          <X className='w-5 h-5' />
        </button>
      </div>

      {/* ── scrollable body ── */}
      <div className='flex-1 overflow-y-auto overscroll-contain'>
        <div className='px-4 md:px-6 py-4 md:py-6 space-y-5'>

          {/* ── Vendor (read-only) ── */}
          <SectionDivider icon={Building2} title='Vendor' />
          <div>
            <FieldLabel>Vendor Name</FieldLabel>
            <InputBase
              value={vendorName}
              disabled
              className='bg-gray-50 text-gray-500 cursor-not-allowed'
              title='Vendor cannot be changed after bill creation'
            />
            <p className='text-xs text-gray-400 mt-1'>Vendor cannot be changed after creation.</p>
          </div>

          {/* ── Invoice Details ── */}
          <SectionDivider icon={Hash} title='Invoice Details' />

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <FieldLabel required>Invoice No.</FieldLabel>
              <InputBase
                type='text'
                placeholder='e.g. INV-001'
                value={invoiceNo}
                onChange={e => setInvoiceNo(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <FieldLabel>Status</FieldLabel>
              <div className='flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg'>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                  status === 'paid'
                    ? 'bg-green-100 text-green-700'
                    : status === 'partially_paid'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {status === 'paid' ? 'Paid' : status === 'partially_paid' ? 'Partially Paid' : 'Unpaid'}
                </span>
                <span className='text-xs text-gray-400'>Updated via payments only</span>
              </div>
            </div>
          </div>

          {/* ── Dates ── */}
          <SectionDivider icon={Calendar} title='Dates' />

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <FieldLabel required>Invoice Date</FieldLabel>
              <InputBase
                type='date'
                value={invoiceDate}
                onChange={e => {
                  setInvoiceDate(e.target.value)
                  // Allow auto-recalculation of due date based on original term
                  setUserEditedDueDate(false)
                }}
                disabled={isLoading}
              />
            </div>
            <div>
              <FieldLabel required>Due Date</FieldLabel>
              <InputBase
                type='date'
                value={dueDate}
                onChange={e => {
                  setUserEditedDueDate(true)
                  setDueDate(e.target.value)
                  setAutoFilledHint('')
                }}
                disabled={isLoading}
                min={invoiceDate || undefined}
              />
              {/* Auto-filled hint — shown when due date was auto-calculated */}
              {autoFilledHint && !userEditedDueDate && (
                <p className='text-xs text-emerald-600 mt-1'>{autoFilledHint}</p>
              )}
              {/* Payment term helper — shown when both dates are valid */}
              {!autoFilledHint && dueDate && invoiceDate && dueDate >= invoiceDate && (
                <p className='text-xs text-gray-400 mt-1'>
                  {(() => {
                    const [y1,m1,d1] = invoiceDate.split('-').map(Number)
                    const [y2,m2,d2] = dueDate.split('-').map(Number)
                    const diff = Math.round((Date.UTC(y2,m2-1,d2) - Date.UTC(y1,m1-1,d1)) / 86400000)
                    return `${diff} day${diff === 1 ? '' : 's'} payment term`
                  })()}
                </p>
              )}
            </div>
          </div>

          {/* ── Amount ── */}
          <SectionDivider icon={DollarSign} title='Amount' />

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <FieldLabel required>Total ({currency})</FieldLabel>
              <div className='relative'>
                <span className='absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400'>{currency}</span>
                <InputBase
                  type='number'
                  min='0'
                  step='0.01'
                  placeholder='0.00'
                  value={total}
                  onChange={e => {
                    const cleaned = e.target.value.replace(/[^\d.]/g, '')
                    setTotal(cleaned)
                  }}
                  onBlur={() => setTotal(clampMoney(total))}
                  disabled={isLoading}
                  className='pl-10'
                />
              </div>
            </div>

            {/* Balance summary (read-only) */}
            <div>
              <FieldLabel>Balance / Paid</FieldLabel>
              <div className='px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm'>
                <div className='flex justify-between'>
                  <span className='text-gray-500'>Paid</span>
                  <span className='font-medium text-green-600'>
                    {currency} {Number(bill.paid ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className='flex justify-between mt-0.5'>
                  <span className='text-gray-500'>Balance</span>
                  <span className='font-bold text-mint-600'>
                    {currency} {Number(bill.balance ?? Math.max(0, Number(total || 0) - Number(bill.paid ?? 0))).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Attachments ── */}
          <SectionDivider icon={Paperclip} title='Attachments' />

          <div className='space-y-2'>
            {/* Existing saved attachments */}
            {attachments.map((url, i) => (
              <AttachmentRow
                key={url}
                url={url}
                onRemove={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
              />
            ))}

            {/* Pending new files (not yet uploaded) */}
            {newFiles.map((file, i) => (
              <NewFileRow
                key={`${file.name}-${i}`}
                file={file}
                onRemove={() => setNewFiles(prev => prev.filter((_, idx) => idx !== i))}
              />
            ))}

            {/* Drop zone — always visible so user can always add */}
            <FileDropZone
              disabled={isLoading}
              onFiles={files => setNewFiles(prev => [...prev, ...files])}
            />

            {newFiles.length > 0 && (
              <p className='text-xs text-mint-600 flex items-center gap-1'>
                <Upload className='w-3 h-3' />
                {newFiles.length} new file{newFiles.length > 1 ? 's' : ''} will be uploaded on save
              </p>
            )}
          </div>

          {/* ── Notes ── */}
          <SectionDivider icon={FileText} title='Notes' />

          <div>
            <FieldLabel>Internal Notes</FieldLabel>
            <textarea
              rows={3}
              placeholder='Optional notes about this bill…'
              value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={isLoading}
              className='w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg resize-none
                focus:outline-none focus:ring-2 focus:ring-mint-500/25 focus:border-mint-500
                disabled:bg-gray-50 disabled:text-gray-400 transition-all'
            />
          </div>

          {/* ── Error ── */}
          {errText && (
            <div className='flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600'>
              <AlertCircle className='w-4 h-4 mt-0.5 flex-shrink-0' />
              {errText}
            </div>
          )}
        </div>
      </div>

      {/* ── footer ── */}
      <div className='flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 px-4 md:px-6 py-3 md:py-4 border-t border-gray-100 bg-gray-50/60 flex-shrink-0'>
        <button
          type='button'
          onClick={onClose}
          disabled={isLoading}
          className='px-5 py-2.5 sm:py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors disabled:opacity-50 w-full sm:w-auto'
        >
          Cancel
        </button>
        <button
          type='button'
          onClick={handleSubmit}
          disabled={isLoading}
          className='flex items-center justify-center gap-2 px-5 py-2.5 sm:py-2 text-sm font-medium text-white bg-mint-500 hover:bg-mint-600 active:scale-[0.99] rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto'
        >
          {isLoading
            ? <><span className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' /> Saving…</>
            : <><Save className='w-4 h-4' /> Save Changes</>
          }
        </button>
      </div>
    </>
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key='edit-backdrop'
            className='fixed inset-0 bg-black/40 backdrop-blur-sm z-50'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Mobile: draggable bottom sheet */}
          <div className='md:hidden fixed inset-0 z-50 flex items-end justify-center pointer-events-none'>
            <motion.div
              key='edit-sheet-mobile'
              className='pointer-events-auto bg-white flex flex-col overflow-hidden w-full rounded-t-2xl max-h-[95vh] shadow-2xl'
              style={{ y: _dragY, opacity: _sheetOpacity }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag='y'
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.3 }}
              onDragEnd={handleDragEnd}
              onClick={e => e.stopPropagation()}
            >
              {FormContent}
            </motion.div>
          </div>

          {/* Desktop: centered modal */}
          <div className='hidden md:flex fixed inset-0 z-50 items-center justify-center p-4 pointer-events-none'>
            <motion.div
              key='edit-sheet-desktop'
              className='pointer-events-auto bg-white flex flex-col overflow-hidden w-full max-w-xl max-h-[90vh] rounded-2xl shadow-2xl'
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{    opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              onClick={e => e.stopPropagation()}
            >
              {FormContent}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}