import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { db } from '@/lib/firebase'
import {
  collection,
  getDocs,
  writeBatch,
  query,
  where,
  serverTimestamp,
  doc,
  updateDoc,
  increment,
  runTransaction // We use this for safe updates/deletes
} from 'firebase/firestore'

// Money in cents, so 0.1 + 0.2 lands on 0.30 and a bill paid to the sen is "paid".
const r2 = n => Math.round((Number(n) || 0) * 100) / 100

/** A bill's status from what it costs and what has been paid on it. */
export const billStatus = (total, paid) =>
  r2(paid) <= 0 ? 'unpaid' : r2(paid) >= r2(total) ? 'paid' : 'partially_paid'

export const vendorBillsApiSlice = createApi({
  reducerPath: 'vendorBillsApiSlice',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['VendorBills'],
  endpoints: builder => ({
    /** List bills */
    getVendorBills: builder.query({
      async queryFn ({ companyId, branchId, status, vendorId, startDate, endDate }) {
        try {
          if (!companyId || !branchId) {
            return { error: { message: 'Missing company/branch' } }
          }

          const colRef = collection(
            db,
            'companies',
            companyId,
            'branches',
            branchId,
            'vendorBills'
          )

          const filters = []
          if (status) filters.push(where('status', '==', status))
          if (vendorId) filters.push(where('vendorId', '==', vendorId))
          if (startDate) filters.push(where('invoiceDate', '>=', startDate))
          if (endDate) filters.push(where('invoiceDate', '<=', endDate))

          const q = query(colRef, ...filters)
          const snap = await getDocs(q)

          const data = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) =>
              (a?.invoiceDate || '') < (b?.invoiceDate || '') ? 1 : -1
            )

          return { data }
        } catch (error) {
          console.error('[getVendorBills] query error:', error)
          return { error }
        }
      },
      providesTags: (result, _e, { companyId, branchId }) =>
        result
          ? [
              { type: 'VendorBills', id: `LIST:${companyId}:${branchId}` },
              ...result.map(b => ({ type: 'VendorBills', id: b.id }))
            ]
          : [{ type: 'VendorBills', id: `LIST:${companyId}:${branchId}` }]
    }),

    /** Create Bill */
    addVendorBill: builder.mutation({
      async queryFn ({ companyId, branchId, bill, skipBalanceUpdate = false }) {
        try {
          if (!companyId || !branchId)
            return { error: { message: 'Missing company/branch' } }
          if (!bill?.vendorId) return { error: { message: 'Missing vendorId' } }

          const total = Number(bill.total || 0)
          const now = serverTimestamp()

          const colRef = collection(
            db,
            'companies',
            companyId,
            'branches',
            branchId,
            'vendorBills'
          )

          const payload = {
            vendorId: bill.vendorId,
            vendorName: bill.vendorName || '',
            invoiceNo: bill.invoiceNo || '',
            invoiceDate: bill.invoiceDate,
            dueDate: bill.dueDate,
            total,
            paid: 0,
            balance: total,
            status: 'unpaid',
            items: [],
            attachments: bill.attachments || [],
            notes: bill.note || '',
            createdAt: now,
            updatedAt: now,
            createdBy: bill.createdBy || {}
          }

          // the bill and the vendor's totals are written together, or not at all
          const docRef = doc(colRef)
          const batch = writeBatch(db)
          batch.set(docRef, payload)
          if (!skipBalanceUpdate) {
            batch.update(doc(db, 'companies', companyId, 'vendors', bill.vendorId), {
              currentBalance: increment(total),
              totalBilled: increment(total),
              updatedAt: now
            })
          }
          await batch.commit()

          return { data: { id: docRef.id } }
        } catch (error) {
          console.error('[addVendorBill] error:', error)
          return { error }
        }
      },
      invalidatesTags: (_res, _e, { companyId, branchId }) => [
        { type: 'VendorBills', id: `LIST:${companyId}:${branchId}` }
      ]
    }),

    /** Update Bill (Transaction Safe) */
    updateVendorBill: builder.mutation({
      async queryFn ({ companyId, branchId, billId, updates }) {
        try {
          if (!companyId || !branchId || !billId)
            return { error: { message: 'Missing IDs' } }

          const billRef = doc(
            db,
            'companies',
            companyId,
            'branches',
            branchId,
            'vendorBills',
            billId
          )

          await runTransaction(db, async transaction => {
            const billSnap = await transaction.get(billRef)
            if (!billSnap.exists()) throw new Error('This bill no longer exists.')

            const oldData = billSnap.data()
            const newTotal =
              updates.total !== undefined
                ? r2(updates.total)
                : r2(oldData.total)
            const oldTotal = r2(oldData.total)
            const paid = r2(oldData.paid)
            if (newTotal < paid) {
              throw new Error(`The total can't be less than what is already paid on this bill (${paid.toFixed(2)}).`)
            }

            // What is owed and the status always follow total − paid, so a
            // paid bill whose total goes up shows as owing again (it used to
            // stay "paid" and drop off Due bills).
            const payload = {
              ...updates,
              total: newTotal,
              balance: r2(newTotal - paid),
              status: billStatus(newTotal, paid),
              updatedAt: serverTimestamp()
            }

            if (newTotal !== oldTotal) {
              const diff = r2(newTotal - oldTotal)
              const vendorRef = doc(
                db,
                'companies',
                companyId,
                'vendors',
                oldData.vendorId
              )
              transaction.update(vendorRef, {
                currentBalance: increment(diff),
                totalBilled: increment(diff)
              })
            }

            transaction.update(billRef, payload)
          })

          return { data: { ok: true } }
        } catch (error) {
          console.error('[updateVendorBill] error:', error)
          return { error }
        }
      },
      invalidatesTags: (_r, _e, { billId, companyId, branchId }) => [
        { type: 'VendorBills', id: billId },
        { type: 'VendorBills', id: `LIST:${companyId}:${branchId}` }
      ]
    }),

    /** Delete Bill (Transaction Safe) */
    deleteVendorBill: builder.mutation({
      async queryFn ({ companyId, branchId, billId }) {
        try {
          if (!companyId || !branchId || !billId)
            return { error: { message: 'Missing IDs' } }

          const billRef = doc(
            db,
            'companies',
            companyId,
            'branches',
            branchId,
            'vendorBills',
            billId
          )

          await runTransaction(db, async transaction => {
            const billSnap = await transaction.get(billRef)
            if (!billSnap.exists()) throw new Error('This bill no longer exists.')

            const billData = billSnap.data()

            // Deduct outstanding balance and total billed from vendor
            const amountToDeduct = Number(billData.balance || 0)
            const billTotal = Number(billData.total || 0)

            if (amountToDeduct > 0 || billTotal > 0) {
              const vendorRef = doc(
                db,
                'companies',
                companyId,
                'vendors',
                billData.vendorId
              )
              transaction.update(vendorRef, {
                currentBalance: increment(-amountToDeduct),
                totalBilled: increment(-billTotal)
              })
            }

            transaction.delete(billRef)
          })

          return { data: { ok: true } }
        } catch (error) {
          console.error('[deleteVendorBill] error:', error)
          return { error }
        }
      },
      invalidatesTags: (_r, _e, { companyId, branchId }) => [
        { type: 'VendorBills', id: `LIST:${companyId}:${branchId}` }
      ]
    }),

    /** Append Attachment */
    appendBillAttachment: builder.mutation({
      async queryFn ({ companyId, branchId, billId, url }) {
        try {
          const ref = doc(
            db,
            'companies',
            companyId,
            'branches',
            branchId,
            'vendorBills',
            billId
          )
          await updateDoc(ref, {
            attachments: [url],
            updatedAt: serverTimestamp()
          })
          return { data: { ok: true } }
        } catch (error) {
          console.error('[appendBillAttachment] error:', error)
          return { error }
        }
      },
      invalidatesTags: (_r, _e, { billId, companyId, branchId }) => [
        { type: 'VendorBills', id: billId },
        { type: 'VendorBills', id: `LIST:${companyId}:${branchId}` }
      ]
    })
  })
})

export const {
  useGetVendorBillsQuery,
  useLazyGetVendorBillsQuery,
  useAddVendorBillMutation,
  useAppendBillAttachmentMutation,
  useUpdateVendorBillMutation,
  useDeleteVendorBillMutation
} = vendorBillsApiSlice
