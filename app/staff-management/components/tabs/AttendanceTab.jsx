"use client";

import React from "react";
import { Select } from '@/app/components/ui';
import { Clock, MoonStar } from 'lucide-react';
import Field from '../Field';
import { useStaffFormContext } from "../StaffFormContext";

export default function AttendanceTab() {
  const { shiftsEnabled, form, errors, touched, activeTab, staffShift, staffShiftWindow, shiftIsOvernight, change, blur, inputClass } = useStaffFormContext();
  return (
    <>
          {/* ─── ATTENDANCE ───────────────────────────────────────── */}
          {activeTab === 'attendance' && (
            <div className='space-y-6'>
              <div className='flex items-center gap-2 mb-2 pb-2 border-b border-line'>
                <Clock size={16} className='text-brand' />
                <h3 className='text-xs font-extrabold uppercase tracking-wider text-muted'>
                  Kiosk & Attendance
                </h3>
              </div>

              <label className='flex items-start gap-3 p-3 bg-warning-soft/70 border border-amber-100 rounded-xl cursor-pointer'>
                <input
                  type='checkbox'
                  name='fixedSalaryNoAttendance'
                  checked={!!form.fixedSalaryNoAttendance}
                  onChange={e => change({ target: { name: 'fixedSalaryNoAttendance', value: e.target.checked } })}
                  className='w-5 h-5 mt-0.5 accent-amber-500'
                />
                <div className='flex flex-col'>
                  <span className='text-sm font-bold text-warning'>Fixed monthly salary (no attendance)</span>
                  <span className='text-[11px] text-warning/80'>
                    For owners/salaried staff. Payroll pays the flat Basic Salary and skips this person when importing hours from attendance.
                  </span>
                </div>
              </label>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <Field label='Kiosk PIN Code (4 Digits)' required error={errors.pinCode}>
                  <input
                    type='password'
                    maxLength={4}
                    name='pinCode'
                    value={form.pinCode}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '')
                      change({ target: { name: 'pinCode', value: val } })
                    }}
                    onBlur={blur}
                    className={inputClass('pinCode')}
                    placeholder='1234'
                  />
                </Field>
              </div>

              <div className='p-4 bg-surface-2/60 rounded-2xl border border-line'>
                <h3 className='text-xs font-extrabold uppercase tracking-wider text-info mb-4'>
                  Attendance Rules
                </h3>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4'>
                  <Field label='Employment Type'>
                    <Select name='employmentType' value={form.employmentType} onChange={change} invalid={!!(errors.employmentType && touched.employmentType)} className='h-11'>
                      <option value='full-time'>Full-time (Salary + OT)</option>
                      <option value='part-time'>Part-time (Hourly Only)</option>
                    </Select>
                  </Field>

                  <Field label='Attendance Period'>
                    <Select name='attendancePeriod' value={form.attendancePeriod} onChange={change} invalid={!!(errors.attendancePeriod && touched.attendancePeriod)} className='h-11'>
                      <option value='weekly'>Weekly (Mon-Sun)</option>
                      <option value='monthly'>Monthly (1st-End)</option>
                    </Select>
                  </Field>
                </div>

                {shiftsEnabled && (
                  <div className='mb-4 p-3 bg-surface border border-line rounded-xl'>
                    <div className='flex items-center justify-between mb-3'>
                      <h4 className='text-[11px] font-extrabold uppercase tracking-wider text-info'>
                        Shift Times
                      </h4>
                      {staffShiftWindow && (
                        <span className='inline-flex items-center gap-1.5 text-[11px] font-bold text-muted'>
                          {staffShiftWindow.hours.toFixed(2)}h paid
                          {shiftIsOvernight && (
                            <span className='inline-flex items-center gap-1 text-info'>
                              <MoonStar size={12} /> overnight
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                      <Field label='Shift Start'>
                        <input
                          type='time'
                          name='shiftStart'
                          value={form.shiftStart || ''}
                          onChange={change}
                          className={inputClass('shiftStart')}
                        />
                      </Field>
                      <Field label='Shift End'>
                        <input
                          type='time'
                          name='shiftEnd'
                          value={form.shiftEnd || ''}
                          onChange={change}
                          className={inputClass('shiftEnd')}
                        />
                      </Field>
                      <Field label='Unpaid Break (Min)'>
                        <input
                          type='number'
                          name='shiftBreakMinutes'
                          value={form.shiftBreakMinutes ?? ''}
                          onChange={change}
                          className={inputClass('shiftBreakMinutes')}
                          placeholder='0'
                        />
                      </Field>
                    </div>

                    <p className='text-[10px] text-subtle mt-2'>
                      {staffShift
                        ? 'Lateness and OT are measured against these times. Arriving well before the start needs approval to count as OT.'
                        : 'Leave blank for no fixed shift — OT then simply starts after the daily hours below. An end time earlier than the start means the shift crosses midnight.'}
                    </p>
                  </div>
                )}

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 items-end'>
                  <Field label='Basic Hours Per Day'>
                    <input
                      type='number'
                      name='basicHoursPerDay'
                      value={form.basicHoursPerDay}
                      onChange={change}
                      disabled={!!staffShift}
                      className={inputClass('basicHoursPerDay')}
                      placeholder='8'
                    />
                    <p className='text-[10px] text-subtle mt-1'>
                      {staffShift
                        ? 'Overridden by the shift times above.'
                        : 'Daily OT starts after this amount.'}
                    </p>
                  </Field>

                  <div className='flex flex-col gap-3 p-3 bg-surface border border-line rounded-xl'>
                    <label className='flex items-center gap-3 cursor-pointer'>
                      <input
                        type='checkbox'
                        name='hasPaidBreak'
                        checked={form.hasPaidBreak}
                        onChange={e => change({ target: { name: 'hasPaidBreak', value: e.target.checked } })}
                        className='w-5 h-5 accent-blue-600'
                      />
                      <div className='flex flex-col'>
                        <span className='text-sm font-bold text-fg'>Eligible for Paid Break</span>
                        <span className='text-[10px] text-muted'>Adds +1 hour per work day</span>
                      </div>
                    </label>

                    {form.hasPaidBreak && (
                      <div className='mt-2 pt-3 border-t border-line flex flex-col gap-3'>
                        <label className='flex items-center gap-3 cursor-pointer group'>
                          <input
                            type='checkbox'
                            name='requireFullShiftForBreak'
                            checked={form.requireFullShiftForBreak}
                            onChange={e => change({ target: { name: 'requireFullShiftForBreak', value: e.target.checked } })}
                            className='w-4 h-4 accent-amber-500'
                          />
                          <div className='flex flex-col'>
                            <span className='text-xs font-bold text-fg'>Require Full Shift</span>
                            <span className='text-[10px] text-subtle'>Only get bonus if worked enough hours</span>
                          </div>
                        </label>

                        {form.requireFullShiftForBreak && (
                          <div className='flex items-center gap-2'>
                            <span className='text-[11px] text-muted whitespace-nowrap'>Min. Hours:</span>
                            <input
                              type='number'
                              name='fullShiftHours'
                              value={form.fullShiftHours}
                              onChange={change}
                              className='w-16 h-8 px-2 text-xs font-bold border border-line rounded-lg outline-none focus:ring-1 focus:ring-warning'
                              placeholder='7.5'
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
    </>
  );
}
