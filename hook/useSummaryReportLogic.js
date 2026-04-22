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

// --- 1. Static Helper Functions ---

const N = v => (v ? Number(v) : 0)

const tsToMs = v => {
  if (!v) return 0
  if (typeof v === 'number') return v
  if (v?.seconds) return v.seconds * 1000
  const ms = Date.parse(v)
  return Number.isNaN(ms) ? 0 : ms
}

const pickActivityDate = e => {
  const prefer =
    e.payDate || e.paymentDate || e.repayDate || e.loanDate || e.date
  const msPref = Date.parse(prefer || '')
  if (!Number.isNaN(msPref)) return format(new Date(msPref), 'yyyy-MM-dd')
  const ms =
    tsToMs(e.createdAt) || tsToMs(e.updatedAt) || Date.parse(e.date || '')
  return format(new Date(ms || Date.now()), 'yyyy-MM-dd')
}

const isCashCost = c => {
  const office = String(c?.paidFromOffice || '').toLowerCase()
  const method = String(c?.paidMethod || c?.method || '').toLowerCase()
  return office === 'front' || method === 'cash'
}
const isBankCost = c => !isCashCost(c)

const isCashMethod = m => {
  const x = String(m || '')
    .trim()
    .toLowerCase()
  if (!x) return true
  return /(cash|hand\s*cash|cash-in-hand|voucher|petty)/i.test(x)
}

const pickSalaryDate = s => {
  const prefer =
    s.paymentDate || s.date || s.payDate || s.createdAt || s.monthEnd || s.month
  const ms =
    (typeof prefer === 'string' ? Date.parse(prefer) : tsToMs(prefer)) ||
    Date.now()
  return format(new Date(ms), 'yyyy-MM-dd')
}
const getSalaryAmount = s =>
  N(s.totalSalary ?? s.amount ?? s.total ?? s.total_amount ?? 0)

const pickWithdrawDate = w => {
  const prefer = w.date || w.withdrawDate || w.createdAt
  const ms =
    (typeof prefer === 'string' ? Date.parse(prefer) : tsToMs(prefer)) ||
    Date.now()
  return format(new Date(ms), 'yyyy-MM-dd')
}
const getWithdrawAmount = w => N(w.amount)

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

