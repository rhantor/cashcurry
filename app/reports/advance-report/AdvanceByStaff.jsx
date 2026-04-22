'use client'
import React, { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { format } from 'date-fns'

function groupByStaff (rows = []) {
  const map = new Map()

  for (const r of rows) {
    const name = (r.staffName || 'Unknown').trim()
    const amt = Number(r.amount) || 0

    if (!map.has(name)) {
      map.set(name, {
        id: name,
        staffName: name,
        total: 0,
        count: 0,
        lastDate: null,
        entries: []
      })
    }

    AdvanceByStaff.propTypes = {
      approvedAdvances: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
          staffName: PropTypes.string,
          amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
          date: PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.instanceOf(Date)
          ]),
          reason: PropTypes.string
        })
      )
    }

    const agg = map.get(name)
    agg.total += amt
    agg.count += 1

    const dateObj = r.date ? new Date(r.date) : null
    if (dateObj && (!agg.lastDate || dateObj > agg.lastDate))
      agg.lastDate = dateObj

    agg.entries.push(r)
  }

  // sort entries newest first
  const out = Array.from(map.values()).map(s => ({
    ...s,
    entries: [...s.entries].sort((a, b) => new Date(b.date) - new Date(a.date))
  }))

  // sort staff by total desc
  out.sort((a, b) => b.total - a.total)

  return out
}

export default function AdvanceByStaff ({ approvedAdvances = [] }) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(() => new Set()) // Set of staffName

  const staffRows = useMemo(
    () => groupByStaff(approvedAdvances),
    [approvedAdvances]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return staffRows
    return staffRows.filter(s => s.staffName.toLowerCase().includes(q))
  }, [staffRows, query])

  const toggle = name => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className='bg-white rounded-lg shadow overflow-hidden'>
      {/* Search */}
      <div className='p-4 border-b flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between'>
        <div>
          <h2 className='text-lg font-semibold text-gray-900'>
            Total by Staff
          </h2>
          <p className='text-sm text-gray-500'>
            Shows one row per staff (Total + Times). Click a row to expand
            dates.
          </p>
        </div>

        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder='Search staff name...'
          className='w-full sm:w-72 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-mint-200'
        />
      </div>

      {/* Table */}
      <div className='max-h-[70vh] overflow-auto'>
        <table className='min-w-full table-fixed border-separate border-spacing-0'>
          <thead className='sticky top-0 z-20'>
            <tr className='bg-gray-50/90 backdrop-blur'>
              <th className='px-4 py-2 text-left text-sm font-semibold text-gray-700 border-b'>
                Staff
              </th>
              <th className='px-4 py-2 text-right text-sm font-semibold text-gray-700 border-b w-40'>
                Total (RM)
              </th>
              <th className='px-4 py-2 text-center text-sm font-semibold text-gray-700 border-b w-28'>
                Times
              </th>
              <th className='px-4 py-2 text-left text-sm font-semibold text-gray-700 border-b w-40'>
                Last Date
              </th>
            </tr>
          </thead>

          <tbody>
            {filtered.map(s => {
              const isOpen = expanded.has(s.staffName)

              return (
                <React.Fragment key={s.id}>
                  {/* Summary row */}
                  <tr
                    className={[
                      'odd:bg-white even:bg-gray-50',
                      'hover:bg-mint-50 transition-colors cursor-pointer',
                      'border-b border-gray-100'
                    ].join(' ')}
                    onClick={() => toggle(s.staffName)}
                  >
                    <td className='px-4 py-3 text-sm text-gray-900 font-medium'>
                      <div className='flex items-center justify-between gap-3'>
                        <span>{s.staffName}</span>
                        <span className='text-xs px-2 py-1 rounded-full bg-mint-100 text-mint-700'>
                          {isOpen ? 'Hide' : 'Show'} dates
                        </span>
                      </div>
                    </td>

                    <td className='px-4 py-3 text-sm text-right font-semibold text-mint-600'>
                      RM {s.total.toFixed(2)}
                    </td>

                    <td className='px-4 py-3 text-sm text-center font-semibold'>
                      {s.count}
                    </td>

                    <td className='px-4 py-3 text-sm text-gray-700'>
                      {s.lastDate
                        ? format(new Date(s.lastDate), 'dd/MM/yyyy')
                        : '—'}
                    </td>
                  </tr>

                  {/* Expanded details */}
                  {isOpen && (
                    <tr className='bg-white'>
                      <td colSpan={4} className='px-4 pb-4'>
                        <div className='mt-2 rounded-lg border border-gray-200 overflow-hidden'>
                          <div className='bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700'>
                            Entries for {s.staffName}
                          </div>

                          <div className='divide-y'>
                            {s.entries.map(r => (
                              <div
                                key={r.id}
                                className='px-3 py-2 text-sm flex items-start justify-between gap-4'
                              >
                                <div className='min-w-0'>
                                  <div className='font-medium text-gray-900'>
                                    {r.date
                                      ? format(new Date(r.date), 'dd/MM/yyyy')
                                      : '—'}
                                  </div>
                                  <div className='text-xs text-gray-500 truncate'>
                                    {r.reason || '—'}
                                  </div>
                                </div>

                                <div className='font-semibold text-gray-900'>
                                  RM {(Number(r.amount) || 0).toFixed(2)}
                                </div>
                              </div>
                            ))}

                            {s.entries.length === 0 && (
                              <div className='px-3 py-3 text-center text-gray-500 text-sm'>
                                No entries.
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className='p-6 text-center text-gray-500'>
                  No staff found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
