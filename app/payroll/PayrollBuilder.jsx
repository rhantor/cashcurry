'use client'

import { isPaidOut } from '@/lib/finance/rules'
import React, { useEffect, useMemo, useState } from 'react'
import { useGetStaffListQuery } from '@/lib/redux/api/staffApiSlice'
import { useGetBranchSettingsQuery } from '@/lib/redux/api/branchSettingsApiSlice'
import { useGetCompanyDetailsQuery } from '@/lib/redux/api/authApiSlice'
import { useGetSingleBranchQuery } from '@/lib/redux/api/branchApiSlice'
import { useGetAdvanceEntriesQuery } from '@/lib/redux/api/AdvanceApiSlice'
import { useGetStaffLoansQuery } from '@/lib/redux/api/staffLoanApiSlice'
import {
  useGetPayrollRunsQuery,
  useGetPayrollSlipsQuery,
  useCreatePayrollDraftMutation,
  useSaveDraftSlipsMutation,
  useFinalizePayrollRunMutation,
  useRevertPayrollRunMutation,
  useMarkPayrollRunPaidMutation,
  useDeletePayrollRunMutation,
} from '@/lib/redux/api/payrollRunApiSlice'
import {
  useLazyGetBranchAttendanceByPeriodQuery,
  useLazyGetOtRequestsQuery
} from '@/lib/redux/api/attendanceApiSlice'
import { shiftsEnabled } from '@/lib/attendance/shifts'
import { calcPayroll, fmtAmt, toPeriodKey, periodLabel } from '@/utils/payrollCalculations'
import { allocateTaken } from '@/lib/payroll/repayments'
import { exportPayrollToPDF, exportPayrollToExcel } from '@/utils/export/exportPayroll'
import { computeAttendance } from '@/lib/attendance/computeHours'
import { startOfMonth, endOfMonth, addDays, subDays, format } from 'date-fns'
import { skipToken } from '@reduxjs/toolkit/query'
import PayrollPrintView from './components/PayrollPrintView'
import useResolvedCompanyBranch from '@/utils/useResolvedCompanyBranch'
import { can } from '@/lib/authz/permissions'
import { confirmDialog, toast } from "@/app/components/ui/notify";
import { Banknote, Building2, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileSpreadsheet, FileText, Lock, MoreHorizontal, Printer, Save, Search, Trash2, Undo2, Users, Wallet } from 'lucide-react'
import { Button, Card, DatePicker, EmptyState, Field, Input, Menu, Sheet, Skeleton, cn } from '@/app/components/ui'
import { Chip } from '@/app/components/entry/Choices'
import StatTiles from '@/app/components/purchases/StatTiles'
import StatusScreen from '@/app/components/common/StatusScreen'
import useCurrency from '@/app/hooks/useCurrency'
import { formatMoney } from '@/lib/region/currency'
import SlipCard from './components/SlipCard'

import { salaryMonth } from '@/lib/payroll/salaryMonth'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const today = new Date()
const currentYear  = today.getFullYear()
const currentMonth = today.getMonth() + 1
const round2 = v => Math.round((Number(v) || 0) * 100) / 100

function getStaffName (s) {
  if (!s) return ''
  if (s.firstName || s.lastName) return `${s.firstName || ''} ${s.lastName || ''}`.trim()
  return s.name || s.staffName || ''
}

function buildDefaultInputs () {
  return {
    workedHours: '',  workedDays: '',
    otHours: '',      phHours: '',  phDays: '',
    allowanceOverride: '',
    bonus: '',        bonusNote: '',
    otherEarnings: '', otherEarningsNote: '',
    penalty: '',      penaltyNote: '',
    otherDeductions: '', otherDeductionsNote: '',
    loanOverride: '', loanNote: '',
    extraNote: '',
  }
}

// ─── Main PayrollBuilder ───────────────────────────────────────────────────────

