'use client'

import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { format, parseISO } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { FileWarning, ReceiptText, ScanLine, Store } from 'lucide-react'
import { Button, CountUp, DatePicker, Field, Input, Select, Sheet, Switch, Textarea, cn } from '@/app/components/ui'
import MoneyInput from '@/app/components/entry/MoneyInput'
import ProofUpload from '@/app/components/entry/ProofUpload'
import { Chip, PaidFromChoice } from '@/app/components/entry/Choices'
import { EntryLayout, EntrySection, SummaryLine } from '@/app/components/entry/EntryLayout'
import useCurrency from '@/app/hooks/useCurrency'
import { formatMoney } from '@/lib/region/currency'
import { BACK_OFFICE_METHODS, DESCRIPTION_CHIPS } from '../logic/constants'
import { findCategory, pickable } from '@/lib/costs/categories'
import { NO_INVOICE_REASONS } from '@/lib/costs/vouchers'
import { checkedBy, isCompanyRole } from '@/lib/authz/permissions'
import { getSessionUser } from '@/lib/session'
import ImageCaptureEditor from './ImageCaptureEditor'

// who checks a cost with no invoice (owner, 31 Oct): someone senior to whoever saves it
const voucherHint = (role) =>
  isCompanyRole(role) ? 'It is saved with your reason — no approval needed.' : `It is saved with a voucher; ${checkedBy([role])} approves it.`

// Invoices and receipts: photos shrunk like the old uploader did.
const SHRINK = { maxMB: 0.6, maxSide: 1600 }
const day = d => (d ? format(parseISO(d), 'EEE, d MMM') : '')
const methodLabel = v => BACK_OFFICE_METHODS.find(m => m.value === v)?.label

