'use client'
import React, { useMemo, useState } from 'react'
import { useGetStaffLoansQuery, useEditStaffLoanTermsMutation } from '@/lib/redux/api/staffLoanApiSlice'
import LoanTermsModal from '@/app/components/common/LoanTermsModal'
import useCurrency from '@/app/hooks/useCurrency'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUser () {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
}

function progressPct (loan) {
  const total = (loan.installments || []).length
  const paid  = (loan.installments || []).filter(i => i.status === 'paid').length
  return total > 0 ? Math.round((paid / total) * 100) : 0
}

function nextPendingInstallment (loan) {
  return (loan.installments || [])
    .filter(i => i.status === 'pending')
    .sort((a, b) => a.month.localeCompare(b.month))[0] || null
}

const STATUS_COLORS = {
  approved: 'bg-green-100 text-green-700 border-green-200',
  pending:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  closed:   'bg-gray-100 text-gray-500 border-gray-200',
  rejected: 'bg-red-100 text-red-600 border-red-200',
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard ({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 border-blue-100 text-blue-700',
    green:  'bg-green-50 border-green-100 text-green-700',
    orange: 'bg-orange-50 border-orange-100 text-orange-700',
    gray:   'bg-gray-50 border-gray-200 text-gray-600',
  }
  return (
    <div className={`rounded-xl border px-4 py-3 ${colors[color]}`}>
      <p className='text-xs font-medium text-gray-500 mb-0.5'>{label}</p>
      <p className={`text-xl font-bold ${colors[color].split(' ')[2]}`}>{value}</p>
      {sub && <p className='text-[11px] text-gray-400 mt-0.5'>{sub}</p>}
    </div>
  )
}

// ─── Installment Row ──────────────────────────────────────────────────────────

function InstallmentRow ({ inst }) {
  return (
    <div className={`flex items-center justify-between px-3 py-1.5 text-xs rounded-lg ${
      inst.status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'
    }`}>
      <span className='flex items-center gap-2'>
        <span className='w-5 h-5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-semibold text-[10px]'>
          {inst.index}
        </span>
        <span className='font-medium'>{inst.month}</span>
        {inst.note && <span className='text-[10px] text-amber-600 italic'>{inst.note}</span>}
      </span>
      <span className='flex items-center gap-2'>
        <span className='font-semibold'>{inst.amount?.toLocaleString()}</span>
        {inst.status === 'paid'
          ? <span className='text-green-600 text-[10px] font-semibold'>✓ Paid</span>
          : <span className='text-gray-400 text-[10px]'>Pending</span>
        }
      </span>
    </div>
  )
}

// ─── Loan Card (expandable) ───────────────────────────────────────────────────

function LoanCard ({ loan, currency, onEditTerms, canEdit }) {
  const [expanded, setExpanded] = useState(false)
  const pct      = progressPct(loan)
  const nextInst = nextPendingInstallment(loan)
  const paidCount   = (loan.installments || []).filter(i => i.status === 'paid').length
  const totalCount  = (loan.installments || []).length
  const isMigration = loan.source === 'migration'

  return (
    <div className='bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden'>
      {/* Card header */}
      <div
        className='px-4 py-3 flex items-start justify-between cursor-pointer hover:bg-gray-50 transition-colors'
        onClick={() => setExpanded(v => !v)}
      >
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2 flex-wrap'>
            <span className='font-semibold text-gray-800 text-sm truncate'>{loan.staffName}</span>
            {isMigration && (
              <span className='px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200'>
                Migration
              </span>
            )}
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${STATUS_COLORS[loan.status] || STATUS_COLORS.pending}`}>
              {loan.status}
            </span>
          </div>

          <div className='flex items-center gap-3 mt-1 flex-wrap'>
            <span className='text-xs text-gray-500'>
              {isMigration && loan.originalAmount
                ? <><span className='text-gray-400 line-through mr-1'>{currency} {loan.originalAmount?.toLocaleString()}</span>{currency} {loan.amount?.toLocaleString()} remaining</>
                : <>{currency} {loan.amount?.toLocaleString()}</>
              }
            </span>
            <span className='text-xs text-gray-400'>·</span>
            <span className='text-xs text-gray-500'>{loan.durationMonths} mo · {currency} {loan.emi?.toLocaleString()} EMI</span>
            <span className='text-xs text-gray-400'>·</span>
            <span className='text-xs text-gray-500'>{paidCount}/{totalCount} paid</span>
          </div>

          {/* Progress bar */}
          <div className='mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden w-full max-w-xs'>
            <div
              className={`h-full rounded-full transition-all ${loan.status === 'closed' ? 'bg-gray-400' : 'bg-green-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className='flex items-center gap-3 ml-3 shrink-0'>
          {nextInst && (
            <div className='text-right hidden sm:block'>
              <p className='text-[10px] text-gray-400'>Next EMI</p>
              <p className='text-xs font-semibold text-gray-700'>{nextInst.month}</p>
              <p className='text-xs font-semibold text-blue-600'>{currency} {nextInst.amount?.toLocaleString()}</p>
            </div>
          )}
          <span className={`text-gray-400 text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className='px-4 pb-4 border-t border-gray-50'>
          <div className='grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 mb-3'>
            <div className='bg-gray-50 rounded-lg p-2 text-center'>
              <p className='text-[10px] text-gray-400'>Total Loan</p>
              <p className='text-xs font-bold text-gray-700'>{currency} {loan.amount?.toLocaleString()}</p>
            </div>
            <div className='bg-green-50 rounded-lg p-2 text-center'>
              <p className='text-[10px] text-gray-400'>Total Paid</p>
              <p className='text-xs font-bold text-green-700'>{currency} {(loan.totalPaid || 0).toLocaleString()}</p>
            </div>
            <div className='bg-orange-50 rounded-lg p-2 text-center'>
              <p className='text-[10px] text-gray-400'>Remaining</p>
              <p className='text-xs font-bold text-orange-700'>{currency} {(loan.remainingAmount || 0).toLocaleString()}</p>
            </div>
            <div className='bg-blue-50 rounded-lg p-2 text-center'>
              <p className='text-[10px] text-gray-400'>Progress</p>
              <p className='text-xs font-bold text-blue-700'>{pct}%</p>
            </div>
          </div>

          {loan.reason && (
            <p className='text-xs text-gray-500 mb-3 italic'>Reason: {loan.reason}</p>
          )}

          {/* Installment schedule */}
          <p className='text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5'>
            Installment Schedule
          </p>
          <div className='space-y-1 max-h-52 overflow-y-auto pr-1'>
            {(loan.installments || []).map(inst => (
              <InstallmentRow key={inst.index} inst={inst} />
            ))}
          </div>

          {/* Edit terms button */}
          {canEdit && loan.status !== 'closed' && (
            <button
              onClick={e => { e.stopPropagation(); onEditTerms(loan) }}
              className='mt-3 text-xs font-semibold text-mint-700 hover:text-mint-900 border border-mint-200 hover:border-mint-400 px-3 py-1.5 rounded-lg transition-colors'
            >
              Edit Terms / Defer Installment
            </button>
          )}

          {/* Term edit history */}
          {loan.termEdits?.length > 0 && (
            <div className='mt-3'>
              <p className='text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1'>Edit History</p>
              <div className='space-y-1'>
                {loan.termEdits.map((e, i) => (
                  <div key={i} className='text-[11px] text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5'>
                    <span className='font-medium'>{e.editedBy?.username || 'Manager'}</span>
                    {' · '}
                    {e.editedAt ? new Date(e.editedAt).toLocaleDateString() : ''}
                    {e.note && <span className='block italic text-gray-400'>"{e.note}"</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StaffLoansPage () {
  const user      = getUser()
  const companyId = user.companyId
  const branchId  = user.branchId
  const role      = user.role

  const currency = useCurrency()

  const canEdit = ['owner', 'gm', 'superAdmin', 'branchAdmin', 'manager'].includes(role)

  const { data: loanList = [], isLoading, isError } = useGetStaffLoansQuery(
    { companyId, branchId },
    { skip: !companyId || !branchId, refetchOnMountOrArgChange: true }
  )

  const [editStaffLoanTerms, { isLoading: saving }] = useEditStaffLoanTermsMutation()
  const [editTarget, setEditTarget] = useState(null)

  // ── Filters ────────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState('')
  const [statusFilter, setStatusFilter] = useState('active') // 'all' | 'active' | 'closed'

  // ── Derived lists ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = loanList
    if (statusFilter === 'active')  list = list.filter(l => l.status !== 'closed' && l.status !== 'rejected')
    if (statusFilter === 'closed')  list = list.filter(l => l.status === 'closed')
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(l =>
        (l.staffName || '').toLowerCase().includes(q) ||
        (l.reason    || '').toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      // Active loans first, then by remaining amount desc
      if (a.status === 'closed' && b.status !== 'closed') return 1
      if (a.status !== 'closed' && b.status === 'closed') return -1
      return (b.remainingAmount || 0) - (a.remainingAmount || 0)
    })
  }, [loanList, statusFilter, search])

  // ── Summary stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = loanList.filter(l => l.status !== 'closed' && l.status !== 'rejected')
    const uniqueStaff = new Set(active.map(l => l.staffId || l.staffName)).size
    const totalOutstanding = active.reduce((s, l) => s + (l.remainingAmount || 0), 0)
    const totalLoaned      = active.reduce((s, l) => s + (l.amount || 0), 0)
    const totalPaid        = active.reduce((s, l) => s + (l.totalPaid || 0), 0)
    return { uniqueStaff, totalOutstanding, totalLoaned, totalPaid, activeCount: active.length }
  }, [loanList])

  // ── Edit terms handler ─────────────────────────────────────────────────────
  async function handleSaveTerms (changes, note) {
    if (!editTarget) return
    await editStaffLoanTerms({
      companyId,
      branchId,
      loanId:     editTarget.id,
      changes,
      managerNote: note,
      editedBy:   { uid: user.uid, username: user.username, role: user.role },
    }).unwrap()
    setEditTarget(null)
  }

  // ── Group by staff for "by staff" view ─────────────────────────────────────
  const [viewMode, setViewMode] = useState('loans') // 'loans' | 'staff'

  const byStaff = useMemo(() => {
    const map = new Map()
    for (const l of filtered) {
      const key = l.staffId || l.staffName
      if (!map.has(key)) {
        map.set(key, { staffId: key, staffName: l.staffName, loans: [], totalRemaining: 0, totalAmount: 0 })
      }
      const g = map.get(key)
      g.loans.push(l)
      g.totalRemaining += l.remainingAmount || 0
      g.totalAmount    += l.amount || 0
    }
    return [...map.values()].sort((a, b) => b.totalRemaining - a.totalRemaining)
  }, [filtered])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className='min-h-screen bg-gray-50 p-4 sm:p-6'>
      <div className='max-w-4xl mx-auto space-y-4'>

        {/* Page title */}
        <div className='flex items-center justify-between flex-wrap gap-2'>
          <div>
            <h1 className='text-xl font-bold text-gray-800'>Staff Loans</h1>
            <p className='text-xs text-gray-500 mt-0.5'>Track all staff loan balances and repayment schedules</p>
          </div>
        </div>

        {/* Stats */}
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
          <StatCard
            label='Staff with Loans'
            value={stats.uniqueStaff}
            sub={`${stats.activeCount} active loans`}
            color='blue'
          />
          <StatCard
            label='Total Outstanding'
            value={`${currency} ${stats.totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            sub='remaining to collect'
            color='orange'
          />
          <StatCard
            label='Total Loaned'
            value={`${currency} ${stats.totalLoaned.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            sub='across active loans'
            color='gray'
          />
          <StatCard
            label='Total Recovered'
            value={`${currency} ${stats.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            sub='paid via payroll'
            color='green'
          />
        </div>

        {/* Controls */}
        <div className='flex flex-col sm:flex-row gap-2'>
          {/* Search */}
          <input
            type='text'
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='Search by staff name or reason…'
            className='flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-mint-400 outline-none bg-white'
          />

          {/* Status filter */}
          <div className='flex gap-1 bg-white border border-gray-200 rounded-xl p-1'>
            {[
              { key: 'active', label: 'Active' },
              { key: 'closed', label: 'Closed' },
              { key: 'all',    label: 'All' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setStatusFilter(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === opt.key
                    ? 'bg-mint-500 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className='flex gap-1 bg-white border border-gray-200 rounded-xl p-1'>
            {[
              { key: 'loans', label: 'By Loan' },
              { key: 'staff', label: 'By Staff' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setViewMode(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  viewMode === opt.key
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading / Error */}
        {isLoading && (
          <div className='text-center py-10 text-gray-400 text-sm'>Loading loans…</div>
        )}
        {isError && (
          <div className='text-center py-10 text-red-500 text-sm'>Failed to load loans. Please refresh.</div>
        )}

        {/* ── By Loan view ── */}
        {!isLoading && !isError && viewMode === 'loans' && (
          <div className='space-y-2'>
            {filtered.length === 0 && (
              <div className='text-center py-10 text-gray-400 text-sm'>No loans found.</div>
            )}
            {filtered.map(loan => (
              <LoanCard
                key={loan.id}
                loan={loan}
                currency={currency}
                canEdit={canEdit}
                onEditTerms={setEditTarget}
              />
            ))}
          </div>
        )}

        {/* ── By Staff view ── */}
        {!isLoading && !isError && viewMode === 'staff' && (
          <div className='space-y-3'>
            {byStaff.length === 0 && (
              <div className='text-center py-10 text-gray-400 text-sm'>No loans found.</div>
            )}
            {byStaff.map(group => (
              <div key={group.staffId} className='bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden'>
                {/* Staff header */}
                <div className='px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between'>
                  <div>
                    <p className='font-semibold text-gray-800 text-sm'>{group.staffName}</p>
                    <p className='text-xs text-gray-500'>{group.loans.length} loan{group.loans.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className='text-right'>
                    <p className='text-xs text-gray-400'>Outstanding</p>
                    <p className='text-sm font-bold text-orange-600'>
                      {currency} {group.totalRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Loans for this staff */}
                <div className='divide-y divide-gray-50'>
                  {group.loans.map(loan => (
                    <LoanCard
                      key={loan.id}
                      loan={loan}
                      currency={currency}
                      canEdit={canEdit}
                      onEditTerms={setEditTarget}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Terms Modal */}
      {editTarget && (
        <LoanTermsModal
          type='loan'
          record={editTarget}
          saving={saving}
          onClose={() => setEditTarget(null)}
          onSave={handleSaveTerms}
        />
      )}
    </div>
  )
}
