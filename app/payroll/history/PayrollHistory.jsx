'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { skipToken } from '@reduxjs/toolkit/query'
import {
  useGetPayrollRunsQuery,
  useGetPayrollSlipsQuery,
  useDeletePayrollRunMutation,
} from '@/lib/redux/api/payrollRunApiSlice'
import { periodLabel } from '@/utils/payrollCalculations'
import { useGetBranchSettingsQuery } from '@/lib/redux/api/branchSettingsApiSlice'
import { useGetCompanyDetailsQuery } from '@/lib/redux/api/authApiSlice'
import { useGetSingleBranchQuery } from '@/lib/redux/api/branchApiSlice'
import { useGetStaffListQuery } from '@/lib/redux/api/staffApiSlice'
import PayrollPrintView from '../components/PayrollPrintView'
import { getSessionUser } from '@/lib/session'
import { toast, confirmDialog } from "@/app/components/ui/notify";
import { format } from 'date-fns'
import { CalendarDays, ChevronDown, Clock, Lock, Pencil, Plus, Printer, Trash2, Wallet } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Skeleton, Tabs, cn } from '@/app/components/ui'
import StatTiles from '@/app/components/purchases/StatTiles'
import StatusScreen from '@/app/components/common/StatusScreen'
import useCurrency from '@/app/hooks/useCurrency'
import { formatMoney } from '@/lib/region/currency'


// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS = {
  draft:     { tone: 'warning', label: 'Draft' },
  finalized: { tone: 'info',    label: 'Finalized' },
  paid:      { tone: 'success', label: 'Paid' },
}

function fmt (iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(+d) ? '—' : format(d, 'd MMM yyyy')
}

// ─── Slips (shown when a run is opened) ───────────────────────────────────────

