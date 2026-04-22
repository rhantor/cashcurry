/* eslint-disable react/prop-types */
'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import {
  X,
  Loader2,
  Camera,
  User,
  Phone,
  CreditCard,
  MapPin,
  Briefcase,
  Edit,
  Plus
} from 'lucide-react'
import Field from './Field'
import {
  EMPTY_FORM,
  PHOTO_MAX_DIMENSION,
  PHOTO_TARGET_MAX_MB,
  ROLES,
  STATES_MY
} from '../lib/constants'
import { RULES, validate } from '../lib/validation'
import { COUNTRIES } from '../lib/countries'
import useCurrency from '@/app/hooks/useCurrency'

export default function StaffModal ({
  mode = 'add',
  initialData = null,
  payrollConfig = null,   // branch payroll settings (for deduction overrides)
  onSave,
  onClose
}) {
  const currency = useCurrency()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [saving, setSaving] = useState(false)

  // photo
  const fileRef = useRef(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [photoPreview, setPhotoPreview] = useState(null) // url string
  const [photoFile, setPhotoFile] = useState(null) // File
  const [photoCleared, setPhotoCleared] = useState(false)
  const isMY = (form.nationality || '').toLowerCase() === 'malaysian'
  const isNonMY = !!form.nationality && !isMY

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
      w-full bg-white border rounded-xl px-3 py-2.5 text-sm text-black/80 outline-none transition-colors
      ${
        errors[name] && touched[name]
          ? 'border-red-300 focus:border-red-500'
          : 'border-black/10 focus:border-[var(--color-primary)]'
      }
      placeholder:text-black/35
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

  const handleSave = async () => {
    setTouched(Object.fromEntries(Object.keys(EMPTY_FORM).map(k => [k, true])))

    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) return

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
    <div
      className='fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200'
      onClick={onClose}
    >
      <div
        className='bg-[var(--color-background)] border border-black/10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200'
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-center justify-between px-6 py-5 border-b border-black/10'>
          <h2 className='text-lg font-extrabold text-[color:var(--color-accent)] tracking-tight'>
            {mode === 'edit' ? 'Edit Staff Member' : 'Add New Staff'}
          </h2>
          <button
            onClick={onClose}
            className='p-2 text-black/40 hover:text-black/80 transition-colors rounded-xl hover:bg-black/5'
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className='flex-1 overflow-y-auto p-6 space-y-8'>
          {/* Photo + Personal */}
          <div>
            <div className='flex items-center gap-2 mb-4 pb-2 border-b border-black/10'>
              <User size={16} className='text-[var(--color-primary)]' />
              <h3 className='text-xs font-extrabold uppercase tracking-wider text-black/55'>
                Personal Information
              </h3>
            </div>

            <div className='flex items-center gap-4 mb-4'>
              <div
                className={`w-20 h-20 rounded-full border-2 border-dashed flex items-center justify-center overflow-hidden bg-[var(--color-surface)] flex-shrink-0 ${
                  photoPreview
                    ? 'border-[var(--color-primary)]'
                    : 'border-black/15'
                }`}
              >
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt='Preview'
                    className='w-full h-full object-cover'
                  />
                ) : (
                  <Camera className='text-black/35' size={24} />
                )}
              </div>

              <div className='flex flex-col gap-1'>
                <label className='text-sm font-extrabold text-[var(--color-primary-dark)] cursor-pointer hover:underline w-fit'>
                  {photoPreview ? 'Change Photo' : 'Upload Photo'}
                  <input
                    type='file'
                    accept='image/*'
                    ref={fileRef}
                    onChange={handleFileChange}
                    className='hidden'
                  />
                </label>

                {photoPreview && (
                  <button
                    onClick={removePhoto}
                    className='text-xs text-red-600 hover:text-red-700 text-left font-bold w-fit'
                    type='button'
                  >
                    Remove Photo
                  </button>
                )}

                <span className='text-[11px] text-black/45 font-semibold'>
                  JPG / PNG · auto-compress above {PHOTO_TARGET_MAX_MB}MB
                </span>

                {errorMessage && (
                  <span className='text-[11px] text-red-600 font-bold'>
                    {errorMessage}
                  </span>
                )}
              </div>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4'>
              <Field label='First Name' required error={errors.firstName}>
                <input
                  name='firstName'
                  value={form.firstName}
                  onChange={change}
                  onBlur={blur}
                  className={inputClass('firstName')}
                  placeholder='Ahmad'
                />
              </Field>

              <Field label='Last Name' required error={errors.lastName}>
                <input
                  name='lastName'
                  value={form.lastName}
                  onChange={change}
                  onBlur={blur}
                  className={inputClass('lastName')}
                  placeholder='Ismail'
                />
              </Field>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <Field label='Gender'>
                <select
                  name='gender'
                  value={form.gender}
                  onChange={change}
                  className={inputClass('gender')}
                >
                  <option value=''>— Select —</option>
                  <option value='male'>Male</option>
                  <option value='female'>Female</option>
                  <option value='other'>Other</option>
                </select>
              </Field>

              <Field label='Date of Birth'>
                <input
                  type='date'
                  name='dob'
                  value={form.dob}
                  onChange={change}
                  className={inputClass('dob')}
                />
              </Field>
            </div>
          </div>

          {/* Contact */}
          <div>
            <div className='flex items-center gap-2 mb-4 pb-2 border-b border-black/10'>
              <Phone size={16} className='text-[var(--color-primary)]' />
              <h3 className='text-xs font-extrabold uppercase tracking-wider text-black/55'>
                Contact Details
              </h3>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4'>
              <Field label='Email' required error={errors.email}>
                <input
                  type='email'
                  name='email'
                  value={form.email}
                  onChange={change}
                  onBlur={blur}
                  className={inputClass('email')}
                  placeholder='ahmad@email.com'
                />
              </Field>

              <Field label='Phone Number' required error={errors.phone}>
                <input
                  type='tel'
                  name='phone'
                  value={form.phone}
                  onChange={change}
                  onBlur={blur}
                  className={inputClass('phone')}
                  placeholder='+60 1x-xxx xxxx'
                />
              </Field>
            </div>

            <div className='bg-[var(--color-surface)]/60 p-4 rounded-2xl border border-black/10'>
              <p className='text-xs text-black/50 mb-3 font-extrabold'>
                Emergency Contact (Optional)
              </p>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <Field label='Name'>
                  <input
                    name='emergencyContactName'
                    value={form.emergencyContactName}
                    onChange={change}
                    className={inputClass('emergencyContactName')}
                    placeholder='Siti Rahimah'
                  />
                </Field>

                <Field label='Phone'>
                  <input
                    type='tel'
                    name='emergencyContactPhone'
                    value={form.emergencyContactPhone}
                    onChange={change}
                    className={inputClass('emergencyContactPhone')}
                    placeholder='+60 1x-xxx xxxx'
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Identity */}
          <div>
            <div className='flex items-center gap-2 mb-4 pb-2 border-b border-black/10'>
              <CreditCard size={16} className='text-[var(--color-primary)]' />
              <h3 className='text-xs font-extrabold uppercase tracking-wider text-black/55'>
                Identity Documents
              </h3>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4'>
              <Field
                label='IC Number (MyKad)'
                required={isMY}
                error={errors.icNumber}
              >
                <input
                  name='icNumber'
                  value={form.icNumber}
                  onChange={change}
                  onBlur={blur}
                  className={inputClass('icNumber')}
                  placeholder={
                    isMY ? '000000-00-0000' : 'Not required for non-MY'
                  }
                  disabled={!isMY}
                />
              </Field>

              <Field
                label='Passport Number'
                required={isNonMY}
                error={errors.passportNumber}
              >
                <input
                  name='passportNumber'
                  value={form.passportNumber}
                  onChange={change}
                  onBlur={blur}
                  className={inputClass('passportNumber')}
                  placeholder={isNonMY ? 'Required for non-MY' : 'Optional'}
                />
              </Field>
            </div>

            <Field label='Nationality'>
              <select
                name='nationality'
                value={form.nationality}
                onChange={change}
                className={inputClass('nationality')}
              >
                <option value=''>— Select —</option>
                {COUNTRIES.map(c => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Address */}
          <div>
            <div className='flex items-center gap-2 mb-4 pb-2 border-b border-black/10'>
              <MapPin size={16} className='text-[var(--color-primary)]' />
              <h3 className='text-xs font-extrabold uppercase tracking-wider text-black/55'>
                Current Address
              </h3>
            </div>

            <div className='space-y-4'>
              <Field label='Address Line 1'>
                <input
                  name='addressLine1'
                  value={form.addressLine1}
                  onChange={change}
                  className={inputClass('addressLine1')}
                  placeholder='12, Jalan Ampang'
                />
              </Field>

              <Field label='Address Line 2'>
                <input
                  name='addressLine2'
                  value={form.addressLine2}
                  onChange={change}
                  className={inputClass('addressLine2')}
                  placeholder='Unit number, Building (Optional)'
                />
              </Field>

              <div className='grid grid-cols-2 gap-4'>
                <Field label='City'>
                  <input
                    name='city'
                    value={form.city}
                    onChange={change}
                    className={inputClass('city')}
                    placeholder='Kuala Lumpur'
                  />
                </Field>

                <Field label='Postal Code'>
                  <input
                    name='postalCode'
                    value={form.postalCode}
                    onChange={change}
                    className={inputClass('postalCode')}
                    placeholder='50000'
                  />
                </Field>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <Field label='State'>
                  <select
                    name='state'
                    value={form.state}
                    onChange={change}
                    className={inputClass('state')}
                  >
                    <option value=''>— Select —</option>
                    {STATES_MY.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label='Country'>
                  <input
                    name='country'
                    value={form.country}
                    onChange={change}
                    className={inputClass('country')}
                    placeholder='Malaysia'
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Employment */}
          <div>
            <div className='flex items-center gap-2 mb-4 pb-2 border-b border-black/10'>
              <Briefcase size={16} className='text-[var(--color-primary)]' />
              <h3 className='text-xs font-extrabold uppercase tracking-wider text-black/55'>
                Employment Details
              </h3>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4'>
              <Field label='Role' required error={errors.role}>
                <select
                  name='role'
                  value={form.role}
                  onChange={change}
                  onBlur={blur}
                  className={inputClass('role')}
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label='Department'>
                <input
                  name='department'
                  value={form.department}
                  onChange={change}
                  className={inputClass('department')}
                  placeholder='Operations'
                />
              </Field>
            </div>
            
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4'>
              <Field label='Kiosk PIN Code (4 Digits)' required error={errors.pinCode}>
                <input
                  type='password'
                  maxLength={4}
                  name='pinCode'
                  value={form.pinCode}
                  onChange={(e) => {
                     const val = e.target.value.replace(/\D/g, '');
                     change({ target: { name: 'pinCode', value: val } });
                  }}
                  onBlur={blur}
                  className={inputClass('pinCode')}
                  placeholder='1234'
                />
              </Field>
            </div>

            <div className='mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100'>
              <h3 className='text-xs font-extrabold uppercase tracking-wider text-blue-600 mb-4'>
                Attendance & Payroll Config
              </h3>
              
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4'>
                <Field label='Employment Type'>
                  <select
                    name='employmentType'
                    value={form.employmentType}
                    onChange={change}
                    className={inputClass('employmentType')}
                  >
                    <option value='full-time'>Full-time (Salary + OT)</option>
                    <option value='part-time'>Part-time (Hourly Only)</option>
                  </select>
                </Field>

                <Field label='Attendance Period'>
                  <select
                    name='attendancePeriod'
                    value={form.attendancePeriod}
                    onChange={change}
                    className={inputClass('attendancePeriod')}
                  >
                    <option value='weekly'>Weekly (Mon-Sun)</option>
                    <option value='monthly'>Monthly (1st-End)</option>
                  </select>
                </Field>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 items-end'>
                <Field label='Basic Hours Per Day'>
                  <input
                    type='number'
                    name='basicHoursPerDay'
                    value={form.basicHoursPerDay}
                    onChange={change}
                    className={inputClass('basicHoursPerDay')}
                    placeholder='8'
                  />
                  <p className='text-[10px] text-gray-400 mt-1'>Daily OT starts after this amount.</p>
                </Field>

                <div className='flex flex-col gap-3 p-3 bg-white border border-gray-200 rounded-xl'>
                   <label className='flex items-center gap-3 cursor-pointer'>
                      <input 
                         type="checkbox"
                         name="hasPaidBreak"
                         checked={form.hasPaidBreak}
                         onChange={(e) => change({ target: { name: 'hasPaidBreak', value: e.target.checked } })}
                         className="w-5 h-5 accent-blue-600"
                      />
                      <div className='flex flex-col'>
                         <span className='text-sm font-bold text-gray-800'>Eligible for Paid Break</span>
                         <span className='text-[10px] text-gray-500'>Adds +1 hour per work day</span>
                      </div>
                   </label>

                   {form.hasPaidBreak && (
                     <div className='mt-2 pt-3 border-t border-gray-100 flex flex-col gap-3'>
                        <label className='flex items-center gap-3 cursor-pointer group'>
                           <input 
                              type="checkbox"
                              name="requireFullShiftForBreak"
                              checked={form.requireFullShiftForBreak}
                              onChange={(e) => change({ target: { name: 'requireFullShiftForBreak', value: e.target.checked } })}
                              className="w-4 h-4 accent-amber-500"
                           />
                           <div className='flex flex-col'>
                              <span className='text-xs font-bold text-gray-700'>Require Full Shift</span>
                              <span className='text-[10px] text-gray-400'>Only get bonus if worked enough hours</span>
                           </div>
                        </label>

                        {form.requireFullShiftForBreak && (
                          <div className='flex items-center gap-2'>
                             <span className='text-[11px] text-gray-500 whitespace-nowrap'>Min. Hours:</span>
                             <input 
                                type="number"
                                name="fullShiftHours"
                                value={form.fullShiftHours}
                                onChange={change}
                                className='w-16 h-8 px-2 text-xs font-bold border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-amber-500'
                                placeholder='7.5'
                             />
                          </div>
                        )}
                     </div>
                   )}
                </div>
              </div>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4'>
              <Field label={`Basic Salary (${currency})`}>
                <input
                  name='basicSalary'
                  value={form.basicSalary}
                  onChange={change}
                  className={inputClass('basicSalary')}
                  placeholder='1500'
                />
              </Field>

              <Field label={`Allowance (${currency})`}>
                <input
                  name='allowance'
                  value={form.allowance}
                  onChange={change}
                  className={inputClass('allowance')}
                  placeholder='200'
                />
              </Field>
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4'>
              <Field label={`Basic Per Hour (${currency})`}>
                <input
                  name='basicPerHour'
                  value={form.basicPerHour}
                  onChange={change}
                  className={inputClass('basicPerHour')}
                  placeholder='7.50'
                />
              </Field>

              <Field label={`OT Per Hour (${currency})`}>
                <input
                  name='OTPerHour'
                  value={form.OTPerHour}
                  onChange={change}
                  className={inputClass('OTPerHour')}
                  placeholder='11.25'
                />
              </Field>
            </div>
            {/* ── Payroll Config ──────────────────────────────────── */}
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4'>
              <Field label='Pay Mode'>
                <select
                  name='salaryMode'
                  value={form.salaryMode || ''}
                  onChange={change}
                  className={inputClass('salaryMode')}
                >
                  <option value=''>Branch default</option>
                  <option value='hours'>Hours-based</option>
                  <option value='days'>Days-based</option>
                </select>
              </Field>

              <Field label='Std Hours / Month'>
                <input
                  type='number'
                  name='standardHours'
                  value={form.standardHours || ''}
                  onChange={change}
                  className={inputClass('standardHours')}
                  placeholder='e.g. 208'
                />
              </Field>

              <Field label='Working Days / Month'>
                <input
                  type='number'
                  name='workingDays'
                  value={form.workingDays || ''}
                  onChange={change}
                  className={inputClass('workingDays')}
                  placeholder='e.g. 26'
                />
              </Field>
            </div>

            {/* ── Per-staff deduction overrides ────────────────── */}
            {payrollConfig?.statutoryDeductions?.length > 0 && (
              <div className='mb-4'>
                <p className='text-xs font-semibold text-black/50 uppercase tracking-wider mb-2'>
                  Deduction Overrides
                </p>
                <div className='border border-black/10 rounded-xl overflow-hidden'>
                  <div className='grid grid-cols-12 gap-2 px-3 py-2 bg-black/5 text-[10px] font-bold uppercase text-black/40'>
                    <div className='col-span-1'>On</div>
                    <div className='col-span-3'>Name</div>
                    <div className='col-span-4'>Employee % override</div>
                    <div className='col-span-4'>Employer % override</div>
                  </div>
                  {payrollConfig.statutoryDeductions.filter(d => d.enabled).map(ded => {
                    const override = form.deductionSettings?.[ded.key] || {}
                    const isEnabled = override.enabled !== undefined ? override.enabled : true
                    function setOverride(patch) {
                      setForm(f => ({
                        ...f,
                        deductionSettings: {
                          ...(f.deductionSettings || {}),
                          [ded.key]: { ...(f.deductionSettings?.[ded.key] || {}), ...patch },
                        },
                      }))
                    }
                    return (
                      <div key={ded.key} className='grid grid-cols-12 gap-2 items-center px-3 py-2 border-t border-black/5 text-sm'>
                        <div className='col-span-1'>
                          <input
                            type='checkbox'
                            checked={isEnabled}
                            onChange={e => setOverride({ enabled: e.target.checked })}
                            className='w-4 h-4 accent-mint-600'
                          />
                        </div>
                        <div className='col-span-3 text-xs text-black/70 font-medium'>
                          {ded.name}
                          <span className='block text-[10px] text-black/30'>{ded.employeeRate}% / {ded.employerRate}%</span>
                        </div>
                        <div className='col-span-4'>
                          <div className='relative'>
                            <input
                              type='number'
                              min='0'
                              max='100'
                              step='0.01'
                              value={override.employeeRateOverride ?? ''}
                              onChange={e => setOverride({ employeeRateOverride: e.target.value === '' ? null : parseFloat(e.target.value) })}
                              placeholder={`${ded.employeeRate} (default)`}
                              disabled={!isEnabled}
                              className='w-full border border-black/10 rounded-lg pl-2 pr-5 py-1 text-xs focus:ring-1 focus:ring-mint-400 outline-none disabled:opacity-40'
                            />
                            <span className='absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-black/30'>%</span>
                          </div>
                        </div>
                        <div className='col-span-4'>
                          <div className='relative'>
                            <input
                              type='number'
                              min='0'
                              max='100'
                              step='0.01'
                              value={override.employerRateOverride ?? ''}
                              onChange={e => setOverride({ employerRateOverride: e.target.value === '' ? null : parseFloat(e.target.value) })}
                              placeholder={`${ded.employerRate} (default)`}
                              disabled={!isEnabled}
                              className='w-full border border-black/10 rounded-lg pl-2 pr-5 py-1 text-xs focus:ring-1 focus:ring-mint-400 outline-none disabled:opacity-40'
                            />
                            <span className='absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-black/30'>%</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className='text-[10px] text-black/30 mt-1'>
                  Leave blank to use branch default rates. Uncheck to exclude this staff from a deduction.
                </p>
              </div>
            )}

            <Field label='Start Date' className='mb-4'>
              <input
                type='date'
                name='startDate'
                value={form.startDate}
                onChange={change}
                className={inputClass('startDate')}
              />
            </Field>

            <Field label='Notes / Remarks'>
              <textarea
                name='notes'
                value={form.notes}
                onChange={change}
                rows={3}
                className={inputClass('notes')}
                placeholder='Additional notes...'
              />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className='flex items-center justify-end gap-3 px-6 py-4 border-t border-black/10 bg-[var(--color-surface)]'>
          <button
            onClick={onClose}
            disabled={saving}
            className='px-5 py-2.5 rounded-xl border border-black/10 text-black/70 font-extrabold text-sm hover:bg-black/5 disabled:opacity-60'
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={!canSubmit}
            className='px-6 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-extrabold text-sm transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed min-w-[160px] justify-center shadow-lg shadow-[color:var(--color-primary)]/20'
          >
            {saving ? (
              <Loader2 size={16} className='animate-spin' />
            ) : mode === 'edit' ? (
              <Edit size={16} />
            ) : (
              <Plus size={16} />
            )}
            {saving
              ? 'Saving...'
              : mode === 'edit'
              ? 'Save Changes'
              : 'Add Staff'}
          </button>
        </div>
      </div>
    </div>
  )
}
