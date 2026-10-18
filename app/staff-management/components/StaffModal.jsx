'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { X, Loader2, User, Phone, Briefcase, Edit, Plus, Clock, Wallet } from 'lucide-react'
import { EMPTY_FORM, PHOTO_MAX_DIMENSION, PHOTO_TARGET_MAX_MB } from '../lib/constants'
import { RULES, validate } from '../lib/validation'
import { isOvernight, shiftWindow, staffShift as resolveShiftFromForm } from '@/lib/attendance/shifts'
import useCurrency from '@/app/hooks/useCurrency'
import { StaffFormContext } from "./StaffFormContext";
import PersonalTab from "./tabs/PersonalTab";
import ContactTab from "./tabs/ContactTab";
import JobTab from "./tabs/JobTab";
import AttendanceTab from "./tabs/AttendanceTab";
import PayrollTab from "./tabs/PayrollTab";

// Tabs, in order. Each groups a use case. `fields` lists the validated fields in
// that tab so we can show an error dot and jump to the first invalid tab on save.
const TABS = [
  { key: 'personal', label: 'Personal', Icon: User, fields: ['firstName', 'lastName', 'icNumber', 'passportNumber'] },
  { key: 'contact', label: 'Contact', Icon: Phone, fields: ['email', 'phone'] },
  { key: 'job', label: 'Job', Icon: Briefcase, fields: ['role'] },
  { key: 'attendance', label: 'Attendance', Icon: Clock, fields: ['pinCode'] },
  { key: 'payroll', label: 'Payroll', Icon: Wallet, fields: [] }
]

