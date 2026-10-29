'use client'
import { personName } from "@/lib/people";
import { useMemo, useState } from 'react'
import { addMonths, format, parseISO } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { Clock3, History } from 'lucide-react'
import { useBusinessToday } from '@/app/hooks/useRegion'
import useCurrency from '@/app/hooks/useCurrency'
import useSession from '@/app/hooks/useSession'
import { formatMoney } from '@/lib/region/currency'
import PayOutQueue from '@/app/components/requests/PayOutQueue'
import { useAddAdvanceEntryMutation } from '@/lib/redux/api/AdvanceApiSlice'
import { useGetStaffListQuery } from '@/lib/redux/api/staffApiSlice'
import { useAddStaffLoanMutation } from '@/lib/redux/api/staffLoanApiSlice'
import { getSessionUser } from '@/lib/session'
import { Button, CountUp, DatePicker, Field, Input, Switch, Tabs, Textarea, cn, toast } from '@/app/components/ui'
import MoneyInput from '@/app/components/entry/MoneyInput'
import StaffPicker, { staffName } from '@/app/components/entry/StaffPicker'
import { Chip, PaidFromChoice } from '@/app/components/entry/Choices'
import { EntryLayout, EntrySection, SummaryLine } from '@/app/components/entry/EntryLayout'
import { can } from '@/lib/authz/permissions'
import { newRequestFields } from '@/lib/requests/model'
import { loanSplit } from '@/lib/payroll/loanSplit'

const ADVANCE_TYPES = [
  { value: 'salary', label: 'Salary advance' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'personal', label: 'Personal' }
]
const LOAN_DURATIONS = [3, 6, 9, 12, 18, 24]
const MAX_LOAN_MONTHS = 60 // a typed-in ("Custom") number of months: 1 to this

// Who paid, for paidOut.by — the same shape the pay-out action records.
const payerOf = user => ({ uid: user?.uid || '', name: personName(user) || '', role: user?.role || '' })
const ym = d => (d || '').slice(0, 7)
const monthLabel = m => (m ? format(parseISO(`${m}-01`), 'MMM yyyy') : '')
// the month a date falls in and the next few, for picking a payroll month
const monthsFrom = (d, n = 4) => Array.from({ length: n }, (_, i) => format(addMonths(parseISO(`${ym(d)}-01`), i), 'yyyy-MM'))
const day = d => (d ? format(parseISO(d), 'EEE, d MMM') : '')

/** The page's top: money approved but not handed over yet, who can do what, and the two tabs. */
function Head ({ companyId, branchId, user, manager, tab, setTab }) {
  return (
    <div className='space-y-4'>
      <PayOutQueue companyId={companyId} branchId={branchId} user={user} />
      {!manager && (
        <div className='flex gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-fg'>
          <Clock3 className='mt-0.5 size-4 shrink-0 text-warning' />
          <p>This is sent to the manager as a request. No money moves until it is approved and handed over.</p>
        </div>
      )}
      <Tabs
        tabs={[
          { value: 'advance', label: 'Advance' },
          { value: 'loan', label: 'Staff loan' }
        ]}
        value={tab}
        onChange={setTab}
      />
      <p className='-mt-2 px-1 text-xs text-muted'>
        {tab === 'advance' ? 'Taken back in full from one salary.' : 'Paid back from salary in monthly instalments.'}
      </p>
    </div>
  )
}

