"use client";

import React from "react";
import { DatePicker, Select } from '@/app/components/ui';
import { Camera, User, CreditCard } from 'lucide-react';
import Field from '../Field';
import { PHOTO_TARGET_MAX_MB } from '../../lib/constants';
import { COUNTRIES } from '../../lib/countries';
import { useStaffFormContext } from "../StaffFormContext";

export default function PersonalTab() {
  const { form, errors, touched, activeTab, fileRef, errorMessage, photoPreview, isMY, isNonMY, change, blur, inputClass, handleFileChange, removePhoto } = useStaffFormContext();
  return (
    <>
          {/* ─── PERSONAL ─────────────────────────────────────────── */}
          {activeTab === 'personal' && (
            <div className='space-y-8'>
              <div>
                <div className='flex items-center gap-2 mb-4 pb-2 border-b border-line'>
                  <User size={16} className='text-brand' />
                  <h3 className='text-xs font-extrabold uppercase tracking-wider text-muted'>
                    Personal Information
                  </h3>
                </div>

                <div className='flex items-center gap-4 mb-4'>
                  <div
                    className={`w-20 h-20 rounded-full border-2 border-dashed flex items-center justify-center overflow-hidden bg-surface-2 flex-shrink-0 ${
                      photoPreview ? 'border-brand/30' : 'border-line'
                    }`}
                  >
                    {photoPreview ? (
                      <img src={photoPreview} alt='Preview' className='w-full h-full object-cover' />
                    ) : (
                      <Camera className='text-subtle' size={24} />
                    )}
                  </div>

                  <div className='flex flex-col gap-1'>
                    <label className='text-sm font-extrabold text-brand cursor-pointer hover:underline w-fit'>
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
                        className='text-xs text-danger hover:text-danger text-left font-bold w-fit'
                        type='button'
                      >
                        Remove Photo
                      </button>
                    )}

                    <span className='text-[11px] text-muted font-semibold'>
                      JPG / PNG · auto-compress above {PHOTO_TARGET_MAX_MB}MB
                    </span>

                    {errorMessage && (
                      <span className='text-[11px] text-danger font-bold'>{errorMessage}</span>
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
                    <Select name='gender' value={form.gender} onChange={change} invalid={!!(errors.gender && touched.gender)} className='h-11'>
                      <option value=''>— Select —</option>
                      <option value='male'>Male</option>
                      <option value='female'>Female</option>
                      <option value='other'>Other</option>
                    </Select>
                  </Field>

                  <Field label='Date of Birth'>
                    <DatePicker max={new Date().toISOString().slice(0, 10)} value={form.dob} onChange={v => change({ target: { name: 'dob', value: v } })} invalid={!!(errors.dob && touched.dob)} />
                  </Field>
                </div>
              </div>

              <div>
                <div className='flex items-center gap-2 mb-4 pb-2 border-b border-line'>
                  <CreditCard size={16} className='text-brand' />
                  <h3 className='text-xs font-extrabold uppercase tracking-wider text-muted'>
                    Identity Documents
                  </h3>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4'>
                  <Field label='IC Number (MyKad)' required={isMY} error={errors.icNumber}>
                    <input
                      name='icNumber'
                      value={form.icNumber}
                      onChange={change}
                      onBlur={blur}
                      className={inputClass('icNumber')}
                      placeholder={isMY ? '000000-00-0000' : 'Not required for non-MY'}
                      disabled={!isMY}
                    />
                  </Field>

                  <Field label='Passport Number' required={isNonMY} error={errors.passportNumber}>
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
                  <Select name='nationality' value={form.nationality} onChange={change} invalid={!!(errors.nationality && touched.nationality)} className='h-11'>
                    <option value=''>— Select —</option>
                    {COUNTRIES.map(c => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
          )}
    </>
  );
}