export default function StaffModal ({
  mode = 'add',
  initialData = null,
  payrollConfig = null,   // branch payroll settings (for deduction overrides)
  shiftsEnabled = false,  // branch runs shift times (start/end per staff)
  onSave,
  onClose
}) {
  const currency = useCurrency()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('personal')

  // photo
  const fileRef = useRef(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [photoPreview, setPhotoPreview] = useState(null) // url string
  const [photoFile, setPhotoFile] = useState(null) // File
  const [photoCleared, setPhotoCleared] = useState(false)
  const isMY = (form.nationality || '').toLowerCase() === 'malaysian'
  const isNonMY = !!form.nationality && !isMY

  // This staff member's own shift times (Attendance tab); null until both are set
  const staffShift = useMemo(
    () => resolveShiftFromForm(form),
    [form.shiftStart, form.shiftEnd, form.shiftBreakMinutes]
  )
  const staffShiftWindow = useMemo(
    () => (staffShift ? shiftWindow('2000-01-01', staffShift) : null),
    [staffShift]
  )
  const shiftIsOvernight = isOvernight(staffShift)

  // Seed when edit
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      const seeded = {}
      Object.keys(EMPTY_FORM).forEach(k => {
        seeded[k] = initialData?.[k] ?? EMPTY_FORM[k]
      })
      setForm(seeded)

      // show existing photo if any
      if (initialData?.photoUrl) {
        setPhotoPreview(initialData.photoUrl)
      } else {
        setPhotoPreview(null)
      }
      setPhotoFile(null)
      setPhotoCleared(false)
      setErrorMessage('')
      setErrors({})
      setTouched({})
    }

    if (mode === 'add') {
      setForm(EMPTY_FORM)
      setPhotoPreview(null)
      setPhotoFile(null)
      setPhotoCleared(false)
      setErrorMessage('')
      setErrors({})
      setTouched({})
      if (fileRef.current) fileRef.current.value = ''
    }
    setActiveTab('personal')
  }, [mode, initialData?.id])

  // Cleanup object URL preview if we created it
  const createdObjectUrlRef = useRef(null)
  useEffect(() => {
    return () => {
      if (createdObjectUrlRef.current) {
        URL.revokeObjectURL(createdObjectUrlRef.current)
        createdObjectUrlRef.current = null
      }
    }
  }, [])

  const change = useCallback(
    e => {
      const { name, value } = e.target

      setForm(prev => {
        const next = { ...prev, [name]: value }

        // live-validate touched fields
        setErrors(curr => {
          if (!touched[name] || !RULES[name]) return curr
          const rule = RULES[name]
          const msg = rule(next[name], next) // ✅ pass full form
          return { ...curr, [name]: msg }
        })

        // also re-validate related fields if nationality changes
        if (name === 'nationality') {
          setErrors(curr => ({
            ...curr,
            icNumber: RULES.icNumber(next.icNumber, next),
            passportNumber: RULES.passportNumber(next.passportNumber, next)
          }))
        }

        return next
      })
    },
    [touched]
  )

  const blur = useCallback(e => {
    const { name } = e.target
    setTouched(p => ({ ...p, [name]: true }))

    setForm(prev => {
      if (!RULES[name]) return prev
      const rule = RULES[name]
      const msg = rule(prev[name], prev) // ✅ pass full form
      setErrors(curr => ({ ...curr, [name]: msg }))
      return prev
    })
  }, [])

  const inputClass = useCallback(
    name => `
      w-full bg-surface border rounded-xl px-3 py-2.5 text-sm text-fg outline-none transition-colors
      ${
        errors[name] && touched[name]
          ? 'border-danger/30 focus:border-danger'
          : 'border-line focus:border-brand/30'
      }
      placeholder:text-subtle
    `,
    [errors, touched]
  )

  // ===== Photo upload (preview + compression) =====
  const handleFileChange = useCallback(async e => {
    const raw = e?.target?.files?.[0]
    if (!raw) return

    // Make sure "type" is always a string (avoid undefined -> indexOf crash)
    const safeType =
      typeof raw.type === 'string' && raw.type ? raw.type : 'image/jpeg'

    // Validate it's an image
    if (!safeType.startsWith('image/')) {
      setErrorMessage('Please select an image file.')
      return
    }

    try {
      // Re-wrap file to guarantee "type" exists for libraries that rely on it
      const normalizedFile =
        safeType === raw.type
          ? raw
          : new File([raw], raw.name || `photo-${Date.now()}.jpg`, {
              type: safeType
            })

      let workingFile = normalizedFile

      const maxBytes = PHOTO_TARGET_MAX_MB * 1024 * 1024
      if (workingFile.size > maxBytes) {
        workingFile = await imageCompression(workingFile, {
          maxSizeMB: PHOTO_TARGET_MAX_MB,
          maxWidthOrHeight: PHOTO_MAX_DIMENSION,
          useWebWorker: true
        })
      }

      setErrorMessage('')
      setPhotoFile(workingFile)
      setPhotoCleared(false)

      if (createdObjectUrlRef.current)
        URL.revokeObjectURL(createdObjectUrlRef.current)
      const url = URL.createObjectURL(workingFile)
      createdObjectUrlRef.current = url
      setPhotoPreview(url)
    } catch (err) {
      console.error('Compression failed:', err)
      setErrorMessage('Failed to process image.')
    }
  }, [])

  const removePhoto = useCallback(() => {
    setPhotoFile(null)
    setPhotoCleared(true)
    setErrorMessage('')
    if (fileRef.current) fileRef.current.value = ''

    // revert preview:
    // - if editing -> show existing initialData photoUrl
    // - if add -> null
    if (mode === 'edit' && initialData?.photoUrl) {
      setPhotoPreview(initialData.photoUrl)
    } else {
      setPhotoPreview(null)
    }

    if (createdObjectUrlRef.current) {
      URL.revokeObjectURL(createdObjectUrlRef.current)
      createdObjectUrlRef.current = null
    }
  }, [initialData?.photoUrl, mode])

  const canSubmit = useMemo(() => !saving, [saving])

  // A tab shows a red dot when any of its validated fields currently has an error.
  const tabHasError = useCallback(
    tabKey => {
      const t = TABS.find(x => x.key === tabKey)
      return !!t && t.fields.some(f => errors[f])
    },
    [errors]
  )

  const handleSave = async () => {
    setTouched(Object.fromEntries(Object.keys(EMPTY_FORM).map(k => [k, true])))

    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) {
      // Jump to the first tab that has an invalid field so the user sees it.
      const firstBad = TABS.find(t => t.fields.some(f => errs[f]))
      if (firstBad) setActiveTab(firstBad.key)
      return
    }

    setSaving(true)
    try {
      const payload = {
        data: { ...form },
        photoFile,
        oldPhotoUrl: initialData?.photoUrl || null,
        id: initialData?.id || null
      }

      // if user removed photo & didn't add a new one
      if (photoCleared && !photoFile) payload.data.photoUrl = null

      await onSave(payload)
    } finally {
      setSaving(false)
    }
  }

  return (
    <StaffFormContext.Provider value={{ mode, initialData, payrollConfig, shiftsEnabled, onSave, onClose, currency, form, setForm, errors, setErrors, touched, setTouched, saving, setSaving, activeTab, setActiveTab, fileRef, errorMessage, setErrorMessage, photoPreview, setPhotoPreview, photoFile, setPhotoFile, photoCleared, setPhotoCleared, isMY, isNonMY, staffShift, staffShiftWindow, shiftIsOvernight, createdObjectUrlRef, change, blur, inputClass, handleFileChange, removePhoto, canSubmit, tabHasError, handleSave }}>
    <div
      className='fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200'
      onClick={onClose}
    >
      <div
        className='bg-bg border border-line w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200'
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-center justify-between px-6 py-5 border-b border-line'>
          <h2 className='text-lg font-extrabold text-brand tracking-tight'>
            {mode === 'edit' ? 'Edit Staff Member' : 'Add New Staff'}
          </h2>
          <button
            onClick={onClose}
            className='p-2 text-subtle hover:text-fg transition-colors rounded-xl hover:bg-surface-2'
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className='px-3 border-b border-line flex gap-1 overflow-x-auto'>
          {TABS.map(({ key, label, Icon }) => {
            const active = activeTab === key
            const err = tabHasError(key)
            return (
              <button
                key={key}
                type='button'
                onClick={() => setActiveTab(key)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  active
                    ? 'border-brand/30 text-brand'
                    : 'border-transparent text-muted hover:text-fg'
                }`}
              >
                <Icon size={16} />
                {label}
                {err && <span className='w-1.5 h-1.5 rounded-full bg-red-500' />}
              </button>
            )
          })}
        </div>

        {/* Body */}
        <div className='flex-1 overflow-y-auto p-6'>
          <PersonalTab />

          <ContactTab />

          <JobTab />

          <AttendanceTab />

          <PayrollTab />
        </div>

        {/* Footer */}
        <div className='flex items-center justify-end gap-3 px-6 py-4 border-t border-line bg-surface-2'>
          <button
            onClick={onClose}
            disabled={saving}
            className='px-5 py-2.5 rounded-xl border border-line text-fg font-extrabold text-sm hover:bg-surface-2 disabled:opacity-60'
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={!canSubmit}
            className='px-6 py-2.5 rounded-xl bg-brand hover:brightness-105 text-brand-fg font-extrabold text-sm transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed min-w-[160px] justify-center shadow-lg shadow-[color:var(--color-primary)]/20'
          >
            {saving ? (
              <Loader2 size={16} className='animate-spin' />
            ) : mode === 'edit' ? (
              <Edit size={16} />
            ) : (
              <Plus size={16} />
            )}
            {saving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Add Staff'}
          </button>
        </div>
      </div>

    </div>
    </StaffFormContext.Provider>
  )
}
