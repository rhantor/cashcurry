"use client";

import React from "react";
import { Select } from '@/app/components/ui';
import { Phone, MapPin } from 'lucide-react';
import Field from '../Field';
import { STATES_MY } from '../../lib/constants';
import { useStaffFormContext } from "../StaffFormContext";

export default function ContactTab() {
  const { form, errors, touched, activeTab, change, blur, inputClass } = useStaffFormContext();
  return (
    <>
          {/* ─── CONTACT ──────────────────────────────────────────── */}
          {activeTab === 'contact' && (
            <div className='space-y-8'>
              <div>
                <div className='flex items-center gap-2 mb-4 pb-2 border-b border-line'>
                  <Phone size={16} className='text-brand' />
                  <h3 className='text-xs font-extrabold uppercase tracking-wider text-muted'>
                    Contact Details
                  </h3>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4'>
                  <Field label='Email (optional)' error={errors.email}>
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

                <div className='bg-surface-2/60 p-4 rounded-2xl border border-line'>
                  <p className='text-xs text-muted mb-3 font-extrabold'>Emergency Contact (Optional)</p>
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

              <div>
                <div className='flex items-center gap-2 mb-4 pb-2 border-b border-line'>
                  <MapPin size={16} className='text-brand' />
                  <h3 className='text-xs font-extrabold uppercase tracking-wider text-muted'>
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
                      <input name='city' value={form.city} onChange={change} className={inputClass('city')} placeholder='Kuala Lumpur' />
                    </Field>
                    <Field label='Postal Code'>
                      <input name='postalCode' value={form.postalCode} onChange={change} className={inputClass('postalCode')} placeholder='50000' />
                    </Field>
                  </div>

                  <div className='grid grid-cols-2 gap-4'>
                    <Field label='State'>
                      <Select name='state' value={form.state} onChange={change} invalid={!!(errors.state && touched.state)} className='h-11'>
                        <option value=''>— Select —</option>
                        {STATES_MY.map(s => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label='Country'>
                      <input name='country' value={form.country} onChange={change} className={inputClass('country')} placeholder='Malaysia' />
                    </Field>
                  </div>
                </div>
              </div>
            </div>
          )}
    </>
  );
}