/** Paid from the till or the bank; for the bank, how. */
function PaidFrom ({ office, setOffice, method, setMethod, error }) {
  return (
    <div>
      <PaidFromChoice value={office} onChange={setOffice} bankNote='Card, QR, online, transfer — back office' />
      <AnimatePresence initial={false}>
        {office === 'back' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className='overflow-hidden'>
            <p className='mb-2 mt-4 text-xs font-semibold text-muted'>How was it paid?</p>
            <div className='flex flex-wrap gap-2'>
              {BACK_OFFICE_METHODS.map(m => (
                <Chip key={m.value} on={method === m.value} onClick={() => setMethod(m.value)}>
                  {m.label}
                </Chip>
              ))}
            </div>
            {error && <p className='mt-2 text-xs font-medium text-danger'>{error}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Cost entry: when, how much, paid from the till or the bank, what for,
 * a note, the invoice (photo, PDF, or several pages scanned into one PDF)
 * and an optional payment receipt. Summary and save stay in view.
 * `errors` = { amount, category, custom, method } from the page's checks.
 */
/**
 * What for (4.9): the group, then the category in it; then whatever that
 * category asks — who was paid, which bill and month.
 */
function WhatFor ({ groups, vendors, form, errors }) {
  const { category, setCategory, vendorId, setVendorId, paidTo, setPaidTo, billMonth, setBillMonth, billRef, setBillRef } = form
  const list = pickable(groups)
  const picked = findCategory(groups, category)
  const [groupId, setGroupId] = useState(picked?.group.id || list[0]?.id || '')
  useEffect(() => {
    if (picked && picked.group.id !== groupId) setGroupId(picked.group.id)
  }, [picked, groupId])
  const group = list.find(g => g.id === groupId) || list[0]
  const needs = picked?.category.needs || []

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap gap-1.5'>
        {list.map(g => (
          <button
            key={g.id}
            type='button'
            onClick={() => setGroupId(g.id)}
            className={cn(
              'shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition',
              g.id === group?.id ? (g.kind === 'notCost' ? 'bg-warning-soft text-warning' : 'bg-brand text-brand-fg') : 'bg-surface-2 text-muted hover:text-fg'
            )}
          >
            {g.name}
          </button>
        ))}
      </div>
      {group?.kind === 'notCost' && (
        <p className='rounded-xl bg-warning-soft px-3 py-2 text-xs text-fg'>
          Money out that isn&apos;t a cost: it comes out of the till or bank as usual, but stays out of profit.
        </p>
      )}
      <motion.div
        key={errors.category ? 'err' : 'ok'}
        animate={errors.category ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
        transition={{ duration: 0.35 }}
        className='flex flex-wrap gap-2'
      >
        {(group?.categories || []).map(c => (
          <Chip key={c.id} on={category === c.id} onClick={() => setCategory(c.id)}>
            {c.name}
          </Chip>
        ))}
      </motion.div>
      {errors.category && <p className='text-xs font-medium text-danger'>{errors.category}</p>}

      <AnimatePresence initial={false}>
        {needs.includes('paidTo') && (
          <motion.div key='paidTo' initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className='overflow-hidden'>
            <div className='grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-2'>
              <p className='flex items-center gap-2 text-sm font-semibold text-fg sm:col-span-2'><Store className='size-4 text-muted' /> Who was paid?</p>
              <Field label='A listed vendor'>
                {({ id }) => (
                  <Select id={id} value={vendorId} onChange={e => { setVendorId(e.target.value); if (e.target.value) setPaidTo('') }} className='h-11'>
                    <option value=''>— Not a listed vendor —</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name || v.vendorName}</option>)}
                  </Select>
                )}
              </Field>
              <Field label='…or the shop' error={errors.paidTo}>
                {({ id, invalid }) => (
                  <Input id={id} value={paidTo} disabled={!!vendorId} invalid={invalid} onChange={e => setPaidTo(e.target.value)} placeholder='e.g. Pasar Chow Kit, Mydin' className='h-11' />
                )}
              </Field>
            </div>
          </motion.div>
        )}
        {needs.includes('billFor') && (
          <motion.div key='billFor' initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className='overflow-hidden'>
            <div className='grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-2'>
              <p className='flex items-center gap-2 text-sm font-semibold text-fg sm:col-span-2'><ReceiptText className='size-4 text-muted' /> Which bill?</p>
              <Field label='For the month' error={errors.billFor}>
                {({ id, invalid }) => <Input id={id} type='month' value={billMonth} invalid={invalid} onChange={e => setBillMonth(e.target.value)} className='h-11' />}
              </Field>
              <Field label='Account or bill number (optional)'>
                {({ id }) => <Input id={id} value={billRef} onChange={e => setBillRef(e.target.value)} placeholder='e.g. TNB 2200 1234 5678' className='h-11' />}
              </Field>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function CostEntryForm ({ form, groups = [], vendors = [], onSave, errors = {}, saved = false, recent }) {
  const {
    date,
    setDate,
    amount,
    setAmount,
    description,
    setDescription,
    file,
    setFile,
    filePreview,
    setFilePreview,
    uploadProgress,
    paidFromOffice,
    setPaidFromOffice,
    paidMethod,
    setPaidMethod,
    isSaving,
    handleDescriptionKeyDown,
    receiptFile,
    setReceiptFile,
    receiptProgress,
    noInvoice,
    setNoInvoice,
    voucherReason,
    setVoucherReason
  } = form
  const resolvedCategory = findCategory(groups, form.category)?.category.name || ''

  const currency = useCurrency()
  const money = v => formatMoney(v, currency)
  const [scanning, setScanning] = useState(false)
  const [role, setRole] = useState('') // read after mount: the session lives in the browser
  useEffect(() => setRole(getSessionUser()?.role || ''), [])
  const [receiptPreview, setReceiptPreview] = useState(null)
  const amt = Number(amount) || 0

  const uploadingInvoice = uploadProgress > 0 && uploadProgress < 100
  const uploadingReceipt = receiptProgress > 0 && receiptProgress < 100
  const label = uploadingInvoice
    ? `Uploading invoice ${Math.round(uploadProgress)}%`
    : uploadingReceipt
      ? `Uploading receipt ${Math.round(receiptProgress)}%`
      : 'Save cost'
  const saveButton = (
    <Button size='lg' className='w-full' onClick={onSave} loading={isSaving && !uploadingInvoice && !uploadingReceipt} success={saved} disabled={uploadingInvoice || uploadingReceipt}>
      {label}
    </Button>
  )
  const paidLine = paidFromOffice === 'front' ? 'Till (cash)' : `Bank${paidMethod ? ` · ${methodLabel(paidMethod)}` : ''}`

  // the scanner hands back one file (a PDF of the pages, or one image)
  const scanned = files => {
    if (files.length !== 1) return
    setFile(files[0])
    setFilePreview(URL.createObjectURL(files[0]))
    setScanning(false)
  }

  return (
    <>
      <EntryLayout
        aside={
          <div className='space-y-4'>
            <div>
              <p className='text-xs font-semibold uppercase tracking-[0.12em] text-subtle'>Cost</p>
              <CountUp value={amt} format={money} className='mt-1 block text-3xl font-bold tracking-tight text-fg' />
              <p className='mt-0.5 text-xs text-muted'>{date ? day(date) : 'Pick a day'}</p>
            </div>
            <div className='space-y-2 border-t border-line pt-3'>
              <SummaryLine label='Paid from' value={paidLine} />
              <SummaryLine label='For' value={resolvedCategory || '—'} />
              <SummaryLine label='Invoice' value={file ? 'Attached' : noInvoice ? 'None — voucher' : 'Not yet'} muted={!file} />
            </div>
            {saveButton}
          </div>
        }
        bar={
          <div className='flex items-center gap-3'>
            <div className='min-w-0 flex-1'>
              <p className='truncate text-[11px] font-semibold uppercase tracking-wider text-subtle'>{resolvedCategory || 'Cost'}</p>
              <CountUp value={amt} format={money} className='block truncate text-lg font-bold tracking-tight text-fg' />
            </div>
            <div className='w-40 shrink-0'>{saveButton}</div>
          </div>
        }
        below={recent}
      >
        <EntrySection title='When and how much'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <Field label='Day'>{({ invalid }) => <DatePicker size='lg' value={date} onChange={setDate} invalid={invalid} />}</Field>
            <Field label='Amount' error={errors.amount}>
              {({ id, invalid }) => <MoneyInput id={id} currency={currency} value={amount} invalid={invalid} onValueChange={setAmount} />}
            </Field>
          </div>
        </EntrySection>

        <EntrySection title='Paid from'>
          <PaidFrom office={paidFromOffice} setOffice={setPaidFromOffice} method={paidMethod} setMethod={setPaidMethod} error={errors.method} />
        </EntrySection>

        <EntrySection title='What for'>
          <WhatFor groups={groups} vendors={vendors} form={form} errors={errors} />

          <Field label='Note' className='mt-5'>
            {({ id }) => (
              <Textarea
                id={id}
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={handleDescriptionKeyDown}
                placeholder='Anything worth remembering. Lines starting with "- " or "1. " keep their bullets.'
              />
            )}
          </Field>
          <div className='mt-2 flex flex-wrap gap-1.5'>
            {DESCRIPTION_CHIPS.map(item => (
              <button
                key={item.key}
                type='button'
                onClick={() => setDescription(d => (d ? d + '\n' + item.text : item.text))}
                className='rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:bg-brand-soft hover:text-brand'
              >
                + {item.text.replace(/- /, '').replace(': ', '')}
              </button>
            ))}
          </div>
        </EntrySection>

        <EntrySection title='Invoice and receipt'>
          {errors.invoice && <p className='mb-3 text-xs font-medium text-danger'>{errors.invoice}</p>}
          <ProofUpload
            label='Invoice'
            pdf
            shrink={SHRINK}
            file={file}
            preview={filePreview}
            progress={uploadProgress}
            onPick={(f, url) => {
              setFile(f)
              setFilePreview(url)
            }}
            onRemove={() => {
              setFile(null)
              setFilePreview(null)
            }}
          />
          <button
            type='button'
            onClick={() => setScanning(true)}
            className='mt-2 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs font-semibold text-brand hover:underline'
          >
            <ScanLine className='size-3.5' /> Several pages? Scan them into one PDF
          </button>

          {!file && (
            <div className={cn('mt-4 rounded-2xl border p-4 transition-colors', noInvoice ? 'border-warning/40 bg-warning-soft/50' : 'border-line')}>
              <div className='flex items-center gap-3'>
                <FileWarning className='size-5 shrink-0 text-warning' />
                <div className='min-w-0 flex-1'>
                  <p className='text-sm font-semibold text-fg'>No invoice for this</p>
                  <p className='text-xs text-muted'>{voucherHint(role)}</p>
                </div>
                <Switch checked={noInvoice} onChange={setNoInvoice} />
              </div>
              <AnimatePresence initial={false}>
                {noInvoice && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className='overflow-hidden'>
                    <div className='mt-3 flex flex-wrap gap-1.5'>
                      {NO_INVOICE_REASONS.map(r => (
                        <Chip key={r} on={voucherReason === r} onClick={() => setVoucherReason(r)}>{r}</Chip>
                      ))}
                    </div>
                    <Field label='Why there is no invoice' error={errors.voucher} className='mt-3'>
                      {({ id, invalid }) => <Input id={id} invalid={invalid} value={voucherReason} onChange={e => setVoucherReason(e.target.value)} placeholder='Or say it in your own words' />}
                    </Field>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className='mt-5'>
            <ProofUpload
              label='Payment receipt (optional)'
              pdf
              shrink={SHRINK}
              pageDrop={false}
              file={receiptFile}
              preview={receiptFile ? receiptPreview : null}
              progress={receiptProgress}
              hint='Bank slip, card slip or transfer confirmation.'
              onPick={(f, url) => {
                setReceiptFile(f)
                setReceiptPreview(url)
              }}
              onRemove={() => {
                setReceiptFile(null)
                setReceiptPreview(null)
              }}
            />
          </div>
        </EntrySection>
      </EntryLayout>

      <Sheet open={scanning} onClose={() => setScanning(false)} size='lg' title='Scan pages' description='Take or choose photos, tidy them up, then turn them into one PDF.'>
        <ImageCaptureEditor onFilesReady={scanned} />
      </Sheet>
    </>
  )
}

CostEntryForm.propTypes = {
  form: PropTypes.object.isRequired,
  groups: PropTypes.array,
  vendors: PropTypes.array,
  onSave: PropTypes.func.isRequired,
  errors: PropTypes.object,
  saved: PropTypes.bool,
  recent: PropTypes.node
}

