// exportAdvanceData: the helpers part (moved from exportAdvanceData.js unchanged).
/* eslint-disable no-useless-escape */
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isWithinInterval } from 'date-fns'

/* ==========================================================
   Helpers
========================================================== */


// Excel sheet name max 31 chars + cannot contain: \ / ? * [ ]
export const safeSheetName = (name = 'Staff') => {
  return String(name || 'Staff')
    .replace(/[\\\/\?\*\[\]]/g, '')
    .slice(0, 31)
}

export const getCreatedAtText = advance => {
  // Firestore timestamp object: { seconds, nanoseconds }
  if (advance?.createdAt?.seconds) {
    return new Date(advance.createdAt.seconds * 1000).toLocaleString()
  }
  // If you sometimes store ISO string
  if (typeof advance?.createdAt === 'string') {
    const d = new Date(advance.createdAt)
    if (!Number.isNaN(d.getTime())) return d.toLocaleString()
  }
  return 'Unknown'
}

export const buildFilterMeta = (filterType, dateRange = {}, selectedMonth = '') => {
  let filterText = 'All Data'
  let fileFilterName = 'all'

  switch (filterType) {
    case 'weekly':
      filterText = 'This Week'
      fileFilterName = 'this_week'
      break
    case 'monthly':
      filterText = 'This Month'
      fileFilterName = 'this_month'
      break
    case 'last7days':
      filterText = 'Last 7 Days'
      fileFilterName = 'last_7_days'
      break
    case 'range':
      if (dateRange.from && dateRange.to) {
        const start = format(new Date(dateRange.from), 'dd/MM/yyyy')
        const end = format(new Date(dateRange.to), 'dd/MM/yyyy')
        filterText = `${start} - ${end}`
        fileFilterName = `${start.replace(/\//g, '-')}_to_${end.replace(
          /\//g,
          '-'
        )}`
      }
      break
    case 'month':
      if (selectedMonth) {
        const [year, month] = selectedMonth.split('-')
        const monthName = format(new Date(year, month - 1), 'MMMM yyyy')
        filterText = monthName
        fileFilterName = monthName.replace(/\s+/g, '_').toLowerCase()
      }
      break
  }

  return { filterText, fileFilterName }
}

/**
 * IMPORTANT FIX:
 * Staff view export must respect filters by filtering the staff.entries array,
 * then recalculating totals/count/lastDate from the filtered entries.
 */
export const filterEntriesByMeta = (
  rows = [],
  filterType,
  dateRange = {},
  selectedMonth = ''
) => {
  const today = new Date()
  if (!filterType || filterType === 'all') return rows

  const inRange = d => {
    if (!d) return false
    const date = new Date(d)
    if (Number.isNaN(date.getTime())) return false

    if (filterType === 'weekly') {
      return isWithinInterval(date, {
        start: startOfWeek(today),
        end: endOfWeek(today)
      })
    }
    if (filterType === 'monthly') {
      return isWithinInterval(date, {
        start: startOfMonth(today),
        end: endOfMonth(today)
      })
    }
    if (filterType === 'last7days') {
      return isWithinInterval(date, {
        start: subDays(today, 7),
        end: today
      })
    }
    if (filterType === 'range' && dateRange?.from && dateRange?.to) {
      return isWithinInterval(date, {
        start: new Date(dateRange.from),
        end: new Date(dateRange.to)
      })
    }
    if (filterType === 'month' && selectedMonth) {
      const [y, m] = selectedMonth.split('-')
      return (
        date.getFullYear() === Number(y) && date.getMonth() + 1 === Number(m)
      )
    }
    return true
  }

  return rows.filter(r => inRange(r?.date))
}

export const calcStaffTotalsFromEntries = (entries = []) => {
  const total = entries.reduce((sum, r) => sum + (Number(r?.amount) || 0), 0)
  const count = entries.length
  let lastDate = null
  for (const r of entries) {
    const d = r?.date ? new Date(r.date) : null
    if (d && !Number.isNaN(d.getTime())) {
      if (!lastDate || d > lastDate) lastDate = d
    }
  }
  return { total, count, lastDate }
}

/* ==========================================================
   1) Single Advance -> Excel
========================================================== */
