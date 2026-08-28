'use client'

import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { NumericFormat } from 'react-number-format'
import UploadInvoice from '@/app/components/purchases/UploadInvoice'
import {
  CATEGORIES,
  BACK_OFFICE_METHODS,
  DESCRIPTION_CHIPS
} from '../logic/constants'
import ImageCaptureEditor from './ImageCaptureEditor'
import useCurrency from '@/app/hooks/useCurrency'

export default function CostEntryForm ({ form, onSave }) {
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
    uploadProgress,
    paidFromOffice,
    setPaidFromOffice,
    paidMethod,
    setPaidMethod,
    isSaving,
    handleDescriptionKeyDown,
    setFile,
    receiptFile,
    setReceiptFile,
    receiptProgress
  } = form

  const [showImageCapture, setShowImageCapture] = useState(false)
  const currency = useCurrency()

  const isUploading =
    (uploadProgress > 0 && uploadProgress < 100) ||
    (receiptProgress > 0 && receiptProgress < 100)

  const isDisabled = isSaving || isUploading || !amount

  // Handle files from ImageCaptureEditor
  const handleFilesReady = files => {
    if (files.length === 1) {
      // Single file (PDF or image)
      const selectedFile = files[0]
      setFile(selectedFile)
    } else if (files.length > 1) {
      // Multiple images - user should convert to PDF first
      alert('⚠️ Multiple images detected. Please convert to PDF first.')
      return
    }

    setShowImageCapture(false)
  }

  return (
    <div className='min-h-screen bg-gray-50 p-4 flex flex-col items-center'>
      <div className='w-full max-w-lg'>
        <h1 className='text-xl font-bold text-sage-300 mb-4'>Cost Entry</h1>

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
          <NumericFormat
            value={amount}
            thousandSeparator={true}
            decimalScale={2}
            allowNegative={false}
            placeholder="0.00"
            className='mt-1 w-full rounded-lg border p-3 text-gray-700'
            onValueChange={(values) => {
              setAmount(values.value)
            }}
          />
        </div>

        {/* Paid From */}
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

          {paidFromOffice === 'back' ? (
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
          ) : (
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

          {/* Quick add chips */}
          <div className='mt-3'>
            <p className='text-xs font-medium text-gray-600 mb-2'>Quick add</p>
            <div className='flex flex-wrap gap-2'>
              {DESCRIPTION_CHIPS.map(item => (
                <button
                  key={item.key}
                  type='button'
                  onClick={() =>
                    setDescription(d => (d ? d + '\n' + item.text : item.text))
                  }
                  className='px-2 py-1 text-xs rounded-full bg-sage-100 text-sage-400 hover:bg-sage-400 hover:text-white'
                >
                  {item.text.replace(/- /, '').replace(': ', '')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* File Upload - Enhanced with Drag & Drop and ImageCaptureEditor */}
        <div className='bg-white rounded-lg shadow p-4 mb-4'>
          <UploadInvoice
            file={file}
            onChange={setFile}
            progress={uploadProgress}
            allowCamera={false}
          />

          {/* OR separator */}
          <div className='flex items-center gap-3 my-4'>
            <div className='flex-1 border-t border-gray-200'></div>
            <span className='text-xs text-gray-400 font-semibold'>OR</span>
            <div className='flex-1 border-t border-gray-200'></div>
          </div>

          {/* Camera + Multi-image + PDF conversion */}
          <button
            type='button'
            onClick={() => setShowImageCapture(true)}
            className='w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-sm shadow-sm hover:shadow transition duration-200 flex items-center justify-center gap-2 cursor-pointer'
          >
            📷 Capture & Edit Images / Convert to PDF
          </button>
        </div>

        {/* Payment Receipt — optional second attachment */}
        <div className='bg-white rounded-lg shadow p-4 mb-4'>
          <UploadInvoice
            file={receiptFile}
            onChange={setReceiptFile}
            progress={receiptProgress}
            allowCamera={true}
            enablePaste={false}
            label='Payment Receipt (optional)'
          />
          <p className='text-xs text-gray-500 mt-2'>
            Proof of payment — bank slip, card slip or transfer confirmation.
            Leave empty if you do not have one.
          </p>
        </div>

        {/* Save Button */}
        <button
          type='button'
          onClick={onSave}
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
            ? `Uploading invoice ${Math.round(uploadProgress)}%`
            : receiptProgress > 0 && receiptProgress < 100
            ? `Uploading receipt ${Math.round(receiptProgress)}%`
            : 'Save'}
        </button>
      </div>

      {/* Image Capture Modal */}
      {showImageCapture && (
        <div className='fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4'>
          <div className='bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6'>
            <div className='flex justify-between items-center mb-4'>
              <h2 className='text-xl font-bold'>Capture & Edit Images</h2>
              <button
                onClick={() => setShowImageCapture(false)}
                className='text-gray-500 hover:text-gray-700 text-2xl'
              >
                ✕
              </button>
            </div>

            <ImageCaptureEditor onFilesReady={handleFilesReady} />
          </div>
        </div>
      )}
    </div>
  )
}

CostEntryForm.propTypes = {
  form: PropTypes.object.isRequired,
  onSave: PropTypes.func.isRequired
}
