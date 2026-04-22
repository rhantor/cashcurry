import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { db } from '@/lib/firebase'
import {
  collection,
  doc,
  serverTimestamp,
  getDocs,
  getDoc,
  query,
  where,
  writeBatch
} from 'firebase/firestore'

export const salarySheetApiSlice = createApi({
  reducerPath: 'salarySheetApiSlice',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['SalarySheet', 'Advance', 'Loan'],
  endpoints: builder => ({
    // 1. Save Salary & Mark Loans as Paid
    saveSalarySheet: builder.mutation({
      async queryFn ({ companyId, branchId, data, deductionMeta }) {
        try {
          const batch = writeBatch(db)

          // A. Create/Update Salary Document
          const salaryRef = doc(
            collection(
              db,
              'companies',
              companyId,
              'branches',
              branchId,
              'salarySheets'
            )
          )
          batch.set(salaryRef, {
            ...data,
            companyId,
            branchId,
            status: 'paid',
            deductionMeta, // We save this so we know exactly what to reverse later!
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })

          // B. Update Advance Installments
          if (deductionMeta?.advances) {
            for (const item of deductionMeta.advances) {
              const ref = doc(
                db,
                'companies',
                companyId,
                'branches',
                branchId,
                'advances',
                item.docId
              )
              const snap = await getDoc(ref)
              if (snap.exists()) {
                const docData = snap.data()
                const newInstallments = docData.installments.map(inst =>
                  inst.index === item.index
                    ? {
                        ...inst,
                        status: 'paid',
                        paidAt: new Date().toISOString()
                      }
                    : inst
                )
                const totalPaid = newInstallments
                  .filter(i => i.status === 'paid')
                  .reduce((sum, i) => sum + i.amount, 0)
                const allPaid = newInstallments.every(i => i.status === 'paid')

                batch.update(ref, {
                  installments: newInstallments,
                  totalPaid,
                  remainingAmount: docData.amount - totalPaid,
                  status: allPaid ? 'closed' : 'approved',
                  updatedAt: serverTimestamp()
                })
              }
            }
          }

          // C. Update Loan Installments
          if (deductionMeta?.loans) {
            for (const item of deductionMeta.loans) {
              const ref = doc(
                db,
                'companies',
                companyId,
                'branches',
                branchId,
                'loans',
                item.docId
              )
              const snap = await getDoc(ref)
              if (snap.exists()) {
                const docData = snap.data()
                const newInstallments = docData.installments.map(inst =>
                  inst.index === item.index
                    ? {
                        ...inst,
                        status: 'paid',
                        paidAt: new Date().toISOString(),
                        amount: item.amount
                      }
                    : inst
                )
                const totalPaid = newInstallments
                  .filter(i => i.status === 'paid')
                  .reduce((sum, i) => sum + i.amount, 0)
                const allPaid = newInstallments.every(i => i.status === 'paid')

                batch.update(ref, {
                  installments: newInstallments,
                  totalPaid,
                  remainingAmount: docData.amount - totalPaid,
                  status: allPaid ? 'closed' : 'approved',
                  updatedAt: serverTimestamp()
                })
              }
            }
          }

          await batch.commit()
          return { data: { id: salaryRef.id } }
        } catch (error) {
          console.error('Firebase Error saving salary:', error)
          return { error: { message: error.message } }
        }
      },
      invalidatesTags: ['SalarySheet', 'Advance', 'Loan']
    }),

    // 2. Get Salary Sheets for History
    getSalarySheets: builder.query({
      async queryFn ({ companyId, branchId, period }) {
        if (!companyId || !branchId || !period) return { data: [] }
        try {
          const ref = collection(
            db,
            'companies',
            companyId,
            'branches',
            branchId,
            'salarySheets'
          )
          const q = query(ref, where('period', '==', period))
          const snapshot = await getDocs(q)

          let results = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
          // Sort alphabetically by staff name
          results.sort((a, b) =>
            (a.staffName || '').localeCompare(b.staffName || '')
          )

          return { data: results }
        } catch (error) {
          console.error('Firebase Error in getSalarySheets:', error)
          return { error: { message: error.message } }
        }
      },
      providesTags: ['SalarySheet']
    }),

    // 3. REVERT / VOID SALARY (NEW!)
    revertSalarySheet: builder.mutation({
      async queryFn ({ companyId, branchId, salaryId, deductionMeta }) {
        try {
          const batch = writeBatch(db)

          // A. Delete the Salary Sheet
          const salaryRef = doc(
            db,
            'companies',
            companyId,
            'branches',
            branchId,
            'salarySheets',
            salaryId
          )
          batch.delete(salaryRef)

          // B. Revert Advance Installments back to 'pending'
          if (deductionMeta?.advances) {
            for (const item of deductionMeta.advances) {
              const ref = doc(
                db,
                'companies',
                companyId,
                'branches',
                branchId,
                'advances',
                item.docId
              )
              const snap = await getDoc(ref)
              if (snap.exists()) {
                const docData = snap.data()
                const newInstallments = docData.installments.map(inst =>
                  inst.index === item.index
                    ? { ...inst, status: 'pending', paidAt: null }
                    : inst
                )
                const totalPaid = newInstallments
                  .filter(i => i.status === 'paid')
                  .reduce((sum, i) => sum + i.amount, 0)
                batch.update(ref, {
                  installments: newInstallments,
                  totalPaid,
                  remainingAmount: docData.amount - totalPaid,
                  status: 'approved', // Reset to approved because it is no longer fully paid
                  updatedAt: serverTimestamp()
                })
              }
            }
          }

          // C. Revert Loan Installments back to 'pending'
          if (deductionMeta?.loans) {
            for (const item of deductionMeta.loans) {
              const ref = doc(
                db,
                'companies',
                companyId,
                'branches',
                branchId,
                'loans',
                item.docId
              )
              const snap = await getDoc(ref)
              if (snap.exists()) {
                const docData = snap.data()
                const newInstallments = docData.installments.map(inst =>
                  inst.index === item.index
                    ? { ...inst, status: 'pending', paidAt: null }
                    : inst
                )
                const totalPaid = newInstallments
                  .filter(i => i.status === 'paid')
                  .reduce((sum, i) => sum + i.amount, 0)
                batch.update(ref, {
                  installments: newInstallments,
                  totalPaid,
                  remainingAmount: docData.amount - totalPaid,
                  status: 'approved', // Reset to approved
                  updatedAt: serverTimestamp()
                })
              }
            }
          }

          await batch.commit()
          return { data: { success: true } }
        } catch (error) {
          console.error('Firebase Error reverting salary:', error)
          return { error: { message: error.message } }
        }
      },
      invalidatesTags: ['SalarySheet', 'Advance', 'Loan']
    })
  })
})

export const {
  useSaveSalarySheetMutation,
  useGetSalarySheetsQuery,
  useRevertSalarySheetMutation 
} = salarySheetApiSlice
