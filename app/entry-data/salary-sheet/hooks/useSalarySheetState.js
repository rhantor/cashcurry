'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  exportSalarySheetCSV,
  exportSalarySheetExcel,
  exportSalarySheetPDF
} from '../lib/exportSalarySheet'
import useCurrency from '@/app/hooks/useCurrency'

const toNum = v => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const fmt = n =>
  toNum(n).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

const calcRow = r => {
  const otPay = toNum(r.otHours) * toNum(r.otRate)
  const gross =
    toNum(r.basicSalary) + toNum(r.allowance) + otPay + toNum(r.bonus)

  const deduction = toNum(r.penalty) + toNum(r.advance) + toNum(r.loan)
  const netPay = gross - deduction

  return { ...r, otPay, gross, netPay }
}

const sumTotals = rows =>
  rows.reduce(
    (acc, r) => {
      acc.basicSalary += toNum(r.basicSalary)
      acc.allowance += toNum(r.allowance)
      acc.otPay += toNum(r.otPay)
      acc.bonus += toNum(r.bonus)
      acc.penalty += toNum(r.penalty)
      acc.advance += toNum(r.advance)
      acc.loan += toNum(r.loan)
      acc.gross += toNum(r.gross)
      acc.netPay += toNum(r.netPay)
      return acc
    },
    {
      basicSalary: 0,
      allowance: 0,
      otPay: 0,
      bonus: 0,
      penalty: 0,
      advance: 0,
      loan: 0,
      gross: 0,
      netPay: 0
    }
  )

