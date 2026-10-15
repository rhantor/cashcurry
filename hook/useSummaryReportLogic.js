/* eslint-disable no-case-declarations */
import { useMemo } from 'react'
import { endOfWeek, format, parseISO, startOfWeek, subDays } from 'date-fns'
import { makeFilterText } from '@/utils/export/exportSummary'
import { skipToken } from '@reduxjs/toolkit/query'
import useResolvedCompanyBranch from '@/utils/useResolvedCompanyBranch'
import { useGetBranchSettingsQuery } from '@/lib/redux/api/branchSettingsApiSlice'
import { useGetSalesEntriesQuery } from '@/lib/redux/api/salesApiSlice'
import { useGetCostEntriesQuery } from '@/lib/redux/api/costApiSlice'
import { useGetAdvanceEntriesQuery } from '@/lib/redux/api/AdvanceApiSlice'
import { useGetStaffLoansQuery } from '@/lib/redux/api/staffLoanApiSlice'
import { useGetDepositEntryQuery } from '@/lib/redux/api/depositApiSlice'
import { useGetLoanActivitiesQuery } from '@/lib/redux/api/loanApiSlice'
import { useGetBranchesBasicQuery, useGetSingleBranchQuery } from '@/lib/redux/api/branchApiSlice'
import { useGetSalaryEntriesQuery } from '@/lib/redux/api/salaryApiSlice'
import { useGetWithdrawEntriesQuery } from '@/lib/redux/api/cashWithdrawApiSlice'
import { useGetCompanyDetailsQuery } from '@/lib/redux/api/authApiSlice'
import { buildLedger } from '@/lib/finance/ledger'
import { useBusinessToday } from '@/app/hooks/useRegion'
import {
  num, isPaidFromTill, saleDay, costDay, advanceDay, staffLoanDay, depositDay,
  salaryDay, withdrawalDay, branchLoanMovements,
} from '@/lib/finance/rules'

// --- 1. Static Helper Functions ---

const extractSalesNotes = (sale, keys) => {
  const out = {}
  if (sale?.notes && typeof sale.notes === 'object') {
    keys.forEach(k => {
      const v = sale.notes[k]
      if (v && String(v).trim()) (out[k] ||= []).push(String(v).trim())
    })
  }
  keys.forEach(k => {
    const v = sale?.[`${k}Note`]
    if (v && String(v).trim()) (out[k] ||= []).push(String(v).trim())
  })
  return out
}

const mergeNotes = (acc, next) => {
  const out = { ...acc }
  Object.entries(next || {}).forEach(([k, arr]) => {
    if (!arr?.length) return
    out[k] = [...(out[k] || []), ...arr]
  })
  return out
}

// --- 2. The Hook ---

