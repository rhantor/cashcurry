import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { db } from '@/lib/firebase'
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  getDoc,
  where
} from 'firebase/firestore'

// ─── Helper: build monthly EMI schedule ──────────────────────────────────────
export const buildLoanSchedule = (
  amount,
  durationMonths,
  repaymentStartDate
) => {
  const emi = Math.ceil(amount / durationMonths)
  const base = repaymentStartDate ? new Date(repaymentStartDate) : new Date()
  base.setDate(1)

  return Array.from({ length: durationMonths }, (_, i) => {
    const d = new Date(base)
    d.setMonth(d.getMonth() + i)
    const isLast = i === durationMonths - 1
    return {
      index: i + 1,
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      amount: isLast ? amount - emi * (durationMonths - 1) : emi,
      status: 'pending', // "pending" | "paid"
      paidAt: null
    }
  })
}

export const staffLoanApiSlice = createApi({
  reducerPath: 'staffLoanApiSlice',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Loan'],
  endpoints: builder => ({
    // ✅ Create Loan
    addStaffLoan: builder.mutation({
      async queryFn ({ companyId, branchId, data }) {
        try {
          const ref = collection(
            db,
            'companies',
            companyId,
            'branches',
            branchId,
            'loans'
          )

          let installments = buildLoanSchedule(
            data.amount || 0,
            data.durationMonths || 1,
            data.repaymentStartDate
          )

          // For migration loans: mark the first N installments as already paid
          // so the tracker shows the correct historical state.
          const alreadyPaidCount = Math.min(
            parseInt(data.alreadyPaidMonths) || 0,
            installments.length - 1   // must leave at least 1 pending
          )
          if (alreadyPaidCount > 0) {
            installments = installments.map((inst, i) =>
              i < alreadyPaidCount
                ? { ...inst, status: 'paid', paidAt: 'migration' }
                : inst
            )
          }

          const emi = installments[0]?.amount || 0
          const totalPaid = installments
            .filter(i => i.status === 'paid')
            .reduce((s, i) => s + i.amount, 0)
          const remainingAmount = (data.amount || 0) - totalPaid

          const docRef = await addDoc(ref, {
            staffId: data.staffId || null,
            staffName: data.staffName || '',

            amount: data.amount || 0,
            durationMonths: data.durationMonths || 1,
            emi,
            reason: data.reason || '',
            date: data.date || '',
            repaymentStartDate: data.repaymentStartDate || null,
            paidFromOffice: data.paidFromOffice || 'front',
            // 'migration': loan carried over from before the app was adopted.
            // No cash-out transaction should fire for migration loans.
            source: data.source || 'new',

            installments,
            totalPaid,
            remainingAmount,

            status: data.status || 'pending',
            approvalNotes: data.approvalNotes || '',

            companyId,
            branchId,
            createdBy: data.createdBy || {},
            createdAt: serverTimestamp()
          })

          return { data: { id: docRef.id, ...data, emi, installments } }
        } catch (error) {
          return { error: { message: error.message } }
        }
      },
      invalidatesTags: [{ type: 'Loan', id: 'LIST' }]
    }),

    // ✅ Get All Loans (Server-Side Filtered)
    getStaffLoans: builder.query({
      async queryFn ({ companyId, branchId, startDate, endDate }) {
        if (!companyId || !branchId) return { data: [] }
        try {
          const ref = collection(
            db,
            'companies',
            companyId,
            'branches',
            branchId,
            'loans'
          )
          
          let conditions = []
          if (startDate) conditions.push(where('date', '>=', startDate))
          if (endDate) conditions.push(where('date', '<=', endDate))

          const q = conditions.length > 0
            ? query(ref, ...conditions)
            : query(ref)

          const snapshot = await getDocs(q)
          const data = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => {
              if (b.date !== a.date) return b.date > a.date ? 1 : -1;
              return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
            })
          return { data }
        } catch (error) {
          return { error: { message: error.message } }
        }
      },
      providesTags: (result = []) => [
        ...(result?.map(({ id }) => ({ type: 'Loan', id })) ?? []),
        { type: 'Loan', id: 'LIST' }
      ]
    }),

    // ✅ Mark one installment as paid (manual)
    markStaffLoanInstallmentPaid: builder.mutation({
      async queryFn ({ companyId, branchId, loanId, installmentIndex }) {
        try {
          const docRef = doc(
            db,
            'companies',
            companyId,
            'branches',
            branchId,
            'loans',
            loanId
          )
          const snap = await getDoc(docRef)
          if (!snap.exists()) return { error: { message: 'Loan not found' } }

          const loan = snap.data()
          const installments = loan.installments.map(inst =>
            inst.index === installmentIndex
              ? { ...inst, status: 'paid', paidAt: new Date().toISOString() }
              : inst
          )

          const totalPaid = installments
            .filter(i => i.status === 'paid')
            .reduce((s, i) => s + i.amount, 0)
          const remainingAmount = loan.amount - totalPaid
          const allPaid = installments.every(i => i.status === 'paid')

          await updateDoc(docRef, {
            installments,
            totalPaid,
            remainingAmount,
            status: allPaid ? 'closed' : loan.status,
            updatedAt: serverTimestamp()
          })

          return {
            data: { loanId, installmentIndex, totalPaid, remainingAmount }
          }
        } catch (error) {
          return { error: { message: error.message } }
        }
      },
      invalidatesTags: (r, e, { loanId }) => [
        { type: 'Loan', id: loanId },
        { type: 'Loan', id: 'LIST' }
      ]
    }),

    // ✅ Update Loan (approve/reject)
    updateStaffLoan: builder.mutation({
      async queryFn ({ companyId, branchId, id, data }) {
        try {
          const docRef = doc(
            db,
            'companies',
            companyId,
            'branches',
            branchId,
            'loans',
            id
          )
          await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() })
          return { data: { id, ...data } }
        } catch (error) {
          return { error: { message: error.message } }
        }
      },
      invalidatesTags: (r, e, { id }) => [
        { type: 'Loan', id },
        { type: 'Loan', id: 'LIST' }
      ]
    }),

    // ✅ Edit loan repayment terms (manager/branchAdmin only)
    // Allows: change installment amount, defer a month, add note
    editStaffLoanTerms: builder.mutation({
      async queryFn ({ companyId, branchId, loanId, changes, managerNote, editedBy }) {
        try {
          const ref = doc(db, 'companies', companyId, 'branches', branchId, 'loans', loanId)
          const snap = await getDoc(ref)
          if (!snap.exists()) return { error: { message: 'Loan not found' } }

          const loan = snap.data()
          let installments = loan.installments.map(inst => ({ ...inst }))

          for (const change of changes) {
            // Always find by index value — re-indexing after each iteration means
            // the positional array index changes, but the .index field is re-assigned
            // sequentially so we must re-find after every sort.
            const idx = installments.findIndex(i => i.index === change.index)
            if (idx === -1) continue

            if (change.type === 'amount') {
              installments[idx] = { ...installments[idx], amount: change.amount }
            } else if (change.type === 'partial') {
              const inst = installments[idx]
              if (inst.status === 'paid') continue
              const partial = parseFloat(change.amount) || 0
              const carry   = inst.amount - partial
              if (partial <= 0 || carry <= 0) continue  // invalid partial — skip

              // Reduce this installment to the partial amount paid
              installments[idx] = { ...inst, amount: partial }

              // Append carry-over to the month after the last scheduled installment
              const sortedMonths = installments.map(i => i.month).sort()
              const lastMonth    = sortedMonths[sortedMonths.length - 1]
              const [ly, lm]     = lastMonth.split('-').map(Number)
              const nextDate     = new Date(ly, lm, 1)
              const nextKey      = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`

              installments.push({
                index:  installments.length + 1,
                month:  nextKey,
                amount: carry,
                status: 'pending',
                paidAt: null,
                note:   change.note || `Carried over from ${inst.month} (partial payment)`,
              })

              // Re-sort by month and re-assign indices
              installments.sort((a, b) => a.month.localeCompare(b.month))
              installments = installments.map((i, n) => ({ ...i, index: n + 1 }))
            } else if (change.type === 'defer') {
              // Find by month (stable identifier) when provided; fall back to index.
              // Using month prevents wrong-installment bugs when multiple defers
              // are processed in one batch (indices shift after each re-sort).
              const stableIdx = change.month
                ? installments.findIndex(i => i.month === change.month)
                : idx
              if (stableIdx === -1) continue
              const current = installments[stableIdx]
              if (current.status === 'paid') continue

              // Find the next free month after this one
              const [y, m] = current.month.split('-').map(Number)
              const occupiedMonths = new Set(installments.map(i => i.month))
              let d = new Date(y, m, 1) // first day of next month
              let targetMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
              while (occupiedMonths.has(targetMonth)) {
                d.setMonth(d.getMonth() + 1)
                targetMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
              }

              installments[stableIdx] = { ...current, month: targetMonth }
              installments.sort((a, b) => a.month.localeCompare(b.month))
              installments = installments.map((inst, i) => ({ ...inst, index: i + 1 }))
            }
          }

          const totalPaid = installments.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
          const remainingAmount = loan.amount - totalPaid

          // Append manager note to termEdits history
          const termEdits = loan.termEdits || []
          if (managerNote || changes.length > 0) {
            termEdits.push({
              editedBy: editedBy || {},
              editedAt: new Date().toISOString(),
              note: managerNote || '',
              changes,
            })
          }

          await updateDoc(ref, {
            installments,
            totalPaid,
            remainingAmount,
            termEdits,
            updatedAt: serverTimestamp(),
          })

          return { data: { loanId, installments } }
        } catch (error) {
          return { error: { message: error.message } }
        }
      },
      invalidatesTags: (r, e, { loanId }) => [
        { type: 'Loan', id: loanId },
        { type: 'Loan', id: 'LIST' },
      ],
    }),

    // ✅ Delete Loan
    deleteStaffLoan: builder.mutation({
      async queryFn ({ companyId, branchId, id }) {
        try {
          await deleteDoc(
            doc(db, 'companies', companyId, 'branches', branchId, 'loans', id)
          )
          return { data: { id } }
        } catch (error) {
          return { error: { message: error.message } }
        }
      },
      invalidatesTags: (r, e, { id }) => [
        { type: 'Loan', id },
        { type: 'Loan', id: 'LIST' }
      ]
    })
  })
})

export const {
  useAddStaffLoanMutation,
  useGetStaffLoansQuery,
  useMarkStaffLoanInstallmentPaidMutation,
  useUpdateStaffLoanMutation,
  useEditStaffLoanTermsMutation,
  useDeleteStaffLoanMutation,
} = staffLoanApiSlice
