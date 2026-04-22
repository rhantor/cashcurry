'use client'
import { useMemo } from 'react'
import { format, subDays, subMonths, eachDayOfInterval, differenceInDays } from 'date-fns'
import { toDate, byDateKey, num, sortByDateKey } from './utils'

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

/* ------------------------ tiny helpers ------------------------ */
const N = v => (v ? Number(v) : 0)

const tsToMs = v => {
  if (!v) return 0
  if (typeof v === 'number') return v
  if (v?.seconds) return v.seconds * 1000 // Firestore TS
  const ms = Date.parse(v)
  return Number.isNaN(ms) ? 0 : ms
}

const titleCase = str =>
  (str || '')
    .replace(/[_-]+/g, ' ')
    .replace(
      /\w\S*/g,
      w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )

const derivePaidFrom = c => {
  if (c?.paidFromOffice === 'front' || c?.paidFromOffice === 'back')
    return c.paidFromOffice
  if (c?.paidMethod && c?.paidMethod !== 'cash') return 'back'
  return 'front'
}
const derivePaidMethod = c => {
  if (c?.paidMethod) return c.paidMethod
  return derivePaidFrom(c) === 'front' ? 'cash' : ''
}

const isCashCost = c => {
  const office = String(c?.paidFromOffice || '').toLowerCase()
  const method = String(c?.paidMethod || c?.method || '').toLowerCase()
  return office === 'front' || method === 'cash'
}
// const isBankCost = (c) => !isCashCost(c);

// Mirror summary's pickSalaryDate / pickWithdrawDate / amount helpers so that
// dashboard period filtering and totals match the reports page exactly.
const pickSalaryDate = s => {
  const prefer =
    s?.paymentDate || s?.date || s?.payDate || s?.createdAt || s?.monthEnd || s?.month
  const ms =
    (typeof prefer === 'string' ? Date.parse(prefer) : tsToMs(prefer)) ||
    Date.now()
  return format(new Date(ms), 'yyyy-MM-dd')
}
const getSalaryAmount = s =>
  N(s?.totalSalary ?? s?.amount ?? s?.total ?? s?.total_amount ?? 0)

const pickWithdrawDate = w => {
  const prefer = w?.date || w?.withdrawDate || w?.createdAt
  const ms =
    (typeof prefer === 'string' ? Date.parse(prefer) : tsToMs(prefer)) ||
    Date.now()
  return format(new Date(ms), 'yyyy-MM-dd')
}
const getWithdrawAmount = w => N(w?.amount)

const isCashMethod = m => {
  const x = String(m || '')
    .trim()
    .toLowerCase()
  if (!x) return true
  return /(cash|hand\s*cash|cash-in-hand|voucher|petty)/i.test(x)
}

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
const DEFAULT_DELIVERY_KEYS = new Set(['grab', 'foodpanda'])

const normalizeTenderDef = (key, cand = {}) => {
  const def = DEFAULT_DEF_MAP.get(key)
  return {
    key,
    label: cand.label ?? def?.label ?? (key === 'qr' ? 'QR' : titleCase(key)),
    order: Number.isFinite(cand.order) ? cand.order : def?.order ?? 9999,
    includeInTotal: cand.includeInTotal !== false
  }
}

// keys to include when computing sale total
const includedTenderKeys = s => {
  if (Array.isArray(s?.tenderMeta) && s.tenderMeta.length) {
    return s.tenderMeta.filter(t => t?.includeInTotal !== false).map(t => t.key)
  }
  return Object.keys(s || {}).filter(k => {
    if (META_KEYS.has(k)) return false
    if (k === 'promotion') return false
    const n = parseFloat(s[k])
    return Number.isFinite(n)
  })
}

// cent-safe sale total (prefer saved total)
const saleTotalDynamic = s => {
  const saved = parseFloat(s?.total)
  if (Number.isFinite(saved)) return saved
  const cents = includedTenderKeys(s).reduce(
    (sum, k) => sum + Math.round((parseFloat(s?.[k]) || 0) * 100),
    0
  )
  return cents / 100
}

