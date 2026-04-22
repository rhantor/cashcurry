/* eslint-disable react/prop-types */
'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { skipToken } from '@reduxjs/toolkit/query'
import {
  useGetPayrollRunsQuery,
  useGetPayrollSlipsQuery,
  useDeletePayrollRunMutation,
} from '@/lib/redux/api/payrollRunApiSlice'
import { fmtAmt, periodLabel } from '@/utils/payrollCalculations'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR = {
  draft:     'bg-yellow-100 text-yellow-700',
  finalized: 'bg-blue-100 text-blue-700',
  paid:      'bg-green-100 text-green-700',
}

function Badge ({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${STATUS_COLOR[status] || 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  )
}

function fmt (iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Slips drawer (expandable) ────────────────────────────────────────────────

function SlipsDrawer ({ companyId, branchId, runId }) {
  const { data: slips = [], isLoading } = useGetPayrollSlipsQuery(
    companyId && branchId && runId ? { companyId, branchId, runId } : skipToken
  )

  if (isLoading) return <p className='text-xs text-gray-400 py-3 text-center'>Loading slips…</p>
  if (slips.length === 0) return <p className='text-xs text-gray-400 py-3 text-center'>No slips saved yet.</p>

  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-xs'>
        <thead>
          <tr className='bg-gray-50 text-gray-500 uppercase tracking-wide text-[10px]'>
            <th className='px-3 py-2 text-left font-semibold'>Staff</th>
            <th className='px-3 py-2 text-right font-semibold'>Gross</th>
            <th className='px-3 py-2 text-right font-semibold'>Deductions</th>
            <th className='px-3 py-2 text-right font-semibold'>Net Pay</th>
            <th className='px-3 py-2 text-right font-semibold'>Employer</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-gray-100'>
          {slips.map(slip => (
            <tr key={slip.id} className='hover:bg-gray-50 transition-colors'>
              <td className='px-3 py-2 font-medium text-gray-800'>{slip.staffName}</td>
              <td className='px-3 py-2 text-right text-gray-700'>{fmtAmt(slip.grossEarnings)}</td>
              <td className='px-3 py-2 text-right text-red-600'>{fmtAmt(slip.totalDeductions)}</td>
              <td className='px-3 py-2 text-right font-semibold text-mint-700'>{fmtAmt(slip.netPay)}</td>
              <td className='px-3 py-2 text-right text-blue-600'>{fmtAmt(slip.totalStatutoryEmployer || 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className='bg-gray-50 font-semibold text-gray-700 text-[11px]'>
            <td className='px-3 py-2'>Totals</td>
            <td className='px-3 py-2 text-right'>{fmtAmt(slips.reduce((s, sl) => s + (sl.grossEarnings || 0), 0))}</td>
            <td className='px-3 py-2 text-right text-red-600'>{fmtAmt(slips.reduce((s, sl) => s + (sl.totalDeductions || 0), 0))}</td>
            <td className='px-3 py-2 text-right text-mint-700'>{fmtAmt(slips.reduce((s, sl) => s + (sl.netPay || 0), 0))}</td>
            <td className='px-3 py-2 text-right text-blue-600'>{fmtAmt(slips.reduce((s, sl) => s + (sl.totalStatutoryEmployer || 0), 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Run row ──────────────────────────────────────────────────────────────────

function RunRow ({ run, companyId, branchId, isAdminOrManager }) {
  const [expanded, setExpanded] = useState(false)
  const [deleteDraft] = useDeletePayrollRunMutation()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete () {
    if (!confirm('Delete this draft run?')) return
    setDeleting(true)
    try {
      await deleteDraft({ companyId, branchId, runId: run.id }).unwrap()
    } catch (e) {
      alert(e.message || 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className='bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden'>
      {/* Run header row */}
      <div
        className='flex flex-wrap items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors gap-3'
        onClick={() => setExpanded(e => !e)}
      >
        <div className='flex items-center gap-3'>
          <span className='text-sm font-semibold text-gray-800'>{periodLabel(run.period)}</span>
          <Badge status={run.status} />
        </div>

        <div className='flex items-center gap-6 text-sm'>
          <span className='text-gray-500'>{run.staffCount || 0} staff</span>
          <span className='text-gray-500'>
            Gross <strong>{fmtAmt(run.totalGross)}</strong>
          </span>
          <span className='text-gray-500'>
            Net <strong className='text-mint-700'>{fmtAmt(run.totalNet)}</strong>
          </span>
          {run.status === 'paid' && (
            <span className='text-gray-400 text-xs'>{fmt(run.paidAt)}</span>
          )}
        </div>

        <div className='flex items-center gap-2'>
          {run.status === 'draft' && isAdminOrManager && (
            <>
              <Link
                href='/payroll'
                onClick={e => e.stopPropagation()}
                className='text-xs px-3 py-1.5 rounded-lg bg-mint-50 text-mint-700 border border-mint-200 font-medium hover:bg-mint-100 transition-colors'
              >
                Continue
              </Link>
              <button
                onClick={e => { e.stopPropagation(); handleDelete() }}
                disabled={deleting}
                className='text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 font-medium hover:bg-red-50 transition-colors disabled:opacity-50'
              >
                {deleting ? '…' : 'Delete'}
              </button>
            </>
          )}
          <span className='text-gray-400 text-lg leading-none'>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Slips table */}
      {expanded && (
        <div className='border-t border-gray-100'>
          <SlipsDrawer companyId={companyId} branchId={branchId} runId={run.id} />
        </div>
      )}

      {/* Payment details (paid runs) */}
      {expanded && run.status === 'paid' && (run.paymentMethod || run.paymentReference) && (
        <div className='border-t border-gray-100 px-5 py-3 bg-green-50 text-xs text-gray-600 flex gap-6'>
          {run.paymentMethod    && <span>Method: <strong>{run.paymentMethod}</strong></span>}
          {run.paymentReference && <span>Ref: <strong>{run.paymentReference}</strong></span>}
          {run.paidAt           && <span>Paid: <strong>{fmt(run.paidAt)}</strong></span>}
        </div>
      )}
    </div>
  )
}

// ─── Main PayrollHistory ──────────────────────────────────────────────────────

export default function PayrollHistory () {
  const [companyId, setCompanyId] = useState(null)
  const [branchId,  setBranchId]  = useState(null)
  const [role, setRole] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || '{}')
    setCompanyId(u.companyId || null)
    setBranchId(u.branchId  || null)
    setRole(u.role || null)
    setAuthReady(true)
  }, [])

  const skip = !companyId || !branchId
  const { data: runs = [], isLoading } = useGetPayrollRunsQuery(
    skip ? skipToken : { companyId, branchId }
  )

  const isAdminOrManager = role === 'branchAdmin' || role === 'manager'

  const filtered = statusFilter === 'all'
    ? runs
    : runs.filter(r => r.status === statusFilter)

  if (!authReady) {
    return (
      <div className='flex items-center justify-center min-h-[50vh]'>
        <p className='text-gray-400 text-sm'>Loading…</p>
      </div>
    )
  }

  if (!isAdminOrManager) {
    return (
      <div className='flex items-center justify-center min-h-[50vh]'>
        <p className='text-gray-500 font-semibold'>Access restricted to branchAdmin and manager.</p>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-[var(--color-background)] p-4 md:p-8 pb-16'>
      <div className='max-w-4xl mx-auto space-y-6'>

        {/* Header */}
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>Payroll History</h1>
            <p className='text-sm text-gray-500 mt-0.5'>All payroll runs for this branch.</p>
          </div>
          <Link
            href='/payroll'
            className='px-4 py-2 rounded-xl bg-mint-500 hover:bg-mint-600 text-white text-sm font-semibold transition-colors'
          >
            + New Payroll Run
          </Link>
        </div>

        {/* Status filter */}
        <div className='flex gap-2'>
          {['all', 'draft', 'finalized', 'paid'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors capitalize ${
                statusFilter === s
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        {/* Runs list */}
        {isLoading ? (
          <p className='text-sm text-gray-400 text-center py-12'>Loading payroll history…</p>
        ) : filtered.length === 0 ? (
          <div className='text-center py-16'>
            <p className='text-gray-400 font-medium'>No payroll runs found.</p>
            <Link href='/payroll' className='mt-3 inline-block text-mint-600 text-sm font-medium underline'>
              Create your first payroll run
            </Link>
          </div>
        ) : (
          <div className='space-y-3'>
            {filtered.map(run => (
              <RunRow
                key={run.id}
                run={run}
                companyId={companyId}
                branchId={branchId}
                isAdminOrManager={isAdminOrManager}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
