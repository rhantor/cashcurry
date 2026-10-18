"use client";

import React from "react";
import { Select } from '@/app/components/ui';
import { Wallet } from 'lucide-react';
import Field from '../Field';
import { useStaffFormContext } from "../StaffFormContext";

export default function PayrollTab() {
  const { payrollConfig, currency, form, setForm, errors, touched, activeTab, change, inputClass } = useStaffFormContext();
  return (
    <>
          {/* ─── PAYROLL ──────────────────────────────────────────── */}
          {activeTab === 'payroll' && (
            <div className='space-y-6'>
              <div className='flex items-center gap-2 mb-2 pb-2 border-b border-line'>
                <Wallet size={16} className='text-brand' />
                <h3 className='text-xs font-extrabold uppercase tracking-wider text-muted'>
                  Compensation & Payroll
                </h3>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <Field label={`Basic Salary (${currency})`}>
                  <input name='basicSalary' value={form.basicSalary} onChange={change} className={inputClass('basicSalary')} placeholder='1500' />
                </Field>
                <Field label={`Allowance (${currency})`}>
                  <input name='allowance' value={form.allowance} onChange={change} className={inputClass('allowance')} placeholder='200' />
                </Field>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <Field label={`Basic Per Hour (${currency})`}>
                  <input name='basicPerHour' value={form.basicPerHour} onChange={change} className={inputClass('basicPerHour')} placeholder='7.50' />
                </Field>
                <Field label={`OT Per Hour (${currency})`}>
                  <input name='OTPerHour' value={form.OTPerHour} onChange={change} className={inputClass('OTPerHour')} placeholder='11.25' />
                </Field>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                <Field label='Pay Mode'>
                  <Select name='salaryMode' value={form.salaryMode || ''} onChange={change} invalid={!!(errors.salaryMode && touched.salaryMode)} className='h-11'>
                    <option value=''>Branch default</option>
                    <option value='hours'>Hours-based</option>
                    <option value='days'>Days-based</option>
                  </Select>
                </Field>

                <Field label='Std Hours / Month'>
                  <input type='number' name='standardHours' value={form.standardHours || ''} onChange={change} className={inputClass('standardHours')} placeholder='e.g. 208' />
                </Field>

                <Field label='Working Days / Month'>
                  <input type='number' name='workingDays' value={form.workingDays || ''} onChange={change} className={inputClass('workingDays')} placeholder='e.g. 26' />
                </Field>
              </div>

              {payrollConfig?.statutoryDeductions?.length > 0 && (
                <div>
                  <p className='text-xs font-semibold text-muted uppercase tracking-wider mb-2'>
                    Deduction Overrides
                  </p>
                  <div className='border border-line rounded-xl overflow-hidden'>
                    <div className='grid grid-cols-12 gap-2 px-3 py-2 bg-surface-2 text-[10px] font-bold uppercase text-subtle'>
                      <div className='col-span-1'>On</div>
                      <div className='col-span-3'>Name</div>
                      <div className='col-span-4'>Employee % override</div>
                      <div className='col-span-4'>Employer % override</div>
                    </div>
                    {payrollConfig.statutoryDeductions.filter(d => d.enabled).map(ded => {
                      const override = form.deductionSettings?.[ded.key] || {}
                      const isEnabled = override.enabled !== undefined ? override.enabled : true
                      function setOverride (patch) {
                        setForm(f => ({
                          ...f,
                          deductionSettings: {
                            ...(f.deductionSettings || {}),
                            [ded.key]: { ...(f.deductionSettings?.[ded.key] || {}), ...patch }
                          }
                        }))
                      }
                      return (
                        <div key={ded.key} className='grid grid-cols-12 gap-2 items-center px-3 py-2 border-t border-line text-sm'>
                          <div className='col-span-1'>
                            <input
                              type='checkbox'
                              checked={isEnabled}
                              onChange={e => setOverride({ enabled: e.target.checked })}
                              className='w-4 h-4 accent-mint-600'
                            />
                          </div>
                          <div className='col-span-3 text-xs text-fg font-medium'>
                            {ded.name}
                            <span className='block text-[10px] text-subtle'>{ded.employeeRate}% / {ded.employerRate}%</span>
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
                                className='w-full border border-line rounded-lg pl-2 pr-5 py-1 text-xs focus:ring-1 focus:ring-[var(--cc-ring)] outline-none disabled:opacity-40'
                              />
                              <span className='absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-subtle'>%</span>
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
                                className='w-full border border-line rounded-lg pl-2 pr-5 py-1 text-xs focus:ring-1 focus:ring-[var(--cc-ring)] outline-none disabled:opacity-40'
                              />
                              <span className='absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-subtle'>%</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className='text-[10px] text-subtle mt-1'>
                    Leave blank to use branch default rates. Uncheck to exclude this staff from a deduction.
                  </p>
                </div>
              )}
            </div>
          )}
    </>
  );
}
