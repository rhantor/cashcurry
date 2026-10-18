'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Briefcase, Check, Clock, Phone, User, Wallet, X } from 'lucide-react'
import { Button, confirmDialog, cn } from '@/app/components/ui'
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

// Steps, in order. `fields` lists the validated fields in each, so a step can
// show an error dot, "Next" can check just that step, and Save can jump to the
// first step with a mistake.
const TABS = [
  { key: 'personal', label: 'Personal', hint: 'Name, photo, IC', Icon: User, fields: ['firstName', 'lastName', 'icNumber', 'passportNumber'] },
  { key: 'contact', label: 'Contact', hint: 'Phone, address', Icon: Phone, fields: ['email', 'phone'] },
  { key: 'job', label: 'Job', hint: 'Role, department', Icon: Briefcase, fields: ['role'] },
  { key: 'attendance', label: 'Attendance', hint: 'Kiosk PIN, hours', Icon: Clock, fields: ['pinCode'] },
  { key: 'payroll', label: 'Pay & bank', hint: 'Salary, bank', Icon: Wallet, fields: [] }
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
  // The form as it was opened, to ask before throwing changes away
  const startRef = useRef(EMPTY_FORM)

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
      startRef.current = seeded

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
      startRef.current = EMPTY_FORM
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

  const stepIndex = TABS.findIndex(t => t.key === activeTab)
  const isLast = stepIndex === TABS.length - 1
  const adding = mode !== 'edit'
  const dirty = !!photoFile || photoCleared || JSON.stringify(form) !== JSON.stringify(startRef.current)

  // "Next" (when adding): check only this step's fields before moving on
  const goNext = () => {
    const fields = TABS[stepIndex].fields
    const all = validate(form)
    const errs = Object.fromEntries(fields.filter(f => all[f]).map(f => [f, all[f]]))
    setTouched(t => ({ ...t, ...Object.fromEntries(fields.map(f => [f, true])) }))
    setErrors(e => ({ ...Object.fromEntries(Object.entries(e).filter(([k]) => !fields.includes(k))), ...errs }))
    if (Object.keys(errs).length) return
    setActiveTab(TABS[stepIndex + 1].key)
  }

  const asking = useRef(false)
  const close = useCallback(async () => {
    if (saving || asking.current) return
    if (dirty) {
      asking.current = true
      const ok = await confirmDialog({ title: 'Discard your changes?', message: 'What you typed here is not saved yet.', confirmLabel: 'Discard', danger: true })
      asking.current = false
      if (!ok) return
    }
    onClose()
  }, [dirty, saving, onClose])

  // Esc closes (asking first if something was typed)
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && !e.defaultPrevented && close()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close])

  // The page behind doesn't scroll while the form is open
  useEffect(() => {
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = before }
  }, [])

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
    <div className='fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-4' role='dialog' aria-modal='true' aria-labelledby='staff-form-title'>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={close}
        className='absolute inset-0 bg-black/40 backdrop-blur-[2px]'
      />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className='relative flex h-[100dvh] w-full flex-col overflow-hidden bg-surface shadow-float sm:h-[min(780px,92vh)] sm:max-w-4xl sm:flex-row sm:rounded-3xl sm:border sm:border-line'
      >
        {/* Steps — a rail on the left (wide screens) */}
        <aside className='hidden w-60 shrink-0 flex-col border-r border-line bg-surface-2/60 p-4 sm:flex'>
          <p className='px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-subtle'>{adding ? 'New staff' : 'Edit staff'}</p>
          <nav className='mt-2 space-y-1'>
            {TABS.map(({ key, label, hint, Icon }, i) => {
              const active = activeTab === key
              const err = tabHasError(key)
              const done = adding && i < stepIndex && !err
              return (
                <button
                  key={key}
                  type='button'
                  onClick={() => setActiveTab(key)}
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors',
                    active ? 'text-fg' : 'text-muted hover:bg-surface hover:text-fg'
                  )}
                >
                  {active && <motion.span layoutId='staff-step' className='absolute inset-0 rounded-xl bg-surface shadow-sm ring-1 ring-line' transition={{ type: 'spring', stiffness: 520, damping: 34 }} />}
                  <span
                    className={cn(
                      'relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg',
                      err ? 'bg-danger/10 text-danger' : done ? 'bg-brand text-brand-fg' : active ? 'bg-brand-soft text-brand' : 'bg-surface text-muted ring-1 ring-line'
                    )}
                  >
                    {done ? <Check className='size-4' /> : <Icon className='size-4' />}
                  </span>
                  <span className='relative min-w-0'>
                    <span className='block text-sm font-semibold'>{label}</span>
                    <span className={cn('block truncate text-xs', err ? 'text-danger' : 'text-subtle')}>{err ? 'Needs a fix' : hint}</span>
                  </span>
                </button>
              )
            })}
          </nav>
        </aside>

        <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
          {/* Header */}
          <div className='flex items-center gap-3 border-b border-line px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-7 sm:pt-5'>
            <div className='min-w-0 flex-1'>
              <h2 id='staff-form-title' className='truncate text-lg font-semibold text-fg'>
                {adding ? 'Add staff' : `${form.firstName} ${form.lastName}`.trim() || 'Edit staff'}
              </h2>
              <p className='text-xs text-muted'>
                {adding ? `Step ${stepIndex + 1} of ${TABS.length} · ${TABS[stepIndex].label}` : TABS[stepIndex].label}
              </p>
            </div>
            <button
              type='button'
              onClick={close}
              aria-label='Close'
              className='rounded-xl p-2 text-muted transition hover:bg-surface-2 hover:text-fg'
            >
              <X className='size-5' />
            </button>
          </div>

          {/* Steps — pills (phones) */}
          <div className='flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2.5 sm:hidden [scrollbar-width:none]'>
            {TABS.map(({ key, label, Icon }) => {
              const active = activeTab === key
              const err = tabHasError(key)
              return (
                <button
                  key={key}
                  type='button'
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors',
                    active ? 'bg-brand text-brand-fg' : 'bg-surface-2 text-muted'
                  )}
                >
                  <Icon className='size-4' />
                  {label}
                  {err && <span className='size-1.5 rounded-full bg-danger' />}
                </button>
              )
            })}
          </div>

          {/* Body */}
          <div className='min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7'>
            <AnimatePresence mode='wait' initial={false}>
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.16 }}
              >
                {activeTab === 'personal' && <PersonalTab />}
                {activeTab === 'contact' && <ContactTab />}
                {activeTab === 'job' && <JobTab />}
                {activeTab === 'attendance' && <AttendanceTab />}
                {activeTab === 'payroll' && <PayrollTab />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className='flex items-center gap-2 border-t border-line bg-surface px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-7'>
            {adding ? (
              <>
                {stepIndex > 0 ? (
                  <Button variant='ghost' icon={ArrowLeft} onClick={() => setActiveTab(TABS[stepIndex - 1].key)} disabled={saving}>
                    Back
                  </Button>
                ) : (
                  <Button variant='ghost' onClick={close} disabled={saving}>
                    Cancel
                  </Button>
                )}
                <div className='flex-1' />
                {!isLast && (
                  <span className='hidden sm:block'>
                    <Button variant='secondary' onClick={handleSave} disabled={!canSubmit}>
                      Add now
                    </Button>
                  </span>
                )}
                {isLast ? (
                  <Button icon={Check} onClick={handleSave} loading={saving} className='min-w-36'>
                    Add staff
                  </Button>
                ) : (
                  <Button onClick={goNext} className='min-w-28'>
                    Next <ArrowRight className='size-4' />
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant='ghost' onClick={close} disabled={saving}>
                  Cancel
                </Button>
                <div className='flex-1' />
                <Button icon={Check} onClick={handleSave} loading={saving} disabled={!dirty} className='min-w-36'>
                  Save changes
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
    </StaffFormContext.Provider>
  )
}
