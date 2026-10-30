'use client'
// People joining (30 Oct, lib/hires/model.js): a new hire is made with the
// job and pay; their appointment letter is prepared; a link (7 days) goes to
// them on WhatsApp to fill in their details, add their documents and sign the
// letter; when they have, whoever manages staff checks it and accepts — the
// Add staff form opens filled in (the page does that, from onAccept).
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { Check, ChevronRight, Copy, FileSignature, FileText, Link2, MessageCircle, RefreshCw, UserPlus, X } from 'lucide-react'
import { Avatar, Badge, Button, DatePicker, Field, Input, Select, Sheet, cn, confirmDialog, toast } from '@/app/components/ui'
import MoneyInput from '@/app/components/entry/MoneyInput'
import FileViewer from '@/app/components/common/FileViewer'
import { STATUSES, docKinds, hireName, linkMessage, staffFormFrom } from '@/lib/hires/model'
import { cancelHire, createHire, fileUrl, getLetter, sendLink, updateHire } from '@/lib/hires/client'
import { letterForHire } from '@/app/tools/appointment-letter/letterForHire'
import { waNumber } from '@/lib/purchases/orders'
import { ROLE_GROUPS, roleLabelOf } from '../lib/constants'

const day = d => (d ? format(parseISO(d), 'd MMM yyyy') : '')
const EMPTY = { firstName: '', lastName: '', phone: '', role: '', department: '', startDate: '', basicSalary: '' }