// ─── Advance ──────────────────────────────────────────────────────────────────
function AdvanceForm ({ head, staff, staffLoading, companyId, branchId, manager, money, currency }) {
  const today = useBusinessToday()
  const [staffId, setStaffId] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('salary')
  const [date, setDate] = useState(today)
  const [month, setMonth] = useState(null) // null = the month of the date
  const [reason, setReason] = useState('')
  const [office, setOffice] = useState('front')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState({})
  const [saved, setSaved] = useState(false)
  const [addAdvanceEntry, { isLoading }] = useAddAdvanceEntryMutation()

  const when = date || today
  const deductionMonth = month || ym(when)
  const person = staff.find(s => s.id === staffId)

  const save = async () => {
    const problems = {}
    if (!staffId) problems.staff = 'Who is it for?'
    if (!(Number(amount) > 0)) problems.amount = 'Enter the amount'
    setErrors(problems)
    if (Object.keys(problems).length) return toast.error('Check the highlighted fields')

    const createdBy = getSessionUser() || {}
    // approvers give it now; anyone else's entry is a request
    const flow = newRequestFields({ type: 'advance', amount: Number(amount) || 0 }, createdBy)
    const given = flow.status === 'approved'
    try {
      await addAdvanceEntry({
        companyId,
        branchId,
        data: {
          staffId: person?.id || '',
          staffName: staffName(person),
          amount: Number(amount) || 0,
          advanceType: type,
          reason: reason.trim(),
          date: when,
          deductionMonth,
          paidFromOffice: office, // 'front' | 'back'
          ...flow,
          // A manager entering an advance hands it over now: approved and paid in one
          // step. Anyone else's entry is a request — no money moves until it is
          // approved and then paid out.
          paidOut: given ? { date: when, from: office, by: payerOf(createdBy) } : null,
          deducted: false,
          approvalNotes: manager ? notes : '',
          createdBy
        }
      }).unwrap()
      toast.success(given ? 'Advance given' : 'Request sent', {
        description: `${staffName(person)} · ${money(amount)}${given ? ` · from the ${office === 'back' ? 'bank' : 'till'}` : ' · waiting for approval'}`
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 1400)
      setStaffId('')
      setAmount('')
      setType('salary')
      setReason('')
      setNotes('')
      setMonth(null)
      setOffice('front')
    } catch (err) {
      console.error(err)
      toast.error("Couldn't save the advance", { description: err?.message || 'Check your connection and try again.' })
    }
  }

  const label = manager ? 'Give advance' : 'Send request'
  const button = (
    <Button size='lg' className='w-full' onClick={save} loading={isLoading} success={saved}>
      {label}
    </Button>
  )

  return (
    <EntryLayout
      aside={
        <div className='space-y-4'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-[0.12em] text-subtle'>Advance</p>
            <CountUp value={Number(amount) || 0} format={money} className='mt-1 block text-3xl font-bold tracking-tight text-fg' />
            <p className='mt-0.5 truncate text-xs text-muted'>{person ? staffName(person) : 'Choose a staff member'}</p>
          </div>
          <div className='space-y-2 border-t border-line pt-3'>
            <SummaryLine label='Given' value={day(when)} />
            <SummaryLine label='From' value={office === 'back' ? 'The bank' : 'The till'} />
            <SummaryLine label='Taken back from' value={`${monthLabel(deductionMonth)} salary`} />
          </div>
          {button}
        </div>
      }
      bar={
        <div className='flex items-center gap-3'>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-[11px] font-semibold uppercase tracking-wider text-subtle'>{person ? staffName(person) : 'Advance'}</p>
            <CountUp value={Number(amount) || 0} format={money} className='block truncate text-lg font-bold tracking-tight text-fg' />
          </div>
          <div className='w-40 shrink-0'>{button}</div>
        </div>
      }
    >
      {head}
      <EntrySection title='Who and how much'>
        <Field label='Staff member' error={errors.staff}>
          {({ invalid }) => (
            <StaffPicker
              staff={staff}
              loading={staffLoading}
              value={staffId}
              invalid={invalid}
              onChange={s => {
                setStaffId(s?.id || '')
                setErrors(e => ({ ...e, staff: undefined }))
              }}
            />
          )}
        </Field>
        <div className='mt-4 grid gap-4 sm:grid-cols-2'>
          <Field label='Amount' error={errors.amount}>
            {({ id, invalid }) => (
              <MoneyInput
                id={id}
                currency={currency}
                value={amount}
                invalid={invalid}
                onValueChange={v => {
                  setAmount(v)
                  if (Number(v) > 0) setErrors(e => ({ ...e, amount: undefined }))
                }}
              />
            )}
          </Field>
          <Field label='Given on'>{() => <DatePicker size='lg' value={when} onChange={setDate} max={today} />}</Field>
        </div>
        <p className='mb-2 mt-4 text-xs font-semibold text-muted'>Kind</p>
        <div className='flex flex-wrap gap-2'>
          {ADVANCE_TYPES.map(t => (
            <Chip key={t.value} on={type === t.value} onClick={() => setType(t.value)}>
              {t.label}
            </Chip>
          ))}
        </div>
        <Field label='Reason (optional)' className='mt-4'>
          {({ id }) => <Textarea id={id} rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder='What is it for?' />}
        </Field>
      </EntrySection>

      <EntrySection title='Taken back from which salary'>
        <div className='flex flex-wrap gap-2'>
          {monthsFrom(when).map(m => (
            <Chip key={m} on={deductionMonth === m} onClick={() => setMonth(m)}>
              {monthLabel(m)}
            </Chip>
          ))}
        </div>
        <p className='mt-2 text-xs text-muted'>Payroll for that month takes it off the pay.</p>
      </EntrySection>

      <EntrySection title='Paid from'>
        <PaidFromChoice value={office} onChange={setOffice} tillNote='Cash in hand goes down' bankNote='The bank goes down' />
        {manager && (
          <Field label='Internal note (optional)' className='mt-4'>
            {({ id }) => <Textarea id={id} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder='Only managers see this' />}
          </Field>
        )}
      </EntrySection>
    </EntryLayout>
  )
}

// ─── Staff loan ───────────────────────────────────────────────────────────────
function LoanForm ({ head, staff, staffLoading, companyId, branchId, manager, money, currency }) {
  const today = useBusinessToday()
  const [staffId, setStaffId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [preset, setPreset] = useState(6)
  const [custom, setCustom] = useState(null) // null = a preset; else the typed number of months
  const [startMonth, setStartMonth] = useState(null) // null = the month of the date
  const [reason, setReason] = useState('')
  const [office, setOffice] = useState('front')
  const [notes, setNotes] = useState('')
  const [migration, setMigration] = useState(false)
  const [alreadyPaidMonths, setAlreadyPaidMonths] = useState(0)
  const [errors, setErrors] = useState({})
  const [saved, setSaved] = useState(false)
  const [addStaffLoan, { isLoading }] = useAddStaffLoanMutation()

  const when = date || today
  const firstMonth = startMonth || ym(when)
  const person = staff.find(s => s.id === staffId)
  const total = Number(amount) || 0
  const typed = Number(custom)
  const customOk = Number.isInteger(typed) && typed >= 1 && typed <= MAX_LOAN_MONTHS
  // 0 while the custom box holds no usable number: no schedule until it does
  const duration = custom === null ? preset : customOk ? typed : 0
  const alreadyPaid = migration ? Math.max(0, Math.min(alreadyPaidMonths, duration - 1)) : 0

  // the instalments, as the server will create them
  const schedule = useMemo(() => {
    if (!(total > 0) || !duration) return []
    return loanSplit(total, duration).map((amount, i) => ({
      month: format(addMonths(parseISO(`${firstMonth}-01`), i), 'MMM yyyy'),
      amount,
      paid: i < alreadyPaid
    }))
  }, [duration, firstMonth, total, alreadyPaid])
  const emi = schedule[0]?.amount || 0

  const save = async () => {
    const problems = {}
    if (!staffId) problems.staff = 'Who is it for?'
    if (!(total > 0)) problems.amount = 'Enter the amount'
    if (!reason.trim()) problems.reason = 'Say what the loan is for'
    if (!duration) problems.months = `Enter 1 to ${MAX_LOAN_MONTHS} months`
    setErrors(problems)
    if (Object.keys(problems).length) return toast.error('Check the highlighted fields')

    const createdBy = getSessionUser() || {}
    const flow = newRequestFields({ type: 'staffLoan', amount: total }, createdBy)
    const given = flow.status === 'approved'
    try {
      await addStaffLoan({
        companyId,
        branchId,
        data: {
          staffId: person?.id || '',
          staffName: staffName(person),
          amount: total,
          durationMonths: duration,
          alreadyPaidMonths: alreadyPaid, // API uses this to pre-mark installments
          reason,
          date: when,
          repaymentStartDate: `${firstMonth}-01`,
          paidFromOffice: office,
          source: migration ? 'migration' : 'new',
          approvalNotes: manager ? notes : '',
          ...flow,
          // Approved by the person entering it = paid now. A migration loan was paid
          // out before the app (it never counts as cash here, but payroll deducts it).
          paidOut: given || migration ? { date: when, from: office, by: payerOf(createdBy), ...(migration ? { migrated: true } : {}) } : null,
          createdBy
        }
      }).unwrap()
      toast.success(migration ? 'Earlier loan recorded' : given ? 'Loan given' : 'Request sent', {
        description: `${staffName(person)} · ${money(total)} over ${duration} months${migration ? ' · no cash moved' : ''}`
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 1400)
      setStaffId('')
      setAmount('')
      setReason('')
      setNotes('')
      setStartMonth(null)
      setPreset(6)
      setCustom(null)
      setMigration(false)
      setAlreadyPaidMonths(0)
      setOffice('front')
    } catch (err) {
      console.error(err)
      toast.error("Couldn't save the loan", { description: err?.message || 'Check your connection and try again.' })
    }
  }

  const label = migration ? 'Record earlier loan' : manager ? 'Give loan' : 'Send request'
  const button = (
    <Button size='lg' className='w-full' onClick={save} loading={isLoading} success={saved}>
      {label}
    </Button>
  )

  return (
    <EntryLayout
      aside={
        <div className='space-y-4'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-[0.12em] text-subtle'>Staff loan</p>
            <CountUp value={total} format={money} className='mt-1 block text-3xl font-bold tracking-tight text-fg' />
            <p className='mt-0.5 truncate text-xs text-muted'>{person ? staffName(person) : 'Choose a staff member'}</p>
          </div>
          <div className='space-y-2 border-t border-line pt-3'>
            <SummaryLine label='Each month' value={emi ? `${money(emi)} × ${duration}` : '—'} />
            <SummaryLine label='First instalment' value={monthLabel(firstMonth)} />
            <SummaryLine label='From' value={migration ? 'Given before the app' : office === 'back' ? 'The bank' : 'The till'} />
          </div>
          {button}
        </div>
      }
      bar={
        <div className='flex items-center gap-3'>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-[11px] font-semibold uppercase tracking-wider text-subtle'>{emi ? `${money(emi)} × ${duration}` : 'Staff loan'}</p>
            <CountUp value={total} format={money} className='block truncate text-lg font-bold tracking-tight text-fg' />
          </div>
          <div className='w-40 shrink-0'>{button}</div>
        </div>
      }
    >
      {head}
      <EntrySection title='Who and how much'>
        <Field label='Staff member' error={errors.staff}>
          {({ invalid }) => (
            <StaffPicker
              staff={staff}
              loading={staffLoading}
              value={staffId}
              invalid={invalid}
              onChange={s => {
                setStaffId(s?.id || '')
                setErrors(e => ({ ...e, staff: undefined }))
              }}
            />
          )}
        </Field>
        <div className='mt-4 grid gap-4 sm:grid-cols-2'>
          <Field label='Loan amount' error={errors.amount}>
            {({ id, invalid }) => (
              <MoneyInput
                id={id}
                currency={currency}
                value={amount}
                invalid={invalid}
                onValueChange={v => {
                  setAmount(v)
                  if (Number(v) > 0) setErrors(e => ({ ...e, amount: undefined }))
                }}
              />
            )}
          </Field>
          <Field label='Given on'>{() => <DatePicker size='lg' value={when} onChange={setDate} max={today} />}</Field>
        </div>
        <Field label='What it is for' error={errors.reason} className='mt-4'>
          {({ id, invalid }) => (
            <Textarea
              id={id}
              invalid={invalid}
              rows={2}
              value={reason}
              onChange={e => {
                setReason(e.target.value)
                if (e.target.value.trim()) setErrors(x => ({ ...x, reason: undefined }))
              }}
              placeholder={migration ? 'e.g. Took RM 900 in January, RM 600 already paid back by hand' : 'Purpose of the loan'}
            />
          )}
        </Field>
      </EntrySection>

      <EntrySection title='Paying it back'>
        <p className='mb-2 text-xs font-semibold text-muted'>Over how many months</p>
        <div className='flex flex-wrap gap-2'>
          {LOAN_DURATIONS.map(n => (
            <Chip
              key={n}
              on={custom === null && preset === n}
              onClick={() => {
                setPreset(n)
                setCustom(null)
                setErrors(e => ({ ...e, months: undefined }))
              }}
            >
              {n} months
            </Chip>
          ))}
          <Chip on={custom !== null} onClick={() => custom === null && setCustom('')}>
            Custom
          </Chip>
        </div>
        {/* any other number of months, typed in */}
        {custom !== null && (
          <Field label='Number of months' error={errors.months} className='mt-3 max-w-48'>
            {({ id, invalid }) => (
              <Input
                id={id}
                size='lg'
                type='number'
                inputMode='numeric'
                min={1}
                max={MAX_LOAN_MONTHS}
                step={1}
                autoFocus
                invalid={invalid || (custom !== '' && !customOk)}
                value={custom}
                placeholder={`1 – ${MAX_LOAN_MONTHS}`}
                onChange={e => {
                  setCustom(e.target.value.replace(/[^0-9]/g, ''))
                  setErrors(x => ({ ...x, months: undefined }))
                }}
              />
            )}
          </Field>
        )}
        <p className='mb-2 mt-4 text-xs font-semibold text-muted'>First instalment from</p>
        <div className='flex flex-wrap gap-2'>
          {monthsFrom(when).map(m => (
            <Chip key={m} on={firstMonth === m} onClick={() => setStartMonth(m)}>
              {monthLabel(m)}
            </Chip>
          ))}
        </div>

        {/* a loan given before the app: no cash moves, some instalments may be paid */}
        <div className={cn('mt-5 rounded-2xl border p-3.5 transition-colors', migration ? 'border-warning/40 bg-warning-soft/60' : 'border-line')}>
          <div className='flex items-start gap-3'>
            <History className={cn('mt-0.5 size-4 shrink-0', migration ? 'text-warning' : 'text-subtle')} />
            <div className='min-w-0 flex-1'>
              <p className='text-sm font-semibold text-fg'>Given before using this app</p>
              <p className='text-xs text-muted'>Only tracks what is left to pay back — no cash moves today.</p>
            </div>
            <Switch checked={migration} onChange={setMigration} aria-label='Given before using this app' />
          </div>
          <AnimatePresence initial={false}>
            {migration && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className='overflow-hidden'>
                <p className='mb-2 mt-3 text-xs font-semibold text-muted'>Instalments already paid back</p>
                <div className='flex flex-wrap gap-2'>
                  {Array.from({ length: duration }, (_, i) => i).map(n => (
                    <Chip key={n} on={alreadyPaid === n} onClick={() => setAlreadyPaidMonths(n)}>
                      {n === 0 ? 'None' : n}
                    </Chip>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* the schedule */}
        {schedule.length > 0 && (
          <div className='mt-5 overflow-hidden rounded-2xl border border-line'>
            <ol className='max-h-56 divide-y divide-line overflow-y-auto'>
              {schedule.map((r, i) => (
                <motion.li
                  key={r.month}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.03 }}
                  className={cn('flex items-center gap-3 px-3.5 py-2 text-sm', r.paid && 'bg-success-soft/50')}
                >
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                      r.paid ? 'bg-success text-white' : 'bg-surface-2 text-muted'
                    )}
                  >
                    {r.paid ? '✓' : i + 1}
                  </span>
                  <span className={cn('flex-1', r.paid ? 'text-muted line-through' : 'text-fg')}>{r.month}</span>
                  {i === schedule.length - 1 && !r.paid && <span className='rounded-full bg-surface-2 px-2 py-px text-[10px] font-semibold text-muted'>last</span>}
                  <span className={cn('font-semibold tabular-nums', r.paid ? 'text-muted' : 'text-fg')}>{money(r.amount)}</span>
                </motion.li>
              ))}
            </ol>
            <div className='flex items-center justify-between border-t border-line bg-surface-2/60 px-3.5 py-2 text-sm'>
              <span className='text-muted'>{alreadyPaid ? `${alreadyPaid} already paid back` : 'Total'}</span>
              <span className='font-bold tabular-nums text-fg'>{money(total)}</span>
            </div>
          </div>
        )}
      </EntrySection>

      <EntrySection title={migration ? 'It was given from' : 'Paid from'}>
        <PaidFromChoice
          value={office}
          onChange={setOffice}
          tillNote={migration ? 'Cash, back then' : 'Cash in hand goes down'}
          bankNote={migration ? 'Bank, back then' : 'The bank goes down'}
        />
        {manager && (
          <Field label='Internal note (optional)' className='mt-4'>
            {({ id }) => <Textarea id={id} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder='Only managers see this' />}
          </Field>
        )}
      </EntrySection>
    </EntryLayout>
  )
}

/**
 * Advances and staff loans. A branch admin or manager gives them here (paid
 * now, from the till or the bank); anyone else sends a request. On top: the
 * approved ones still waiting to be handed over.
 */
export default function AdvanceLoanEntry () {
  const { user, role, companyId, branchId } = useSession()
  const currency = useCurrency()
  const money = v => formatMoney(v, currency)
  const [tab, setTab] = useState('advance')
  const { data: staff = [], isLoading: staffLoading } = useGetStaffListQuery({ companyId, branchId }, { skip: !companyId || !branchId })
  const manager = can(role, 'advances.approve') // approvers record one handed over on the spot

  const head = <Head companyId={companyId} branchId={branchId} user={user} manager={manager} tab={tab} setTab={setTab} />
  const props = { head, staff, staffLoading, companyId, branchId, manager, money, currency }
  return tab === 'advance' ? <AdvanceForm key='advance' {...props} /> : <LoanForm key='loan' {...props} />
}

