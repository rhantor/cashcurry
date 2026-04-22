'use client'

import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { FaUpload } from 'react-icons/fa'
import { NumericFormat } from 'react-number-format'
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
    filePreview,
    uploadProgress,
    paidFromOffice,
    setPaidFromOffice,
    paidMethod,
    setPaidMethod,
    isSaving,
    handleFileChange,
    handleDescriptionKeyDown,
    setFile,
    setFilePreview
  } = form

  const [showImageCapture, setShowImageCapture] = useState(false)
  const currency = useCurrency()

  const isDisabled =
    isSaving || (uploadProgress > 0 && uploadProgress < 100) || !amount

  // Handle files from ImageCaptureEditor
  const handleFilesReady = files => {
    if (files.length === 1) {
      // Single file (PDF or image)
      const selectedFile = files[0]
      setFile(selectedFile)

      // Set preview for images
      if (selectedFile.type.startsWith('image/')) {
        const url = URL.createObjectURL(selectedFile)
        setFilePreview(url)
      } else {
        setFilePreview(null)
      }
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

        {/* File Upload - Enhanced with ImageCaptureEditor */}
        <div className='bg-white rounded-lg shadow p-4 mb-4'>
          <label className='block text-sm font-medium text-gray-600 mb-3'>
            Upload Invoice (PDF or Image)
          </label>

          <div className='space-y-3'>
            {/* Traditional upload */}
            <div className='flex items-center gap-4'>
              <label className='cursor-pointer flex items-center gap-2 px-4 py-2 bg-sage-100 hover:bg-sage-200 rounded-lg text-sage-500 font-medium transition-all duration-300 hover:text-white'>
                <FaUpload />
                <span>Select File</span>
                <input
                  type='file'
                  accept='.pdf,image/*'
                  onChange={handleFileChange}
                  className='hidden'
                />
              </label>

              {filePreview && (
                <img
                  src={filePreview}
                  alt='Preview'
                  className='w-20 h-20 object-cover rounded-lg border'
                />
              )}
            </div>

            {/* OR separator */}
            <div className='flex items-center gap-3'>
              <div className='flex-1 border-t border-gray-300'></div>
              <span className='text-xs text-gray-500'>OR</span>
              <div className='flex-1 border-t border-gray-300'></div>
            </div>

            {/* Camera + Multi-image + PDF conversion */}
            <button
              type='button'
              onClick={() => setShowImageCapture(true)}
              className='w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition'
            >
              📷 Capture & Edit Images / Convert to PDF
            </button>

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className='mt-2 w-full bg-gray-200 rounded-full h-2'>
                <div
                  className='bg-mint-500 h-2 rounded-full'
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {file && !filePreview && (
              <p className='text-xs text-gray-500 mt-1'>
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
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
            ? `Uploading ${Math.round(uploadProgress)}%`
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
