"use client";

import { Landmark, Percent, Wallet } from 'lucide-react';
import { cn } from '@/app/components/ui';
import { useStaffFormContext } from "../StaffFormContext";
import { Choice, Row, Section, TextField, decimal, digits } from '../parts';

const PAY_MODES = [
  { value: '', label: 'Branch default' },
  { value: 'hours', label: 'By hours' },
  { value: 'days', label: 'By days' },
];

export default function PayrollTab() {
  const { payrollConfig, currency, form, setForm } = useStaffFormContext();
  const deductions = (payrollConfig?.statutoryDeductions || []).filter(d => d.enabled);
  const money = { prefix: currency, inputMode: 'decimal', clean: decimal };

  return (
    <div className='space-y-8'>
      <Section icon={Wallet} title='Pay' description='Only managers and the bookkeeper see pay and bank details.'>
        <Row>
          <TextField name='basicSalary' label='Basic salary a month' placeholder='1,500' {...money} />
          <TextField name='allowance' label='Allowance a month' placeholder='200' {...money} />
        </Row>
        <Row>
          <TextField name='basicPerHour' label='Pay per hour' placeholder='7.50' {...money} />
          <TextField name='OTPerHour' label='OT per hour' placeholder='11.25' {...money} />
        </Row>
        <Choice name='salaryMode' label='Salary counted' options={PAY_MODES} hint='Leave on branch default unless this person is paid differently.' />
        <Row>
          <TextField name='standardHours' label='Normal hours a month' inputMode='numeric' clean={digits} placeholder='Branch default (e.g. 208)' />
          <TextField name='workingDays' label='Working days a month' inputMode='numeric' clean={digits} placeholder='Branch default (e.g. 26)' />
        </Row>
      </Section>

      <Section icon={Landmark} title='Bank' description='Where their salary goes.'>
        <Row>
          <TextField name='bankName' label='Bank' placeholder='Maybank' />
          <TextField name='bankAccountNumber' label='Account number' inputMode='numeric' placeholder='1234 5678 9012' />
        </Row>
        <TextField name='bankAccountHolderName' label='Name on the account' placeholder='As the bank has it' />
      </Section>

      {deductions.length > 0 && (
        <Section icon={Percent} title='Deductions' description="The branch's rates apply unless you change them here. Switch one off to leave this person out of it.">
          <div className='space-y-2'>
            {deductions.map(ded => {
              const override = form.deductionSettings?.[ded.key] || {};
              const on = override.enabled !== undefined ? override.enabled : true;
              const set = patch =>
                setForm(f => ({
                  ...f,
                  deductionSettings: { ...(f.deductionSettings || {}), [ded.key]: { ...(f.deductionSettings?.[ded.key] || {}), ...patch } },
                }));
              const rate = (key, fallback, label) => (
                <label className='flex-1'>
                  <span className='mb-1 block text-xs text-muted'>{label}</span>
                  <span className='relative block'>
                    <input
                      type='number'
                      min='0'
                      max='100'
                      step='0.01'
                      value={override[key] ?? ''}
                      onChange={e => set({ [key]: e.target.value === '' ? null : parseFloat(e.target.value) })}
                      placeholder={String(fallback)}
                      disabled={!on}
                      className='h-10 w-full rounded-xl border border-line bg-surface pl-3 pr-7 text-sm text-fg outline-none transition focus:border-brand focus:ring-4 focus:ring-[var(--cc-ring)] disabled:opacity-50'
                    />
                    <span className='absolute inset-y-0 right-3 flex items-center text-xs text-subtle'>%</span>
                  </span>
                </label>
              );
              return (
                <div key={ded.key} className={cn('rounded-2xl border p-4 transition-colors', on ? 'border-line' : 'border-dashed border-line bg-surface-2/50')}>
                  <div className='flex items-center justify-between gap-3'>
                    <div>
                      <p className='text-sm font-semibold text-fg'>{ded.name}</p>
                      <p className='text-xs text-muted'>Branch rate: {ded.employeeRate}% them · {ded.employerRate}% you</p>
                    </div>
                    <button
                      type='button'
                      role='switch'
                      aria-checked={on}
                      aria-label={`${ded.name} for this person`}
                      onClick={() => set({ enabled: !on })}
                      className={cn('relative flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors', on ? 'bg-brand' : 'bg-line')}
                    >
                      <span className={cn('size-5 rounded-full bg-white shadow transition-transform', on && 'translate-x-5')} />
                    </button>
                  </div>
                  {on && (
                    <div className='mt-3 flex gap-3'>
                      {rate('employeeRateOverride', ded.employeeRate, 'Their share')}
                      {rate('employerRateOverride', ded.employerRate, 'Your share')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
