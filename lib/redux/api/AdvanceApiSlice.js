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

  // ─── Helper: build installment schedule ──────────────────────────────────────
  const buildAdvanceSchedule = (amount, installments, repaymentDate, deductionMonth) => {
    const emi = Math.ceil(amount / installments)
    let base;
    if (deductionMonth) {
      const [y, m] = deductionMonth.split('-');
      base = new Date(parseInt(y), parseInt(m) - 1, 1);
    } else {
      base = repaymentDate ? new Date(repaymentDate) : new Date()
      base.setDate(1)
    }

    return Array.from({ length: installments }, (_, i) => {
      const d = new Date(base)
      d.setMonth(d.getMonth() + i)
      const isLast = i === installments - 1
      return {
        index: i + 1,
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        amount: isLast ? amount - emi * (installments - 1) : emi,
        status: 'pending', // "pending" | "paid"
        paidAt: null
      }
    })
  }

  export const advanceApiSlice = createApi({
    reducerPath: 'advanceApiSlice',
    baseQuery: fakeBaseQuery(),
    tagTypes: ['Advance'],
    endpoints: builder => ({
      // ✅ Add Advance
      addAdvanceEntry: builder.mutation({
        async queryFn ({ companyId, branchId, data }) {
          try {
            const ref = collection(
              db,
              'companies',
              companyId,
              'branches',
              branchId,
              'advances'
            )
            const installments = buildAdvanceSchedule(
              data.amount || 0,
              data.repaymentInstallments || 1,
              data.repaymentDate,
              data.deductionMonth
            )
            const emi = installments[0]?.amount || 0

            const docRef = await addDoc(ref, {
              staffId: data.staffId || null,
              staffName: data.staffName || '',

              amount: data.amount || 0,
              advanceType: data.advanceType || 'personal',
              reason: data.reason || '',
              date: data.date || '',
              // Till ('front') or bank ('back'). Was asked on the form but never saved,
              // so every advance counted as cash.
              paidFromOffice: data.paidFromOffice || 'front',
              deductionMonth: data.deductionMonth || null,

              repaymentDate: data.repaymentDate || null,
              repaymentInstallments: data.repaymentInstallments || 1,
              repaymentPerInstallment: emi,
              installments,
              totalPaid: 0,
              remainingAmount: data.amount || 0,

              status: data.status || 'pending',
              approvalNotes: data.approvalNotes || '',
              // { date, from, by } once paid out; null = no money has left yet.
              paidOut: data.paidOut ?? null,
              // requests engine (lib/requests/model.js): the approval trail and
              // which step waits — "branch", "owner", or null once decided
              approvals: data.approvals || [],
              awaiting: data.awaiting ?? (data.status === 'pending' || !data.status ? 'branch' : null),

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
              action: "ADD_ADVANCE",
              details: `Added ${data.advanceType} advance for ${data.staffName} (Amount: ${data.amount})`,
              targetId: docRef.id
            });

            return { data: { id: docRef.id, ...data, installments } }
          } catch (error) {
            return { error: { message: error.message } }
          }
        },
        invalidatesTags: [{ type: 'Advance', id: 'LIST' }]
      }),

      // ✅ Get All Advances
      getAdvanceEntries: builder.query({
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
              'advances'
            )
            
            let conditions = [];
            if (startDate) conditions.push(where("date", ">=", startDate));
            if (endDate) conditions.push(where("date", "<=", endDate));
            // Equality filters alongside a date range would need an index.
            if (!startDate && !endDate) conditions.push(...requestFilters({ status, unpaid }));

            const q = conditions.length > 0
              ? query(ref, ...conditions)
              : query(ref);

            const entries = (mine
              ? await getOwnDocs(ref, mine)
              : since
                ? await getDocsSince(ref, 'date', since, { paidOut: true })
                : (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() })))
              .sort((a, b) => {
                if (b.date !== a.date) return b.date > a.date ? 1 : -1;
                return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
              });
            return { data: entries }
          } catch (error) {
            return { error: { message: error.message } }
          }
        },
        providesTags: (result = []) => [
          ...(result?.map(({ id }) => ({ type: 'Advance', id })) ?? []),
          { type: 'Advance', id: 'LIST' }
        ]
      }),

      // ✅ Mark one installment as paid (manual)
      markAdvanceInstallmentPaid: builder.mutation({
        async queryFn ({ companyId, branchId, advanceId, installmentIndex }) {
          try {
            const docRef = doc(
              db,
              'companies',
              companyId,
              'branches',
              branchId,
              'advances',
              advanceId
            )
            const snap = await getDoc(docRef)
            if (!snap.exists()) return { error: { message: 'Advance not found' } }

            const advance = snap.data()
            const installments = advance.installments.map(inst =>
              inst.index === installmentIndex
                ? { ...inst, status: 'paid', paidAt: new Date().toISOString() }
                : inst
            )

            const totalPaid = installments
              .filter(i => i.status === 'paid')
              .reduce((s, i) => s + i.amount, 0)
            const remainingAmount = advance.amount - totalPaid
            const allPaid = installments.every(i => i.status === 'paid')

            await updateDoc(docRef, {
              installments,
              totalPaid,
              remainingAmount,
              status: allPaid ? 'closed' : advance.status,
              updatedAt: serverTimestamp()
            })

            return {
              data: { advanceId, installmentIndex, totalPaid, remainingAmount }
            }
          } catch (error) {
            return { error: { message: error.message } }
          }
        },
        invalidatesTags: (r, e, { advanceId }) => [
          { type: 'Advance', id: advanceId },
          { type: 'Advance', id: 'LIST' }
        ]
      }),

      // ✅ Update Advance (approve/reject/edit)
      updateAdvanceEntry: builder.mutation({
        async queryFn ({ companyId, branchId, id, data, user }) {
          try {
            const docRef = doc(
              db,
              'companies',
              companyId,
              'branches',
              branchId,
              'advances',
              id
            )
            await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() })

            // Audit Log
            await createAuditLog({
              companyId,
              branchId,
              user: user || data.updatedBy,
              action: "UPDATE_ADVANCE",
              details: `Updated advance entry ID: ${id}. Status: ${data.status || 'N/A'}, Amount: ${data.amount || 'N/A'}`,
              targetId: id
            });

            return { data: { id, ...data } }
          } catch (error) {
            return { error: { message: error.message } }
          }
        },
        invalidatesTags: (r, e, { id }) => [
          { type: 'Advance', id },
          { type: 'Advance', id: 'LIST' }
        ]
      }),


      // ✅ Pay out an approved advance: money leaves the till or bank now.
      // Until this runs (paidOut: null) the advance moves no cash — see
      // lib/finance/rules.js paidOutOf.
      payOutAdvance: builder.mutation({
        async queryFn ({ companyId, branchId, id, date, from, user }) {
          try {
            const docRef = doc(db, 'companies', companyId, 'branches', branchId, 'advances', id)
            const by = { uid: user?.uid || '', name: user?.username || user?.name || '', role: user?.role || '' }
            const paidOut = { date, from: from === 'back' ? 'back' : 'front', by, recordedAt: new Date().toISOString() }
            // paidFromOffice mirrors it for screens that read the older field.
            await updateDoc(docRef, { paidOut, paidFromOffice: paidOut.from, updatedAt: serverTimestamp() })
            await createAuditLog({
              companyId,
              branchId,
              user,
              action: 'PAY_OUT_ADVANCE',
              details: `Paid out advance ${id} on ${date} from ${paidOut.from === 'back' ? 'bank' : 'till'}`,
              targetId: id
            })
            return { data: { id, paidOut } }
          } catch (error) {
            return { error: { message: error.message } }
          }
        },
        invalidatesTags: (r, e, { id }) => [
          { type: 'Advance', id },
          { type: 'Advance', id: 'LIST' }
        ]
      }),

      // ✅ Edit advance repayment terms (manager/branchAdmin only)
      editAdvanceTerms: builder.mutation({
        async queryFn ({ companyId, branchId, advanceId, changes, managerNote, editedBy }) {
          try {
            const ref = doc(db, 'companies', companyId, 'branches', branchId, 'advances', advanceId)
            const snap = await getDoc(ref)
            if (!snap.exists()) return { error: { message: 'Advance not found' } }

            const advance = snap.data()
            let installments = advance.installments.map(inst => ({ ...inst }))

            for (const change of changes) {
              const idx = installments.findIndex(i => i.index === change.index)
              if (idx === -1) continue

              if (change.type === 'amount') {
                installments[idx] = { ...installments[idx], amount: change.amount }
              } else if (change.type === 'defer') {
                const current = installments[idx]
                if (current.status === 'paid') continue

                const [y, m] = current.month.split('-').map(Number)
                let d = new Date(y, m, 1)
                const occupiedMonths = new Set(installments.map(i => i.month))
                let targetMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                while (occupiedMonths.has(targetMonth)) {
                  d.setMonth(d.getMonth() + 1)
                  targetMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                }
                installments[idx] = { ...installments[idx], month: targetMonth }
                installments.sort((a, b) => a.month.localeCompare(b.month))
                installments = installments.map((inst, i) => ({ ...inst, index: i + 1 }))
              }
            }

            const totalPaid = installments.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
            const remainingAmount = advance.amount - totalPaid
            const termEdits = advance.termEdits || []
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
              action: "UPDATE_ADVANCE_TERMS",
              details: `Edited repayment terms for advance ID: ${advanceId}. Note: ${managerNote || 'None'}`,
              targetId: advanceId
            });

            return { data: { advanceId, installments } }
          } catch (error) {
            return { error: { message: error.message } }
          }
        },
        invalidatesTags: (r, e, { advanceId }) => [
          { type: 'Advance', id: advanceId },
          { type: 'Advance', id: 'LIST' },
        ],
      }),

      // ✅ Delete Advance
      deleteAdvanceEntry: builder.mutation({
        async queryFn ({ companyId, branchId, id, user }) {
          try {
            const docRef = doc(
              db,
              'companies',
              companyId,
              'branches',
              branchId,
              'advances',
              id
            )
            
            const snap = await getDoc(docRef);
            const oldData = snap.exists() ? snap.data() : {};

            await deleteDoc(docRef)

            // Audit Log
            await createAuditLog({
              companyId,
              branchId,
              user,
              action: "DELETE_ADVANCE",
              details: `Deleted advance entry for ${oldData.staffName} (Amount: ${oldData.amount})`,
              targetId: id
            });

            return { data: { id } }
          } catch (error) {
            return { error: { message: error.message } }
          }
        },
        invalidatesTags: (r, e, { id }) => [
          { type: 'Advance', id },
          { type: 'Advance', id: 'LIST' }
        ]
      })
    })
  })

  export const {
    useAddAdvanceEntryMutation,
    useGetAdvanceEntriesQuery,
    useMarkAdvanceInstallmentPaidMutation,
    useUpdateAdvanceEntryMutation,
    useEditAdvanceTermsMutation,
    useDeleteAdvanceEntryMutation,
    usePayOutAdvanceMutation,
  } = advanceApiSlice
