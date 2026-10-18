"use client";

import React from "react";
import { DatePicker, Select } from '@/app/components/ui';
import { Briefcase } from 'lucide-react';
import Field from '../Field';
import { ROLES } from '../../lib/constants';
import { useStaffFormContext } from "../StaffFormContext";

export default function JobTab() {
  const { form, errors, touched, activeTab, change, blur, inputClass } = useStaffFormContext();
  return (
    <>
          {/* ─── JOB ──────────────────────────────────────────────── */}
          {activeTab === 'job' && (
            <div className='space-y-8'>
              <div>
                <div className='flex items-center gap-2 mb-4 pb-2 border-b border-line'>
                  <Briefcase size={16} className='text-brand' />
                  <h3 className='text-xs font-extrabold uppercase tracking-wider text-muted'>
                    Employment Details
                  </h3>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4'>
                  <Field label='Role' required error={errors.role}>
                    <Select name='role' value={form.role} onChange={change} onBlur={blur} invalid={!!(errors.role && touched.role)} className='h-11'>
                      {ROLES.map(r => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label='Department'>
                    <input name='department' value={form.department} onChange={change} className={inputClass('department')} placeholder='Operations' />
                  </Field>
                </div>

                <Field label='Start Date' className='mb-4'>
                  <DatePicker value={form.startDate} onChange={v => change({ target: { name: 'startDate', value: v } })} invalid={!!(errors.startDate && touched.startDate)} />
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
          )}
    </>
  );
}