/** The list on the staff page: everyone joining who hasn't joined or been cancelled, and the last few who have. */
export default function NewHires ({ hires, onNew, onOpen }) {
  const open = hires.filter(h => !['accepted', 'cancelled'].includes(h.status))
  if (!open.length) return null
  return (
    <section className='space-y-2'>
      <div className='flex items-center justify-between gap-2 px-1'>
        <h2 className='text-sm font-semibold text-fg'>Joining <span className='font-normal text-muted'>· {open.length}</span></h2>
        <Button size='sm' variant='ghost' icon={UserPlus} onClick={onNew}>New hire</Button>
      </div>
      <ul className='divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface'>
        {open.map(h => (
          <li key={h.id}>
            <button type='button' onClick={() => onOpen(h)} className='flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2'>
              <Avatar name={hireName(h)} size='sm' />
              <span className='min-w-0 flex-1'>
                <span className='block truncate text-sm font-medium text-fg'>{hireName(h)}</span>
                <span className='block truncate text-xs text-muted'>{[roleLabelOf(h.role), h.startDate && `starts ${day(h.startDate)}`].filter(Boolean).join(' · ')}</span>
              </span>
              <Badge tone={STATUSES[h.status]?.tone} className='shrink-0 px-2 py-px text-[10px]'>{STATUSES[h.status]?.label}</Badge>
              <ChevronRight className='size-4 shrink-0 text-subtle' />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** A new hire: name, phone, job, start day and pay (the rest comes from them). Also to change those while it is a draft. */
export function NewHireSheet ({ open, onClose, hire, companyId, branchId, user, currency, onSaved }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (open) {
      setForm(hire ? { ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map(k => [k, hire[k] ?? ''])) } : EMPTY)
      setErrors({})
    }
  }, [open, hire])
  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: undefined }))
  }
  const save = async () => {
    const e = {}
    if (!form.firstName.trim()) e.firstName = 'Their first name'
    if (!form.phone.trim()) e.phone = 'Their phone, for WhatsApp'
    if (!form.role) e.role = 'The job'
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      if (hire) await updateHire(companyId, branchId, hire.id, { ...form, basicSalary: form.basicSalary === '' ? '' : Number(form.basicSalary) })
      const id = hire ? hire.id : await createHire(companyId, branchId, user, form)
      toast.success(hire ? 'Saved' : `${form.firstName} added as a new hire`)
      onSaved?.(id)
    } catch (err) {
      toast.error("Couldn't save", { description: err?.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={hire ? 'Change new hire' : 'New hire'}
      description='Who is joining, as what and for how much. They fill in the rest from a link.'
      footer={<Button className='w-full' size='lg' loading={saving} onClick={save}>{hire ? 'Save' : 'Add new hire'}</Button>}
    >
      <div className='space-y-4'>
        <div className='grid gap-3 sm:grid-cols-2'>
          <Field label='First name' error={errors.firstName}>
            {({ id, invalid }) => <Input id={id} invalid={invalid} value={form.firstName} onChange={e => set('firstName', e.target.value)} autoFocus />}
          </Field>
          <Field label='Last name'>
            {({ id }) => <Input id={id} value={form.lastName} onChange={e => set('lastName', e.target.value)} />}
          </Field>
        </div>
        <Field label='Phone' hint='The link goes to this number on WhatsApp' error={errors.phone}>
          {({ id, invalid }) => <Input id={id} invalid={invalid} type='tel' inputMode='tel' value={form.phone} onChange={e => set('phone', e.target.value)} placeholder='012-345 6789' />}
        </Field>
        <div className='grid gap-3 sm:grid-cols-2'>
          <Field label='Job' error={errors.role}>
            {({ id, invalid }) => (
              <Select id={id} invalid={invalid} value={form.role} onChange={e => set('role', e.target.value)}>
                <option value=''>Choose…</option>
                {ROLE_GROUPS.map(([group, roles]) => (
                  <optgroup key={group} label={group}>
                    {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </optgroup>
                ))}
              </Select>
            )}
          </Field>
          <Field label='Department (optional)'>
            {({ id }) => <Input id={id} value={form.department} onChange={e => set('department', e.target.value)} placeholder='Kitchen, Front…' />}
          </Field>
        </div>
        <div className='grid gap-3 sm:grid-cols-2'>
          <Field label='Starts on'>
            {() => <DatePicker value={form.startDate} onChange={v => set('startDate', v)} placeholder='Pick the day' />}
          </Field>
          <Field label='Basic pay (optional)'>
            {({ id }) => <MoneyInput id={id} size='md' currency={currency} value={form.basicSalary} onValueChange={v => set('basicSalary', v)} />}
          </Field>
        </div>
      </div>
    </Sheet>
  )
}

/** One step of the way: done or not, what it is, and what to do. */
function Step ({ n, done, title, children }) {
  return (
    <li className='flex gap-3'>
      <span className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', done ? 'bg-brand text-brand-fg' : 'bg-surface-2 text-muted')}>
        {done ? <Check className='size-3.5' strokeWidth={3} /> : n}
      </span>
      <div className='min-w-0 flex-1 space-y-2'>
        <p className='text-sm font-semibold text-fg'>{title}</p>
        {children}
      </div>
    </li>
  )
}

const DETAIL_ROWS = [
  ['Name', d => [d.firstName, d.lastName].filter(Boolean).join(' ')],
  ['Gender', d => d.gender],
  ['Date of birth', d => day(d.dob)],
  ['Nationality', d => d.nationality],
  ['IC', d => d.icNumber],
  ['Passport', d => d.passportNumber],
  ['Phone', d => d.phone],
  ['Email', d => d.email],
  ['Address', d => [d.addressLine1, d.addressLine2, d.postalCode, d.city, d.state, d.country].filter(Boolean).join(', ')],
  ['Emergency contact', d => [d.emergencyContactName, d.emergencyContactPhone].filter(Boolean).join(' · ')],
  ['Bank', d => [d.bankName, d.bankAccountNumber, d.bankAccountHolderName].filter(Boolean).join(' · ')]
]

/** A new hire, step by step: letter, link, checking what they sent, accepting. */
export function HireSheet ({ hire, onClose, companyId, branchId, company, timeZone, currency, onEdit, onAccept }) {
  const router = useRouter()
  const [link, setLink] = useState(null) // { url, expiresAt } just made
  const [busy, setBusy] = useState(false)
  const [viewer, setViewer] = useState(null) // { items, index }
  const open = !!hire
  useEffect(() => setLink(null), [hire?.id])
  const name = hire ? hireName(hire) : ''
  const status = hire?.status
  const submitted = ['submitted', 'accepted'].includes(status)
  const files = useMemo(() => {
    if (!hire) return []
    const out = []
    for (const d of docKinds(hire.details)) {
      const v = hire.files?.[d.kind]
      for (const f of Array.isArray(v) ? v : v ? [v] : []) out.push({ ...f, label: d.label })
    }
    return out
  }, [hire])

  const makeLink = async () => {
    if (hire.link && !(await confirmDialog({ title: 'Send a new link?', message: 'The link sent before stops working.', confirmLabel: 'Make a new link' }))) return
    setBusy(true)
    try {
      setLink(await sendLink(companyId, branchId, hire.id))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }
  const text = link ? linkMessage({ name: hire.firstName, company, url: link.url, expiresAt: link.expiresAt }) : ''
  const wa = waNumber(hire?.phone || '', timeZone)
  const showFiles = async index => {
    try {
      const items = await Promise.all(files.map(async f => ({ url: await fileUrl(f.path), label: f.label, pdf: f.contentType === 'application/pdf' })))
      setViewer({ items, index })
    } catch {
      toast.error("Couldn't open the documents")
    }
  }
  const showLetter = async () => {
    try {
      const letter = await getLetter(companyId, branchId, hire.id)
      if (!letter) return toast.error('No letter saved for them yet')
      const { blob } = letterForHire(letter, { details: hire.details || hire, signed: hire.signed, currency })
      setViewer({ items: [{ url: URL.createObjectURL(blob), label: hire.signed ? 'Signed appointment letter' : 'Appointment letter', pdf: true }], index: 0 })
    } catch (err) {
      toast.error("Couldn't draw the letter", { description: err?.message })
    }
  }
  const cancel = async () => {
    if (!(await confirmDialog({ title: `Cancel ${name}?`, message: 'Their link stops working. Nothing is added to the staff list.', confirmLabel: 'Cancel new hire', danger: true }))) return
    await cancelHire(companyId, branchId, hire.id)
    toast.success('Cancelled')
    onClose()
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title={name} description={hire ? [roleLabelOf(hire.role), hire.startDate && `starts ${day(hire.startDate)}`].filter(Boolean).join(' · ') : ''} size='lg'>
        {hire && (
          <div className='space-y-5'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge tone={STATUSES[status]?.tone}>{STATUSES[status]?.label}</Badge>
              {['draft', 'sent'].includes(status) && <Button size='sm' variant='ghost' onClick={() => onEdit(hire)}>Change</Button>}
            </div>

            <ol className='space-y-5'>
              <Step n={1} done={hire.letterReady} title='Appointment letter'>
                <p className='text-xs text-muted'>{hire.letterReady ? (hire.signed ? `Signed ${day(hire.signed.at)}.` : 'Ready — they read and sign it on their link.') : 'Prepare it in the Appointment Letter tool; the job, pay and start day are filled in. They sign it on their link.'}</p>
                <div className='flex flex-wrap gap-2'>
                  {!hire.signed && status !== 'accepted' && (
                    <Button size='sm' variant={hire.letterReady ? 'secondary' : 'primary'} icon={FileSignature} onClick={() => router.push(`/tools/appointment-letter?hire=${hire.id}`)}>
                      {hire.letterReady ? 'Change the letter' : 'Prepare the letter'}
                    </Button>
                  )}
                  {hire.letterReady && <Button size='sm' variant='secondary' icon={FileText} onClick={showLetter}>{hire.signed ? 'Signed letter' : 'See the letter'}</Button>}
                </div>
              </Step>

              <Step n={2} done={submitted} title='Their join link'>
                <p className='text-xs text-muted'>
                  {submitted
                    ? `Filled in ${day(hire.submittedAt)}.`
                    : hire.link
                    ? `Sent — works until ${day(hire.link.expiresAt)}, once. They fill in their details, add their IC or passport, photo (bank card and health certificate if they have them)${hire.letterReady ? ' and sign the letter' : ''}.`
                    : `A link for ${hire.firstName || 'them'} to fill in their details, add their documents${hire.letterReady ? ' and sign the letter' : ''} — 7 days, used once.`}
                </p>
                {!hire.letterReady && !submitted && <p className='text-xs font-medium text-warning'>Prepare the letter first if they should sign it on the link.</p>}
                {link ? (
                  <div className='space-y-2 rounded-xl bg-surface-2 p-3'>
                    <p className='break-all text-xs text-muted'>{link.url}</p>
                    <div className='flex flex-wrap gap-2'>
                      <Button size='sm' icon={MessageCircle} onClick={() => window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')}>WhatsApp</Button>
                      <Button size='sm' variant='secondary' icon={Copy} onClick={() => navigator.clipboard?.writeText(text).then(() => toast.success('Copied'))}>Copy message</Button>
                    </div>
                  </div>
                ) : (
                  !['accepted', 'cancelled'].includes(status) && (
                    <Button size='sm' variant={hire.link ? 'secondary' : 'primary'} icon={hire.link ? RefreshCw : Link2} loading={busy} onClick={makeLink}>
                      {status === 'submitted' ? 'Ask them again (new link)' : hire.link ? 'Send a new link' : 'Make the link'}
                    </Button>
                  )
                )}
              </Step>

              <Step n={3} done={status === 'accepted'} title='Check and accept'>
                {!submitted ? (
                  <p className='text-xs text-muted'>When they have filled it in, you are told; check it here, then accept them as staff.</p>
                ) : (
                  <div className='space-y-3'>
                    <dl className='divide-y divide-line overflow-hidden rounded-xl border border-line text-sm'>
                      {DETAIL_ROWS.map(([label, get]) => {
                        const v = get(hire.details || {})
                        return v ? (
                          <div key={label} className='flex gap-3 px-3 py-2'>
                            <dt className='w-32 shrink-0 text-xs text-muted'>{label}</dt>
                            <dd className='min-w-0 flex-1 break-words text-fg'>{v}</dd>
                          </div>
                        ) : null
                      })}
                    </dl>
                    <div className='flex flex-wrap gap-2'>
                      {files.map((f, i) => (
                        <Button key={f.path} size='sm' variant='secondary' icon={FileText} onClick={() => showFiles(i)}>{f.label}</Button>
                      ))}
                    </div>
                    {status === 'submitted' && (
                      <Button className='w-full' icon={UserPlus} onClick={() => onAccept(hire)}>Accept as staff</Button>
                    )}
                    {status === 'accepted' && <p className='text-xs text-muted'>Joined — they are on the staff list. Their documents and signed letter are on their record.</p>}
                  </div>
                )}
              </Step>
            </ol>

            {!['accepted', 'cancelled'].includes(status) && (
              <Button variant='ghost' size='sm' icon={X} className='text-danger' onClick={cancel}>Cancel this new hire</Button>
            )}
          </div>
        )}
      </Sheet>
      <FileViewer open={!!viewer} items={viewer?.items || []} index={viewer?.index || 0} onClose={() => setViewer(null)} />
    </>
  )
}

export { staffFormFrom }
