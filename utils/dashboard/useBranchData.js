'use client'
import { useMemo } from 'react'
import { format, subDays, subMonths, eachDayOfInterval, differenceInDays } from 'date-fns'
import { toDate, byDateKey, dayKey, num, sortByDateKey } from './utils'

// RTK slices
import { useGetSalesEntriesQuery } from '@/lib/redux/api/salesApiSlice'
import { useGetCostEntriesQuery } from '@/lib/redux/api/costApiSlice'
import { useGetAdvanceEntriesQuery } from '@/lib/redux/api/AdvanceApiSlice'
import { useGetDepositEntryQuery } from '@/lib/redux/api/depositApiSlice'
import { useGetWithdrawEntriesQuery } from '@/lib/redux/api/cashWithdrawApiSlice'
import { useGetSalaryEntriesQuery } from '@/lib/redux/api/salaryApiSlice'
import { useGetLoanActivitiesQuery } from '@/lib/redux/api/loanApiSlice'
import { useGetStaffLoansQuery } from '@/lib/redux/api/staffLoanApiSlice'
import { useGetSingleBranchQuery } from '@/lib/redux/api/branchApiSlice'
import { useGetBranchSettingsQuery } from '@/lib/redux/api/branchSettingsApiSlice'
import useResolvedCompanyBranch from '../useResolvedCompanyBranch'
import { skipToken } from '@reduxjs/toolkit/query'
import { aggregateLoanMovements } from '../finance/loanAgg'
import { buildLedger } from '@/lib/finance/ledger'
import {
  saleDay, costDay, advanceDay, depositDay, withdrawalDay, salaryDay, staffLoanDay,
  isCashCost, isMigratedStaffLoan, paidOutOf
} from '@/lib/finance/rules'

/* ------------------------ chart label helpers ------------------------ */
// The money rules live in lib/finance. These only name and order the payment
// types shown in the sales-breakdown chart and the "Banked" card label.
const titleCase = str =>
  (str || '')
    .replace(/[_-]+/g, ' ')
    .replace(
      /\w\S*/g,
      w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )

// fields that are NOT tenders
const META_KEYS = new Set([
  'id',
  'date',
  'createdAt',
  'createdBy',
  'notes',
  'zReportUrl',
  'tenderMeta',
  'companyId',
  'branchId',
  'total',
  '__typename'
])

// default tender defs for fallback
const DEFAULT_TENDERS = [
  { key: 'cash', label: 'Cash', order: 1, includeInTotal: true },
  { key: 'card', label: 'Card', order: 2, includeInTotal: true },
  { key: 'qr', label: 'QR', order: 3, includeInTotal: true },
  { key: 'grab', label: 'Grab', order: 4, includeInTotal: true },
  { key: 'foodpanda', label: 'Foodpanda', order: 5, includeInTotal: true },
  { key: 'online', label: 'Online', order: 6, includeInTotal: true },
  { key: 'cheque', label: 'Cheque', order: 7, includeInTotal: true },
  { key: 'promotion', label: 'Promotion', order: 8, includeInTotal: false }
]
const DEFAULT_DEF_MAP = new Map(DEFAULT_TENDERS.map(t => [t.key, t]))

// 🔹 DEFAULTS for banked/delivery if settings absent
const DEFAULT_BANKED_KEYS = new Set([
  'card',
  'qr',
  'online',
  'grab',
  'foodpanda'
])
const normalizeTenderDef = (key, cand = {}) => {
  const def = DEFAULT_DEF_MAP.get(key)
  return {
    key,
    label: cand.label ?? def?.label ?? (key === 'qr' ? 'QR' : titleCase(key)),
    order: Number.isFinite(cand.order) ? cand.order : def?.order ?? 9999,
    includeInTotal: cand.includeInTotal !== false
  }
}