// 🔹 settings-driven banked calc
const saleBankedAmount = (s, bankedSet) => {
  // Prefer per-row tenderMeta
  if (Array.isArray(s?.tenderMeta) && s.tenderMeta.length) {
    const keys = s.tenderMeta.filter(t => t?.banked).map(t => t.key)
    return keys.reduce((sum, k) => sum + (parseFloat(s?.[k]) || 0), 0)
  }
  // Else: use settings-derived bankedSet (with fallback)
  const set = bankedSet?.size ? bankedSet : DEFAULT_BANKED_KEYS
  return Object.keys(s || {}).reduce((sum, k) => {
    if (META_KEYS.has(k)) return sum
    if (set.has(k)) return sum + (parseFloat(s[k]) || 0)
    return sum
  }, 0)
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
          type: 'all'
        }
      : skipToken
  const { data: loanActivities = [], isLoading: loanLoading } =
    useGetLoanActivitiesQuery(loanArgs)

  const inRange = d => {
    const t = +toDate(d)
    return t >= +filter.from && t <= +filter.to
  }

  /* --------------- filtered windows --------------- */
  const fSales = useMemo(
    () => sales.filter(s => inRange(s.date)),
    [sales, filter]
  )
  const fCosts = useMemo(
    () => costs.filter(x => inRange(x.date || x.createdAt)),
    [costs, filter]
  )
  const fAdv = useMemo(
    () => advances.filter(x => inRange(x.date || x.createdAt)),
    [advances, filter]
  )
  const fDep = useMemo(
    () => deposits.filter(x => inRange(x.date || x.createdAt)),
    [deposits, filter]
  )
  // Use the same date-picking helpers as the summary/reports page so
  // period filtering matches exactly (e.g. payroll entries without a `date`
  // field still get picked up via paymentDate/monthEnd/etc).
  const fWdr = useMemo(() => {
    const fromStr = format(filter.from, 'yyyy-MM-dd')
    const toStr = format(filter.to, 'yyyy-MM-dd')
    return withdrawals.filter(w => {
      const d = pickWithdrawDate(w)
      return d >= fromStr && d <= toStr
    })
  }, [withdrawals, filter])
  const fSal = useMemo(() => {
    const fromStr = format(filter.from, 'yyyy-MM-dd')
    const toStr = format(filter.to, 'yyyy-MM-dd')
    return salaries.filter(s => {
      const d = pickSalaryDate(s)
      return d >= fromStr && d <= toStr
    })
  }, [salaries, filter])

  // Staff loans that are a cash outflow in this period.
  // Mirrors the summary/reports page: only exclude migration loans (cash was given
  // before the app was adopted). Do NOT filter by status — summary treats every
  // non-migration loan as an actual disbursement, and the user has confirmed
  // the summary numbers are correct.
  const fStaffLoans = useMemo(
    () => staffLoans.filter(x =>
      inRange(x.date) &&
      x.source !== 'migration' &&
      String(x.paidFromOffice || 'front').toLowerCase() !== 'back'
    ),
    [staffLoans, filter]
  )

  const fLoans = useMemo(
    () => loanActivities.filter(x => inRange(x.date || x.createdAt)),
    [loanActivities, filter]
  )

  // 🔹 settings → derive banked & delivery sets
  const { bankedSet, deliveryKeys } = useMemo(() => {
    const list = branchSettings?.financeSales?.tenders || []
    if (!Array.isArray(list) || !list.length) {
      return {
        bankedSet: new Set(DEFAULT_BANKED_KEYS),
        deliveryKeys: Array.from(DEFAULT_DELIVERY_KEYS)
      }
    }
    const banked = new Set(list.filter(t => t.banked).map(t => t.key))
    const explicitDelivery = list.filter(t => t.delivery).map(t => t.key)
    const delivery =
      explicitDelivery.length > 0
        ? explicitDelivery
        : ['grab', 'foodpanda'].filter(k => list.some(t => t.key === k))
    return { bankedSet: banked, deliveryKeys: delivery }
  }, [branchSettings])

  /* --------------- normalize loans like Summary (cash/bank deltas) --------------- */
  // Normalize ALL loan activities (not the period-filtered fLoans) so that
  // pre-period cash/bank deltas can be included in openingCash. The summary
  // does the same — see useSummaryReportLogic.js `normalized`.
  const normalizedLoans = useMemo(() => {
    return (loanActivities || [])
      .map(e => {
        const typ = String(e.type || '').toLowerCase() // loan | repayment
        const from = e._fromBranchId ?? e.fromBranchId ?? e.requestFromBranchId
        const to = e._toBranchId ?? e.toBranchId ?? e.requestedToBranchId
        const rawMethod = String(
          e.paymentMethod || e.method || ''
        ).toLowerCase()

        let role
        if (to === branchId) role = 'lender'
        else if (from === branchId) role = 'borrower'

        const amt = N(e.amount)
        let cashDelta = 0
        let bankDelta = 0

        if (typ === 'loan') {
          // force loans as cash channel per Summary logic
          if (role === 'lender') cashDelta -= amt
          else if (role === 'borrower') cashDelta += amt
        } else if (typ === 'repayment') {
          const isCash = isCashMethod(rawMethod)
          if (role === 'lender') {
            if (isCash) cashDelta += amt
            else bankDelta += amt
          } else if (role === 'borrower') {
            if (isCash) cashDelta -= amt
            else bankDelta -= amt
          }
        }

        // pick deterministic date string
        const prefer =
          e.payDate ||
          e.paymentDate ||
          e.repayDate ||
          e.loanDate ||
          e.date ||
          e.createdAt
        const ms =
          (typeof prefer === 'string' ? Date.parse(prefer) : tsToMs(prefer)) ||
          Date.now()
        const dateStr = format(new Date(ms), 'yyyy-MM-dd')

        return {
          type: typ,
          amount: amt,
          paymentMethod: rawMethod || '-',
          fromBranchId: from,
          toBranchId: to,
          role,
          cashDelta,
          bankDelta,
          dateStr
        }
      })
      .filter(x => x.role && x.dateStr)
  }, [loanActivities, branchId])

  /* --------------- totals & high-level metrics (aligned with Summary) --------------- */
  const totals = useMemo(() => {
    const fromStr = format(filter.from, 'yyyy-MM-dd')
    const toStr = format(filter.to, 'yyyy-MM-dd')
    const inRangeStr = d => d >= fromStr && d <= toStr

    // ---------- PRE-RANGE opening cash ----------
    const preSalesCash = sales
      .filter(s => s?.date && s.date < fromStr)
      .reduce((sum, s) => sum + N(s.cash), 0)

    const preCostsCash = costs
      .filter(c => {
        const raw = c?.date || c?.createdAt
        if (!raw) return false
        const d = format(new Date(tsToMs(raw) || Date.parse(raw)), 'yyyy-MM-dd')
        return d < fromStr && isCashCost(c)
      })
      .reduce((sum, c) => sum + N(c.amount), 0)

    // Match summary's isSalaryCash: checks payMethod first, then paidFromOffice.
    // This mirrors the reports page so openingCash matches summary's runningCash.
    const isSalaryCash = s => {
      const m = String(s.payMethod || '').toLowerCase()
      if (m === 'bank' || m === 'bank_transfer' || m === 'cheque') return false
      return String(s?.paidFromOffice || 'front').toLowerCase() !== 'back'
    }

    // Pre-range cash-paid salaries only — bank-paid salaries don't affect openingCash
    const preSalariesCash = (salaries || [])
      .filter(s => {
        const prefer =
          s.paymentDate ||
          s.date ||
          s.payDate ||
          s.createdAt ||
          s.monthEnd ||
          s.month
        const ms =
          (typeof prefer === 'string' ? Date.parse(prefer) : tsToMs(prefer)) ||
          Date.now()
        const d = format(new Date(ms), 'yyyy-MM-dd')
        return d < fromStr
      })
      .filter(isSalaryCash)
      .reduce(
        (sum, s) =>
          sum + N(s.totalSalary ?? s.amount ?? s.total ?? s.total_amount ?? 0),
        0
      )

    // Match summary's isAdvanceCash: advances paid from back office (bank) don't reduce cash.
    const isAdvanceCash = a =>
      String(a?.paidFromOffice || 'front').toLowerCase() !== 'back'

    const preAdvances = advances
      .filter(a => a?.date && a.date < fromStr && isAdvanceCash(a))
      .reduce((sum, a) => sum + N(a.amount), 0)

    // Pre-range staff loan disbursements that came out of the register
    const preStaffLoansCash = staffLoans
      .filter(l =>
        l.date && l.date < fromStr &&
        l.source !== 'migration' &&
        String(l.paidFromOffice || 'front').toLowerCase() !== 'back'
      )
      .reduce((sum, l) => sum + N(l.amount), 0)

    const preDeposits = deposits
      .filter(d => d?.date && d.date < fromStr)
      .reduce((sum, d) => sum + N(d.amount), 0)

    const preWithdrawals = (withdrawals || [])
      .filter(w => {
        const prefer = w.date || w.withdrawDate || w.createdAt
        const ms =
          (typeof prefer === 'string' ? Date.parse(prefer) : tsToMs(prefer)) ||
          Date.now()
        const d = format(new Date(ms), 'yyyy-MM-dd')
        return d < fromStr
      })
      .reduce((sum, w) => sum + N(w.amount), 0)

    const preActsCashDelta = normalizedLoans
      .filter(x => x.dateStr < fromStr)
      .reduce((s, x) => s + (x.cashDelta || 0), 0)
    // Initial Cash
    const initialCash = N(
      branchSettings?.initialCash ??
        branchSettings?.financeSales?.openingBalance ??
        0
    )

    let openingCash =
      initialCash +
      preSalesCash -
      preCostsCash -
      preSalariesCash -
      preAdvances -
      preStaffLoansCash +
      preActsCashDelta -
      preDeposits +
      preWithdrawals

    // ---------- IN-PERIOD ----------
    // banked tenders (settings/per-row aware)
    const bankedSum = fSales.reduce(
      (sum, s) => sum + saleBankedAmount(s, bankedSet),
      0
    )

    const periodDeposits = fDep.reduce((s, x) => s + N(x.amount), 0)
    const periodWithdrawals = fWdr.reduce((s, x) => s + getWithdrawAmount(x), 0)

    // Costs split (front/back)
    let totalCostsFront = 0
    let totalCostsBack = 0
    let backCard = 0,
      backQR = 0,
      backOnline = 0,
      backBank = 0
    fCosts.forEach(c => {
      const amt = N(c.amount)
      const from = derivePaidFrom(c)
      const method = derivePaidMethod(c)
      if (from === 'front') {
        totalCostsFront += amt
      } else {
        totalCostsBack += amt
        if (method === 'card') backCard += amt
        else if (method === 'qr') backQR += amt
        else if (method === 'online') backOnline += amt
        else if (method === 'bank_transfer') backBank += amt
      }
    })

    // Advances: only cash-paid ones reduce handInCash (mirrors summary's isAdvanceCash).
    // Bank-paid advances are not tracked on the bank side either — summary treats
    // them as out-of-scope for cash-flow purposes, so we match that behaviour.
    const totalAdv = fAdv.filter(isAdvanceCash).reduce((s, x) => s + N(x.amount), 0)

    // Staff loan disbursements from the register (cash out on the loan date)
    const totalStaffLoanCash = fStaffLoans.reduce((s, x) => s + N(x.amount), 0)

    // Salaries split using the same isSalaryCash helper as summary/reports:
    //   cash → reduces handInCash (staff paid in hand)
    //   bank → reduces bankExpected (bank transfer)
    let totalSalCash = 0
    let totalSalBank = 0
    fSal.forEach(x => {
      const amt = getSalaryAmount(x)
      if (isSalaryCash(x)) totalSalCash += amt
      else totalSalBank += amt
    })
    const totalSal = totalSalCash + totalSalBank  // combined for KPI display

    // Cash sales in period
    const periodCashSales = fSales.reduce((s, x) => s + N(x.cash), 0)

    // Loan channel deltas (in period)
    const periodCashLoanDelta = normalizedLoans
      .filter(x => inRangeStr(x.dateStr))
      .reduce((s, x) => s + (x.cashDelta || 0), 0)

    const periodBankLoanDelta = normalizedLoans
      .filter(x => inRangeStr(x.dateStr))
      .reduce((s, x) => s + (x.bankDelta || 0), 0)

    // ---------- CASH IN HAND ----------
    // Only cash-paid items reduce hand cash:
    //   - front-office costs
    //   - cash-paid salaries (payMethod: 'cash' or no payMethod)
    //   - advances given
    //   - staff loan disbursements from register (paidFromOffice: 'front')
    //   - deposits to bank
    //   - branch loans given in cash (via normalizedLoans cashDelta)
    const handInCash =
      openingCash +
      periodCashSales -
      totalCostsFront -
      totalSalCash -
      totalAdv -
      totalStaffLoanCash -
      periodDeposits +
      periodCashLoanDelta +
      periodWithdrawals

    // ---------- EFFECTIVE BANK (expected) ----------
    // banked tenders + deposits ± non-cash repayments − withdrawals − back-office costs − bank salaries
    const bankExpected =
      bankedSum +
      periodDeposits +
      periodBankLoanDelta -
      periodWithdrawals -
      totalCostsBack -
      totalSalBank  // bank-transferred salaries reduce bank balance

    // Keep earlier high-levels too
    const totalCash = fSales.reduce((s, x) => s + N(x.cash), 0)
    const totalCard = fSales.reduce((s, x) => s + N(x.card), 0)
    const totalQR = fSales.reduce((s, x) => s + N(x.qr), 0)
    const totalOnline = fSales.reduce((s, x) => s + N(x.online), 0)
    const totalSales = fSales.reduce((s, x) => s + saleTotalDynamic(x), 0)

    // Delivery totals (settings-driven)
    const deliverySet = new Set(deliveryKeys)
    const deliveryBanked = fSales.reduce((sum, s) => {
      let row = 0
      if (Array.isArray(s?.tenderMeta) && s.tenderMeta.length) {
        s.tenderMeta.forEach(t => {
          if (!deliverySet.has(t.key)) return
          if (!t.banked) return
          row += N(s[t.key])
        })
      } else {
        Object.keys(s || {}).forEach(k => {
          if (META_KEYS.has(k)) return
          if (!deliverySet.has(k)) return
          if (!bankedSet.has(k)) return
          row += N(s[k])
        })
      }
      return sum + row
    }, 0)

    const deliveryNonBanked = fSales.reduce((sum, s) => {
      let row = 0
      if (Array.isArray(s?.tenderMeta) && s.tenderMeta.length) {
        s.tenderMeta.forEach(t => {
          if (!deliverySet.has(t.key)) return
          if (t.banked) return
          row += N(s[t.key])
        })
      } else {
        Object.keys(s || {}).forEach(k => {
          if (META_KEYS.has(k)) return
          if (!deliverySet.has(k)) return
          if (bankedSet.has(k)) return
          row += N(s[k])
        })
      }
      return sum + row
    }, 0)

    const deliveryTotal = deliveryBanked + deliveryNonBanked

    return {
      // new KPI-aligned outputs
      handInCash,
      bankExpected,

      // backward-compatible aliases
      estCashOnHand: handInCash,
      effectiveBankedAfterWithdrawals: bankExpected,

      // existing totals
      totalCash,
      totalCard,
      totalQR,
      totalOnline,
      bankedSales: bankedSum,
      totalWdr: periodWithdrawals,
      totalDep: periodDeposits,
      totalCosts: totalCostsFront + totalCostsBack,
      totalCostsFront,
      totalCostsBack,
      backCard,
      backQR,
      backOnline,
      backBank,
      totalAdv,
      totalStaffLoanCash,
      totalSal,
      totalSales,
      deliveryBanked,
      deliveryNonBanked,
      deliveryTotal
    }
  }, [
    sales,
    costs,
    salaries,
    staffLoans,
    advances,
    deposits,
    withdrawals,
    fSales,
    fCosts,
    fSal,
    fAdv,
    fStaffLoans,
    fDep,
    fWdr,
    bankedSet,
    deliveryKeys,
    filter,
    normalizedLoans
  ])

  /* --------------- trend (daily total) --------------- */
  const salesTrend = useMemo(() => {
    const map = new Map()
    fSales.forEach(s => {
      const k = byDateKey(s.date)
      const prev = map.get(k) || { date: k, total: 0 }
      prev.total += saleTotalDynamic(s)
      map.set(k, prev)
    })
    return sortByDateKey([...map.values()])
  }, [fSales])

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
      curMap.set(k, (curMap.get(k) || 0) + saleTotalDynamic(s))
    })
    const prevMap = new Map()
    prevSales.forEach(s => {
      const k = byDateKey(s.date)
      prevMap.set(k, (prevMap.get(k) || 0) + saleTotalDynamic(s))
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
  }, [sales, fSales, filter])

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
      prev.sales += saleTotalDynamic(s)
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
      const from = derivePaidFrom(c)
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
  }, [fSales, fCosts])

  /* --------------- banked vs withdrawals (daily) --------------- */
  const bankedVsWdr = useMemo(() => {
    const map = new Map()
    fSales.forEach(s => {
      const k = byDateKey(s.date)
      const prev = map.get(k) || { date: k, bankedSales: 0, withdrawals: 0 }
      prev.bankedSales += saleBankedAmount(s, bankedSet)
      map.set(k, prev)
    })
    fWdr.forEach(w => {
      const k = byDateKey(w.date || w.createdAt)
      const prev = map.get(k) || { date: k, bankedSales: 0, withdrawals: 0 }
      prev.withdrawals += num(w.amount)
      map.set(k, prev)
    })
    return sortByDateKey([...map.values()])
  }, [fSales, fWdr, bankedSet])

  /* --------------- banked vs back-office cost (daily) --------------- */
  const bankedVsBackCost = useMemo(() => {
    const map = new Map()
    // seed with banked sales per day
    fSales.forEach(s => {
      const k = byDateKey(s.date)
      const prev = map.get(k) || { date: k, bankedSales: 0, backCosts: 0 }
      prev.bankedSales += saleBankedAmount(s, bankedSet)
      map.set(k, prev)
    })
    // add back-office costs per day
    fCosts.forEach(c => {
      const k = byDateKey(c.date || c.createdAt)
      const prev = map.get(k) || { date: k, bankedSales: 0, backCosts: 0 }
      if (derivePaidFrom(c) === 'back') prev.backCosts += num(c.amount)
      map.set(k, prev)
    })
    return sortByDateKey([...map.values()])
  }, [fSales, fCosts, bankedSet])

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
      if (derivePaidFrom(c) === 'front') prev.cashCosts += num(c.amount)
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
      rows.push({ type: 'Sale', date: x.date, amount: saleTotalDynamic(x) })
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
  }, [fSales, fCosts, fDep, fWdr, fSal, fAdv, fLoans])

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
    branchId,
    isCompany,
    setActiveBranch,
  }
}
