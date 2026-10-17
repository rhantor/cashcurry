'use client'

import { useState } from 'react'
import PropTypes from 'prop-types'
import { format, parseISO } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { ScanLine } from 'lucide-react'
import { Button, CountUp, DatePicker, Field, Input, Sheet, Textarea } from '@/app/components/ui'
import MoneyInput from '@/app/components/entry/MoneyInput'
import ProofUpload from '@/app/components/entry/ProofUpload'
import { Chip, PaidFromChoice } from '@/app/components/entry/Choices'
import { EntryLayout, EntrySection, SummaryLine } from '@/app/components/entry/EntryLayout'
import useCurrency from '@/app/hooks/useCurrency'
import { formatMoney } from '@/lib/region/currency'
import { CATEGORIES, BACK_OFFICE_METHODS, DESCRIPTION_CHIPS, categoryLabel } from '../logic/constants'
import ImageCaptureEditor from './ImageCaptureEditor'

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
export default function CostEntryForm ({ form, onSave, errors = {}, saved = false, recent }) {
  const {
    date,
    setDate,
    amount,
    setAmount,
    category,
    setCategory,
    customCategory,
    setCustomCategory,
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
    resolvedCategory
  } = form

  const currency = useCurrency()
  const money = v => formatMoney(v, currency)
  const [scanning, setScanning] = useState(false)
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
              <SummaryLine label='Invoice' value={file ? 'Attached' : 'None'} muted={!file} />
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
          <motion.div
            key={errors.category ? 'err' : 'ok'}
            animate={errors.category ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
            transition={{ duration: 0.35 }}
            className='flex flex-wrap gap-2'
          >
            {CATEGORIES.map(c => (
              <Chip key={c} on={category === c} onClick={() => setCategory(c)}>
                {categoryLabel(c)}
              </Chip>
            ))}
          </motion.div>
          {errors.category && <p className='mt-2 text-xs font-medium text-danger'>{errors.category}</p>}
          <AnimatePresence initial={false}>
            {category === 'Other' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className='overflow-hidden'>
                <Field label='Name the category' error={errors.custom} className='mt-4'>
                  {({ id, invalid }) => (
                    <Input id={id} invalid={invalid} value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder='e.g. Pest control, License renewal' />
                  )}
                </Field>
              </motion.div>
            )}
          </AnimatePresence>

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
  onSave: PropTypes.func.isRequired,
  errors: PropTypes.object,
  saved: PropTypes.bool,
  recent: PropTypes.node
}

