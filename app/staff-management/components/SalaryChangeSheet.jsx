'use client'
// Change someone's salary (6 Nov): the new basic and allowance, from which month,
// and why. The hourly and OT rates follow from the basic (lib/payroll/payHistory.js),
// payroll pays each month at the rate in force then, and the change is kept.
import React, { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { TrendingUp } from 'lucide-react'
import { skipToken } from '@reduxjs/toolkit/query'
import { Button, Field, Input, Select, Sheet, Textarea, toast } from '@/app/components/ui'
import useSession from '@/app/hooks/useSession'
import useCurrency from '@/app/hooks/useCurrency'
import { formatMoney } from '@/lib/region/currency'
import { personName } from '@/lib/people'
import { useGetBranchSettingsQuery } from '@/lib/redux/api/branchSettingsApiSlice'
import { useChangeSalaryMutation } from '@/lib/redux/api/staffApiSlice'
import { hoursOf, payOf, salaryChange } from '@/lib/payroll/payHistory'

/** This month, the three before and the three after: "YYYY-MM". */
function monthChoices () {
  const now = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 3 + i, 1)
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') }
  })
}

export default function SalaryChangeSheet ({ open, onClose, staff, onSaved }) {
  const { user, companyId, branchId } = useSession()
  const currency = useCurrency()
  const money = v => (v === null || v === undefined || v === '' ? '—' : formatMoney(Number(v), currency))
  const { data: settings } = useGetBranchSettingsQuery(companyId && branchId ? { companyId, branchId } : skipToken)
  const branchHours = settings?.payroll?.standardHoursPerMonth
  const [changeSalary, { isLoading }] = useChangeSalaryMutation()
  const months = useMemo(monthChoices, [])
  const was = payOf(staff || {})
  const [form, setForm] = useState({ from: format(new Date(), 'yyyy-MM'), basicSalary: '', allowance: '', note: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // what it comes to, worked out as the user types
  const preview = useMemo(() => {
    try {
      return salaryChange(staff || {}, { ...form, allowance: form.allowance === '' ? null : form.allowance, by: {}, at: new Date().toISOString() }, branchHours).entry
    } catch {
      return null
    }
  }, [staff, form, branchHours])

  const save = async () => {
    try {
      const { patch } = salaryChange(staff, {
        ...form,
        allowance: form.allowance === '' ? null : form.allowance,
        by: { uid: user?.uid || '', name: personName(user) || '' },
      }, branchHours)
      await changeSalary({ companyId, branchId, staffId: staff.id, patch }).unwrap()
      toast.success('Salary changed', { description: `${money(was.basicSalary)} → ${money(patch.basicSalary)} from ${months.find(m => m.value === form.from)?.label || form.from}` })
      setForm({ from: format(new Date(), 'yyyy-MM'), basicSalary: '', allowance: '', note: '' })
      onSaved?.()
      onClose()
    } catch (e) {
      toast.error("Couldn't change the salary", { description: e?.message || 'Try again.' })
    }
  }

  const rise = preview ? preview.now.basicSalary - (was.basicSalary || 0) : 0
  return (
    <Sheet
      open={open && !!staff}
      onClose={onClose}
      title='Change salary'
      description={`${`${staff?.firstName || ''} ${staff?.lastName || ''}`.trim()} · now ${money(was.basicSalary)} basic${staff?.fixedSalaryNoAttendance ? ' (fixed monthly)' : ''}`}
      footer={
        <div className='flex justify-end gap-2'>
          <Button variant='ghost' onClick={onClose}>Cancel</Button>
          <Button icon={TrendingUp} onClick={save} loading={isLoading} disabled={!preview}>Save the change</Button>
        </div>
      }
    >
      <div className='space-y-4'>
        <div className='grid grid-cols-2 gap-3'>
          <Field label='New basic'>
            {({ id }) => <Input id={id} inputMode='decimal' value={form.basicSalary} onChange={e => set('basicSalary', e.target.value)} placeholder={String(was.basicSalary ?? '')} />}
          </Field>
          <Field label='Allowance' hint='Leave empty to keep it'>
            {({ id }) => <Input id={id} inputMode='decimal' value={form.allowance} onChange={e => set('allowance', e.target.value)} placeholder={String(was.allowance ?? 0)} />}
          </Field>
        </div>
        <Field label='From which month' hint="Payroll for this month and after pays the new salary; earlier months stay as they were.">
          {({ id }) => (
            <Select id={id} value={form.from} onChange={e => set('from', e.target.value)}>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          )}
        </Field>
        <Field label='Why' hint='e.g. Approved by the GM'>
          {({ id }) => <Textarea id={id} rows={2} value={form.note} onChange={e => set('note', e.target.value)} />}
        </Field>

        {preview && (
          <div className='rounded-2xl border border-line bg-surface-2/60 p-3 text-sm'>
            <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-subtle'>
              What changes {rise ? `· ${rise > 0 ? '+' : '−'}${money(Math.abs(rise))} a month` : ''}
            </p>
            {[
              ['Basic', was.basicSalary, preview.now.basicSalary],
              ['Allowance', was.allowance, preview.now.allowance],
              [`Basic an hour (÷ ${hoursOf(staff, branchHours)} hrs)`, was.basicPerHour, preview.now.basicPerHour],
              ['OT an hour', was.OTPerHour, preview.now.OTPerHour],
            ].map(([label, a, b]) => (
              <div key={label} className='flex items-center justify-between gap-3 py-1'>
                <span className='text-muted'>{label}</span>
                <span className='tabular-nums'>
                  <span className='text-subtle'>{money(a)}</span> → <strong className='text-fg'>{money(b)}</strong>
                </span>
              </div>
            ))}
            {staff?.fixedSalaryNoAttendance && <p className='mt-2 text-xs text-muted'>A fixed monthly salary: the new basic is paid in full.</p>}
          </div>
        )}
      </div>
    </Sheet>
  )
}