export const useSummaryReportLogic = (filterState, summaryMode, overrideBranchId = null) => {
  const resolved = useResolvedCompanyBranch()
  const companyId = resolved.companyId
  const branchId = overrideBranchId || resolved.branchId
  const ready = resolved.ready

  const baseArgs =
    ready && companyId && branchId ? { companyId, branchId } : null

  // Queries
  const { data: settings } = useGetBranchSettingsQuery(
    baseArgs ? baseArgs : skipToken
  )
  const { data: sales = [], isLoading: loadingSales } = useGetSalesEntriesQuery(
    baseArgs ? baseArgs : skipToken
  )
  const { data: costs = [], isLoading: loadingCosts } = useGetCostEntriesQuery(
    baseArgs ? baseArgs : skipToken
  )
  const { data: advances = [], isLoading: loadingAdvances } = useGetAdvanceEntriesQuery(
    baseArgs ? baseArgs : skipToken
  )
  const { data: staffLoans = [], isLoading: loadingStaffLoans } = useGetStaffLoansQuery(
    baseArgs ? baseArgs : skipToken
  )
  const { data: deposits = [], isLoading: loadingDeposits } = useGetDepositEntryQuery(
    baseArgs ? baseArgs : skipToken
  )
  const { data: salaries = [], isLoading: loadingSalaries } = useGetSalaryEntriesQuery(
    baseArgs ? baseArgs : skipToken
  )
  const { data: withdrawals = [], isLoading: loadingWithdrawals } = useGetWithdrawEntriesQuery(
    baseArgs ? baseArgs : skipToken
  )
  const { data: loanActs = [], isLoading: loadingLoanActs } = useGetLoanActivitiesQuery(
    baseArgs
      ? { ...baseArgs, direction: 'all', status: 'approved', type: 'all', pageLimit: 0 } // every loan: cash needs the full history
      : skipToken
  )
  const { data: branches = [] } = useGetBranchesBasicQuery(companyId || skipToken)
  const { data: currentBranch } = useGetSingleBranchQuery(
    baseArgs ? baseArgs : skipToken
  )

  // `ready` only reports company/branch resolution — the queries above are still
  // in flight after it flips, so consumers that render totals need this instead.
  // Otherwise a fully-zeroed table flashes before the real numbers arrive.
  const isLoading =
    !ready ||
    loadingSales ||
    loadingCosts ||
    loadingAdvances ||
    loadingStaffLoans ||
    loadingDeposits ||
    loadingSalaries ||
    loadingWithdrawals ||
    loadingLoanActs
  const { data: company } = useGetCompanyDetailsQuery(companyId ?? skipToken)

  const companyName = company?.name || 'Unknown Company'
  const getBranchName = id =>
    branches?.find(b => b.id === id)?.name || id
  const branchName =
    currentBranch?.name ||
    settings?.basic?.name ||
    getBranchName(branchId)

  // "Today" is the branch's business date (its clock, after the day cut-off).
  const businessToday = useBusinessToday()

  // Date Range Logic
  const dateRange = useMemo(() => {
    const today = parseISO(businessToday)
    let from = subDays(today, 6)
    let to = today

    const parseYyyyMm = ym => {
      const [y, m] = (ym || '').split('-').map(Number)
      if (!y || !m) return null
      return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) }
    }

    switch (filterState.filterType) {
      case 'all': {
        // From the first to the last day anything was recorded.
        const collectDates = [
          ...sales.map(saleDay),
          ...costs.map(costDay),
          ...advances.map(advanceDay),
          ...staffLoans.map(staffLoanDay),
          ...deposits.map(depositDay),
          ...salaries.map(salaryDay),
          ...withdrawals.map(withdrawalDay),
          ...branchLoanMovements(loanActs, branchId).map(m => m.day),
        ].filter(Boolean)
        if (collectDates.length) {
          collectDates.sort()
          from = parseISO(collectDates[0])
          to = parseISO(collectDates[collectDates.length - 1])
        }
        break
      }
      case 'weekly':
        from = startOfWeek(today, { weekStartsOn: 1 })
        to = endOfWeek(today, { weekStartsOn: 1 })
        break
      case 'monthly':
      case 'thisMonth':
        from = new Date(today.getFullYear(), today.getMonth(), 1)
        to = today
        break
      case 'lastMonth':
        from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        to = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case 'month':
        const picked = parseYyyyMm(filterState.selectedMonth)
        if (picked) {
          from = picked.from
          to = picked.to
        }
        break
      case 'range':
        from = filterState.dateRange.from
          ? parseISO(filterState.dateRange.from)
          : from
        to = filterState.dateRange.to ? parseISO(filterState.dateRange.to) : to
        break
      case 'last7days':
      default:
        from = subDays(today, 6)
        to = today
        break
    }
    return { from, to }
  }, [
    filterState,
    sales,
    costs,
    advances,
    staffLoans,
    deposits,
    salaries,
    withdrawals,
    loanActs,
    branchId,
    businessToday
  ])

  // --- Money: one cash book from the shared finance engine ---
  const ledger = useMemo(
    () =>
      buildLedger({
        branchId,
        settings,
        records: { sales, costs, advances, staffLoans, deposits, salaries, withdrawals, loanActivities: loanActs },
        from: format(dateRange.from, 'yyyy-MM-dd'),
        to: format(dateRange.to, 'yyyy-MM-dd'),
      }),
    [branchId, settings, sales, costs, advances, staffLoans, deposits, salaries, withdrawals, loanActs, dateRange]
  )

  const tenderDefs = ledger.tenders.defs

  // --- Report rows: the ledger's days, laid out for the table and exports ---
  const computed = useMemo(() => {
    const { tenders, days, totals, broughtForward, closing } = ledger
    const tenderKeys = tenders.keys
    const rows = []

    rows.push({
      type: 'balance',
      label: 'Balance from Last Summary',
      runningCash: broughtForward.cash,
      runningBank: broughtForward.bank,
      date: ledger.from
    })

    for (const day of days) {
      const d = day.date
      const { runningCash, runningBank } = day
      const rec = day.records

      const notesByTender = rec.sales.reduce(
        (acc, s) => mergeNotes(acc, extractSalesNotes(s, tenderKeys)),
        {}
      )
      const salesNotesText = tenderKeys
        .filter(k => notesByTender[k]?.length)
        .map(k => `${tenders.byKey.get(k)?.label || k}: ${notesByTender[k].join(' | ')}`)
        .join(' • ')

      rows.push({
        type: 'daily',
        date: d,
        tenders: day.tenders,
        // Raw entries for consumers that break costs down by category; the
        // costCash/costBank split below stays the source of truth for cash flow.
        costEntries: rec.costs,
        advance: day.advance,
        staffLoanGiven: day.staffLoanGiven,
        cost: day.costCash + day.costBank,
        costCash: day.costCash,
        costBank: day.costBank,
        salary: day.salaryCash + day.salaryBank,
        salaryCash: day.salaryCash,
        salaryBank: day.salaryBank,
        loanGiven: day.loanGiven,
        loanReceived: day.loanReceived,
        repayCashIn: day.repayCashIn,
        repayCashOut: day.repayCashOut,
        repayBankIn: day.repayBankIn,
        repayBankOut: day.repayBankOut,
        deposit: day.deposit,
        withdrawal: day.withdrawal,
        totalSales: day.totalSales,
        runningCash,
        runningBank,
        salesNotesByTender: notesByTender,
        salesNotesText
      })

      if (salesNotesText)
        rows.push({
          type: 'salesNote',
          date: d,
          label: `Sales Notes (${d})`,
          notesByTender,
          notesText: salesNotesText,
          runningCash
        })

      rec.loans.filter(l => l.type === 'loan').forEach(l =>
        rows.push({
          type: 'loan',
          date: d,
          label:
            l.role === 'lender'
              ? `Loan Provided to ${l.requestFrom || getBranchName(l.fromBranchId)}`
              : `Loan Received from ${l.requestedTo || getBranchName(l.toBranchId)}`,
          amount: l.amount,
          role: l.role,
          method: l.paymentMethod,
          reason: l.reason || null,
          runningCash
        })
      )

      rec.loans.filter(l => l.type === 'repayment').forEach(r =>
        rows.push({
          type: 'repayment',
          date: d,
          label:
            r.role === 'lender'
              ? `Repayment Received (${r.paymentMethod})`
              : `Repayment Paid (${r.paymentMethod})`,
          amount: r.amount,
          role: r.role,
          method: r.paymentMethod || '-',
          runningCash
        })
      )

      rec.deposits.forEach(dep =>
        rows.push({ type: 'deposit', date: d, label: 'Cash Deposit', amount: num(dep.amount), runningCash })
      )
      rec.withdrawals.forEach(wd =>
        rows.push({ type: 'withdraw', date: d, label: 'Cash Withdrawal', amount: num(wd.amount), runningCash })
      )
      rec.advances.filter(isPaidFromTill).forEach(a =>
        rows.push({
          type: 'staffAdvance',
          date: d,
          label: `Staff Advance${a.staffName ? ` — ${a.staffName}` : ''}`,
          amount: num(a.amount),
          runningCash
        })
      )
      rec.staffLoans.filter(isPaidFromTill).forEach(l =>
        rows.push({
          type: 'staffLoan',
          date: d,
          label: `Staff Loan${l.staffName ? ` — ${l.staffName}` : ''}`,
          amount: num(l.amount),
          runningCash
        })
      )
    }

    const handInCash = closing.cash
    const bankBalance = closing.bank

    return {
      rows,
      kpis: {
        totalSales: totals.totalSales,
        handInCash,
        bankBalance,
        // Grab/Foodpanda not yet paid out still belong to the business.
        netTotal: handInCash + bankBalance + totals.deliveryUnbanked,
        foodDelivery: totals.deliveryTotal,
        totalCostFront: totals.costCash,
        totalCostBack: totals.costBank,
        totalCashSales: totals.cashSales,
        totalAdvances: totals.advance,
        totalLoanGiven: totals.loanGiven,
        totalBankedSales: totals.bankedSales,
        periodDeposits: totals.deposit,
        periodWithdrawals: totals.withdrawal,
      },
      periodTotals: totals.tenders,
      periodTotalSales: totals.totalSales,
      periodDeposits: totals.deposit,
      periodWithdrawals: totals.withdrawal,
      periodRepaySums: {
        cashIn: totals.repayCashIn,
        cashOut: totals.repayCashOut,
        bankIn: totals.repayBankIn,
        bankOut: totals.repayBankOut
      },
      tenderDefs
    }
  }, [ledger, tenderDefs, branches]) // `branches` feeds getBranchName in loan labels

  const filterBadgeText = makeFilterText(
    filterState.filterType,
    { from: dateRange.from, to: dateRange.to },
    filterState.selectedMonth
  )

  const finalSummary = useMemo(() => {
    if (summaryMode === 'front')
      return {
        label: 'Hand In Cash',
        value: computed.kpis.handInCash,
        tone: 'green'
      }
    if (summaryMode === 'back')
      return { label: 'Bank Balance', value: computed.kpis.bankBalance, tone: 'blue' }
    return { label: 'Net Total', value: computed.kpis.netTotal, tone: 'purple' }
  }, [summaryMode, computed])

  return {
    ready,
    isLoading,
    branchName,
    companyName,
    computed,
    tenderDefs,
    finalSummary,
    filterBadgeText,
    commonMeta: {
      companyName,
      branchName,
      currency: settings?.financeSales?.currency || 'RM',
      filterText: filterBadgeText,
      filterDateFrom: dateRange.from,
      filterDateTo: dateRange.to,
      mode: summaryMode,
      generatedAt: new Date().toLocaleString(),
      finalSummary,
      externalKpis: computed.kpis,
      title: branchName + ' Summary Report'
    }
  }
}
