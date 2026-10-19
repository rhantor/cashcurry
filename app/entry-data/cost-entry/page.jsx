'use client'

import { useEffect, useMemo, useState } from 'react'
import { db, storage } from '@/lib/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { useCostEntryForm } from './logic/useCostEntryForm'
import { uploadCostFile } from './logic/storageUpload'
import CostEntryForm from './components/CostEntryForm'
import { getSessionUser } from '@/lib/session'
import { toast } from '@/app/components/ui'
import { RecentEntries } from '@/app/components/entry/EntryLayout'
import { useGetCostEntriesQuery } from '@/lib/redux/api/costApiSlice'
import useCurrency from '@/app/hooks/useCurrency'
import { formatMoney } from '@/lib/region/currency'
import { categoryFields, findCategory, missingFor } from '@/lib/costs/categories'
import { useCostCategories } from '@/lib/costs/client'
import { newVoucher } from '@/lib/costs/vouchers'
import { useGetVendorsQuery } from '@/lib/redux/api/vendorsApiSlice'

const storedUserNow = () => getSessionUser() || {}

export default function CostEntryPage () {
  const form = useCostEntryForm()
  const { groups } = useCostCategories(form.companyId)
  const { data: vendors = [] } = useGetVendorsQuery({ companyId: form.companyId }, { skip: !form.companyId })
  const currency = useCurrency()
  const money = v => formatMoney(v, currency)
  const [errors, setErrors] = useState({})
  const [saved, setSaved] = useState(false)

  const {
    companyId,
    branchId,
    amount,
    category,
    vendorId,
    paidTo,
    billMonth,
    billRef,
    noInvoice,
    voucherReason,
    paidFromOffice,
    paidMethod,
    description,
    date,
    file,
    setUploadProgress,
    receiptFile,
    setReceiptProgress,
    setIsSaving,
    resetForm
  } = form

  // a highlighted field calms down as soon as it is filled in
  useEffect(() => setErrors(e => (e.amount && Number(amount) > 0 ? { ...e, amount: undefined } : e)), [amount])
  useEffect(() => setErrors(e => (e.category && category ? { ...e, category: undefined } : e)), [category])
  useEffect(() => setErrors(e => (e.paidTo && (vendorId || paidTo.trim()) ? { ...e, paidTo: undefined } : e)), [vendorId, paidTo])
  useEffect(() => setErrors(e => (e.billFor && billMonth ? { ...e, billFor: undefined } : e)), [billMonth])
  useEffect(() => setErrors(e => (e.invoice && (file || noInvoice) ? { ...e, invoice: undefined } : e)), [file, noInvoice])
  useEffect(() => setErrors(e => (e.voucher && voucherReason.trim() ? { ...e, voucher: undefined } : e)), [voucherReason])

  const picked = findCategory(groups, category)
  const resolvedCategory = picked?.category.name || ''
  useEffect(() => setErrors(e => (e.method && paidMethod ? { ...e, method: undefined } : e)), [paidMethod])

  // this month's costs, for the list under the form
  const month = (date || '').slice(0, 7)
  const [y, m] = month.split('-').map(Number)
  const { data: costs = [], isLoading, isError, refetch } = useGetCostEntriesQuery(
    { companyId, branchId, startDate: `${month}-01`, endDate: month ? `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}` : '' },
    { skip: !companyId || !branchId || !month }
  )
  const recent = useMemo(
    () =>
      [...costs]
        .sort((a, b) => (a.date === b.date ? (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0) : a.date < b.date ? 1 : -1))
        .slice(0, 5),
    [costs]
  )

  const handleSave = async () => {
    if (!companyId || !branchId) return toast.warning('No branch chosen')

    const amt = Number(amount)
    const problems = {}
    if (!Number.isFinite(amt) || amt <= 0) problems.amount = 'Enter the amount'
    if (!picked) problems.category = 'Pick what this cost was for'
    else Object.assign(problems, missingFor(picked.category, { vendorId, paidTo, billMonth }))
    // every cost has its invoice — or a voucher saying why not (4.9)
    if (!file && !noInvoice) problems.invoice = 'Attach the invoice, or say there is none'
    if (!file && noInvoice && !voucherReason.trim()) problems.voucher = 'Say why there is no invoice'
    if (paidFromOffice === 'back' && !paidMethod) problems.method = 'Pick how it was paid'
    setErrors(problems)
    if (Object.keys(problems).length) return toast.error('Check the highlighted fields')

    setIsSaving(true)

    try {
      const fileURL = await uploadCostFile({
        storage,
        file,
        companyId,
        branchId,
        resolvedCategory,
        paidFromOffice,
        date,
        onProgress: setUploadProgress
      })

      // Optional proof of payment. Uploaded after the invoice so each one
      // drives its own progress bar.
      const receiptURL = await uploadCostFile({
        storage,
        file: receiptFile,
        companyId,
        branchId,
        resolvedCategory,
        paidFromOffice,
        date,
        onProgress: setReceiptProgress,
        kind: 'receipt'
      })

      const storedUser = getSessionUser()
      const createdBy = storedUser ? storedUser : {}

      const vendor = vendors.find(v => v.id === vendorId)
      const data = {
        date, // YYYY-MM-DD
        amount: amt,
        // category, its group and whether it counts as a cost — a snapshot (lib/costs/categories.js)
        ...categoryFields(groups, category),
        ...(vendor ? { vendorId: vendor.id, paidTo: vendor.name || vendor.vendorName || '' } : paidTo.trim() ? { paidTo: paidTo.trim() } : {}),
        ...(billMonth ? { billMonth, billRef: billRef.trim() } : {}),
        ...(!file && noInvoice ? { voucher: newVoucher(storedUserNow(), voucherReason) } : {}),
        description: description?.trim() || '',
        fileURL: fileURL || null,
        receiptURL: receiptURL || null,

        // Reports, the attachment viewer and the exports all read `attachments`
        // first and fall back to `fileURL`, so keep both in sync.
        attachments: [fileURL, receiptURL].filter(Boolean),

        paidFromOffice, // "front" | "back"
        paidMethod: paidFromOffice === 'front' ? 'cash' : paidMethod,
        isFrontOffice: paidFromOffice === 'front',
        isBackOffice: paidFromOffice === 'back',

        createdBy,
        createdAt: serverTimestamp() // ✅ only one createdAt
      }

      await addDoc(collection(db, 'companies', companyId, 'branches', branchId, 'costs'), data)

      resetForm()
      setSaved(true)
      setTimeout(() => setSaved(false), 1400)
      toast.success('Cost saved', { description: `${resolvedCategory} · ${money(amt)}` })
      refetch()
    } catch (err) {
      console.error('Save failed:', err)
      toast.error("Couldn't save the cost", { description: 'Check your connection and try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <CostEntryForm
      form={form}
      groups={groups}
      vendors={vendors}
      onSave={handleSave}
      errors={errors}
      saved={saved}
      recent={
        <RecentEntries
          title='Latest costs this month'
          viewAllHref='/reports/cost-report'
          loading={isLoading && !!companyId}
          error={isError}
          money={money}
          items={recent.map(c => {
            const link = c.attachments?.[0] || c.fileURL
            return {
              id: c.id,
              date: c.date,
              amount: c.amount,
              proof: !!link,
              note: `${c.category || 'Cost'} · ${c.paidFromOffice === 'back' ? 'bank' : 'till'}${c.voucher ? ' · voucher' : ''}`,
              onOpen: link ? () => window.open(link, '_blank', 'noopener') : undefined
            }
          })}
        />
      }
    />
  )
}
