'use client'
import React, { useEffect, useState, useMemo } from 'react'
import { db, storage } from '@/lib/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import imageCompression from 'browser-image-compression'
import { FaUpload } from 'react-icons/fa'
import useCurrency from '@/app/hooks/useCurrency'

const CATEGORIES = [
  'Utilities',
  'Inventory',
  'Maintenance',
  'Staff Cost',
  'Rent/Deposit',
  'Transport/Delivery',
  'Office Supplies',
  'Operation',
  'New Purchases/Assets',
  'Software/Subscriptions',
  'Taxes/License',
  'compund',
  'Packaging',
  'Marketing/Ads',
  'Bank Charges',
  'Other'
]

// For display
const BACK_OFFICE_METHODS = [
  { value: 'card', label: 'Card' },
  { value: 'qr', label: 'QR' },
  { value: 'online', label: 'Online' },
  { value: 'bank_transfer', label: 'Bank Transfer' }
]

export default function CostEntryPage () {
  const currency = useCurrency()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('') // shown if "Other"
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const [companyId, setCompanyId] = useState(null)
  const [branchId, setBranchId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  // NEW: Paid From (Front/Back) + Method
  // - front office => always cash (fixed)
  // - back office  => choose one of card/qr/online/bank_transfer
  const [paidFromOffice, setPaidFromOffice] = useState('front') // "front" | "back"
  const [paidMethod, setPaidMethod] = useState('cash') // one of the allowed methods

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      const parsed = JSON.parse(storedUser)
      setCompanyId(parsed.companyId)
      setBranchId(parsed.branchId)
    }
  }, [])

  // Keep method synced with office choice
  useEffect(() => {
    if (paidFromOffice === 'front') {
      setPaidMethod('cash')
    } else if (paidFromOffice === 'back' && paidMethod === 'cash') {
      setPaidMethod('') // force selection for back office
    }
  }, [paidFromOffice])

  const resolvedCategory = useMemo(() => {
    return category === 'Other' ? (customCategory || 'Other').trim() : category
  }, [category, customCategory])

  // Handle bullets & numbering inside textarea
  const handleDescriptionKeyDown = e => {
    if (e.key === 'Enter') {
      const { selectionStart, value } = e.target
      const lines = value.substr(0, selectionStart).split('\n')
      const currentLine = lines[lines.length - 1]

      // Continue bullet points (- )
      if (currentLine.trim().startsWith('- ')) {
        e.preventDefault()
        const newValue =
          value.substr(0, selectionStart) +
          '\n- ' +
          value.substr(selectionStart)
        setDescription(newValue)
        setTimeout(() => {
          e.target.selectionStart = e.target.selectionEnd = selectionStart + 3
        }, 0)
      }

      // Continue numbered list (1. 2. etc.)
      const numMatch = currentLine.trim().match(/^(\d+)\. /)
      if (numMatch) {
        e.preventDefault()
        const nextNum = parseInt(numMatch[1]) + 1
        const newValue =
          value.substr(0, selectionStart) +
          `\n${nextNum}. ` +
          value.substr(selectionStart)
        setDescription(newValue)
        setTimeout(() => {
          e.target.selectionStart = e.target.selectionEnd =
            selectionStart + `${nextNum}. `.length
        }, 0)
      }
    }
  }

  // Handle file selection & compress image if needed
  const handleFileChange = async e => {
    try {
      const selectedFile = e.target.files[0]
      if (!selectedFile) return

      let processedFile = selectedFile

      if (selectedFile.type.startsWith('image/')) {
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1024,
          useWebWorker: true
        }
        processedFile = await imageCompression(selectedFile, options)
        setFilePreview(URL.createObjectURL(processedFile))
      } else {
        setFilePreview(null) // no preview for PDF
      }

      setFile(processedFile)
    } catch (err) {
      console.error('File processing error:', err)
      alert('❌ Failed to process file. Try again.')
    }
  }

  // Upload file to Firebase Storage
  const uploadFile = async () => {
    if (!file || !companyId || !branchId) return null

    return new Promise((resolve, reject) => {
      try {
        const fileExtension = file.name.split('.').pop()
        // Include category in the path for organization
        const safeCategory = (resolvedCategory || 'uncategorized').replace(
          /[^\w-]+/g,
          '_'
        )
        // ALSO include the office for better organization
        const officeFolder = paidFromOffice === 'front' ? 'front' : 'back'
        const filePath = `costs/${companyId}/${branchId}/${safeCategory}/${officeFolder}/${date}.${fileExtension}`
        const storageRef = ref(storage, filePath)

        const uploadTask = uploadBytesResumable(storageRef, file)

        uploadTask.on(
          'state_changed',
          snapshot => {
            const progress =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            setUploadProgress(progress)
          },
          error => {
            console.error('Upload failed:', error)
            alert('❌ File upload failed. Please try again.')
            reject(error)
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
            resolve(downloadURL)
          }
        )
      } catch (err) {
        reject(err)
      }
    })
  }

  const handleSave = async () => {
    if (!companyId || !branchId) {
      alert('❌ Invalid company or branch.')
      return
    }
    if (!amount) {
      alert('❌ Please enter amount.')
      return
    }
    if (!resolvedCategory) {
      alert('❌ Please select a category.')
      return
    }
    if (category === 'Other' && !customCategory.trim()) {
      alert('❌ Please type a custom category name.')
      return
    }
    if (paidFromOffice === 'back' && !paidMethod) {
      alert('❌ Please select a payment method for Back Office.')
      return
    }

    setIsSaving(true)

    try {
      let fileURL = null
      if (file) {
        fileURL = await uploadFile()
      }

      const storedUser = localStorage.getItem('user')
      const createdBy = storedUser ? JSON.parse(storedUser) : {}

      const data = {
        date, // YYYY-MM-DD
        amount: Number(amount), // store as number
        category: resolvedCategory, // selected or custom
        description: description?.trim() || '',
        fileURL: fileURL || null,

        // NEW: payment source fields (for summary/dashboard)
        paidFromOffice, // "front" | "back"
        paidMethod: paidFromOffice === 'front' ? 'cash' : paidMethod, // normalize
        isFrontOffice: paidFromOffice === 'front',
        isBackOffice: paidFromOffice === 'back',

        createdAt: new Date().toISOString(),
        createdBy
      }

      const costRef = collection(
        db,
        'companies',
        companyId,
        'branches',
        branchId,
        'costs'
      )
      await addDoc(costRef, { ...data, createdAt: serverTimestamp() })

      // Reset
      setAmount('')
      setCategory('')
      setCustomCategory('')
      setDescription('')
      setFile(null)
      setFilePreview(null)
      setUploadProgress(0)
      setPaidFromOffice('front')
      setPaidMethod('cash')

      alert('✅ Cost entry saved successfully!')
    } catch (err) {
      console.error('Save failed:', err)
      alert('❌ Failed to save cost entry. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const isDisabled =
    isSaving || (uploadProgress > 0 && uploadProgress < 100) || !amount

  return (
    <div className='min-h-screen bg-gray-50 p-4 flex flex-col items-center'>
      <div className='w-full max-w-lg'>
        <h1 className='text-xl font-bold text-mint-500 mb-4'>Cost Entry</h1>

        {/* Date */}
        <div className='bg-white rounded-lg shadow p-4 mb-4'>
          <label className='block text-sm font-medium text-gray-600'>
            Date
          </label>
          <input
            type='date'
            value={date}
            onChange={e => setDate(e.target.value)}
            className='mt-1 w-full rounded-lg border p-3 text-gray-700'
          />
        </div>

        {/* Amount */}
        <div className='bg-white rounded-lg shadow p-4 mb-4'>
          <label className='block text-sm font-medium text-gray-600'>
            Amount ({currency})
          </label>
          <input
            type='number'
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder='Enter amount'
            className='mt-1 w-full rounded-lg border p-3 text-gray-700'
          />
        </div>

        {/* Paid From (Front/Back) */}
        <div className='bg-white rounded-lg shadow p-4 mb-4'>
          <label className='block text-sm font-medium text-gray-600 mb-2'>
            Paid From
          </label>

          <div className='flex items-center gap-4'>
            <label className='flex items-center gap-2'>
              <input
                type='radio'
                name='paidFromOffice'
                value='front'
                checked={paidFromOffice === 'front'}
                onChange={() => setPaidFromOffice('front')}
              />
              <span>Front Office (Cash)</span>
            </label>

            <label className='flex items-center gap-2'>
              <input
                type='radio'
                name='paidFromOffice'
                value='back'
                checked={paidFromOffice === 'back'}
                onChange={() => setPaidFromOffice('back')}
              />
              <span>Back Office (Bank/Card/QR/Online)</span>
            </label>
          </div>

          {/* If back office, choose method */}
          {paidFromOffice === 'back' && (
            <div className='mt-3'>
              <label className='block text-sm font-medium text-gray-600'>
                Method
              </label>
              <select
                value={paidMethod}
                onChange={e => setPaidMethod(e.target.value)}
                className='mt-1 w-full rounded-lg border p-3 text-gray-700 bg-white'
              >
                <option value=''>Select method</option>
                {BACK_OFFICE_METHODS.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <p className='text-xs text-gray-500 mt-1'>
                This will be deducted from your {paidMethod || 'selected'} pool
                in summary.
              </p>
            </div>
          )}

          {/* If front office, show fixed method */}
          {paidFromOffice === 'front' && (
            <p className='text-xs text-gray-500 mt-2'>
              Method: <span className='font-medium'>Cash</span> (fixed)
            </p>
          )}
        </div>

        {/* Category */}
        <div className='bg-white rounded-lg shadow p-4 mb-4'>
          <label className='block text-sm font-medium text-gray-600'>
            Category
          </label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className='mt-1 w-full rounded-lg border p-3 text-gray-700 bg-white'
          >
            <option value=''>Select a category</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Custom Category (when "Other") */}
          {category === 'Other' && (
            <div className='mt-3'>
              <label className='block text-sm font-medium text-gray-600'>
                Custom Category
              </label>
              <input
                type='text'
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value)}
                placeholder='e.g., License Renewal, Pest Control'
                className='mt-1 w-full rounded-lg border p-3 text-gray-700'
              />
            </div>
          )}
        </div>

        {/* Description */}
        <div className='bg-white rounded-lg shadow p-4 mb-4'>
          <label className='block text-sm font-medium text-gray-600'>
            Description
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={handleDescriptionKeyDown}
            placeholder='Add notes. Tip: start lines with `- ` or `1. ` to keep bullets/numbering.'
            rows={4}
            className='mt-1 w-full rounded-lg border p-3 text-gray-700'
          />
          {/* Quick chips to help user write common details */}
          <div className='flex flex-wrap gap-2 mt-2'>
            {[
              '- Invoice No: ',
              '- Vendor: ',
              '- Period: ',
              '- Reason: ',
              '- Approved by: '
            ].map(chip => (
              <button
                key={chip}
                type='button'
                onClick={() =>
                  setDescription(d => (d ? d + '\n' + chip : chip))
                }
                className='px-2 py-1 text-xs rounded-full bg-mint-100 text-mint-700 hover:bg-mint-200'
              >
                {chip.replace(/- /, '')}
              </button>
            ))}
          </div>
        </div>

        {/* File Upload */}
        <div className='bg-white rounded-lg shadow p-4 mb-4'>
          <label className='block text-sm font-medium text-gray-600'>
            Upload Invoice (PDF or Image)
          </label>

          <div className='flex items-center gap-4'>
            <label className='cursor-pointer flex items-center gap-2 px-4 py-2 bg-mint-100 hover:bg-mint-200 rounded-lg text-mint-700 font-medium'>
              <FaUpload />
              <span>Select File</span>
              <input
                type='file'
                accept='.pdf,image/*'
                onChange={handleFileChange}
                className='hidden'
              />
            </label>

            {/* Image preview */}
            {filePreview && (
              <img
                src={filePreview}
                alt='Preview'
                className='w-20 h-20 object-cover rounded-lg border'
              />
            )}
          </div>

          {/* Progress Bar */}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className='mt-2 w-full bg-gray-200 rounded-full h-2'>
              <div
                className='bg-mint-500 h-2 rounded-full'
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          {file && !filePreview && (
            <p className='text-xs text-gray-500 mt-1'>Selected: {file.name}</p>
          )}
        </div>

        {/* Save Button */}
        <button
          type='button'
          onClick={handleSave}
          disabled={isDisabled}
          className={`w-full py-3 rounded-lg font-semibold transition ${
            isDisabled
              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
              : 'bg-mint-500 text-white hover:bg-mint-600 cursor-pointer'
          }`}
        >
          {isSaving
            ? 'Saving...'
            : uploadProgress > 0 && uploadProgress < 100
            ? `Uploading ${Math.round(uploadProgress)}%`
            : 'Save'}
        </button>
      </div>
    </div>
  )
}
