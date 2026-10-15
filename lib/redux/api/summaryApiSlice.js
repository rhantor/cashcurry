import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { db } from '@/lib/firebase'
import {
  collection,
  getCountFromServer,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { COLLECTION, DATE_FIELD } from '@/lib/finance/rules'

/**
 * summaryApiSlice — the monthly summaries the Cloud Functions keep
 * (companies/{companyId}/branches/{branchId}/summaries/{YYYY-MM}, see
 * functions/summaries.js), so a dashboard does not download every record
 * ever entered.
 *
 * getLedgerStart returns what lib/finance/monthly.js `fastStart` needs to
 * decide whether the summaries can stand in for everything before `month`:
 * the earlier months' summaries, and a server-side count of each kind of
 * record dated before the month (1 read per 1,000 records counted).
 */
/**
 * The earlier months' summaries and the server-side counts for `month`
 * ({ month, summaries, countsBefore }), or null when they cannot be read —
 * which just means the full download.
 */
export async function fetchLedgerStart ({ companyId, branchId, month }) {
  try {
    const base = ['companies', companyId, 'branches', branchId]
    const day = `${month}-01`
    const kinds = Object.keys(COLLECTION)
    const [snap, ...counts] = await Promise.all([
      getDocs(query(collection(db, ...base, 'summaries'), where('period', '<', month))),
      ...kinds.map(k =>
        getCountFromServer(query(collection(db, ...base, COLLECTION[k]), where(DATE_FIELD[k], '<', day)))
      ),
    ])
    // Only the plain fields (updatedAt is a Timestamp, not storable in Redux).
    const summaries = snap.docs.map(d => {
      const { period, engineVersion, cashChange, bankChange, counts } = d.data()
      return { period, engineVersion, cashChange, bankChange, counts }
    })
    const countsBefore = Object.fromEntries(kinds.map((k, i) => [k, counts[i].data().count]))
    return { month, summaries, countsBefore }
  } catch (error) {
    console.warn('[summaryApi] ledger start:', error.message)
    return null
  }
}

export const summaryApiSlice = createApi({
  reducerPath: 'summaryApi',
  baseQuery: fakeBaseQuery(),

  endpoints: builder => ({
    getLedgerStart: builder.query({
      async queryFn (args) {
        return { data: await fetchLedgerStart(args) }
      },
    }),
  }),
})

export const { useGetLedgerStartQuery } = summaryApiSlice
