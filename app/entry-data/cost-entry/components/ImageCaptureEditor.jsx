'use client'

import React, { useState, useRef, useEffect } from 'react'
import PropTypes from 'prop-types'
import {
  FaCamera,
  FaImage,
  FaTrash,
  FaEdit,
  FaCrop,
  FaFilePdf,
  FaCheck,
  FaTimes
} from 'react-icons/fa'
import imageCompression from 'browser-image-compression'
import { jsPDF } from 'jspdf'

export default function ImageCaptureEditor ({ onFilesReady }) {
  const [capturedImages, setCapturedImages] = useState([])
  const [editingIndex, setEditingIndex] = useState(null)
  const [currentImage, setCurrentImage] = useState(null)

  // Editor states
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [cropMode, setCropMode] = useState(false)

  // Crop states
  const [cropArea, setCropArea] = useState({
    x: 0,
    y: 0,
    width: 100,
    height: 100
  })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const canvasRef = useRef(null)
  const imageRef = useRef(null)
  const cropContainerRef = useRef(null)

  // Compress image to minimize size
  const compressImage = async file => {
    try {
      const options = {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: 'image/jpeg',
        initialQuality: 0.7
      }
      return await imageCompression(file, options)
    } catch (error) {
      console.error('Compression error:', error)
      return file
    }
  }

  // Handle camera capture
  const handleCameraCapture = async e => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const compressed = await Promise.all(files.map(compressImage))
    const newImages = compressed.map((file, idx) => ({
      id: Date.now() + idx,
      file,
      url: URL.createObjectURL(file),
      edited: false
    }))

    setCapturedImages(prev => [...prev, ...newImages])
  }

  // Handle file selection
  const handleFileSelect = async e => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    const compressed = await Promise.all(imageFiles.map(compressImage))

    const newImages = compressed.map((file, idx) => ({
      id: Date.now() + idx,
      file,
      url: URL.createObjectURL(file),
      edited: false
    }))

    setCapturedImages(prev => [...prev, ...newImages])
  }

  // Remove image
  const removeImage = id => {
    setCapturedImages(prev => {
      const updated = prev.filter(img => img.id !== id)
      const imgToRemove = prev.find(img => img.id === id)
      if (imgToRemove) URL.revokeObjectURL(imgToRemove.url)
      return updated
    })
  }

  // Start editing
  const startEditing = index => {
    setEditingIndex(index)
    setCurrentImage(capturedImages[index])
    setBrightness(100)
    setContrast(100)
    setRotation(0)
    setCropMode(false)
    setCropArea({ x: 10, y: 10, width: 80, height: 80 })
  }

  // Initialize crop area when entering crop mode
  useEffect(() => {
    if (cropMode && imageRef.current) {
      const img = imageRef.current
      const rect = img.getBoundingClientRect()

      // Set initial crop to center 80% of image
      setCropArea({
        x: rect.width * 0.1,
        y: rect.height * 0.1,
        width: rect.width * 0.8,
        height: rect.height * 0.8
      })
    }
  }, [cropMode])

  // Handle crop drag start
  const handleCropMouseDown = e => {
    if (!cropMode) return

    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  // Handle crop drag
  const handleCropMouseMove = e => {
    if (!isDragging || !cropMode) return

    const deltaX = e.clientX - dragStart.x
    const deltaY = e.clientY - dragStart.y

    setCropArea(prev => ({
      ...prev,
      x: Math.max(0, prev.x + deltaX),
      y: Math.max(0, prev.y + deltaY)
    }))

    setDragStart({ x: e.clientX, y: e.clientY })
  }

  // Handle crop drag end
  const handleCropMouseUp = () => {
    setIsDragging(false)
  }

  // Handle resize crop area
  const handleResizeMouseDown = (e, corner) => {
    e.stopPropagation()
    setIsDragging(corner)
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleResizeMouseMove = e => {
    if (!isDragging || isDragging === true) return

    const deltaX = e.clientX - dragStart.x
    const deltaY = e.clientY - dragStart.y

    setCropArea(prev => {
      const newArea = { ...prev }

      if (isDragging.includes('e'))
        newArea.width = Math.max(50, prev.width + deltaX)
      if (isDragging.includes('w')) {
        newArea.width = Math.max(50, prev.width - deltaX)
        newArea.x = prev.x + deltaX
      }
      if (isDragging.includes('s'))
        newArea.height = Math.max(50, prev.height + deltaY)
      if (isDragging.includes('n')) {
        newArea.height = Math.max(50, prev.height - deltaY)
        newArea.y = prev.y + deltaY
      }

      return newArea
    })

    setDragStart({ x: e.clientX, y: e.clientY })
  }

  // Apply edits (including crop)
  const applyEdits = async () => {
    if (!currentImage || editingIndex === null) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = async () => {
      let sourceX = 0,
        sourceY = 0,
        sourceWidth = img.width,
        sourceHeight = img.height

      // Apply crop if in crop mode
      if (cropMode && imageRef.current) {
        const imgElement = imageRef.current
        const rect = imgElement.getBoundingClientRect()

        // Calculate crop coordinates relative to original image
        const scaleX = img.width / rect.width
        const scaleY = img.height / rect.height

        sourceX = cropArea.x * scaleX
        sourceY = cropArea.y * scaleY
        sourceWidth = cropArea.width * scaleX
        sourceHeight = cropArea.height * scaleY
      }

      // Apply rotation
      const rad = (rotation * Math.PI) / 180
      const sin = Math.abs(Math.sin(rad))
      const cos = Math.abs(Math.cos(rad))

      canvas.width = sourceWidth * cos + sourceHeight * sin
      canvas.height = sourceWidth * sin + sourceHeight * cos

      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate(rad)

      // Apply filters
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`

      // Draw cropped/rotated image
      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        -sourceWidth / 2,
        -sourceHeight / 2,
        sourceWidth,
        sourceHeight
      )

      // Convert to blob
      canvas.toBlob(
        async blob => {
          const editedFile = new File([blob], `edited_${Date.now()}.jpg`, {
            type: 'image/jpeg'
          })

          // Compress edited image
          const compressed = await compressImage(editedFile)
          const newUrl = URL.createObjectURL(compressed)

          setCapturedImages(prev => {
            const updated = [...prev]
            URL.revokeObjectURL(updated[editingIndex].url)
            updated[editingIndex] = {
              ...updated[editingIndex],
              file: compressed,
              url: newUrl,
              edited: true
            }
            return updated
          })

          setEditingIndex(null)
          setCurrentImage(null)
          setCropMode(false)
        },
        'image/jpeg',
        0.85
      )
    }

    img.src = currentImage.url
  }

  // Cancel editing
  const cancelEditing = () => {
    setEditingIndex(null)
    setCurrentImage(null)
    setBrightness(100)
    setContrast(100)
    setRotation(0)
    setCropMode(false)
  }

  // Convert images to PDF
  const convertToPDF = async () => {
    if (capturedImages.length === 0) {
      alert('❌ No images to convert')
      return
    }

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      for (let i = 0; i < capturedImages.length; i++) {
        const img = capturedImages[i]
        const imgData = await loadImage(img.url)

        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = pdf.internal.pageSize.getHeight()
        const imgWidth = imgData.width
        const imgHeight = imgData.height

        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
        const width = imgWidth * ratio
        const height = imgHeight * ratio

        const x = (pdfWidth - width) / 2
        const y = (pdfHeight - height) / 2

        if (i > 0) pdf.addPage()
        pdf.addImage(
          imgData.src,
          'JPEG',
          x,
          y,
          width,
          height,
          undefined,
          'FAST'
        )
      }

      const pdfBlob = pdf.output('blob')
      const pdfFile = new File([pdfBlob], `invoice_${Date.now()}.pdf`, {
        type: 'application/pdf'
      })

      onFilesReady?.([pdfFile])
      alert('✅ PDF created successfully!')
    } catch (error) {
      console.error('PDF conversion error:', error)
      alert('❌ Failed to create PDF')
    }
  }

  const loadImage = src => {
    return new Promise(resolve => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.src = src
    })
  }

  const saveIndividualImages = async () => {
    if (capturedImages.length === 0) {
      alert('❌ No images to save')
      return
    }

    const files = capturedImages.map(img => img.file)
    onFilesReady?.(files)
    alert(`✅ ${files.length} image(s) ready for upload!`)
  }

  // Mouse event listeners for crop
  useEffect(() => {
    if (cropMode) {
      document.addEventListener(
        'mousemove',
        isDragging ? handleResizeMouseMove : handleCropMouseMove
      )
      document.addEventListener('mouseup', handleCropMouseUp)
      return () => {
        document.removeEventListener(
          'mousemove',
          isDragging ? handleResizeMouseMove : handleCropMouseMove
        )
        document.removeEventListener('mouseup', handleCropMouseUp)
      }
    }
  }, [cropMode, isDragging, dragStart])

  return (
    <div className='space-y-4'>
      {/* Action Buttons */}
      <div className='flex flex-wrap gap-2'>
        <button
          type='button'
          onClick={() => cameraInputRef.current?.click()}
          className='flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition'
        >
          <FaCamera />
          Take Photo
        </button>

        <button
          type='button'
          onClick={() => fileInputRef.current?.click()}
          className='flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition'
        >
          <FaImage />
          Select Images
        </button>

        {capturedImages.length > 0 && (
          <>
            <button
              type='button'
              onClick={convertToPDF}
              className='flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition'
            >
              <FaFilePdf />
              Convert to PDF
            </button>

            <button
              type='button'
              onClick={saveIndividualImages}
              className='flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition'
            >
              Save Images ({capturedImages.length})
            </button>
          </>
        )}
      </div>

      {/* Hidden Inputs */}
      <input
        ref={cameraInputRef}
        type='file'
        accept='image/*'
        capture='environment'
        multiple
        onChange={handleCameraCapture}
        className='hidden'
      />

      <input
        ref={fileInputRef}
        type='file'
        accept='image/*'
        multiple
        onChange={handleFileSelect}
        className='hidden'
      />

      {/* Image Gallery */}
      {capturedImages.length > 0 && !editingIndex && editingIndex !== 0 && (
        <div className='grid grid-cols-2 sm:grid-cols-3 gap-4'>
          {capturedImages.map((img, idx) => (
            <div key={img.id} className='relative group'>
              <img
                src={img.url}
                alt={`Capture ${idx + 1}`}
                className='w-full h-40 object-cover rounded-lg border-2 border-gray-300'
              />

              {img.edited && (
                <span className='absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded'>
                  Edited
                </span>
              )}

              <div className='absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition'>
                <button
                  type='button'
                  onClick={() => startEditing(idx)}
                  className='p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full'
                >
                  <FaEdit />
                </button>
                <button
                  type='button'
                  onClick={() => removeImage(img.id)}
                  className='p-2 bg-red-500 hover:bg-red-600 text-white rounded-full'
                >
                  <FaTrash />
                </button>
              </div>

              <p className='text-center text-xs text-gray-600 mt-1'>
                Image {idx + 1}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      {(editingIndex !== null || editingIndex === 0) && currentImage && (
        <div className='fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4'>
          <div className='bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto'>
            <div className='p-4 border-b flex justify-between items-center'>
              <h3 className='text-lg font-bold'>Edit Image</h3>
              <button
                onClick={cancelEditing}
                className='text-gray-500 hover:text-gray-700 text-xl'
              >
                ✕
              </button>
            </div>

            <div className='p-4 space-y-4'>
              {/* Preview with Crop Overlay */}
              <div
                ref={cropContainerRef}
                className='flex justify-center bg-gray-100 rounded-lg p-4 relative'
              >
                <div className='relative inline-block'>
                  <img
                    ref={imageRef}
                    src={currentImage.url}
                    alt='Editing'
                    style={{
                      filter: cropMode
                        ? 'brightness(100%) contrast(100%)'
                        : `brightness(${brightness}%) contrast(${contrast}%)`,
                      transform: cropMode
                        ? 'rotate(0deg)'
                        : `rotate(${rotation}deg)`,
                      maxWidth: '100%',
                      maxHeight: '400px',
                      userSelect: 'none'
                    }}
                    className='rounded-lg'
                    draggable={false}
                  />

                  {/* Crop Overlay */}
                  {cropMode && (
                    <>
                      {/* Darken outside crop area */}
                      <div className='absolute inset-0 bg-black bg-opacity-50 pointer-events-none' />

                      {/* Crop selection box */}
                      <div
                        className='absolute border-2 border-white cursor-move'
                        style={{
                          left: `${cropArea.x}px`,
                          top: `${cropArea.y}px`,
                          width: `${cropArea.width}px`,
                          height: `${cropArea.height}px`,
                          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
                        }}
                        onMouseDown={handleCropMouseDown}
                      >
                        {/* Resize handles */}
                        {['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map(
                          corner => (
                            <div
                              key={corner}
                              className='absolute w-3 h-3 bg-white border border-blue-500'
                              style={{
                                ...(corner.includes('n') && { top: -1.5 }),
                                ...(corner.includes('s') && { bottom: -1.5 }),
                                ...(corner.includes('w') && { left: -1.5 }),
                                ...(corner.includes('e') && { right: -1.5 }),
                                ...(!corner.includes('n') &&
                                  !corner.includes('s') && {
                                    top: '50%',
                                    transform: 'translateY(-50%)'
                                  }),
                                ...(!corner.includes('w') &&
                                  !corner.includes('e') && {
                                    left: '50%',
                                    transform: 'translateX(-50%)'
                                  }),
                                cursor: `${corner}-resize`
                              }}
                              onMouseDown={e =>
                                handleResizeMouseDown(e, corner)
                              }
                            />
                          )
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Crop Mode Toggle */}
              <div className='flex justify-center'>
                <button
                  type='button'
                  onClick={() => setCropMode(!cropMode)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                    cropMode
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  {cropMode ? <FaCheck /> : <FaCrop />}
                  {cropMode ? 'Cropping (Click Apply to Save)' : 'Enable Crop'}
                </button>
              </div>

              {/* Controls (hidden in crop mode) */}
              {!cropMode && (
                <div className='space-y-3'>
                  <div>
                    <label className='block text-sm font-medium mb-1'>
                      Brightness: {brightness}%
                    </label>
                    <input
                      type='range'
                      min='50'
                      max='150'
                      value={brightness}
                      onChange={e => setBrightness(Number(e.target.value))}
                      className='w-full'
                    />
                  </div>

                  <div>
                    <label className='block text-sm font-medium mb-1'>
                      Contrast: {contrast}%
                    </label>
                    <input
                      type='range'
                      min='50'
                      max='150'
                      value={contrast}
                      onChange={e => setContrast(Number(e.target.value))}
                      className='w-full'
                    />
                  </div>

                  <div>
                    <label className='block text-sm font-medium mb-1'>
                      Rotation: {rotation}°
                    </label>
                    <input
                      type='range'
                      min='0'
                      max='360'
                      step='90'
                      value={rotation}
                      onChange={e => setRotation(Number(e.target.value))}
                      className='w-full'
                    />
                  </div>
                </div>
              )}

              {/* Crop Instructions */}
              {cropMode && (
                <div className='bg-blue-50 border border-blue-200 rounded-lg p-3'>
                  <p className='text-sm text-blue-800'>
                    <strong>Crop Mode:</strong> Drag the box to reposition. Use
                    corner/edge handles to resize. Click &quot;Apply Changes&quot; when
                    done.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className='flex gap-3 justify-end'>
                <button
                  type='button'
                  onClick={cancelEditing}
                  className='px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded-lg'
                >
                  Cancel
                </button>
                <button
                  type='button'
                  onClick={applyEdits}
                  className='px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg'
                >
                  Apply Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden canvas for editing */}
      <canvas ref={canvasRef} className='hidden' />
    </div>
  )
}

ImageCaptureEditor.propTypes = {
  onFilesReady: PropTypes.func.isRequired
}
