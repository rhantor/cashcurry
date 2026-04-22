import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { db } from '@/lib/firebase'
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore'

/**
 * summaryApiSlice — reads pre-computed monthly rollup docs written by
 * the rollupSales / rollupCosts / … Cloud Functions.
 *
 * Path: companies/{companyId}/branches/{branchId}/summaries/{YYYY-MM}
 *
 * Stored fields (all safe to use directly for KPI display):
 *   totalSales, salesCount
 *   totalCosts, costsCount
 *   totalDeposits, depositsCount
 *   totalWithdrawals, withdrawalsCount
 *   totalAdvances, advancesCount
 *   totalSalaries, salariesCount
 *
 * ⚠️  Do NOT use these for hand-in-cash / bankExpected calculations.
 *     Those require opening balance + per-row tender data and live in
 *     useBranchData where they have been validated.
 */
export const summaryApiSlice = createApi({
  reducerPath: 'summaryApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Summary'],

  endpoints: builder => ({

    /**
     * Read the rollup doc for a single month.
     * Returns null if the Cloud Function hasn't written it yet
     * (e.g. the month has no transactions, or functions haven't been deployed yet).
     *
     * Usage:
     *   const { data: summary } = useGetMonthlySummaryQuery({ companyId, branchId, month: '2026-04' })
     *   summary?.totalSales   // pre-computed total — instant, 1 read
     */
    getMonthlySummary: builder.query({
      async queryFn ({ companyId, branchId, month }) {
        if (!companyId || !branchId || !month) return { data: null }
        try {
          const ref  = doc(db, 'companies', companyId, 'branches', branchId, 'summaries', month)
          const snap = await getDoc(ref)
          if (!snap.exists()) return { data: null }
          return { data: { id: snap.id, ...snap.data() } }
        } catch (error) {
          console.error('[summaryApi] getMonthlySummary error:', error)
          return { error: { message: error.message } }
        }
      },
      providesTags: (result, error, { month }) => [{ type: 'Summary', id: month }],
    }),

    /**
     * Read all available monthly summaries for a branch, newest first.
     * Useful for month-over-month trend tables on the owner/company dashboard.
     *
     * Usage:
     *   const { data: summaries = [] } = useGetBranchSummariesQuery({ companyId, branchId })
     */
    getBranchSummaries: builder.query({
      async queryFn ({ companyId, branchId }) {
        if (!companyId || !branchId) return { data: [] }
        try {
          const ref  = collection(db, 'companies', companyId, 'branches', branchId, 'summaries')
          const q    = query(ref, orderBy('period', 'desc'))
          const snap = await getDocs(q)
          return { data: snap.docs.map(d => ({ id: d.id, ...d.data() })) }
        } catch (error) {
          console.error('[summaryApi] getBranchSummaries error:', error)
          return { error: { message: error.message } }
        }
      },
      providesTags: ['Summary'],
    }),

  }),
})

export const {
  useGetMonthlySummaryQuery,
  useGetBranchSummariesQuery,
} = summaryApiSlice
