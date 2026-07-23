// Derives the column layout for a monthly sales statement from the data that
// actually exists in the period, so the sheet adapts per branch instead of
// hard-coding one company's chart of accounts.
//
// Layout mirrors the printed statement:
//   MONTH | <sales tenders> | TOTAL SALES | <site office costs> | SALARY |
//   LOANS GIVEN | <HQ office costs> | TOTAL EXPENSES | NET INCOME/LOSS | REMARKS

const N = v => Number(v || 0)

const normalizeCategory = c => {
  const s = String(c ?? '').trim()
  return s || 'Uncategorized'
}

// Cost entries are classified front/back the same way the summary hook does it,
// so a cost never lands in a different band than it does in the cash-flow math.
const isFrontOffice = c => {
  const office = String(c?.paidFromOffice || '').toLowerCase()
  const method = String(c?.paidMethod || c?.method || '').toLowerCase()
  return office === 'front' || method === 'cash'
}

// The HQ (back office) band always shows this fixed set of columns, in this
// order, whether or not there's data that month — the statement is meant to
// look the same every period. Back-office cost entries are folded into these
// via `aliases` (matched on the normalized, lower-cased category). Anything
// that doesn't match a permanent column still gets its own column appended, so
// no spend is ever hidden.
export const HQ_PERMANENT_COLUMNS = [
  { key: 'Rent', label: 'Rent', aliases: ['rent', 'rent/deposit', 'rental', 'rental/installment', 'deposit'] },
  { key: 'SST', label: 'SST', aliases: ['sst', 'tax', 'taxes', 'taxes/license', 'license'] },
  { key: 'Opex', label: 'Opex', aliases: ['opex', 'operation', 'operations'] },
  { key: 'Marketing', label: 'Marketing', aliases: ['marketing', 'marketing/ads', 'ads', 'advertising', 'promotion'] },
  { key: 'New Renovation', label: 'New Renovation', aliases: ['new renovation', 'renovation'] },
]

// Which HQ column a back-office category belongs to: a permanent column when
// an alias matches, otherwise the category itself (a dynamic extra column).
const resolveHqKey = category => {
  const n = normalizeCategory(category).toLowerCase()
  const hit = HQ_PERMANENT_COLUMNS.find(col => col.aliases.includes(n))
  return hit ? hit.key : normalizeCategory(category)
}

const PERMANENT_HQ_KEYS = new Set(HQ_PERMANENT_COLUMNS.map(c => c.key))

/**
 * @param {Array}  rows       daily rows from useSummaryReportLogic (type === 'daily')
 * @param {Array}  tenderDefs branch tender config
 * @returns {{ salesCols, siteCols, hqCols }}
 */
