import { useEffect, useMemo, useState } from 'react'
import imageCompression from 'browser-image-compression'

export function useCostEntryForm () {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [description, setDescription] = useState('')

  const [file, setFile] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const [companyId, setCompanyId] = useState(null)
  const [branchId, setBranchId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const [paidFromOffice, setPaidFromOffice] = useState('front')
  const [paidMethod, setPaidMethod] = useState('cash')

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      const parsed = JSON.parse(storedUser)
      setCompanyId(parsed.companyId)
      setBranchId(parsed.branchId)
    }
  }, [])

  // Sync payment method with office type
  useEffect(() => {
    if (paidFromOffice === 'front') {
      if (paidMethod !== 'cash') setPaidMethod('cash')
    } else {
      if (paidMethod === 'cash') setPaidMethod('')
    }
  }, [paidFromOffice, paidMethod])

  const resolvedCategory = useMemo(() => {
    return category === 'Other' ? (customCategory || 'Other').trim() : category
  }, [category, customCategory])

  const handleDescriptionKeyDown = e => {
    if (e.key !== 'Enter') return

    const { selectionStart, value } = e.target
    const lines = value.substr(0, selectionStart).split('\n')
    const currentLine = lines[lines.length - 1]

    // Continue bullet points (- )
    if (currentLine.trim().startsWith('- ')) {
      e.preventDefault()
      const newValue =
        value.substr(0, selectionStart) + '\n- ' + value.substr(selectionStart)
      setDescription(newValue)
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = selectionStart + 3
      }, 0)
      return
    }

    // Continue numbered list (1. 2. etc.)
    const numMatch = currentLine.trim().match(/^(\d+)\. /)
    if (numMatch) {
      e.preventDefault()
      const nextNum = parseInt(numMatch[1]) + 1
      const insert = `\n${nextNum}. `
      const newValue =
        value.substr(0, selectionStart) + insert + value.substr(selectionStart)
      setDescription(newValue)
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd =
          selectionStart + insert.length
      }, 0)
    }
  }

  // Prevent memory leak from objectURL
  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview)
    }
  }, [filePreview])

  const handleFileChange = async e => {
    try {
      const selected = e.target.files?.[0]
      if (!selected) return

      // Reset progress on new file
      setUploadProgress(0)

      let processed = selected

      if (selected.type.startsWith('image/')) {
        // Enhanced compression settings
        processed = await imageCompression(selected, {
          maxSizeMB: 0.3, // Reduced from 0.5 to save more storage
          maxWidthOrHeight: 1200, // Increased slightly for better quality
          useWebWorker: true,
          fileType: 'image/jpeg',
          initialQuality: 0.7
        })

        const url = URL.createObjectURL(processed)
        setFilePreview(prev => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
      } else {
        // PDF/no preview
        setFilePreview(prev => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
      }

      setFile(processed)
    } catch (err) {
      console.error('File processing error:', err)
      alert('❌ Failed to process file. Try again.')
    }
  }

  const resetForm = () => {
    setAmount('')
    setCategory('')
    setCustomCategory('')
    setDescription('')
    setFile(null)

    setFilePreview(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })

    setUploadProgress(0)
    setPaidFromOffice('front')
    setPaidMethod('cash')
  }

  return {
    // state
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
    setFile, // Expose setFile for ImageCaptureEditor
    filePreview,
    setFilePreview, // Expose setFilePreview for ImageCaptureEditor
    uploadProgress,
    setUploadProgress,
    companyId,
    branchId,
    isSaving,
    setIsSaving,
    paidFromOffice,
    setPaidFromOffice,
    paidMethod,
    setPaidMethod,
    resolvedCategory,

    // handlers
    handleDescriptionKeyDown,
    handleFileChange,
    resetForm
  }
}