export default function PayrollBuilder () {
  // the branch being viewed: a branch user's own, or the one a company role picked
  const { ready: authReady, user: sessionUser, companyId, branchId } = useResolvedCompanyBranch()
  const currentUser = sessionUser || {}
  const role = sessionUser?.role || null

  const currency = useCurrency()
  const money = n => formatMoney(Number(n) || 0, currency)

  const [year,  setYear]  = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const period = toPeriodKey(year, month)

  // Per-staff attendance inputs: { [staffId]: inputs }
  const [slipInputs, setSlipInputs] = useState({})
  const [searchTerm, setSearchTerm] = useState('')

  const [busy, setBusy] = useState(false)
  const [showPaidModal, setShowPaidModal] = useState(false)
  const [paidForm, setPaidForm] = useState({ method: '', reference: '', paidAt: '' })
  const [printTarget, setPrintTarget] = useState(null) // { mode: 'single'|'all', slip? }

  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get('period')
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(asked || '')) {
      setYear(Number(asked.slice(0, 4)))
      setMonth(Number(asked.slice(5, 7)))
    }
  }, [])

  const skip = !companyId || !branchId

  const { data: staffList = [] }    = useGetStaffListQuery({ companyId, branchId }, { skip })
  const { data: branchSettings }    = useGetBranchSettingsQuery(skip ? skipToken : { companyId, branchId })
  const { data: companyData }       = useGetCompanyDetailsQuery(companyId ?? skipToken)
  const { data: branchDoc }         = useGetSingleBranchQuery(skip ? skipToken : { companyId, branchId })

  const companyName = companyData?.name || ''
  const branchName  = branchDoc?.name || branchSettings?.basic?.name || 'Branch'
  // Only approved ones can have an instalment to deduct (repaid ones are closed).
  const { data: advanceList = [] }  = useGetAdvanceEntriesQuery({ companyId, branchId, status: 'approved' }, { skip })
  const { data: loanList = [] }     = useGetStaffLoansQuery({ companyId, branchId, status: 'approved' }, { skip })
  const { data: runs = [] }         = useGetPayrollRunsQuery(skip ? skipToken : { companyId, branchId, period })

  // Existing run for this period (if any) — defined early so slips query can use runId
  const existingRun = runs.find(r => r.period === period) || null
  const runId       = existingRun?.id || null
  const locked      = existingRun?.status === 'finalized' || existingRun?.status === 'paid'

  const { data: savedSlips = [] } = useGetPayrollSlipsQuery(
    companyId && branchId && runId ? { companyId, branchId, runId } : skipToken
  )

  // Reset inputs when period changes so stale inputs from previous period don't carry over
  const [lastPeriod, setLastPeriod] = useState(period)
  useEffect(() => {
    if (period !== lastPeriod) {
      setSlipInputs({})
      setInputsRestoredFor(null)
      setLastPeriod(period)
    }
  }, [period, lastPeriod])

  // Restore attendance inputs from saved slips when a draft is loaded / period changes
  const [inputsRestoredFor, setInputsRestoredFor] = useState(null)
  useEffect(() => {
    if (!savedSlips.length) return
    if (inputsRestoredFor === runId) return   // already restored for this run
    const restored = {}
    for (const slip of savedSlips) {
      restored[slip.staffId] = {
        workedHours:          String(slip.workedHours      ?? ''),
        workedDays:           String(slip.workedDays       ?? ''),
        otHours:              String(slip.otHours          ?? ''),
        phHours:              String(slip.phHours          ?? ''),
        phDays:               String(slip.phDays           ?? ''),
        allowanceOverride:    String(slip.allowanceOverride ?? ''),
        bonus:                String(slip.bonus            ?? ''),
        bonusNote:            slip.bonusNote               || '',
        otherEarnings:        String(slip.otherEarnings    ?? ''),
        otherEarningsNote:    slip.otherEarningsNote       || '',
        penalty:              String(slip.penalty          ?? ''),
        penaltyNote:          slip.penaltyNote             || '',
        otherDeductions:      String(slip.otherDeductions  ?? ''),
        otherDeductionsNote:  slip.otherDeductionsNote     || '',
        loanOverride:         slip.loanOverride != null ? String(slip.loanOverride) : '',
        loanNote:             slip.loanNote               || '',
        extraNote:            slip.extraNote              || '',
      }
    }
    setSlipInputs(restored)
    setInputsRestoredFor(runId)
  }, [savedSlips, runId, inputsRestoredFor])

  const [createDraft]    = useCreatePayrollDraftMutation()
  const [saveDraftSlips] = useSaveDraftSlipsMutation()
  const [finalize]       = useFinalizePayrollRunMutation()
  const [revert]         = useRevertPayrollRunMutation()
  const [markPaid]       = useMarkPayrollRunPaidMutation()
  const [deleteDraft]    = useDeletePayrollRunMutation()
  const [fetchAttendance] = useLazyGetBranchAttendanceByPeriodQuery()
  const [fetchOtRequests] = useLazyGetOtRequestsQuery()

  const payrollConfig = branchSettings?.payroll || null

  const isAdminOrManager = can(role, 'payroll.manage') // roles matrix: branchAdmin, manager, company roles

  const filteredStaff = useMemo(() => {
    if (!searchTerm) return staffList
    const s = searchTerm.toLowerCase()
    return staffList.filter(st => {
      const name = getStaffName(st).toLowerCase()
      return name.includes(s)
    })
  }, [staffList, searchTerm])

  // ── Advance/loan deductions per staff for this period ─────────────────────
  const advanceByStaff = useMemo(() => {
    const map = {}
    for (const adv of advanceList) {
      // Deduct only what was actually handed over (approved AND paid out).
      if (!adv.staffId || adv.status !== 'approved' || !isPaidOut(adv)) continue
      const inst = (adv.installments || []).find(i => i.month === period && i.status === 'pending')
      if (!inst) continue
      map[adv.staffId] = (map[adv.staffId] || []).concat({
        docId: adv.id, index: inst.index, amount: inst.amount,
      })
    }
    return map
  }, [advanceList, period])

  const loanByStaff = useMemo(() => {
    const map = {}
    for (const ln of loanList) {
      if (!ln.staffId || ln.status !== 'approved' || !isPaidOut(ln)) continue
      const inst = (ln.installments || []).find(i => i.month === period && i.status === 'pending')
      if (!inst) continue
      map[ln.staffId] = (map[ln.staffId] || []).concat({
        docId: ln.id, index: inst.index, amount: inst.amount,
      })
    }
    return map
  }, [loanList, period])

  // ── Totals for header ─────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let gross = 0, net = 0, empCost = 0
    for (const staff of staffList) {
      const inputs  = slipInputs[staff.id] || buildDefaultInputs()
      const advDed  = (advanceByStaff[staff.id] || []).reduce((s, a) => s + a.amount, 0)
      const loanDed = (loanByStaff[staff.id]    || []).reduce((s, a) => s + a.amount, 0)
      const mode    = staff.salaryMode || payrollConfig?.defaultPayMode || 'hours'
      const stdH    = parseFloat(staff.standardHours) || parseFloat(payrollConfig?.standardHoursPerMonth) || 208
      const wrkD    = parseFloat(staff.workingDays)   || parseFloat(payrollConfig?.workingDaysPerMonth)   || 26

      const effectiveLoanAmt = inputs.loanOverride !== ''
        ? (parseFloat(inputs.loanOverride) || 0)
        : loanDed
      const effectiveAllowanceAmt = inputs.allowanceOverride !== ''
        ? (parseFloat(inputs.allowanceOverride) || 0)
        : (parseFloat(staff.allowance) || 0)
      const c = calcPayroll(
        {
          basicSalary: parseFloat(staff.basicSalary) || 0,
          allowance:   effectiveAllowanceAmt,
          salaryMode: mode, standardHours: stdH, workingDays: wrkD,
          OTPerHour:   parseFloat(staff.OTPerHour)   || null,
          otMultiplier: staff.otMultiplier ?? payrollConfig?.otMultiplier ?? 1.5,
          phMultiplier: staff.phMultiplier ?? payrollConfig?.phMultiplier ?? 2.0,
          deductionSettings: staff.deductionSettings || {},
        },
        {
          workedHours:     parseFloat(inputs.workedHours)     || 0,
          workedDays:      parseFloat(inputs.workedDays)      || 0,
          otHours:         parseFloat(inputs.otHours)         || 0,
          phHours:         parseFloat(inputs.phHours)         || 0,
          phDays:          parseFloat(inputs.phDays)          || 0,
          bonus:           parseFloat(inputs.bonus)           || 0,
          otherEarnings:   parseFloat(inputs.otherEarnings)   || 0,
          penalty:         parseFloat(inputs.penalty)         || 0,
          otherDeductions: parseFloat(inputs.otherDeductions) || 0,
          advanceAmt: advDed, loanAmt: effectiveLoanAmt,
        },
        payrollConfig?.statutoryDeductions || [],
        { otMultiplier: payrollConfig?.otMultiplier ?? 1.5, phMultiplier: payrollConfig?.phMultiplier ?? 2.0 }
      )
      gross   += c.grossEarnings
      net     += c.netPay
      empCost += c.totalEmployerCost
    }
    return {
      gross:   Math.round(gross * 100) / 100,
      net:     Math.round(net * 100) / 100,
      empCost: Math.round(empCost * 100) / 100,
    }
  }, [staffList, slipInputs, advanceByStaff, loanByStaff, payrollConfig])

  function flash (type, msg) {
    if (type === 'error') toast.error(msg)
    else toast.success(msg)
  }

  // ── Build slips array from current inputs ─────────────────────────────────
  function buildSlips () {
    return staffList.map(staff => {
      const inputs  = slipInputs[staff.id] || buildDefaultInputs()
      const advItems = advanceByStaff[staff.id] || []
      const lnItems  = loanByStaff[staff.id]    || []
      const advDed   = advItems.reduce((s, a) => s + a.amount, 0)
      const loanDed  = lnItems.reduce((s,  a) => s + a.amount, 0)
      const mode    = staff.salaryMode || payrollConfig?.defaultPayMode || 'hours'
      const stdH    = parseFloat(staff.standardHours) || parseFloat(payrollConfig?.standardHoursPerMonth) || 208
      const wrkD    = parseFloat(staff.workingDays)   || parseFloat(payrollConfig?.workingDaysPerMonth)   || 26

      const effectiveSlipLoan = inputs.loanOverride !== ''
        ? (parseFloat(inputs.loanOverride) || 0)
        : loanDed

      const effectiveSlipAllowance = inputs.allowanceOverride !== ''
        ? (parseFloat(inputs.allowanceOverride) || 0)
        : (parseFloat(staff.allowance) || 0)

      const calc = calcPayroll(
        {
          basicSalary: parseFloat(staff.basicSalary) || 0,
          allowance:   effectiveSlipAllowance,
          salaryMode: mode, standardHours: stdH, workingDays: wrkD,
          OTPerHour:   parseFloat(staff.OTPerHour)   || null,
          otMultiplier: staff.otMultiplier ?? payrollConfig?.otMultiplier ?? 1.5,
          phMultiplier: staff.phMultiplier ?? payrollConfig?.phMultiplier ?? 2.0,
          deductionSettings: staff.deductionSettings || {},
        },
        {
          workedHours:     parseFloat(inputs.workedHours)     || 0,
          workedDays:      parseFloat(inputs.workedDays)      || 0,
          otHours:         parseFloat(inputs.otHours)         || 0,
          phHours:         parseFloat(inputs.phHours)         || 0,
          phDays:          parseFloat(inputs.phDays)          || 0,
          bonus:           parseFloat(inputs.bonus)           || 0,
          otherEarnings:   parseFloat(inputs.otherEarnings)   || 0,
          penalty:         parseFloat(inputs.penalty)         || 0,
          otherDeductions: parseFloat(inputs.otherDeductions) || 0,
          advanceAmt: advDed, loanAmt: effectiveSlipLoan,
        },
        payrollConfig?.statutoryDeductions || [],
        { otMultiplier: payrollConfig?.otMultiplier ?? 1.5, phMultiplier: payrollConfig?.phMultiplier ?? 2.0 }
      )

      return {
        staffId:      staff.id,
        staffName:    getStaffName(staff),
        designation:  staff.designation || staff.role || '',
        department:   staff.department  || staff.group || staff.role || '',
        calc,
        inputs: { ...inputs },
        // Only what the slip actually takes (calcPayroll caps it to the pay;
        // a manager can change the loan amount) — finalize marks exactly
        // this repaid and carries the rest to next month.
        deductionMeta: {
          advances: allocateTaken(advItems, calc.advanceAmt),
          loans:    allocateTaken(lnItems, calc.loanAmt),
        },
      }
    })
  }

  // Build a single slip object for print (from current live inputs)
  function buildSingleSlipForPrint (staff) {
    const slipData = buildSlips().find(s => s.staffId === staff.id)
    if (!slipData) return null
    return {
      ...slipData.calc,
      staffId:      staff.id,
      staffName:    getStaffName(staff),
      designation:  staff.designation || staff.role || '',
      department:   staff.department  || staff.group || staff.role || '',
      status:       existingRun?.status || 'draft',
      bonusNote:           slipData.inputs?.bonusNote           || '',
      otherEarningsNote:   slipData.inputs?.otherEarningsNote   || '',
      penaltyNote:         slipData.inputs?.penaltyNote         || '',
      otherDeductionsNote: slipData.inputs?.otherDeductionsNote || '',
      loanNote:            slipData.inputs?.loanNote            || '',
      extraNote:           slipData.inputs?.extraNote           || '',
    }
  }

  // Build all slips for print
  function buildAllSlipsForPrint () {
    return buildSlips().map(s => ({
      ...s.calc,
      staffId:      s.staffId,
      staffName:    s.staffName,
      designation:  s.designation || '',
      department:   s.department  || '',
      status:       existingRun?.status || 'draft',
      bonusNote:           s.inputs?.bonusNote           || '',
      otherEarningsNote:   s.inputs?.otherEarningsNote   || '',
      penaltyNote:         s.inputs?.penaltyNote         || '',
      otherDeductionsNote: s.inputs?.otherDeductionsNote || '',
      loanNote:            s.inputs?.loanNote            || '',
      extraNote:           s.inputs?.extraNote           || '',
    }))
  }

  // ── Import worked/OT hours from attendance punches for this month ──────────
  async function handleImportAttendance () {
    if (!isAdminOrManager || locked) return

    const hasExisting = staffList.some(s => {
      const inp = slipInputs[s.id]
      return inp && (inp.workedHours || inp.workedDays || inp.otHours)
    })
    if (
      hasExisting &&
      !(await confirmDialog({
        title: 'Replace hours from attendance?',
        message: 'Hours/Days Worked and OT for this month are replaced from the attendance punches. Bonuses, penalties, allowances and notes are kept.',
        confirmLabel: 'Import',
      }))
    ) return

    setBusy(true)
    try {
      const mStart = startOfMonth(new Date(year, month - 1, 1))
      const mEnd = endOfMonth(mStart)
      const startStr = format(mStart, 'yyyy-MM-dd')
      const endStr = format(mEnd, 'yyyy-MM-dd')
      // Query a ±1 day buffer so overnight shifts crossing the month boundary
      // pair correctly; we then keep only computed days inside the month.
      const bufStart = format(subDays(mStart, 1), 'yyyy-MM-dd')
      const bufEnd = format(addDays(mEnd, 1), 'yyyy-MM-dd')

      const punches = await fetchAttendance({
        companyId, branchId, startDate: bufStart, endDate: bufEnd,
      }).unwrap()

      const settings = branchSettings?.attendance || {}

      // Early-OT decisions for the month. Anything still pending is imported as
      // unpaid (paid from shift start) — we warn so it can be approved first.
      let otByStaff = {}
      if (shiftsEnabled(settings)) {
        const otRequests = await fetchOtRequests({
          companyId, branchId, startDate: bufStart, endDate: bufEnd,
        }).unwrap()
        otRequests.forEach(r => {
          if (!r.staffId || !r.date) return
          ;(otByStaff[r.staffId] = otByStaff[r.staffId] || {})[r.date] = r.status
        })
      }

      const updates = {}
      let imported = 0
      let skippedFixed = 0
      let pendingOt = 0
      let lateDays = 0
      for (const staff of staffList) {
        if (staff.fixedSalaryNoAttendance) { skippedFixed++; continue }
        const mine = (punches || []).filter(p => p.staffId === staff.id)
        if (!mine.length) continue
        const { days } = computeAttendance({
          punches: mine, staff, settings, otApprovals: otByStaff[staff.id],
        })
        const inMonth = days.filter(d => d.date >= startStr && d.date <= endStr)
        if (!inMonth.length) continue
        pendingOt += inMonth.filter(d => d.otApproval === 'pending').length
        lateDays += inMonth.filter(d => d.lateMinutes > 0).length
        const basic = round2(inMonth.reduce((s, d) => s + d.basic, 0))
        const ot = round2(inMonth.reduce((s, d) => s + d.ot, 0))
        const daysWorked = inMonth.filter(d => d.worked > 0).length
        const mode = staff.salaryMode || payrollConfig?.defaultPayMode || 'hours'
        updates[staff.id] = { mode, basic, ot, daysWorked }
        imported++
      }

      setSlipInputs(prev => {
        const next = { ...prev }
        for (const [id, u] of Object.entries(updates)) {
          const base = prev[id] || buildDefaultInputs()
          next[id] = {
            ...base,
            ...(u.mode === 'hours'
              ? { workedHours: u.basic ? String(u.basic) : '' }
              : { workedDays: u.daysWorked ? String(u.daysWorked) : '' }),
            otHours: u.ot ? String(u.ot) : '',
          }
        }
        return next
      })

      const parts = [`Imported attendance for ${imported} staff`]
      if (skippedFixed) parts.push(`${skippedFixed} fixed-salary skipped`)
      if (lateDays) parts.push(`${lateDays} late day(s)`)
      if (pendingOt) parts.push(`⚠ ${pendingOt} early-OT day(s) still pending — approve in the Requested Panel and re-import to pay them`)
      flash('ok', `${parts.join(' · ')}. Review and adjust before saving.`)
    } catch (e) {
      flash('error', e.message || 'Failed to import attendance')
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveDraft () {
    if (!isAdminOrManager) return
    setBusy(true)
    try {
      let activeRunId = runId
      if (!activeRunId) {
        const res = await createDraft({ companyId, branchId, period, createdBy: currentUser }).unwrap()
        activeRunId = res.id
      }
      await saveDraftSlips({
        companyId, branchId,
        runId: activeRunId,
        period,
        slips: buildSlips(),
        user: currentUser,
      }).unwrap()
      flash('ok', 'Draft saved.')
    } catch (e) {
      flash('error', e.message || 'Failed to save draft')
    } finally {
      setBusy(false)
    }
  }

  async function handleFinalize () {
    if (!runId) return
    setBusy(true)
    try {
      // Save latest inputs first, then finalize
      await saveDraftSlips({ companyId, branchId, runId, period, slips: buildSlips(), user: currentUser }).unwrap()
      await finalize({ companyId, branchId, runId, finalizedBy: currentUser }).unwrap()
      flash('ok', 'Payroll finalized. Advance/loan installments marked as paid.')
    } catch (e) {
      flash('error', e.message || 'Failed to finalize')
    } finally {
      setBusy(false)
    }
  }

  async function handleRevert () {
    if (!runId) return
    if (!(await confirmDialog({
      title: 'Revert this payroll to draft?',
      message: 'This undoes the finalize step and puts any deducted loan and advance instalments back to pending.',
      danger: true,
      confirmLabel: 'Revert',
    }))) return
    setBusy(true)
    try {
      await revert({ companyId, branchId, runId, user: currentUser }).unwrap()
      flash('ok', 'Reverted to draft. Installments restored.')
    } catch (e) {
      flash('error', e.message || 'Failed to revert')
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkPaid () {
    if (!runId) return
    setBusy(true)
    try {
      // Salaries for this month already entered by hand (Salary Entry)? Then
      // marking the run paid would count the month's salaries twice.
      const { byHand } = await salaryMonth(companyId, branchId, period)
      if (byHand.length) {
        const total = byHand.reduce((n, s) => n + s.amount, 0)
        const ok = await confirmDialog({
          title: `${periodLabel(period)} salaries are already entered by hand`,
          message:
            `${byHand.length === 1 ? 'One salary entry' : `${byHand.length} salary entries`} for this month (${fmtAmt(total)}) ` +
            `${byHand.length === 1 ? 'was' : 'were'} saved on the Salary Entry screen` +
            `${byHand[0]?.paymentDate ? `, paid ${byHand[0].paymentDate}` : ''}.

` +
            'Marking this payroll paid adds every slip as salary too, so the month would be counted twice. ' +
            'Only go on if those entries were for something else (e.g. part-timers not on this payroll).',
          danger: true,
          confirmLabel: 'Mark paid anyway'
        })
        if (!ok) return
      }
      await markPaid({
        companyId, branchId, runId,
        paidBy:           currentUser,
        paymentMethod:    paidForm.method,
        paymentReference: paidForm.reference,
        paidAt:           paidForm.paidAt || undefined,
      }).unwrap()
      setShowPaidModal(false)
      flash('ok', 'Payroll marked as paid.')
    } catch (e) {
      flash('error', e.message || 'Failed to mark paid')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete () {
    if (!runId || locked) return
    if (!(await confirmDialog({ title: 'Delete this draft payroll run?', message: 'Nothing has been paid from it; the draft and its slips are removed.', danger: true }))) return
    setBusy(true)
    try {
      await deleteDraft({ companyId, branchId, runId, user: currentUser }).unwrap()
      flash('ok', 'Draft deleted.')
    } catch (e) {
      flash('error', e.message || 'Failed to delete')
    } finally {
      setBusy(false)
    }
  }

  if (!authReady) return <Skeleton className='m-6 h-64' rounded='rounded-2xl' />

  if (!isAdminOrManager) {
    return (
      <StatusScreen
        full={false}
        icon={Lock}
        tone='warning'
        title='Payroll is run by branch admins, managers and the owner'
        message='Ask your branch admin if a payslip needs changing.'
        actions={[{ label: 'Go home', href: '/', primary: true }]}
      />
    )
  }

  const status = existingRun?.status || 'none'
  const stage = { none: 0, draft: 1, finalized: 2, paid: 3 }[status] ?? 0
  const STEPS = [
    { label: 'Fill in', note: 'hours, extras' },
    { label: 'Draft saved', note: 'still editable' },
    { label: 'Finalized', note: 'loans & advances taken' },
    { label: 'Paid', note: 'counted as salary' },
  ]
  const shiftMonth = d => {
    const m = month + d
    if (m < 1) { setYear(year - 1); setMonth(12) } else if (m > 12) { setYear(year + 1); setMonth(1) } else setMonth(m)
  }
  const hasStaff = staffList.length > 0

  // the one next step for where this month's payroll is
  const primary = !runId || status === 'draft'
    ? status === 'draft'
      ? { label: 'Finalize payroll', icon: CheckCircle2, onClick: handleFinalize }
      : { label: 'Save draft', icon: Save, onClick: handleSaveDraft, disabled: !hasStaff }
    : status === 'finalized'
      ? { label: 'Mark as paid', icon: Wallet, onClick: () => setShowPaidModal(true) }
      : null

  const moreItems = [
    hasStaff && { label: 'Print all payslips', icon: Printer, onSelect: () => setPrintTarget({ mode: 'all' }) },
    hasStaff && { label: 'PDF', icon: FileText, onSelect: () => exportPayrollToPDF(buildAllSlipsForPrint(), branchName, period, existingRun, companyName) },
    hasStaff && { label: 'Excel', icon: FileSpreadsheet, onSelect: () => exportPayrollToExcel(buildAllSlipsForPrint(), branchName, period, existingRun, companyName) },
    status === 'draft' && 'divider',
    status === 'draft' && { label: 'Save changes to the draft', icon: Save, onSelect: handleSaveDraft },
    status === 'finalized' && 'divider',
    status === 'finalized' && { label: 'Back to draft', icon: Undo2, onSelect: handleRevert },
    status === 'draft' && { label: 'Delete the draft', icon: Trash2, danger: true, onSelect: handleDelete },
  ].filter(Boolean)

  return (
    <div className='mx-auto max-w-5xl space-y-4 px-4 py-5 pb-28'>
      {/* ── month and where its payroll is ─────────────────────────────── */}
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight text-fg'>Payroll</h1>
          <p className='text-sm text-muted'>Fill in each payslip, save a draft, finalize, then mark it paid.</p>
        </div>
        <div className='flex items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-card'>
          <Button size='icon' variant='ghost' className='size-9' aria-label='Previous month' onClick={() => shiftMonth(-1)}>
            <ChevronLeft className='size-4' />
          </Button>
          <span className='min-w-[8.5rem] text-center text-sm font-semibold text-fg'>{periodLabel(period)}</span>
          <Button size='icon' variant='ghost' className='size-9' aria-label='Next month' onClick={() => shiftMonth(1)}>
            <ChevronRight className='size-4' />
          </Button>
        </div>
      </div>

      <Card className='p-3 sm:p-4'>
        <ol className='grid grid-cols-4 gap-1'>
          {STEPS.map((st, i) => {
            const done = i < stage || (i === 3 && stage === 3)
            const now = i === stage && stage < 3
            return (
              <li key={st.label} className='min-w-0'>
                <div className={cn('h-1.5 rounded-full', done ? 'bg-brand' : now ? 'bg-brand/40' : 'bg-surface-2')} />
                <p className={cn('mt-2 flex items-center gap-1 truncate text-xs font-semibold', done || now ? 'text-fg' : 'text-subtle')}>
                  {done && <Check className='size-3 shrink-0 text-brand' />}
                  {st.label}
                </p>
                <p className='hidden truncate text-[11px] text-subtle sm:block'>{st.note}</p>
              </li>
            )
          })}
        </ol>
        {existingRun && (
          <p className='mt-3 text-xs text-muted'>
            {existingRun.staffCount || 0} staff saved
            {existingRun.status === 'paid' && existingRun.paymentMethod ? ` · paid by ${existingRun.paymentMethod}` : ''}
            {existingRun.status === 'paid' && existingRun.paymentReference ? ` (${existingRun.paymentReference})` : ''}
            {locked ? ' · payslips are locked' : ''}
          </p>
        )}
      </Card>

      <StatTiles
        tiles={[
          { label: 'Net pay', value: money(totals.net), note: `To ${staffList.length} staff`, icon: Wallet, tone: 'bg-brand-soft text-brand' },
          { label: 'Gross', value: money(totals.gross), note: 'Before deductions', icon: Banknote, tone: 'bg-surface-2 text-muted' },
          { label: 'Employer cost', value: money(totals.empCost), note: 'Gross + employer shares', icon: Building2, tone: 'bg-info-soft text-info' },
        ]}
      />

      {/* ── tools ─────────────────────────────────────────────────────── */}
      <div className='flex flex-wrap items-center gap-2'>
        {hasStaff && staffList.length > 4 && (
          <div className='relative min-w-0 flex-1 basis-56'>
            <Search className='pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle' />
            <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder='Find a staff member…' className='pl-10' aria-label='Find a staff member' />
          </div>
        )}
        {!locked && hasStaff && (
          <Button variant='secondary' icon={Clock} loading={busy} onClick={handleImportAttendance}>
            Fill from attendance
          </Button>
        )}
        {moreItems.length > 0 && (
          <Menu
            align='end'
            width={240}
            trigger={p => (
              <Button {...p} variant='secondary' icon={MoreHorizontal}>
                More
              </Button>
            )}
            items={moreItems}
          />
        )}
      </div>

      {/* ── payslips ──────────────────────────────────────────────────── */}
      {filteredStaff.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={searchTerm ? 'No one by that name' : 'No staff in this branch yet'}
            description={searchTerm ? `Nothing matches “${searchTerm}”.` : 'Add staff in Staff management, with their basic salary, then come back.'}
          />
        </Card>
      ) : (
        <div className='grid gap-3 lg:grid-cols-2 lg:items-start'>
          {filteredStaff.map(staff => (
            <SlipCard
              key={staff.id}
              staff={staff}
              name={getStaffName(staff)}
              money={money}
              inputs={slipInputs[staff.id] || buildDefaultInputs()}
              setInputs={inp => setSlipInputs(prev => ({ ...prev, [staff.id]: inp(prev[staff.id] || buildDefaultInputs()) }))}
              payrollConfig={payrollConfig}
              advanceDed={(advanceByStaff[staff.id] || []).reduce((s, a) => s + a.amount, 0)}
              loanDed={(loanByStaff[staff.id] || []).reduce((s, a) => s + a.amount, 0)}
              locked={locked}
              onPrint={() => setPrintTarget({ mode: 'single', slip: buildSingleSlipForPrint(staff) })}
            />
          ))}
        </div>
      )}

      {/* ── the next step, always in reach ─────────────────────────────── */}
      {primary && hasStaff && (
        <div className='fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-2xl lg:bottom-5 lg:left-[calc(16rem+1.5rem)]'>
          <div className='flex items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 pl-4 shadow-float backdrop-blur'>
            <div className='min-w-0 flex-1'>
              <p className='truncate text-[11px] font-semibold uppercase tracking-wider text-subtle'>{periodLabel(period)} · net pay</p>
              <p className='truncate text-lg font-bold tabular-nums text-fg'>{money(totals.net)}</p>
            </div>
            <Button size='lg' icon={primary.icon} loading={busy} disabled={primary.disabled} onClick={primary.onClick}>
              {primary.label}
            </Button>
          </div>
        </div>
      )}

      {/* ── mark paid ─────────────────────────────────────────────────── */}
      <Sheet
        open={showPaidModal}
        onClose={() => setShowPaidModal(false)}
        title={`Mark ${periodLabel(period)} as paid`}
        description={`${money(totals.net)} net pay to ${staffList.length} staff. Each slip is then counted as salary.`}
        footer={
          <div className='flex justify-end gap-2'>
            <Button variant='ghost' onClick={() => setShowPaidModal(false)}>Cancel</Button>
            <Button icon={Wallet} loading={busy} onClick={handleMarkPaid}>Mark paid</Button>
          </div>
        }
      >
        <div className='space-y-4'>
          <Field label='Paid by'>
            {() => (
              <div>
                <div className='mb-2 flex flex-wrap gap-1.5'>
                  {['Bank transfer', 'Cash', 'Cheque'].map(m => (
                    <Chip key={m} on={paidForm.method === m} onClick={() => setPaidForm(f => ({ ...f, method: m }))}>{m}</Chip>
                  ))}
                </div>
                <Input value={paidForm.method} onChange={e => setPaidForm(f => ({ ...f, method: e.target.value }))} placeholder='Or type how it was paid' />
              </div>
            )}
          </Field>
          <Field label='Reference' hint='Optional'>
            {({ id }) => <Input id={id} value={paidForm.reference} onChange={e => setPaidForm(f => ({ ...f, reference: e.target.value }))} placeholder='Transfer ID or a note' />}
          </Field>
          <Field label='Paid on' hint='Blank = today'>
            {() => <DatePicker value={paidForm.paidAt} onChange={v => setPaidForm(f => ({ ...f, paidAt: v }))} />}
          </Field>
        </div>
      </Sheet>

      {printTarget && (
        <PayrollPrintView
          mode={printTarget.mode}
          singleSlip={printTarget.slip}
          slips={buildAllSlipsForPrint()}
          run={existingRun}
          branchName={branchName}
          companyName={companyName}
          period={period}
          onClose={() => setPrintTarget(null)}
        />
      )}
    </div>
  )
}
