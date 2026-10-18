"use client";

import { useState } from 'react';
import { Clock, Eye, EyeOff, KeyRound, MoonStar, Shuffle } from 'lucide-react';
import { useStaffFormContext } from "../StaffFormContext";
import { Choice, Row, Section, TextField, ToggleRow, decimal, digits } from '../parts';

const EMPLOYMENT = [
  { value: 'full-time', label: 'Full-time · salary + OT' },
  { value: 'part-time', label: 'Part-time · by the hour' },
];
const PERIODS = [
  { value: 'weekly', label: 'Weekly (Mon–Sun)' },
  { value: 'monthly', label: 'Monthly (1st–end)' },
];

/** A random 4-digit kiosk PIN. */
const newPin = () => String(crypto.getRandomValues(new Uint16Array(1))[0] % 10000).padStart(4, '0');

export default function AttendanceTab() {
  const { shiftsEnabled, staffShift, staffShiftWindow, shiftIsOvernight, change } = useStaffFormContext();
  const [showPin, setShowPin] = useState(false);
  const makePin = () => {
    change({ target: { name: 'pinCode', value: newPin() } });
    setShowPin(true);
  };

  return (
    <div className='space-y-8'>
      <Section icon={KeyRound} title='Clocking in' description='They type this PIN at the attendance kiosk.'>
        <Row>
          <TextField
            name='pinCode'
            label='Kiosk PIN (4 digits)'
            required
            type={showPin ? 'text' : 'password'}
            inputMode='numeric'
            maxLength={4}
            clean={digits}
            placeholder='••••'
            className='[&_input]:tracking-[0.5em] [&_input]:font-semibold'
            suffix={
              <span className='flex items-center'>
                <button
                  type='button'
                  onClick={() => setShowPin(s => !s)}
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                  className='rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg'
                >
                  {showPin ? <EyeOff className='size-4' /> : <Eye className='size-4' />}
                </button>
                <button
                  type='button'
                  onClick={makePin}
                  title='Make one up'
                  aria-label='Make up a PIN'
                  className='rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg'
                >
                  <Shuffle className='size-4' />
                </button>
              </span>
            }
            hint='Tap the shuffle button to make one up.'
          />
        </Row>
        <ToggleRow
          name='fixedSalaryNoAttendance'
          tone='warning'
          title='Fixed monthly salary, no attendance'
          description='For owners and salaried staff: payroll pays the basic salary as it is and skips them when bringing in hours.'
        />
      </Section>

      <Section icon={Clock} title='Hours and overtime'>
        <Choice name='employmentType' label='Works' options={EMPLOYMENT} />
        <Choice name='attendancePeriod' label='Hours are added up' options={PERIODS} />

        {shiftsEnabled && (
          <div className='space-y-4 rounded-2xl border border-line p-4'>
            <div className='flex items-center justify-between gap-2'>
              <p className='text-sm font-semibold text-fg'>Shift</p>
              {staffShiftWindow && (
                <span className='inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted'>
                  {staffShiftWindow.hours.toFixed(2)} h paid
                  {shiftIsOvernight && (
                    <span className='inline-flex items-center gap-1 text-info'>
                      <MoonStar className='size-3' aria-hidden='true' /> overnight
                    </span>
                  )}
                </span>
              )}
            </div>
            <Row cols={3}>
              <TextField name='shiftStart' label='Starts' type='time' />
              <TextField name='shiftEnd' label='Ends' type='time' />
              <TextField name='shiftBreakMinutes' label='Unpaid break' inputMode='numeric' clean={digits} placeholder='0' suffix={<span className='pr-2 text-sm text-subtle'>min</span>} />
            </Row>
            <p className='text-xs text-subtle'>
              {staffShift
                ? 'Lateness and OT are counted against these times. Coming in well before the start needs approval to count as OT.'
                : 'Leave empty for no fixed shift — OT then starts after the daily hours below. An end earlier than the start means the shift crosses midnight.'}
            </p>
          </div>
        )}

        <Row>
          <TextField
            name='basicHoursPerDay'
            label='Normal hours a day'
            inputMode='decimal'
            clean={decimal}
            disabled={!!staffShift}
            placeholder='8'
            hint={staffShift ? 'Set by the shift times above.' : 'OT starts after this many hours.'}
          />
        </Row>

        <ToggleRow name='hasPaidBreak' title='Paid break' description='Adds 1 paid hour for each day worked.'>
          <ToggleRow name='requireFullShiftForBreak' title='Only after a full shift' description='The paid hour counts only on days they work long enough.'>
            <Row>
              <TextField name='fullShiftHours' label='At least' inputMode='decimal' clean={decimal} placeholder='7.5' suffix={<span className='pr-2 text-sm text-subtle'>hours</span>} />
            </Row>
          </ToggleRow>
        </ToggleRow>
      </Section>
    </div>
  );
}