export const useSummaryReportLogic = (filterState, summaryMode) => {
  const { ready, companyId, branchId } = useResolvedCompanyBranch()
  const baseArgs =
    ready && companyId && branchId ? { companyId, branchId } : null

  // Queries
  const { data: settings } = useGetBranchSettingsQuery(
    baseArgs ? baseArgs : skipToken
  )
  const { data: sales = [] } = useGetSalesEntriesQuery(
    baseArgs ? baseArgs : skipToken
  )
  const { data: costs = [] } = useGetCostEntriesQuery(
    baseArgs ? baseArgs : skipToken
  )
  const { data: advanceEntries = [] } = useGetAdvanceEntriesQuery(
    baseArgs ? baseArgs : skipToken
  )
  const { data: staffLoans = [] } = useGetStaffLoansQuery(
    baseArgs ? baseArgs : skipToken
  )
  // Merge staff loans into advances for cash-flow calculation.
  // Staff loans use the issue date (loan.date) as the cash-out date,
  // same shape as advances: { date, amount, paidFromOffice }
  const advances = [
    ...advanceEntries,
    // Migration loans (source === 'migration') had no cash given out by this office —
    // the money was paid before the app was adopted, so exclude them from cash flow.
    ...staffLoans
      .filter(l => l.source !== 'migration')
      .map(l => ({
        id:             l.id,
        date:           l.date,
        amount:         l.amount,
        staffName:      l.staffName || '',
        paidFromOffice: l.paidFromOffice || 'front',
        _source:        'staffLoan',
      })),
  ]
  const { data: deposits = [] } = useGetDepositEntryQuery(
    baseArgs ? baseArgs : skipToken
  )
  const { data: salaries = [] } = useGetSalaryEntriesQuery(
    baseArgs ? baseArgs : skipToken
  )
  const { data: withdrawals = [] } = useGetWithdrawEntriesQuery(
    baseArgs ? baseArgs : skipToken
  )
  const { data: loanActs = [] } = useGetLoanActivitiesQuery(
    baseArgs
      ? { ...baseArgs, direction: 'all', status: 'approved', type: 'all' }
      : skipToken
  )
  const { data: branches = [] } = useGetBranchesBasicQuery(companyId || skipToken)
  const { data: currentBranch } = useGetSingleBranchQuery(
    baseArgs ? baseArgs : skipToken
  )
  const { data: company } = useGetCompanyDetailsQuery(companyId ?? skipToken)

  const companyName = company?.name || 'Unknown Company'
  const getBranchName = id =>
    branches?.find(b => b.id === id)?.name || id
  const branchName =
    currentBranch?.name ||
    settings?.basic?.name ||
    getBranchName(branchId)

  // Tender Config
  const tenderDefs = useMemo(() => {
    const list = settings?.financeSales?.tenders || []
    return list
      .filter(t => t.enabled !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [settings])

  const tenderKeys = useMemo(() => tenderDefs.map(t => t.key), [tenderDefs])

  const tenderByKey = useMemo(() => {
    const m = new Map()
    tenderDefs.forEach(t => m.set(t.key, t))
    return m
  }, [tenderDefs])

  const isBankedTender = key => !!tenderByKey.get(key)?.banked
  const includeInTotal = key => tenderByKey.get(key)?.includeInTotal !== false

  const deliveryKeys = useMemo(() => {
    const explicit = tenderDefs.filter(t => t.delivery).map(t => t.key)
    if (explicit.length > 0) return explicit
    return ['grab', 'foodpanda'].filter(k => tenderByKey.has(k))
  }, [tenderDefs, tenderByKey])

  // Normalized Loans
  const normalized = useMemo(
    () =>
      (loanActs || [])
        .map(e => {
          const typ = String(e.type || '').toLowerCase()
          const from =
            e._fromBranchId ?? e.fromBranchId ?? e.requestFromBranchId
          const to = e._toBranchId ?? e.toBranchId ?? e.requestedToBranchId
          const rawMethod = String(
            e.paymentMethod || e.method || ''
          ).toLowerCase()
          const dateStr = pickActivityDate(e)

          let role = 'other'
          if (to === branchId) role = 'lender'
          else if (from === branchId) role = 'borrower'

          let cashDelta = 0
          let bankDelta = 0
          const amt = N(e.amount)

          if (typ === 'loan') {
            if (role === 'lender') cashDelta -= amt
            else if (role === 'borrower') cashDelta += amt
          } else if (typ === 'repayment') {
            const cash = isCashMethod(rawMethod)
            if (role === 'lender') {
              if (cash) cashDelta += amt
              else bankDelta += amt
            } else if (role === 'borrower') {
              if (cash) cashDelta -= amt
              else bankDelta -= amt
            }
          }

          return {
            id: e.id,
            type: typ,
            amount: amt,
            paymentMethod: typ === 'loan' ? 'cash (forced)' : rawMethod || '-',
            fromBranchId: from,
            toBranchId: to,
            requestFrom: e.requestFrom || null,
            requestedTo: e.requestedTo || null,
            reason: e.reason || null,
            dateStr,
            role,
            cashDelta,
            bankDelta
          }
        })
        .filter(x => x.role !== 'other' && x.dateStr),
    [loanActs, branchId]
  )

  // Date Range Logic
  const dateRange = useMemo(() => {
    const today = new Date()
    let from = subDays(today, 6)
    let to = today

    const parseYyyyMm = ym => {
      const [y, m] = (ym || '').split('-').map(Number)
      if (!y || !m) return null
      return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) }
    }

    switch (filterState.filterType) {
      case 'all': {
        const collectDates = []
        sales.forEach(s => s?.date && collectDates.push(s.date))
        costs.forEach(c => c?.date && collectDates.push(c.date))
        advances.forEach(a => a?.date && collectDates.push(a.date))
        deposits.forEach(d => d?.date && collectDates.push(d.date))
        ;(salaries || []).forEach(s => collectDates.push(pickSalaryDate(s)))
        ;(withdrawals || []).forEach(w =>
          collectDates.push(pickWithdrawDate(w))
        )
        normalized.forEach(x => x?.dateStr && collectDates.push(x.dateStr))
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
    deposits,
    salaries,
    withdrawals,
    normalized
  ])

  // --- CALCULATION LOOP ---
  const computed = useMemo(() => {
    const fromStr = format(dateRange.from, 'yyyy-MM-dd')
    const toStr = format(dateRange.to, 'yyyy-MM-dd')
    const inRange = d => d >= fromStr && d <= toStr

    // Initial Balances
    const initialCash = N(
      settings?.initialCash ?? settings?.financeSales?.openingBalance ?? 0
    )
    const initialBankBalance = N(settings?.financeSales?.openingBankBalance ?? 0)

    const preSalesCash = sales
      .filter(s => s.date < fromStr)
      .reduce((sum, s) => sum + N(s.cash), 0)
    const preCostsCash = costs
      .filter(c => c.date < fromStr && isCashCost(c))
      .reduce((sum, c) => sum + N(c.amount), 0)
    // isSalaryCash: checks payMethod (new payroll entries) then paidFromOffice (legacy manual entries)
    const isSalaryCash = s => {
      const m = String(s.payMethod || '').toLowerCase()
      if (m === 'bank' || m === 'bank_transfer' || m === 'cheque') return false
      return String(s?.paidFromOffice || 'front').toLowerCase() !== 'back'
    }
    const preSalariesCash = (salaries || [])
      .filter(s => pickSalaryDate(s) < fromStr && isSalaryCash(s))
      .reduce((sum, s) => sum + getSalaryAmount(s), 0)
    const preSalariesBank = (salaries || [])
      .filter(s => pickSalaryDate(s) < fromStr && !isSalaryCash(s))
      .reduce((sum, s) => sum + getSalaryAmount(s), 0)
    const isAdvanceCashPre = a => String(a?.paidFromOffice || 'front').toLowerCase() !== 'back'
    const preAdvances = advances
      .filter(a => a.date < fromStr && isAdvanceCashPre(a))
      .reduce((sum, a) => sum + N(a.amount), 0)
    const preDeposits = deposits
      .filter(d => d.date < fromStr)
      .reduce((s, d0) => s + N(d0.amount), 0)
    const preActsCashDelta = normalized
      .filter(x => x.dateStr < fromStr)
      .reduce((s, x) => s + (x.cashDelta || 0), 0)
    const preWithdrawals = (withdrawals || [])
      .filter(w => pickWithdrawDate(w) < fromStr)
      .reduce((s, w) => s + getWithdrawAmount(w), 0)

    let runningCash =
      initialCash +
      preSalesCash -
      preCostsCash -
      preSalariesCash -
      preAdvances +
      preActsCashDelta -
      preDeposits +
      preWithdrawals

    // Pre-period Bank Balance
    const preBankedTenders = tenderKeys.reduce((sum, k) => {
      if (!isBankedTender(k)) return sum
      return sum + sales.filter(s => s.date < fromStr).reduce((s2, sale) => s2 + N(sale[k]), 0)
    }, 0)
    const preBankCosts = costs
      .filter(c => c.date < fromStr && isBankCost(c))
      .reduce((s, c) => s + N(c.amount), 0)
    const preBankDeposits = deposits
      .filter(d => d.date < fromStr)
      .reduce((s, d) => s + N(d.amount), 0)
    const preBankActsDelta = normalized
      .filter(x => x.dateStr < fromStr)
      .reduce((s, x) => s + (x.bankDelta || 0), 0)
    const preBankWithdrawals = (withdrawals || [])
      .filter(w => pickWithdrawDate(w) < fromStr)
      .reduce((s, w) => s + getWithdrawAmount(w), 0)

    let runningBank =
      initialBankBalance +
      preBankedTenders +
      preBankDeposits +
      preBankActsDelta -
      preBankWithdrawals -
      preBankCosts -
      preSalariesBank  // was computed but never applied — pre-period bank salaries reduce opening bank

    const days =
      Math.floor(
        (dateRange.to.getTime() - dateRange.from.getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1
    const allDates = Array.from({ length: days }, (_, i) => {
      const d = new Date(dateRange.from)
      d.setDate(d.getDate() + i)
      return format(d, 'yyyy-MM-dd')
    })

    let periodDeposits = 0,
      periodWithdrawals = 0,
      totalCostFront = 0,
      totalCostBack = 0,
      periodBankLoanDelta = 0
    let periodRepayCashIn = 0,
      periodRepayCashOut = 0,
      periodRepayBankIn = 0,
      periodRepayBankOut = 0,
      periodTotalSales = 0

    // Explicit Accumulators for KPI
    let periodAdvances = 0
    let periodLoanGiven = 0
    let periodCashSales = 0 // <--- FIX: Track cash sales explicitly

    const periodTotals = Object.fromEntries(tenderKeys.map(k => [k, 0]))
    const rows = []

    rows.push({
      type: 'balance',
      label: 'Balance from Last Summary',
      runningCash,
      runningBank,
      date: fromStr
    })

    allDates.forEach(d => {
      const dailySales = sales.filter(s => s.date === d)
      const dailyCosts = costs.filter(c => c.date === d)
      const dailyAdvances = advances.filter(a => a.date === d)
      const dailyDeposits = deposits.filter(dep => dep.date === d)
      const dailySalaries = (salaries || []).filter(
        s => pickSalaryDate(s) === d
      )
      const dailyWithdrawals = (withdrawals || []).filter(
        w => pickWithdrawDate(w) === d
      )
      const dailyActs = normalized.filter(x => x.dateStr === d)
      const dailyLoans = dailyActs.filter(x => x.type === 'loan')
      const dailyRepays = dailyActs.filter(x => x.type === 'repayment')

      const tendersForDay = Object.fromEntries(
        tenderKeys.map(k => [k, dailySales.reduce((s, x) => s + N(x[k]), 0)])
      )
      const cashVal = N(tendersForDay.cash) // Explicit cash value

      // Split salary advances from staff loans; only front-office (cash) ones affect runningCash
      const isAdvanceCash = a => String(a?.paidFromOffice || 'front').toLowerCase() !== 'back'
      const dailySalaryAdvances = dailyAdvances.filter(a => a._source !== 'staffLoan')
      const dailyStaffLoans     = dailyAdvances.filter(a => a._source === 'staffLoan')
      const advance        = dailySalaryAdvances.filter(isAdvanceCash).reduce((s, x) => s + N(x.amount), 0)
      const staffLoanGiven = dailyStaffLoans.filter(isAdvanceCash).reduce((s, x) => s + N(x.amount), 0)

      const deposit = dailyDeposits.reduce((s, x) => s + N(x.amount), 0)
      const costCash = dailyCosts
        .filter(c => isCashCost(c))
        .reduce((s, x) => s + N(x.amount), 0)
      const costBank = dailyCosts
        .filter(c => isBankCost(c))
        .reduce((s, x) => s + N(x.amount), 0)
      const salaryCash = dailySalaries
        .filter(isSalaryCash)
        .reduce((s, x) => s + getSalaryAmount(x), 0)
      const salaryBank = dailySalaries
        .filter(s => !isSalaryCash(s))
        .reduce((s, x) => s + getSalaryAmount(x), 0)
      const withdrawalAmt = dailyWithdrawals.reduce(
        (s, x) => s + getWithdrawAmount(x),
        0
      )

      const loanGiven = dailyLoans
        .filter(l => l.role === 'lender')
        .reduce((s, x) => s + N(x.amount), 0)
      const loanReceived = dailyLoans
        .filter(l => l.role === 'borrower')
        .reduce((s, x) => s + N(x.amount), 0)

      const repayCashIn = dailyRepays
        .filter(r => r.role === 'lender' && isCashMethod(r.paymentMethod))
        .reduce((s, r) => s + N(r.amount), 0)
      const repayCashOut = dailyRepays
        .filter(r => r.role === 'borrower' && isCashMethod(r.paymentMethod))
        .reduce((s, r) => s + N(r.amount), 0)
      const repayBankIn = dailyRepays
        .filter(r => r.role === 'lender' && !isCashMethod(r.paymentMethod))
        .reduce((s, r) => s + N(r.amount), 0)
      const repayBankOut = dailyRepays
        .filter(r => r.role === 'borrower' && !isCashMethod(r.paymentMethod))
        .reduce((s, r) => s + N(r.amount), 0)

      const totalSales = tenderKeys.reduce(
        (sum, k) => sum + (includeInTotal(k) ? N(tendersForDay[k]) : 0),
        0
      )
      const dailyActsCashDelta = dailyActs.reduce(
        (s, x) => s + (x.cashDelta || 0),
        0
      )
      const dailyActsBankDelta = dailyActs.reduce(
        (s, x) => s + (x.bankDelta || 0),
        0
      )
      const dailyBankedTenders = tenderKeys.reduce(
        (sum, k) => sum + (isBankedTender(k) ? N(tendersForDay[k]) : 0),
        0
      )

      const notesByTender = dailySales.reduce(
        (acc, s) => mergeNotes(acc, extractSalesNotes(s, tenderKeys)),
        {}
      )
      const salesNotesText = tenderKeys
        .filter(k => notesByTender[k]?.length)
        .map(
          k =>
            `${tenderByKey.get(k)?.label || k}: ${notesByTender[k].join(' | ')}`
        )
        .join(' • ')

      runningCash =
        runningCash +
        cashVal -
        costCash -
        salaryCash -
        advance -
        staffLoanGiven -
        deposit +
        dailyActsCashDelta +
        withdrawalAmt

      runningBank =
        runningBank +
        dailyBankedTenders +
        deposit +
        dailyActsBankDelta -
        withdrawalAmt -
        costBank -
        salaryBank  // bank-transferred salaries reduce bank balance

      if (inRange(d)) {
        periodDeposits += deposit
        periodWithdrawals += withdrawalAmt
        totalCostFront += costCash
        totalCostBack += costBank  // bank salaries handled separately in runningBank, not counted as a cost
        tenderKeys.forEach(k => (periodTotals[k] += N(tendersForDay[k])))
        periodBankLoanDelta += dailyActsBankDelta
        periodRepayCashIn += repayCashIn
        periodRepayCashOut += repayCashOut
        periodRepayBankIn += repayBankIn
        periodRepayBankOut += repayBankOut
        periodTotalSales += totalSales

        // Accumulate for KPIs
        periodAdvances += advance
        periodLoanGiven += loanGiven
        periodCashSales += cashVal // <--- FIX: Accumulate here
      }

      rows.push({
        type: 'daily',
        date: d,
        tenders: tendersForDay,
        advance,
        staffLoanGiven,
        cost: costCash + costBank,
        costCash,
        costBank,
        salary: salaryCash + salaryBank,
        salaryCash,
        salaryBank,
        loanGiven,
        loanReceived,
        repayCashIn,
        repayCashOut,
        repayBankIn,
        repayBankOut,
        deposit,
        withdrawal: withdrawalAmt,
        totalSales,
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

      dailyLoans.forEach(l =>
        rows.push({
          type: 'loan',
          date: d,
          label:
            l.role === 'lender'
              ? `Loan Provided to ${l.requestFrom || getBranchName(l.fromBranchId)}`
              : `Loan Received from ${l.requestedTo || getBranchName(l.toBranchId)}`,
          amount: N(l.amount),
          role: l.role,
          method: l.paymentMethod,
          reason: l.reason || null,
          runningCash
        })
      )

      dailyRepays.forEach(r =>
        rows.push({
          type: 'repayment',
          date: d,
          label:
            r.role === 'lender'
              ? `Repayment Received (${r.paymentMethod})`
              : `Repayment Paid (${r.paymentMethod})`,
          amount: N(r.amount),
          role: r.role,
          method: r.paymentMethod || '-',
          runningCash
        })
      )

      dailyDeposits.forEach(dep =>
        rows.push({
          type: 'deposit',
          date: d,
          label: 'Cash Deposit',
          amount: N(dep.amount),
          runningCash
        })
      )
      dailyWithdrawals.forEach(wd =>
        rows.push({
          type: 'withdraw',
          date: d,
          label: 'Cash Withdrawal',
          amount: N(wd.amount),
          runningCash
        })
      )
      dailySalaryAdvances.filter(isAdvanceCash).forEach(a =>
        rows.push({
          type: 'staffAdvance',
          date: d,
          label: `Staff Advance${a.staffName ? ` — ${a.staffName}` : ''}`,
          amount: N(a.amount),
          runningCash
        })
      )
      dailyStaffLoans.filter(isAdvanceCash).forEach(l =>
        rows.push({
          type: 'staffLoan',
          date: d,
          label: `Staff Loan${l.staffName ? ` — ${l.staffName}` : ''}`,
          amount: N(l.amount),
          runningCash
        })
      )
    })

    const handInCash = runningCash
    const bankBalance = runningBank
    const totalBankedSales = tenderKeys.reduce(
      (s, k) => s + (isBankedTender(k) ? N(periodTotals[k]) : 0),
      0
    )
    // foodDeliveryTotal: for display in KPI card (all delivery, regardless of banked)
    const foodDeliveryTotal = deliveryKeys.reduce((s, k) => s + N(periodTotals[k] ?? 0), 0)
    // foodDeliveryUnbanked: only pending receivables not yet in bank (for netTotal)
    const foodDeliveryUnbanked = deliveryKeys.reduce(
      (s, k) => s + (isBankedTender(k) ? 0 : N(periodTotals[k] ?? 0)),
      0
    )
    const netTotal = handInCash + bankBalance + foodDeliveryUnbanked

    return {
      rows,
      kpis: {
        totalSales: periodTotalSales,
        handInCash,
        bankBalance,
        netTotal,
        foodDelivery: foodDeliveryTotal,
        totalCostFront,
        totalCostBack,
        totalCashSales: periodCashSales,
        totalAdvances: periodAdvances,
        totalLoanGiven: periodLoanGiven,
        totalBankedSales,
        periodDeposits,
        periodWithdrawals,
      },
      periodTotals,
      periodTotalSales,
      periodDeposits,
      periodWithdrawals,
      periodRepaySums: {
        cashIn: periodRepayCashIn,
        cashOut: periodRepayCashOut,
        bankIn: periodRepayBankIn,
        bankOut: periodRepayBankOut
      },
      tenderDefs
    }
  }, [
    sales,
    costs,
    advances,
    deposits,
    salaries,
    withdrawals,
    normalized,
    dateRange,
    tenderKeys,
    deliveryKeys,
    settings,
    branches
  ])

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
