'use client'
// Quick add (6 Nov): someone starting today, or part-time — a name and pay is
// enough to put them on payroll and attendance. What is still missing shows on
// their record until it is in (lib/staff/missing.js).
import React, { useState } from 'react'
import { format } from 'date-fns'
import { Zap } from 'lucide-react'
import { skipToken } from '@reduxjs/toolkit/query'
import { Button, Field, Input, Select, Sheet, toast } from '@/app/components/ui'
import useSession from '@/app/hooks/useSession'
import { useGetBranchSettingsQuery } from '@/lib/redux/api/branchSettingsApiSlice'
import { useAddStaffMutation } from '@/lib/redux/api/staffApiSlice'
import { quickStaff } from '@/lib/staff/missing'
import { ROLE_GROUPS } from '../lib/constants'

const PAY = [
  { value: 'monthly', label: 'Monthly basic (by the hour)', amount: 'Basic a month' },
  { value: 'fixed', label: 'Fixed monthly salary', amount: 'Salary a month' },
  { value: 'hourly', label: 'Part-time, so much an hour', amount: 'Pay an hour' },
]
const EMPTY = { firstName: '', lastName: '', role: '', pay: 'monthly', amount: '', startDate: '' }

export default function QuickAddSheet ({ open, onClose, onAdded }) {
  const { companyId, branchId } = useSession()
  const { data: settings } = useGetBranchSettingsQuery(companyId && branchId ? { companyId, branchId } : skipToken)
  const hours = Number(settings?.payroll?.standardHoursPerMonth) || 312
  const [addStaff, { isLoading }] = useAddStaffMutation()
  const [form, setForm] = useState(EMPTY)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const pay = PAY.find(p => p.value === form.pay)

  const save = async () => {
    try {
      const data = quickStaff({ ...form, startDate: form.startDate || format(new Date(), 'yyyy-MM-dd'), hours })
      const added = await addStaff({ companyId, branchId, data }).unwrap()
      toast.success(`${data.firstName} added`, { description: 'On payroll and attendance now. Their details are still to come.' })
      setForm(EMPTY)
      onClose()
      onAdded?.({ id: added?.id, ...data })
    } catch (e) {
      toast.error(e?.message || "Couldn't add them")
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title='Quick add'
      description='Name and pay now; their phone, IC, address and the rest later, by hand or on a link.'
      footer={
        <div className='flex justify-end gap-2'>
          <Button variant='ghost' onClick={onClose}>Cancel</Button>
          <Button icon={Zap} onClick={save} loading={isLoading}>Add</Button>
        </div>
      }
    >
      <div className='space-y-4'>
        <div className='grid grid-cols-2 gap-3'>
          <Field label='First name'>{({ id }) => <Input id={id} value={form.firstName} onChange={e => set('firstName', e.target.value)} autoFocus />}</Field>
          <Field label='Last name'>{({ id }) => <Input id={id} value={form.lastName} onChange={e => set('lastName', e.target.value)} />}</Field>
        </div>
        <Field label='Job' hint='Optional'>
          {({ id }) => (
            <Select id={id} value={form.role} onChange={e => set('role', e.target.value)}>
              <option value=''>— Later —</option>
              {ROLE_GROUPS.map(([group, roles]) => (
                <optgroup key={group} label={group}>
                  {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </optgroup>
              ))}
            </Select>
          )}
        </Field>
        <Field label='Paid'>
          {({ id }) => (
            <Select id={id} value={form.pay} onChange={e => set('pay', e.target.value)}>
              {PAY.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          )}
        </Field>
        <div className='grid grid-cols-2 gap-3'>
          <Field label={pay.amount} hint={form.pay === 'monthly' && Number(form.amount) > 0 ? `${(Number(form.amount) / hours).toFixed(2)} an hour (÷ ${hours} hrs), OT the same` : form.pay === 'hourly' ? 'Every hour worked, OT at the same rate' : undefined}>
            {({ id }) => <Input id={id} inputMode='decimal' value={form.amount} onChange={e => set('amount', e.target.value)} />}
          </Field>
          <Field label='Starts' hint='Empty: today'>
            {({ id }) => <Input id={id} type='date' value={form.startDate} onChange={e => set('startDate', e.target.value)} />}
          </Field>
        </div>
      </div>
    </Sheet>
  )
}
