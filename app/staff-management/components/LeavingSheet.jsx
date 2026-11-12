'use client'
// Someone left the job (12 Nov 2026; lib/staff/leaving.js): their last day and
// why. Saved by the server (app/api/staff/leaving), which also takes their face
// off the kiosk and switches off their staff app login.
import { useEffect, useState } from 'react'
import { UserMinus } from 'lucide-react'
import { Button, DatePicker, Field, Select, Sheet, Textarea } from '@/app/components/ui'
import { toast } from '@/app/components/ui/notify'
import { useBusinessToday } from '@/app/hooks/useRegion'
import { useStaffLeavingMutation } from '@/lib/redux/api/staffApiSlice'
import { LEAVING_REASONS, isCurrent } from '@/lib/staff/leaving'

const fullName = s => `${s?.firstName || ''} ${s?.lastName || ''}`.trim() || s?.name || 'They'

export default function LeavingSheet ({ staff, onClose, companyId, branchId }) {
  const today = useBusinessToday()
  const [leftOn, setLeftOn] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState({})
  const [save, { isLoading }] = useStaffLeavingMutation()
  const changing = staff && !isCurrent(staff) // already marked: changing the details

  useEffect(() => {
    if (!staff) return
    setLeftOn(staff.leftOn || today)
    setReason(staff.leftReason || '')
    setNote(staff.leftNote || '')
    setErrors({})
  }, [staff, today])

  const submit = async () => {
    const e = {}
    if (!leftOn) e.leftOn = 'Pick their last working day'
    else if (leftOn > today) e.leftOn = 'Their last day is still to come — mark them on that day'
    if (!reason) e.reason = 'Why did they leave?'
    if (reason === 'other' && !note.trim()) e.note = 'Write a line on why'
    setErrors(e)
    if (Object.keys(e).length) return
    try {
      const r = await save({ companyId, branchId, staffId: staff.id, leftOn, reason, note }).unwrap()
      toast.success(changing ? 'Saved' : `${fullName(staff)} marked as left`, {
        description: r?.office ? `They also have an office login (${r.office}) — remove it under Users if they shouldn't sign in.` : undefined
      })
      onClose()
    } catch (err) {
      toast.error("Couldn't save it", { description: err?.message })
    }
  }

  return (
    <Sheet
      open={!!staff}
      onClose={onClose}
      title={changing ? 'When and why they left' : `${fullName(staff)} left the job`}
      description={changing ? fullName(staff) : 'They stay in old records. You can bring them back later.'}
      footer={
        <div className='flex justify-end gap-2'>
          <Button variant='ghost' onClick={onClose}>Cancel</Button>
          <Button icon={UserMinus} onClick={submit} loading={isLoading}>{changing ? 'Save' : 'Mark as left'}</Button>
        </div>
      }
    >
      {staff && (
        <div className='space-y-4'>
          <Field label='Last working day' error={errors.leftOn}>
            <DatePicker value={leftOn} onChange={setLeftOn} max={today} invalid={!!errors.leftOn} placeholder='Their last day' />
          </Field>
          <Field label='Why' error={errors.reason}>
            <Select value={reason} onChange={e => setReason(e.target.value)} invalid={!!errors.reason}>
              <option value=''>Choose…</option>
              {LEAVING_REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </Field>
          <Field label={reason === 'other' ? 'Note' : 'Note (optional)'} error={errors.note}>
            <Textarea rows={2} maxLength={300} value={note} onChange={e => setNote(e.target.value)} invalid={!!errors.note} placeholder='Anything to remember, e.g. gave one month notice' />
          </Field>
          {!changing && (
            <ul className='space-y-1.5 rounded-xl bg-surface-2 p-3 text-sm text-muted'>
              <li>• Off the kiosk, the Attendance Log lists, tasks, requests and advances.</li>
              <li>• Their face is deleted from the kiosk and their staff app login stops.</li>
              <li>• Payroll keeps them up to the month they left, for the last salary.</li>
              <li>• Old attendance, advances, payslips and reports stay as they are.</li>
            </ul>
          )}
        </div>
      )}
    </Sheet>
  )
}
