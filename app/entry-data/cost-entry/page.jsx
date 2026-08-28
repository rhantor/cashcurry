'use client'

import React from 'react'
import { db, storage } from '@/lib/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { useCostEntryForm } from './logic/useCostEntryForm'
import { uploadCostFile } from './logic/storageUpload'
import CostEntryForm from './components/CostEntryForm'



export default function CostEntryPage () {
  const form = useCostEntryForm()

  const {
    companyId,
    branchId,
    amount,
    category,
    customCategory,
    resolvedCategory,
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

  const handleSave = async () => {
    if (!companyId || !branchId) return alert('❌ Invalid company or branch.')

    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      return alert('❌ Please enter a valid amount (> 0).')
    }

    if (!resolvedCategory) return alert('❌ Please select a category.')

    if (category === 'Other' && !customCategory.trim()) {
      return alert('❌ Please type a custom category name.')
    }

    if (paidFromOffice === 'back' && !paidMethod) {
      return alert('❌ Please select a payment method for Back Office.')
    }

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

      const storedUser = localStorage.getItem('user')
      const createdBy = storedUser ? JSON.parse(storedUser) : {}

      const data = {
        date, // YYYY-MM-DD
        amount: amt,
        category: resolvedCategory,
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

      const costRef = collection(
        db,
        'companies',
        companyId,
        'branches',
        branchId,
        'costs'
      )

      await addDoc(costRef, data)

      resetForm()
      alert('✅ Cost entry saved successfully!')
    } catch (err) {
      console.error('Save failed:', err)
      alert('❌ Failed to save cost entry. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return <CostEntryForm form={form} onSave={handleSave} />
}