export const buildStatementColumns = (rows = [], tenderDefs = []) => {
  const daily = rows.filter(r => r.type === 'daily')

  const salesCols = tenderDefs
    .filter(t => t.enabled !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(t => ({
      key: t.key,
      label: t.label || t.key,
      includeInTotal: t.includeInTotal !== false
    }))

  // Front office stays fully dynamic — only surface a category column when it
  // moved money this period, since an empty column is noise on a sheet this wide.
  const frontTotals = new Map()
  // Back office: track which non-permanent categories actually appeared so we
  // can append them after the permanent columns.
  const hqDynamicTotals = new Map()

  daily.forEach(r => {
    ;(r.costEntries || []).forEach(c => {
      const amount = N(c.amount)
      if (!amount) return
      if (isFrontOffice(c)) {
        const cat = normalizeCategory(c.category)
        frontTotals.set(cat, (frontTotals.get(cat) || 0) + amount)
      } else {
        const key = resolveHqKey(c.category)
        if (!PERMANENT_HQ_KEYS.has(key)) {
          hqDynamicTotals.set(key, (hqDynamicTotals.get(key) || 0) + amount)
        }
      }
    })
  })

  const dynamicCols = totals =>
    [...totals.keys()]
      .sort((a, b) => a.localeCompare(b))
      .map(cat => ({ key: cat, label: cat }))

  // Permanent HQ columns first (always), then any unmatched back-office
  // categories that carried money this month.
  const hqCols = [
    ...HQ_PERMANENT_COLUMNS.map(c => ({ key: c.key, label: c.label, permanent: true })),
    ...dynamicCols(hqDynamicTotals),
  ]

  return {
    salesCols,
    siteCols: dynamicCols(frontTotals),
    hqCols
  }
}

/**
 * Flattens one daily row into the numbers each column needs.
 * Kept separate from rendering so Excel/PDF export and the table agree.
 */
export const buildStatementRow = (row, cols) => {
  const { salesCols, siteCols, hqCols } = cols

  const sales = {}
  salesCols.forEach(c => {
    sales[c.key] = N(row.tenders?.[c.key])
  })

  const siteCosts = {}
  const hqCosts = {}
  siteCols.forEach(c => (siteCosts[c.key] = 0))
  hqCols.forEach(c => (hqCosts[c.key] = 0))
  ;(row.costEntries || []).forEach(c => {
    if (isFrontOffice(c)) {
      const cat = normalizeCategory(c.category)
      if (cat in siteCosts) siteCosts[cat] += N(c.amount)
    } else {
      // Same resolver the columns were built with, so a back-office cost lands
      // in its permanent column (Rent, SST, …) or its own dynamic one.
      const key = resolveHqKey(c.category)
      if (key in hqCosts) hqCosts[key] += N(c.amount)
    }
  })

  const salary = N(row.salaryCash) + N(row.salaryBank)
  // Front-office (cash) salary advances and staff loans — money that left the
  // office this day, so they belong in the SITE OFFICE band alongside salary.
  const advance = N(row.advance)
  const staffLoan = N(row.staffLoanGiven)
  const loansGiven = N(row.loanGiven)

  const siteTotal = siteCols.reduce((s, c) => s + siteCosts[c.key], 0)
  const hqTotal = hqCols.reduce((s, c) => s + hqCosts[c.key], 0)

  // Advances, staff loans and company loans given all leave the business the
  // same way an expense does, so the printed statement counts them toward
  // total expenses.
  const totalExpenses =
    siteTotal + hqTotal + salary + advance + staffLoan + loansGiven
  const totalSales = N(row.totalSales)

  return {
    date: row.date,
    sales,
    totalSales,
    siteCosts,
    hqCosts,
    salary,
    advance,
    staffLoan,
    loansGiven,
    totalExpenses,
    netIncome: totalSales - totalExpenses
  }
}

/** Column-wise totals for the footer / TOTAL row. */
export const buildStatementTotals = (statementRows, cols) => {
  const { salesCols, siteCols, hqCols } = cols

  const acc = {
    sales: Object.fromEntries(salesCols.map(c => [c.key, 0])),
    siteCosts: Object.fromEntries(siteCols.map(c => [c.key, 0])),
    hqCosts: Object.fromEntries(hqCols.map(c => [c.key, 0])),
    totalSales: 0,
    salary: 0,
    advance: 0,
    staffLoan: 0,
    loansGiven: 0,
    totalExpenses: 0,
    netIncome: 0
  }

  statementRows.forEach(r => {
    salesCols.forEach(c => (acc.sales[c.key] += r.sales[c.key]))
    siteCols.forEach(c => (acc.siteCosts[c.key] += r.siteCosts[c.key]))
    hqCols.forEach(c => (acc.hqCosts[c.key] += r.hqCosts[c.key]))
    acc.totalSales += r.totalSales
    acc.salary += r.salary
    acc.advance += r.advance
    acc.staffLoan += r.staffLoan
    acc.loansGiven += r.loansGiven
    acc.totalExpenses += r.totalExpenses
    acc.netIncome += r.netIncome
  })

  return acc
}

export default buildStatementColumns
