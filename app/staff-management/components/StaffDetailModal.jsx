'use client'
import React from 'react'
import { format, parseISO } from 'date-fns'
import { Pencil, Phone, Trash2 } from 'lucide-react'
import useCurrency from '@/app/hooks/useCurrency'
import { formatMoney } from '@/lib/region/currency'
import { Avatar, Badge, Button, Sheet, cn } from '@/app/components/ui'
import { roleLabelOf } from '../lib/constants'

// ── helpers ───────────────────────────────────────────────────────────────────
const fmtDate = val => {
  if (!val) return null
  try {
    if (val?.seconds) return format(new Date(val.seconds * 1000), 'd MMM yyyy')
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) return format(parseISO(val.slice(0, 10)), 'd MMM yyyy')
  } catch {
    /* falls through */
  }
  return null
}

const capitalize = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : null)

const fmtAddress = s => {
  const parts = [s.addressLine1, s.addressLine2, s.city, s.postalCode, s.state, s.country].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

/** How long ago someone started: "2 yrs 3 mths", "5 mths", "3 weeks". */
const tenure = start => {
  if (!start) return null
  const d = typeof start === 'string' ? parseISO(start.slice(0, 10)) : start?.seconds ? new Date(start.seconds * 1000) : null
  if (!d || Number.isNaN(+d)) return null
  const months = (new Date().getFullYear() - d.getFullYear()) * 12 + (new Date().getMonth() - d.getMonth())
  if (months < 1) return `${Math.max(1, Math.round((Date.now() - d) / 6048e5))} weeks`
  const y = Math.floor(months / 12)
  const m = months % 12
  return [y && `${y} yr${y === 1 ? '' : 's'}`, m && `${m} mth${m === 1 ? '' : 's'}`].filter(Boolean).join(' ')
}

const Line = ({ label, children, mono }) =>
  children ? (
    <div className='flex items-start justify-between gap-4 py-2 text-sm'>
      <span className='shrink-0 text-muted'>{label}</span>
      <span className={cn('min-w-0 break-words text-right font-medium text-fg', mono && 'font-mono tracking-wide')}>{children}</span>
    </div>
  ) : null

const Group = ({ title, children }) => {
  // a group with nothing filled in isn't shown at all
  const shown = React.Children.toArray(children).filter(c => c?.props?.children)
  if (!shown.length) return null
  return (
    <section>
      <p className='mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-subtle'>{title}</p>
      <div className='divide-y divide-line'>{children}</div>
    </section>
  )
}

/** One staff member: pay at a glance, then contact, work, ID and bank. */
export default function StaffDetailModal ({ isOpen, onClose, staff, onEdit, onDelete, onLinkOffice, onUnlinkOffice }) {
  const currency = useCurrency()
  const money = v => (v && Number(v) > 0 ? formatMoney(Number(v), currency) : null)
  const s = staff || {}
  const fullName = `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Staff member'
  const address = fmtAddress(s)
  const since = tenure(s.startDate)

  const figures = [
    { label: 'Basic pay', value: money(s.basicSalary) || '—' },
    { label: 'OT an hour', value: money(s.OTPerHour) || '—' },
    { label: 'Allowance', value: money(s.allowance) || '—' },
    { label: 'Started', value: fmtDate(s.startDate) || '—', note: since }
  ]

  return (
    <Sheet
      open={isOpen && !!staff}
      onClose={onClose}
      size='lg'
      title={fullName}
      description={[roleLabelOf(s.role) || 'Staff', s.department].filter(Boolean).join(' · ')}
      footer={
        <div className='flex items-center justify-between gap-2'>
          {onDelete ? (
            <Button
              variant='ghost'
              icon={Trash2}
              className='text-danger hover:bg-danger-soft'
              onClick={() => {
                onClose()
                onDelete(staff)
              }}
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          {onEdit && (
            <Button
              icon={Pencil}
              onClick={() => {
                onClose()
                onEdit(staff)
              }}
            >
              Edit
            </Button>
          )}
        </div>
      }
    >
      {staff && (
        <div className='space-y-5'>
          <div className='flex items-center gap-4'>
            <Avatar name={fullName} src={s.photoUrl} size='lg' />
            <div className='min-w-0 space-y-1.5'>
              <div className='flex flex-wrap gap-1.5'>
                {s.uid ? <Badge tone='success' dot>Staff app login</Badge> : s.officeUid ? <Badge tone='info' dot>Office login · {s.officeName || 'linked'}</Badge> : <Badge>No staff app login</Badge>}
                {s.salaryMode && <Badge tone='info'>Paid by the {s.salaryMode === 'hours' ? 'hour' : s.salaryMode === 'days' ? 'day' : 'month'}</Badge>}
              </div>
              {/* an office login sees this record's pay under Me (30 Oct) */}
              {!s.uid && !s.officeUid && onLinkOffice && (
                <button type='button' onClick={() => onLinkOffice(staff)} className='block text-xs font-semibold text-brand hover:underline'>
                  Link an office login
                </button>
              )}
              {s.officeUid && onUnlinkOffice && (
                <button type='button' onClick={() => onUnlinkOffice(staff)} className='block text-xs font-semibold text-muted hover:text-danger'>
                  Unlink the office login
                </button>
              )}
              {s.phone && (
                <a href={`tel:${s.phone}`} className='inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline'>
                  <Phone className='size-3.5' /> {s.phone}
                </a>
              )}
            </div>
          </div>

          <div className='grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4'>
            {figures.map(f => (
              <div key={f.label} className='bg-surface p-3'>
                <p className='text-[11px] font-semibold text-muted'>{f.label}</p>
                <p className='mt-0.5 truncate text-base font-bold tabular-nums text-fg'>{f.value}</p>
                {f.note && <p className='text-[11px] text-subtle'>{f.note}</p>}
              </div>
            ))}
          </div>

          <div className='grid gap-5 md:grid-cols-2'>
            <div className='space-y-5'>
              <Group title='Contact'>
                <Line label='Email'>{s.email && <a href={`mailto:${s.email}`} className='text-brand hover:underline'>{s.email}</a>}</Line>
                <Line label='Address'>{address}</Line>
              </Group>
              <Group title='Personal'>
                <Line label='Gender'>{capitalize(s.gender)}</Line>
                <Line label='Born'>{fmtDate(s.dob)}</Line>
                <Line label='Nationality'>{capitalize(s.nationality)}</Line>
              </Group>
              <Group title='If something happens'>
                <Line label='Call'>{s.emergencyContactName}</Line>
                <Line label='On'>{s.emergencyContactPhone && <a href={`tel:${s.emergencyContactPhone}`} className='text-brand hover:underline'>{s.emergencyContactPhone}</a>}</Line>
              </Group>
            </div>
            <div className='space-y-5'>
              <Group title='Work'>
                <Line label='Department'>{s.department}</Line>
                <Line label='Supervisor'>{s.supervisorName}</Line>
                <Line label='Basic an hour'>{money(s.basicPerHour)}</Line>
                <Line label='Added on'>{fmtDate(s.createdAt)}</Line>
              </Group>
              <Group title='ID'>
                <Line label='IC number' mono>{s.icNumber}</Line>
                <Line label='Passport' mono>{s.passportNumber}</Line>
              </Group>
              <Group title='Bank'>
                <Line label='Bank'>{s.bankName}</Line>
                <Line label='Account' mono>{s.bankAccountNumber}</Line>
                <Line label='In the name of'>{s.bankAccountHolderName}</Line>
              </Group>
            </div>
          </div>

          {s.notes && (
            <div className='rounded-xl bg-surface-2/60 p-3'>
              <p className='mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-subtle'>Notes</p>
              <p className='whitespace-pre-wrap text-sm text-fg'>{s.notes}</p>
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}
