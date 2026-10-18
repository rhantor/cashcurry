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
  getDoc,
  where
} from 'firebase/firestore'
import { getDocsSince, getOwnDocs, requestFilters } from './recordQueries'
import { createAuditLog } from './auditUtils'

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
            // { date, from, by } once paid out; null = no money has left yet.
            paidOut: data.paidOut ?? null,
            // requests engine (lib/requests/model.js): who approved, and when
            approvals: data.approvals || [],

            companyId,
            branchId,
            createdBy: data.createdBy || {},
            createdAt: serverTimestamp()
          })

          // Audit Log
          await createAuditLog({
            companyId,
            branchId,
            user: data.createdBy,
            action: "ADD_LOAN",
            details: `Added loan for ${data.staffName} (Amount: ${data.amount})`,
            targetId: docRef.id
          });

          return { data: { id: docRef.id, ...data, emi, installments } }
        } catch (error) {
          return { error: { message: error.message } }
        }
      },
      invalidatesTags: [{ type: 'Loan', id: 'LIST' }]
    }),

    // ✅ Get All Loans (Server-Side Filtered)
    getStaffLoans: builder.query({
      // since: dated or paid out from that day on (dashboards)
      // mine: { uid, staffId } — a staff member's own (the only query staff may run)
      // status / unpaid: request lists (pending, waiting to be paid)
      // — see ./recordQueries.js
      async queryFn ({ companyId, branchId, startDate, endDate, since, mine, status, unpaid }) {
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
          // Equality filters alongside a date range would need an index.
          if (!startDate && !endDate) conditions.push(...requestFilters({ status, unpaid }))

          const q = conditions.length > 0
            ? query(ref, ...conditions)
            : query(ref)

          const data = (mine
            ? await getOwnDocs(ref, mine)
            : since
              ? await getDocsSince(ref, 'date', since, { paidOut: true })
              : (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() })))
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
      async queryFn ({ companyId, branchId, loanId, installmentIndex, user }) {
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

          // Audit Log
          await createAuditLog({
            companyId,
            branchId,
            user, // Assuming user is passed from UI
            action: "MARK_LOAN_INSTALLMENT_PAID",
            details: `Manually marked loan installment ${installmentIndex} as paid for loan ID: ${loanId}`,
            targetId: loanId
          });

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

    // ✅ Update Loan (approve/reject/edit)
    updateStaffLoan: builder.mutation({
      async queryFn ({ companyId, branchId, id, data, user }) {
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

          // Audit Log
          await createAuditLog({
            companyId,
            branchId,
            user: user || data.updatedBy,
            action: "UPDATE_LOAN",
            details: `Updated loan entry ID: ${id}. Status: ${data.status || 'N/A'}, Amount: ${data.amount || 'N/A'}`,
            targetId: id
          });

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


    // ✅ Pay out an approved staff loan: money leaves the till or bank now.
    // Until this runs (paidOut: null) the staff loan moves no cash — see
    // lib/finance/rules.js paidOutOf.
    payOutStaffLoan: builder.mutation({
      async queryFn ({ companyId, branchId, id, date, from, user }) {
        try {
          const docRef = doc(db, 'companies', companyId, 'branches', branchId, 'loans', id)
          const by = { uid: user?.uid || '', name: user?.username || user?.name || '', role: user?.role || '' }
          const paidOut = { date, from: from === 'back' ? 'back' : 'front', by, recordedAt: new Date().toISOString() }
          // paidFromOffice mirrors it for screens that read the older field.
          await updateDoc(docRef, { paidOut, paidFromOffice: paidOut.from, updatedAt: serverTimestamp() })
          await createAuditLog({
            companyId,
            branchId,
            user,
            action: 'PAY_OUT_LOAN',
            details: `Paid out staff loan ${id} on ${date} from ${paidOut.from === 'back' ? 'bank' : 'till'}`,
            targetId: id
          })
          return { data: { id, paidOut } }
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

          // Audit Log
          await createAuditLog({
            companyId,
            branchId,
            user: editedBy,
            action: "UPDATE_LOAN_TERMS",
            details: `Edited repayment terms for loan ID: ${loanId}. Note: ${managerNote || 'None'}`,
            targetId: loanId
          });

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
      async queryFn ({ companyId, branchId, id, user }) {
        try {
          const docRef = doc(db, 'companies', companyId, 'branches', branchId, 'loans', id);
          const snap = await getDoc(docRef);
          const oldData = snap.exists() ? snap.data() : {};

          await deleteDoc(docRef)

          // Audit Log
          await createAuditLog({
            companyId,
            branchId,
            user,
            action: "DELETE_LOAN",
            details: `Deleted loan for ${oldData.staffName} (Amount: ${oldData.amount})`,
            targetId: id
          });

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
  usePayOutStaffLoanMutation,
} = staffLoanApiSlice