export function useSalarySheetState ({
  ready,
  staffList,
  companyId,
  branchId,
  createSheet,

  // ✅ provided by page (single source of truth)
  month,
  setMonth,

  existingSheet = null,
  loadingSheet = false
}) {
  const currency = useCurrency()
  const [title, setTitle] = useState('')
  const [standardHours, setStandardHours] = useState(208)

  const [items, setItems] = useState([])

  // prevent overwriting unsaved work
  const [dirty, setDirty] = useState(false)
  const hydratedMonthRef = useRef(null)

  const staffMap = useMemo(() => {
    const m = new Map()
    for (const s of staffList || []) {
      const name = `${s.firstName || ''} ${s.lastName || ''}`.trim()
      m.set(s.id, {
        id: s.id,
        name,
        basicSalary: toNum(s.basicSalary),
        allowance: toNum(s.allowance),
        perHour: toNum(s.perHour),
        otPerHour: toNum(s.otPerHour)
      })
    }
    return m
  }, [staffList])

  const staffOptions = useMemo(() => Array.from(staffMap.values()), [staffMap])

  const addRow = useCallback(() => {
    setDirty(true)
    setItems(prev => [
      ...prev,
      {
        staffId: '',
        staffName: '',
        basicSalary: 0,
        allowance: 0,
        basicHours: toNum(standardHours),
        otHours: 0,
        otRate: 0,
        bonus: 0,
        penalty: 0,
        advance: 0,
        loan: 0,
        remarks: ''
      }
    ])
  }, [standardHours])

  const removeRow = idx => {
    setDirty(true)
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const patchRow = (idx, patch) => {
    setDirty(true)
    setItems(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const onSelectStaff = (idx, staffId) => {
    setDirty(true)
    const s = staffMap.get(staffId)

    if (!s) {
      patchRow(idx, {
        staffId: '',
        staffName: '',
        basicSalary: 0,
        allowance: 0,
        otRate: 0
      })
      return
    }

    patchRow(idx, {
      staffId: s.id,
      staffName: s.name,
      basicSalary: s.basicSalary,
      allowance: s.allowance,
      otRate: s.otPerHour
    })
  }

  const computedItems = useMemo(() => items.map(calcRow), [items])
  const totals = useMemo(() => sumTotals(computedItems), [computedItems])

  const canSave =
    computedItems.length > 0 && computedItems.every(r => r.staffId)

  const periodText = useMemo(() => {
    try {
      return new Date(month + '-01').toLocaleDateString('en-MY', {
        month: 'long',
        year: 'numeric'
      })
    } catch {
      return month
    }
  }, [month])

  // ✅ hydrate when month changes and sheet loaded
  useEffect(() => {
    if (!ready || !companyId || !branchId) return
    if (!month) return

    if (hydratedMonthRef.current === month) return
    if (dirty) return // don't overwrite unsaved edits

    hydratedMonthRef.current = month

    if (!existingSheet) {
      setTitle('')
      setStandardHours(208)
      setItems([])
      return
    }

    setTitle(existingSheet.title || '')
    setStandardHours(toNum(existingSheet.standardHours) || 208)

    const safeItems = Array.isArray(existingSheet.items)
      ? existingSheet.items.map(it => ({
          staffId: it.staffId || '',
          staffName: it.staffName || '',
          basicSalary: toNum(it.basicSalary),
          allowance: toNum(it.allowance),
          basicHours:
            toNum(it.basicHours) || toNum(existingSheet.standardHours) || 208,
          otHours: toNum(it.otHours),
          otRate: toNum(it.otRate),
          bonus: toNum(it.bonus),
          penalty: toNum(it.penalty),
          advance: toNum(it.advance),
          loan: toNum(it.loan),
          remarks: String(it.remarks || '')
        }))
      : []

    setItems(safeItems)
  }, [ready, companyId, branchId, month, existingSheet, dirty])

  const setMonthSafe = nextMonth => {
    if (nextMonth === month) return
    if (dirty) {
      const ok = window.confirm(
        'You have unsaved changes. Switch month anyway?'
      )
      if (!ok) return
    }
    setDirty(false)
    hydratedMonthRef.current = null
    setMonth(nextMonth)
  }

  const handleSave = async () => {
    if (!ready || !companyId || !branchId) return
    if (!canSave) return

    const payload = {
      month,
      title: title || `Salary Sheet - ${month}`,
      standardHours: toNum(standardHours),
      items: computedItems.map(r => ({
        staffId: r.staffId,
        staffName: r.staffName,
        basicSalary: toNum(r.basicSalary),
        allowance: toNum(r.allowance),
        basicHours: toNum(r.basicHours),
        otHours: toNum(r.otHours),
        otRate: toNum(r.otRate),
        bonus: toNum(r.bonus),
        penalty: toNum(r.penalty),
        advance: toNum(r.advance),
        loan: toNum(r.loan),
        remarks: String(r.remarks || ''),
        netPay: toNum(r.netPay)
      }))
    }

    try {
      await createSheet({ companyId, branchId, data: payload }).unwrap()
      setDirty(false)
      hydratedMonthRef.current = month
      alert('Salary sheet saved successfully!')
    } catch (err) {
      console.error(err)
      alert('Failed to save salary sheet. Please try again.')
    }
  }

  const handlePrint = () => window.print()

  const handleExportExcel = () =>
    exportSalarySheetExcel({
      month,
      title,
      standardHours,
      rows: computedItems,
      totals,
      currency
    })

  const handleExportCSV = () =>
    exportSalarySheetCSV({
      month,
      title,
      standardHours,
      rows: computedItems,
      totals,
      currency
    })

  const handleExportPDF = async () =>
    exportSalarySheetPDF({
      month,
      title,
      standardHours,
      rows: computedItems,
      totals,
      currency
    })

  return {
    month,
    setMonth,
    setMonthSafe,
    title,
    setTitle,
    standardHours,
    setStandardHours,

    items,
    computedItems,
    totals,
    staffOptions,

    addRow,
    removeRow,
    patchRow,
    onSelectStaff,

    canSave,
    periodText,
    dirty,
    loadingSheet,

    fmt,
    handleSave,
    handlePrint,
    handleExportExcel,
    handleExportCSV,
    handleExportPDF
  }
}