function SlipsDrawer ({ companyId, branchId, runId, run, setPrintTarget, money }) {
  const { data: slips = [], isLoading } = useGetPayrollSlipsQuery(
    companyId && branchId && runId ? { companyId, branchId, runId } : skipToken
  )
  const { data: staffList = [] } = useGetStaffListQuery(
    companyId && branchId ? { companyId, branchId } : skipToken
  )

  const staffMap = {}
  for (const s of staffList) {
    staffMap[s.id] = `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.name || s.staffName || ''
  }

  const enrichedSlips = slips.map(slip => ({
    ...slip,
    staffName: slip.staffName || staffMap[slip.staffId] || 'Former staff'
  }))

  if (isLoading) return <div className='space-y-2 p-4'><Skeleton className='h-10' /><Skeleton className='h-10' /></div>
  if (enrichedSlips.length === 0) return <p className='p-4 text-center text-xs text-subtle'>No payslips saved yet.</p>

  const sum = k => enrichedSlips.reduce((s, sl) => s + (Number(sl[k]) || 0), 0)

  return (
    <div>
      <div className='flex items-center justify-between gap-2 px-4 py-2.5'>
        <p className='text-xs text-muted'>{enrichedSlips.length} payslip{enrichedSlips.length === 1 ? '' : 's'}</p>
        <Button size='sm' variant='secondary' icon={Printer} onClick={() => setPrintTarget({ mode: 'all', slips: enrichedSlips, run })}>
          Print all
        </Button>
      </div>
      <ul className='divide-y divide-line border-t border-line'>
        {enrichedSlips.map(slip => (
          <li key={slip.id} className='flex items-center gap-3 px-4 py-2.5'>
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-medium text-fg'>{slip.staffName}</p>
              <p className='truncate text-[11px] text-muted'>
                Gross {money(slip.grossEarnings)}
                {Number(slip.totalDeductions) > 0 && <> · <span className='text-danger'>− {money(slip.totalDeductions)}</span></>}
                {Number(slip.totalStatutoryEmployer) > 0 && <> · employer {money(slip.totalStatutoryEmployer)}</>}
              </p>
            </div>
            <span className='shrink-0 text-sm font-bold tabular-nums text-fg'>{money(slip.netPay)}</span>
            <button
              type='button'
              onClick={() => setPrintTarget({ mode: 'single', slip, slips: enrichedSlips, run })}
              aria-label={`Print the payslip for ${slip.staffName}`}
              className='flex size-8 shrink-0 items-center justify-center rounded-lg text-subtle hover:bg-surface-2 hover:text-fg'
            >
              <Printer className='size-4' />
            </button>
          </li>
        ))}
      </ul>
      <div className='flex items-center justify-between gap-3 border-t border-line bg-surface-2/60 px-4 py-2.5 text-sm font-semibold'>
        <span className='text-muted'>Net pay in all</span>
        <span className='tabular-nums text-fg'>{money(sum('netPay'))}</span>
      </div>
    </div>
  )
}

// ─── One run ──────────────────────────────────────────────────────────────────

function RunRow ({ run, companyId, branchId, isAdminOrManager, setPrintTarget, money }) {
  const [expanded, setExpanded] = useState(false)
  const [deleteDraft] = useDeletePayrollRunMutation()
  const [deleting, setDeleting] = useState(false)
  const st = STATUS[run.status] || { tone: 'neutral', label: run.status }

  async function handleDelete () {
    if (!(await confirmDialog({ title: 'Delete this draft payroll run?', message: 'Nothing has been paid from it; the draft and its slips are removed.', danger: true }))) return
    setDeleting(true)
    try {
      await deleteDraft({ companyId, branchId, runId: run.id }).unwrap()
      toast.success('Draft deleted')
    } catch (e) {
      toast.error(e.message || 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className={cn('overflow-hidden transition-colors', expanded && 'border-brand/40')}>
      <div className='flex items-center gap-3 p-4'>
        <button type='button' onClick={() => setExpanded(e => !e)} aria-expanded={expanded} className='flex min-w-0 flex-1 items-center gap-3 text-left'>
          <span className='min-w-0 flex-1'>
            <span className='flex items-center gap-2'>
              <span className='truncate text-sm font-semibold text-fg'>{periodLabel(run.period)}</span>
              <Badge tone={st.tone}>{st.label}</Badge>
            </span>
            <span className='mt-0.5 block truncate text-[11px] text-muted'>
              {run.staffCount || 0} staff · gross {money(run.totalGross)}
              {run.status === 'paid' && ` · paid ${fmt(run.paidAt)}${run.paymentMethod ? ` by ${run.paymentMethod}` : ''}`}
            </span>
          </span>
          <span className='shrink-0 text-right'>
            <span className='block text-base font-bold tabular-nums text-fg'>{money(run.totalNet)}</span>
            <span className='block text-[11px] text-subtle'>net pay</span>
          </span>
          <ChevronDown className={cn('size-4 shrink-0 text-subtle transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>

      {expanded && (
        <div className='border-t border-line'>
          {run.status === 'draft' && isAdminOrManager && (
            <div className='flex flex-wrap gap-2 px-4 pt-3'>
              <Link href={`/payroll?period=${run.period}`} className='inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold text-brand-fg hover:brightness-105'>
                <Pencil className='size-3.5' /> Carry on with it
              </Link>
              <Button size='sm' variant='ghost' icon={Trash2} loading={deleting} className='text-danger hover:bg-danger-soft' onClick={handleDelete}>
                Delete draft
              </Button>
            </div>
          )}
          {run.status === 'paid' && run.paymentReference && <p className='px-4 pt-3 text-xs text-muted'>Reference: <b className='text-fg'>{run.paymentReference}</b></p>}
          <SlipsDrawer companyId={companyId} branchId={branchId} runId={run.id} run={run} setPrintTarget={setPrintTarget} money={money} />
        </div>
      )}
    </Card>
  )
}

// ─── Main PayrollHistory ──────────────────────────────────────────────────────

export default function PayrollHistory () {
  const [companyId, setCompanyId] = useState(null)
  const [branchId,  setBranchId]  = useState(null)
  const [role, setRole] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [printTarget, setPrintTarget] = useState(null)
  const currency = useCurrency()
  const money = n => formatMoney(Number(n) || 0, currency)

  useEffect(() => {
    const u = (getSessionUser() || {})
    setCompanyId(u.companyId || null)
    setBranchId(u.branchId  || null)
    setRole(u.role || null)
    setAuthReady(true)
  }, [])

  const skip = !companyId || !branchId
  const { data: runs = [], isLoading } = useGetPayrollRunsQuery(
    skip ? skipToken : { companyId, branchId }
  )
  const { data: branchSettings } = useGetBranchSettingsQuery(skip ? skipToken : { companyId, branchId })
  const { data: companyData }    = useGetCompanyDetailsQuery(companyId ?? skipToken)
  const { data: branchDoc }      = useGetSingleBranchQuery(skip ? skipToken : { companyId, branchId })

  const companyName = companyData?.name || ''
  const branchName  = branchDoc?.name || branchSettings?.basic?.name || 'Branch'

  const isAdminOrManager = role === 'branchAdmin' || role === 'manager'

  const sorted = [...runs].sort((a, b) => String(b.period).localeCompare(String(a.period)))
  const filtered = statusFilter === 'all' ? sorted : sorted.filter(r => r.status === statusFilter)
  const count = s => runs.filter(r => r.status === s).length
  const paidRuns = runs.filter(r => r.status === 'paid')
  const year = String(new Date().getFullYear())
  const paidThisYear = paidRuns.filter(r => String(r.period).startsWith(year)).reduce((n, r) => n + (Number(r.totalNet) || 0), 0)

  if (!authReady) return <Skeleton className='m-6 h-64' rounded='rounded-2xl' />

  if (!isAdminOrManager) {
    return (
      <StatusScreen
        full={false}
        icon={Lock}
        tone='warning'
        title='Payroll is for branch admins and managers'
        message='Ask your branch admin if you need a payslip.'
        actions={[{ label: 'Go home', href: '/', primary: true }]}
      />
    )
  }

  return (
    <div className='mx-auto max-w-4xl space-y-4 px-4 py-5'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight text-fg'>Payroll history</h1>
          <p className='text-sm text-muted'>Every month&apos;s payroll for this branch. Open one to see its payslips.</p>
        </div>
        <Link href='/payroll' className='inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-fg shadow-sm hover:brightness-105'>
          <Plus className='size-4' /> Run payroll
        </Link>
      </div>

      {runs.length > 0 && (
        <StatTiles
          tiles={[
            { label: `Net pay paid in ${year}`, value: money(paidThisYear), note: `${paidRuns.filter(r => String(r.period).startsWith(year)).length} month(s) paid`, icon: Wallet, tone: 'bg-brand-soft text-brand' },
            { label: 'Waiting to be paid', value: String(count('finalized')), note: 'Finalized, not yet paid', icon: Clock, tone: count('finalized') ? 'bg-info-soft text-info' : 'bg-surface-2 text-muted' },
            { label: 'Drafts', value: String(count('draft')), note: 'Still being filled in', icon: Pencil, tone: count('draft') ? 'bg-warning-soft text-warning' : 'bg-surface-2 text-muted' },
          ]}
        />
      )}

      <Tabs
        value={statusFilter}
        onChange={setStatusFilter}
        className='max-w-full overflow-x-auto'
        tabs={[
          { value: 'all', label: `All ${runs.length}` },
          { value: 'draft', label: `Draft ${count('draft')}` },
          { value: 'finalized', label: `Finalized ${count('finalized')}` },
          { value: 'paid', label: `Paid ${count('paid')}` },
        ]}
      />

      {isLoading ? (
        <div className='space-y-3'><Skeleton className='h-20' rounded='rounded-2xl' /><Skeleton className='h-20' rounded='rounded-2xl' /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarDays}
            title={runs.length ? 'Nothing here' : 'No payroll yet'}
            description={runs.length ? 'No month has that status.' : 'Run the first month’s payroll and it shows here.'}
            action={!runs.length && (
              <Link href='/payroll' className='inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-fg'>Run payroll</Link>
            )}
          />
        </Card>
      ) : (
        <div className='space-y-3'>
          {filtered.map(run => (
            <RunRow
              key={run.id}
              run={run}
              companyId={companyId}
              branchId={branchId}
              isAdminOrManager={isAdminOrManager}
              setPrintTarget={setPrintTarget}
              money={money}
            />
          ))}
        </div>
      )}

      {printTarget && (
        <PayrollPrintView
          mode={printTarget.mode}
          singleSlip={printTarget.slip}
          slips={printTarget.slips}
          run={printTarget.run}
          branchName={branchName}
          companyName={companyName}
          period={printTarget.run?.period}
          onClose={() => setPrintTarget(null)}
        />
      )}
    </div>
  )
}