// union tender defs across filtered sales (prefer tenderMeta)
const tenderDefsFromSales = fSales => {
  const defs = new Map() // key -> {key,label,order,includeInTotal}
  for (const s of fSales) {
    if (Array.isArray(s?.tenderMeta) && s.tenderMeta.length) {
      for (const t of s.tenderMeta) {
        if (!t?.key) continue
        if (!defs.has(t.key)) defs.set(t.key, normalizeTenderDef(t.key, t))
      }
    } else {
      for (const k of Object.keys(s || {})) {
        if (META_KEYS.has(k)) continue
        const val = parseFloat(s[k])
        if (!Number.isFinite(val)) continue
        if (!defs.has(k)) defs.set(k, normalizeTenderDef(k))
      }
    }
  }
  if (defs.size === 0) {
    DEFAULT_TENDERS.forEach(t => defs.set(t.key, normalizeTenderDef(t.key, t)))
  }
  const ordered = Array.from(defs.values()).sort((a, b) => a.order - b.order)
  return {
    tenderKeys: ordered.map(d => d.key),
    tenderLabelsByKey: ordered.reduce(
      (acc, d) => ((acc[d.key] = d.label), acc),
      {}
    )
  }
}

/* ------------------------ hook ------------------------ */
export default function useBranchData (filter) {
  const { companyId, branchId, isCompany, setActiveBranch } = useResolvedCompanyBranch()

  // base args
  const baseArgs = companyId && branchId ? { companyId, branchId } : skipToken

  const { data: branchData = {} } = useGetSingleBranchQuery(baseArgs)
  const branchName = branchData?.name || 'Branch'

  // 🔹 settings for tenders (banked/delivery)
  const { data: branchSettings = {} } = useGetBranchSettingsQuery(baseArgs)

  const { data: sales = [], isLoading: salesLoading } =
    useGetSalesEntriesQuery(baseArgs)
  const { data: costs = [], isLoading: costsLoading } =
    useGetCostEntriesQuery(baseArgs)
  const { data: advances = [], isLoading: advLoading } =
    useGetAdvanceEntriesQuery(baseArgs)
  const { data: deposits = [], isLoading: depLoading } =
    useGetDepositEntryQuery(baseArgs)
  const { data: withdrawals = [], isLoading: wdLoading } =
    useGetWithdrawEntriesQuery(baseArgs)
  const { data: salaries = [], isLoading: salLoading } =
    useGetSalaryEntriesQuery(baseArgs)

  // Staff loans: needed to deduct disbursements from handInCash.
  // Only non-migration + front-office (cash given from register) + actually approved/closed.
  const { data: staffLoans = [], isLoading: staffLoanLoading } =
    useGetStaffLoansQuery(baseArgs)

  const loanArgs =
    companyId && branchId
      ? {
          companyId,
          branchId,
          direction: 'all',
          status: 'approved',
          type: 'all',
          pageLimit: 0 // every loan: cash needs the full history
        }
      : skipToken
  const { data: loanActivities = [], isLoading: loanLoading } =
    useGetLoanActivitiesQuery(loanArgs)

  // Whole calendar days, like the summary report: a filter carrying a time
  // of day must not drop part of its first or last day.
  const fromKey = format(filter.from, 'yyyy-MM-dd')
  const toKey = format(filter.to, 'yyyy-MM-dd')
  const inPeriod = day => !!day && day >= fromKey && day <= toKey

  /* --------------- the period's records (charts and lists) --------------- */
  const fSales = useMemo(() => sales.filter(s => inPeriod(saleDay(s))), [sales, fromKey, toKey])
  const fCosts = useMemo(() => costs.filter(x => inPeriod(costDay(x))), [costs, fromKey, toKey])
  // Advances and staff loans count once paid out, on the day they were paid.
  const fAdv = useMemo(() => advances.filter(x => inPeriod(paidOutOf(x, advanceDay)?.day)), [advances, fromKey, toKey])
  const fDep = useMemo(() => deposits.filter(x => inPeriod(depositDay(x))), [deposits, fromKey, toKey])
  const fWdr = useMemo(() => withdrawals.filter(w => inPeriod(withdrawalDay(w))), [withdrawals, fromKey, toKey])
  const fSal = useMemo(() => salaries.filter(s => inPeriod(salaryDay(s))), [salaries, fromKey, toKey])
  // Staff loans paid out of the till in this period.
  const fStaffLoans = useMemo(
    () => staffLoans.filter(x => !isMigratedStaffLoan(x) && paidOutOf(x, staffLoanDay)?.fromTill && inPeriod(paidOutOf(x, staffLoanDay).day)),
    [staffLoans, fromKey, toKey]
  )
  const fLoans = useMemo(
    () => loanActivities.filter(x => inPeriod(dayKey(x.date || x.createdAt))),
    [loanActivities, fromKey, toKey]
  )

  /* --------------- money: the shared finance engine --------------- */
  // Same cash book as the summary report, so the cards always agree with it.
  const ledger = useMemo(
    () =>
      buildLedger({
        branchId,
        settings: branchSettings,
        records: { sales, costs, advances, staffLoans, deposits, salaries, withdrawals, loanActivities },
        from: fromKey,
        to: toKey
      }),
    [branchId, branchSettings, sales, costs, advances, staffLoans, deposits, salaries, withdrawals, loanActivities, fromKey, toKey]
  )

  // What one sale adds to total sales and to the bank, by the ledger's rules.
  const { saleTotal, bankedOfSale } = useMemo(() => {
    const { keys, countsInTotal, isBanked } = ledger.tenders
    return {
      saleTotal: s => keys.reduce((a, k) => a + (countsInTotal(k) ? num(s[k]) : 0), 0),
      bankedOfSale: s => keys.reduce((a, k) => a + (isBanked(k) ? num(s[k]) : 0), 0)
    }
  }, [ledger])

  // Payment types named in the "Banked" card label.
  const bankedSet = useMemo(() => {
    const list = branchSettings?.financeSales?.tenders || []
    return list.length ? new Set(list.filter(t => t.banked).map(t => t.key)) : new Set(DEFAULT_BANKED_KEYS)
  }, [branchSettings])

  const totals = useMemo(() => {
    const t = ledger.totals
    // Back-office costs by how they were paid.
    let backCard = 0, backQR = 0, backOnline = 0, backBank = 0
    fCosts.forEach(c => {
      if (isCashCost(c)) return
      const amt = num(c.amount)
      const method = c.paidMethod || ''
      if (method === 'card') backCard += amt
      else if (method === 'qr') backQR += amt
      else if (method === 'online') backOnline += amt
      else if (method === 'bank_transfer') backBank += amt
    })
    return {
      // Cash in hand at the end of the period (opening + everything since).
      handInCash: ledger.closing.cash,
      // Bank movement within the period.
      bankExpected: t.bankChange,
      totalCash: t.cashSales,
      totalCard: fSales.reduce((s, x) => s + num(x.card), 0),
      totalQR: fSales.reduce((s, x) => s + num(x.qr), 0),
      totalOnline: fSales.reduce((s, x) => s + num(x.online), 0),
      bankedSales: t.bankedSales,
      totalWdr: t.withdrawal,
      totalDep: t.deposit,
      totalCosts: t.costCash + t.costBank,
      totalCostsFront: t.costCash,
      totalCostsBack: t.costBank,
      backCard,
      backQR,
      backOnline,
      backBank,
      totalAdv: t.advance,
      totalStaffLoanCash: t.staffLoanGiven,
      totalSal: t.salaryCash + t.salaryBank,
      totalSales: t.totalSales,
      deliveryBanked: t.deliveryBanked,
      deliveryNonBanked: t.deliveryUnbanked,
      deliveryTotal: t.deliveryTotal
    }
  }, [ledger, fCosts, fSales])

  /* --------------- trend (daily total) --------------- */
  const salesTrend = useMemo(() => {
    const map = new Map()
    fSales.forEach(s => {
      const k = byDateKey(s.date)
      const prev = map.get(k) || { date: k, total: 0 }
      prev.total += saleTotal(s)
      map.set(k, prev)
    })
    return sortByDateKey([...map.values()])
  }, [fSales, saleTotal])

  /* --------------- comparison sales trend (previous period) --------------- */
  // preset = 'month'  → same calendar days, one month back  (Apr 1-20 → Mar 1-20)
  // preset = 'week'   → previous 7 days, X-axis: Mon/Tue/…
  // preset = 'days30' → previous 30 days, X-axis: MMM d
  // preset = 'custom' → same duration shifted back, X-axis: MMM d
  const compareSalesTrend = useMemo(() => {
    const from   = filter.from
    const to     = filter.to
    const preset = filter.preset ?? 'custom'
    if (!from || !to || isNaN(+from) || isNaN(+to)) return []

    // ── Compute previous period boundaries ──────────────────────────────────
    let prevFrom, prevTo
    if (preset === 'month') {
      // Same calendar days, one month back
      prevFrom = subMonths(from, 1)   // e.g. Mar 1
      prevTo   = subMonths(to,   1)   // e.g. Mar 20
    } else {
      // For week / days30 / custom: shift back by exact same duration
      const dayCount = Math.max(1, differenceInDays(to, from) + 1)
      prevTo   = subDays(from, 1)
      prevFrom = subDays(from, dayCount)
    }

    const prevFromStr = format(prevFrom, 'yyyy-MM-dd')
    const prevToStr   = format(prevTo,   'yyyy-MM-dd')

    // Reuse the already-fetched full sales array — no extra network request
    const prevSales = sales.filter(s => s.date >= prevFromStr && s.date <= prevToStr)

    // Build day-keyed totals for both periods
    const curMap = new Map()
    fSales.forEach(s => {
      const k = byDateKey(s.date)
      curMap.set(k, (curMap.get(k) || 0) + saleTotal(s))
    })
    const prevMap = new Map()
    prevSales.forEach(s => {
      const k = byDateKey(s.date)
      prevMap.set(k, (prevMap.get(k) || 0) + saleTotal(s))
    })

    // Align both periods by day position (index 0 = Day 1 of each period)
    const curDays  = eachDayOfInterval({ start: from, end: to })
    const prevDays = eachDayOfInterval({ start: prevFrom, end: prevTo })
    const len = Math.max(curDays.length, prevDays.length)

    // X-axis label format per preset:
    // month  → "1", "2", "3" … (day of month — same for both, easy to read)
    // week   → "Mon", "Tue" … (day name — same weekday in both periods)
    // others → "Apr 14" style short date from the current period
    const labelFmt =
      preset === 'month' ? 'd' :
      preset === 'week'  ? 'EEE' :
      'MMM d'

    return Array.from({ length: len }, (_, i) => {
      const curDay   = curDays[i]  ?? null
      const prevDay  = prevDays[i] ?? null
      const curDate  = curDay  ? format(curDay,  'yyyy-MM-dd') : null
      const prevDate = prevDay ? format(prevDay, 'yyyy-MM-dd') : null
      return {
        label:       curDay  ? format(curDay, labelFmt) : `D${i + 1}`,
        current:     curDate  ? (curMap.get(curDate)  ?? 0) : null,
        previous:    prevDate ? (prevMap.get(prevDate) ?? 0) : null,
        currentDate: curDate,
        prevDate:    prevDate,
      }
    })
  }, [sales, fSales, filter, saleTotal])

  /* --------------- dynamic sales breakdown --------------- */
  const { tenderKeys, tenderLabelsByKey } = useMemo(
    () => tenderDefsFromSales(fSales),
    [fSales]
  )

  const bankedTenderKeys = useMemo(() => {
    if (bankedSet?.size) return Array.from(bankedSet)
    return Array.from(DEFAULT_BANKED_KEYS)
  }, [bankedSet])

  const bankedTenderLabelList = useMemo(
    () =>
      bankedTenderKeys
        .map(
          k =>
            tenderLabelsByKey?.[k] ??
            (k === 'qr' ? 'QR' : k[0]?.toUpperCase() + k.slice(1))
        )
        .join(', '),
    [bankedTenderKeys, tenderLabelsByKey]
  )

  const salesBreakdown = useMemo(() => {
    const map = new Map()
    const extraKeysSet = new Set()
    const ensureRow = k => {
      if (!map.has(k)) {
        const base = { date: k }
        tenderKeys.forEach(tk => (base[tk] = 0))
        map.set(k, base)
      }
      return map.get(k)
    }
    fSales.forEach(s => {
      const k = byDateKey(s.date)
      const row = ensureRow(k)
      tenderKeys.forEach(tk => (row[tk] += num(s[tk])))
      Object.keys(s || {}).forEach(field => {
        if (META_KEYS.has(field)) return
        if (tenderKeys.includes(field)) return
        const val = num(s[field])
        if (val) extraKeysSet.add(field)
      })
    })
    const extraKeys = Array.from(extraKeysSet)
    if (extraKeys.length) {
      map.forEach(r => extraKeys.forEach(ek => (r[ek] ??= 0)))
      fSales.forEach(s => {
        const k = byDateKey(s.date)
        const row = map.get(k)
        extraKeys.forEach(ek => (row[ek] += num(s[ek])))
      })
    }
    return sortByDateKey([...map.values()])
  }, [fSales, tenderKeys])

  /* --------------- sales vs costs (daily) --------------- */
  const salesVsCosts = useMemo(() => {
    const map = new Map()
    fSales.forEach(s => {
      const k = byDateKey(s.date)
      const prev = map.get(k) || {
        date: k,
        sales: 0,
        costs_front: 0,
        costs_back: 0
      }
      prev.sales += saleTotal(s)
      map.set(k, prev)
    })
    fCosts.forEach(c => {
      const k = byDateKey(c.date || c.createdAt)
      const prev = map.get(k) || {
        date: k,
        sales: 0,
        costs_front: 0,
        costs_back: 0
      }
      const from = isCashCost(c) ? 'front' : 'back'
      const amt = num(c.amount)
      if (from === 'front') prev.costs_front += amt
      else prev.costs_back += amt
      map.set(k, prev)
    })
    return sortByDateKey(
      [...map.values()].map(row => ({
        ...row,
        costs_total: row.costs_front + row.costs_back
      }))
    )
  }, [fSales, fCosts, saleTotal])

  /* --------------- banked vs withdrawals (daily) --------------- */
  const bankedVsWdr = useMemo(() => {
    const map = new Map()
    fSales.forEach(s => {
      const k = byDateKey(s.date)
      const prev = map.get(k) || { date: k, bankedSales: 0, withdrawals: 0 }
      prev.bankedSales += bankedOfSale(s)
      map.set(k, prev)
    })
    fWdr.forEach(w => {
      const k = byDateKey(w.date || w.createdAt)
      const prev = map.get(k) || { date: k, bankedSales: 0, withdrawals: 0 }
      prev.withdrawals += num(w.amount)
      map.set(k, prev)
    })
    return sortByDateKey([...map.values()])
  }, [fSales, fWdr, bankedOfSale])

  /* --------------- banked vs back-office cost (daily) --------------- */
  const bankedVsBackCost = useMemo(() => {
    const map = new Map()
    // seed with banked sales per day
    fSales.forEach(s => {
      const k = byDateKey(s.date)
      const prev = map.get(k) || { date: k, bankedSales: 0, backCosts: 0 }
      prev.bankedSales += bankedOfSale(s)
      map.set(k, prev)
    })
    // add back-office costs per day
    fCosts.forEach(c => {
      const k = byDateKey(c.date || c.createdAt)
      const prev = map.get(k) || { date: k, bankedSales: 0, backCosts: 0 }
      if (!isCashCost(c)) prev.backCosts += num(c.amount)
      map.set(k, prev)
    })
    return sortByDateKey([...map.values()])
  }, [fSales, fCosts, bankedOfSale])

  /* --------------- cash vs cost (daily) --------------- */
  const cashVsCost = useMemo(() => {
    const map = new Map()
    fSales.forEach(s => {
      const k = byDateKey(s.date)
      const prev = map.get(k) || { date: k, cashSales: 0, cashCosts: 0 }
      prev.cashSales += num(s.cash)
      map.set(k, prev)
    })
    fCosts.forEach(c => {
      const k = byDateKey(c.date || c.createdAt)
      const prev = map.get(k) || { date: k, cashSales: 0, cashCosts: 0 }
      if (isCashCost(c)) prev.cashCosts += num(c.amount)
      map.set(k, prev)
    })
    return sortByDateKey([...map.values()])
  }, [fSales, fCosts])

  /* --------------- loans (timeline) --------------- */
  const loanTimeline = useMemo(() => {
    const map = new Map()
    const add = (k, field, amt) => {
      const row = map.get(k) || {
        date: k,
        lent: 0,
        borrowed: 0,
        repayReceived: 0,
        repayPaid: 0
      }
      row[field] += amt
      map.set(k, row)
    }
    fLoans.forEach(e => {
      const k = byDateKey(e.date || e.createdAt)
      const amt = num(e.amount)
      const fromId =
        e.fromBranchId ||
        e.giverBranchId ||
        e.requestFromBranchId ||
        e.sourceBranchId
      const toId =
        e.toBranchId ||
        e.receiverBranchId ||
        e.requestedToBranchId ||
        e.targetBranchId

      if (e.type === 'loan') {
        if (toId === branchId) add(k, 'lent', amt)
        if (fromId === branchId) add(k, 'borrowed', amt)
      } else if (e.type === 'repayment') {
        if (toId === branchId) add(k, 'repayReceived', amt)
        if (fromId === branchId) add(k, 'repayPaid', amt)
      }
    })
    return sortByDateKey([...map.values()])
  }, [fLoans, branchId])

  /* --------------- recent activity --------------- */
  const recent = useMemo(() => {
    const rows = []
    fSales.slice(-20).forEach(x => {
      rows.push({ type: 'Sale', date: x.date, amount: saleTotal(x) })
    })
    fCosts.slice(-20).forEach(x =>
      rows.push({
        type: 'Cost',
        date: x.date || x.createdAt,
        amount: num(x.amount)
      })
    )
    fDep.slice(-20).forEach(x =>
      rows.push({
        type: 'Deposit',
        date: x.date || x.createdAt,
        amount: num(x.amount)
      })
    )
    fWdr.slice(-20).forEach(x =>
      rows.push({
        type: 'Withdraw',
        date: x.date || x.createdAt,
        amount: num(x.amount)
      })
    )
    fSal.slice(-20).forEach(x =>
      rows.push({
        type: 'Salary',
        date: x.date || x.createdAt,
        amount: num(x.amount)
      })
    )
    fAdv.slice(-20).forEach(x =>
      rows.push({
        type: 'Advance',
        date: x.date || x.createdAt,
        amount: num(x.amount)
      })
    )
    fLoans.slice(-20).forEach(x =>
      rows.push({
        type: 'Loan',
        date: x.date || x.createdAt,
        amount: num(x.amount)
      })
    )
    return rows
      .map(r => ({ ...r, ts: +toDate(r.date) }))
      .filter(r => !Number.isNaN(r.ts))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 15)
  }, [fSales, fCosts, fDep, fWdr, fSal, fAdv, fLoans, saleTotal])

  const loading =
    salesLoading ||
    costsLoading ||
    advLoading ||
    depLoading ||
    wdLoading ||
    salLoading ||
    staffLoanLoading ||
    loanLoading

  // Expose loan summary for UI/exporters (still useful)
  const loanSummary = useMemo(() => aggregateLoanMovements(fLoans), [fLoans])

  return {
    companyId,
    branchId,
    loading,
    fSales,
    fCosts,
    fAdv,
    fStaffLoans,
    fDep,
    fWdr,
    fSal,
    fLoans,

    // charts & breakdowns
    salesTrend,
    compareSalesTrend,
    salesBreakdown,
    tenderKeys,
    tenderLabelsByKey,
    bankedTenderKeys: Array.from(
      bankedSet?.size ? bankedSet : DEFAULT_BANKED_KEYS
    ),
    bankedTenderLabelList,
    salesVsCosts,
    cashVsCost,
    bankedVsWdr,
    bankedVsBackCost,
    loanTimeline,
    recent,

    // NEW summary-aligned KPIs
    handInCash: totals.handInCash,
    bankExpected: totals.bankExpected,

    // Backward-compatible aliases (so existing UI/exporters don't break)
    estCashOnHand: totals.handInCash,
    effectiveBankedAfterWithdrawals: totals.bankExpected,

    // Other totals you already used
    totalCash: totals.totalCash,
    totalCard: totals.totalCard,
    totalQR: totals.totalQR,
    totalOnline: totals.totalOnline,
    bankedSales: totals.bankedSales,
    totalWdr: totals.totalWdr,
    totalDep: totals.totalDep,
    totalCosts: totals.totalCosts,
    totalCostsFront: totals.totalCostsFront,
    totalCostsBack: totals.totalCostsBack,
    backCard: totals.backCard,
    backQR: totals.backQR,
    backOnline: totals.backOnline,
    backBank: totals.backBank,
    totalAdv: totals.totalAdv,
    totalStaffLoanCash: totals.totalStaffLoanCash,
    totalSal: totals.totalSal,
    totalSales: totals.totalSales,
    deliveryBanked: totals.deliveryBanked,
    deliveryNonBanked: totals.deliveryNonBanked,
    deliveryTotal: totals.deliveryTotal,

    // Loan aggregation (people/outstanding etc.)
    loanSummary,

    branchName,

    // Branch switching — for owner/gm/superAdmin viewing individual branches
    isCompany,
    setActiveBranch,
  }
}
