import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  writeBatch, serverTimestamp, query, where, orderBy, arrayUnion,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createAuditLog } from './auditUtils'

/**
 * Firestore layout
 * ─────────────────────────────────────────────────────────────────
 * companies/{companyId}/branches/{branchId}/payrollRuns/{runId}
 *   status: 'draft' | 'finalized' | 'paid'
 *   period: 'YYYY-MM'
 *   staffCount, totalGross, totalNet, totalEmployerCost
 *   createdBy, createdAt
 *   finalizedBy, finalizedAt
 *   paidAt, paymentMethod, paymentReference
 *
 * companies/{companyId}/branches/{branchId}/payrollRuns/{runId}/slips/{staffId}
 *   staffId, staffName, period
 *   all calcPayroll() output fields
 *   otherEarningsNote, otherDeductionsNote
 *   deductionMeta: { advances:[{docId,index,amount}], loans:[{docId,index,amount}] }
 *   createdAt, updatedAt
 */

const runsPath = (cId, bId) =>
  collection(db, 'companies', cId, 'branches', bId, 'payrollRuns')

const runDoc = (cId, bId, runId) =>
  doc(db, 'companies', cId, 'branches', bId, 'payrollRuns', runId)

const slipsCol = (cId, bId, runId) =>
  collection(db, 'companies', cId, 'branches', bId, 'payrollRuns', runId, 'slips')

const slipDoc = (cId, bId, runId, slipId) =>
  doc(db, 'companies', cId, 'branches', bId, 'payrollRuns', runId, 'slips', slipId)

// ─── Advance/Loan helpers (reused from salarySheetApiSlice pattern) ───────────

const advanceDoc = (cId, bId, id) =>
  doc(db, 'companies', cId, 'branches', bId, 'advances', id)

const loanDoc = (cId, bId, id) =>
  doc(db, 'companies', cId, 'branches', bId, 'loans', id)

function serialiseTs(d) {
  if (!d) return d
  if (typeof d.toDate === 'function') return d.toDate().toISOString()
  return d
}

function serialiseDoc(id, data) {
  return {
    id,
    ...data,
    createdAt:   serialiseTs(data.createdAt),
    updatedAt:   serialiseTs(data.updatedAt),
    finalizedAt: serialiseTs(data.finalizedAt),
    paidAt:      serialiseTs(data.paidAt),
  }
}

// Who the manager took off a run's sheet, or added to it (28 Oct 2026) —
// kept on the run so the sheet opens the same way next time
function sheetFields (sheet) {
  if (!sheet) return {}
  const ids = (a) => [...new Set((a || []).filter(Boolean).map(String))]
  return { sheetAdded: ids(sheet.added), sheetRemoved: ids(sheet.removed) }
}

export const payrollRunApiSlice = createApi({
  reducerPath: 'payrollRunApiSlice',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['PayrollRun', 'PayrollSlip'],

  endpoints: builder => ({

    // ── List runs for a branch/period ────────────────────────────────────────
    getPayrollRuns: builder.query({
      async queryFn({ companyId, branchId, period }) {
        try {
          let q = period
            ? query(runsPath(companyId, branchId), where('period', '==', period))
            : query(runsPath(companyId, branchId), orderBy('period', 'desc'))

          const snap = await getDocs(q)
          const runs = snap.docs.map(d => serialiseDoc(d.id, d.data()))
          return { data: runs }
        } catch (e) {
          return { error: { message: e.message } }
        }
      },
      providesTags: (res = []) => [
        { type: 'PayrollRun', id: 'LIST' },
        ...res.map(r => ({ type: 'PayrollRun', id: r.id })),
      ],
    }),

    // ── Get single run ────────────────────────────────────────────────────────
    getPayrollRun: builder.query({
      async queryFn({ companyId, branchId, runId }) {
        try {
          const snap = await getDoc(runDoc(companyId, branchId, runId))
          if (!snap.exists()) return { error: { message: 'Run not found' } }
          return { data: serialiseDoc(snap.id, snap.data()) }
        } catch (e) {
          return { error: { message: e.message } }
        }
      },
      providesTags: (r, e, { runId }) => [{ type: 'PayrollRun', id: runId }],
    }),

    // ── Get slips for a run ───────────────────────────────────────────────────
    getPayrollSlips: builder.query({
      async queryFn({ companyId, branchId, runId }) {
        try {
          const snap = await getDocs(slipsCol(companyId, branchId, runId))
          const slips = snap.docs
            .map(d => serialiseDoc(d.id, d.data()))
            .sort((a, b) => (a.staffName || '').localeCompare(b.staffName || ''))
          return { data: slips }
        } catch (e) {
          return { error: { message: e.message } }
        }
      },
      providesTags: (r, e, { runId }) => [{ type: 'PayrollSlip', id: runId }],
    }),

    // What a run paid, staff by staff: its salary entries (payroll_{runId}_{staffId}).
    // A paid month reopened to correct it is shown from these — the staff and
    // the salary terms of that month — not from today's staff list (27 Oct 2026).
    getRunPaidEntries: builder.query({
      async queryFn({ companyId, branchId, runId }) {
        try {
          const snap = await getDocs(query(
            collection(db, 'companies', companyId, 'branches', branchId, 'salaries'),
            where('payrollRunId', '==', runId)
          ))
          return { data: snap.docs.map(d => serialiseDoc(d.id, d.data())) }
        } catch (e) {
          return { error: { message: e.message } }
        }
      },
      providesTags: (r, e, { runId }) => [{ type: 'PayrollSlip', id: `paid_${runId}` }],
    }),

    // ── Create draft run (header only, no slips yet) ──────────────────────────
    createPayrollDraft: builder.mutation({
      async queryFn({ companyId, branchId, period, createdBy, sheet }) {
        try {
          const ref = await addDoc(runsPath(companyId, branchId), {
            period,
            status: 'draft',
            ...sheetFields(sheet),
            staffCount: 0,
            totalGross: 0,
            totalNet: 0,
            totalEmployerCost: 0,
            totalDeductions: 0,
            companyId,
            branchId,
            createdBy: createdBy || {},
            createdAt: serverTimestamp(),
          })

          // Audit Log
          await createAuditLog({
            companyId,
            branchId,
            user: createdBy,
            action: "CREATE_PAYROLL_DRAFT",
            details: `Created draft payroll run for period: ${period}`,
            targetId: ref.id
          });

          return { data: { id: ref.id, period, status: 'draft' } }
        } catch (e) {
          return { error: { message: e.message } }
        }
      },
      invalidatesTags: [{ type: 'PayrollRun', id: 'LIST' }],
    }),

    // ── Save/overwrite draft slips (batch upsert) ─────────────────────────────
    // slips: Array<{ staffId, staffName, calc, inputs, deductionMeta }>
    saveDraftSlips: builder.mutation({
      async queryFn({ companyId, branchId, runId, period, slips, user, sheet }) {
        try {
          const batch = writeBatch(db)

          let totalGross = 0, totalNet = 0, totalEmployerCost = 0, totalDeductions = 0

          // The run is what is on screen: slips of staff no longer in it (e.g.
          // someone added by mistake) are removed, so they are not finalized,
          // paid, or counted in the totals (27 Oct 2026)
          if (!slips.length) return { error: { message: 'Nothing to save — no staff in this payroll.' } }
          const keepIds = new Set(slips.map(s => s.staffId))
          const existing = await getDocs(slipsCol(companyId, branchId, runId))
          existing.docs.forEach(d => { if (!keepIds.has(d.data().staffId || d.id)) batch.delete(d.ref) })

          for (const slip of slips) {
            const { staffId, staffName, calc, inputs, deductionMeta } = slip
            const ref = slipDoc(companyId, branchId, runId, staffId)

            const doc = {
              staffId,
              staffName:    staffName || '',
              designation:  slip.designation || '',
              department:   slip.department  || '',
              period,
              ...calc,
              otherEarningsNote:   inputs?.otherEarningsNote   || '',
              otherDeductionsNote: inputs?.otherDeductionsNote || '',
              bonusNote:           inputs?.bonusNote           || '',
              penaltyNote:         inputs?.penaltyNote         || '',
              loanNote:            inputs?.loanNote            || '',
              // null = auto (no override); '' or number string = manager override
              allowanceOverride: inputs?.allowanceOverride != null ? inputs.allowanceOverride : null,
              loanOverride: inputs?.loanOverride != null ? inputs.loanOverride : null,
              extraNote:         inputs?.extraNote          || '',
              deductionMeta: deductionMeta || { advances: [], loans: [] },
              updatedAt: serverTimestamp(),
            }

            batch.set(ref, doc, { merge: true })

            totalGross        += calc.grossEarnings   || 0
            totalNet          += calc.netPay           || 0
            totalEmployerCost += calc.totalEmployerCost || 0
            totalDeductions   += calc.totalDeductions  || 0
          }

          // Update run header totals
          batch.update(runDoc(companyId, branchId, runId), {
            staffCount:        slips.length,
            totalGross:        Math.round(totalGross        * 100) / 100,
            totalNet:          Math.round(totalNet          * 100) / 100,
            totalEmployerCost: Math.round(totalEmployerCost * 100) / 100,
            totalDeductions:   Math.round(totalDeductions   * 100) / 100,
            ...sheetFields(sheet),
            updatedAt: serverTimestamp(),
          })

          await batch.commit()

          // Audit Log
          await createAuditLog({
            companyId,
            branchId,
            user,
            action: "SAVE_PAYROLL_SLIPS",
            details: `Saved/Updated ${slips.length} slips for payroll run period: ${period} (Run ID: ${runId})`,
            targetId: runId
          });

          return { data: { runId, slipCount: slips.length } }
        } catch (e) {
          return { error: { message: e.message } }
        }
      },
      invalidatesTags: (r, e, { runId }) => [
        { type: 'PayrollRun',  id: runId },
        { type: 'PayrollSlip', id: runId },
      ],
    }),

    // ── Finalize run: lock + mark advance/loan installments paid ─────────────
    finalizePayrollRun: builder.mutation({
      async queryFn({ companyId, branchId, runId, finalizedBy }) {
        try {
          // Load all slips
          const slipSnap = await getDocs(slipsCol(companyId, branchId, runId))
          const slips = slipSnap.docs.map(d => ({ id: d.id, ...d.data() }))

          const batch = writeBatch(db)

          for (const slip of slips) {
            const meta = slip.deductionMeta || {}

            // Mark advance installments paid
            for (const adv of (meta.advances || [])) {
              const ref = advanceDoc(companyId, branchId, adv.docId)
              const snap = await getDoc(ref)
              if (!snap.exists()) continue
              const data = snap.data()
              const installments = (data.installments || []).map(inst =>
                inst.index === adv.index
                  ? { ...inst, status: 'paid', paidAt: new Date().toISOString() }
                  : inst
              )
              const totalPaid = installments.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
              const remaining = data.amount - totalPaid
              const allPaid   = installments.every(i => i.status === 'paid')
              batch.update(ref, {
                installments,
                totalPaid,
                remainingAmount: remaining,
                status: allPaid ? 'closed' : data.status,
                updatedAt: serverTimestamp(),
              })
            }

            // Mark loan installments paid
            for (const ln of (meta.loans || [])) {
              const ref = loanDoc(companyId, branchId, ln.docId)
              const snap = await getDoc(ref)
              if (!snap.exists()) continue
              const data = snap.data()

              let installments = (data.installments || []).map(i => ({ ...i }))
              const targetInst  = installments.find(i => i.index === ln.index)
              if (!targetInst) continue

              // ln.amount = what was actually deducted (may be a manager override)
              const actualPaid  = ln.amount
              const scheduled   = targetInst.amount
              const targetMonth = targetInst.month  // stable identifier after re-index

              if (actualPaid < scheduled) {
                // Partial payment: reduce the installment and add a carry-over
                const carry = scheduled - actualPaid
                installments = installments.map(i =>
                  i.index === ln.index ? { ...i, amount: actualPaid } : i
                )
                const sortedMonths = [...installments.map(i => i.month)].sort()
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
                  note:   `Carried over from ${targetMonth} (partial payment)`,
                })
                installments.sort((a, b) => a.month.localeCompare(b.month))
                installments = installments.map((i, n) => ({ ...i, index: n + 1 }))
              }

              // Mark the target month installment as paid (find by month — index may have shifted)
              installments = installments.map(i =>
                i.month === targetMonth && i.status !== 'paid'
                  ? { ...i, status: 'paid', paidAt: new Date().toISOString() }
                  : i
              )

              const totalPaid = installments.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
              const remaining = data.amount - totalPaid
              const allPaid   = installments.every(i => i.status === 'paid')
              batch.update(ref, {
                installments,
                totalPaid,
                remainingAmount: remaining,
                status: allPaid ? 'closed' : data.status,
                updatedAt: serverTimestamp(),
              })
            }
          }

          // Lock the run
          batch.update(runDoc(companyId, branchId, runId), {
            status: 'finalized',
            finalizedBy: finalizedBy || {},
            finalizedAt: serverTimestamp(),
          })

          await batch.commit()

          // Audit Log
          await createAuditLog({
            companyId,
            branchId,
            user: finalizedBy,
            action: "FINALIZE_PAYROLL_RUN",
            details: `Finalized payroll run ID: ${runId}`,
            targetId: runId
          });

          return { data: { runId, status: 'finalized' } }
        } catch (e) {
          return { error: { message: e.message } }
        }
      },
      invalidatesTags: (r, e, { runId }) => [
        { type: 'PayrollRun',  id: runId },
        { type: 'PayrollRun',  id: 'LIST' },
        { type: 'PayrollSlip', id: runId },
      ],
    }),

    // ── Revert finalized run back to draft ────────────────────────────────────
    // A finalized run back to draft — or a PAID run reopened to correct it
    // (25 Oct 2026): its installments go back to pending as for a revert, and
    // what was paid (day, method, reference) is kept on the run, with the
    // reason, so marking it paid again starts from the same payment. Its
    // salary entries stay as they were until it is marked paid again.
    revertPayrollRun: builder.mutation({
      async queryFn({ companyId, branchId, runId, user, reason = '' }) {
        try {
          const runSnap = await getDoc(runDoc(companyId, branchId, runId))
          if (!runSnap.exists()) return { error: { message: 'Run not found' } }
          const run = runSnap.data()
          const wasPaid = run.status === 'paid'
          if (wasPaid && !String(reason).trim()) return { error: { message: 'Say why the paid payroll is reopened.' } }

          const slipSnap = await getDocs(slipsCol(companyId, branchId, runId))
          const slips = slipSnap.docs.map(d => ({ id: d.id, ...d.data() }))

          const batch = writeBatch(db)

          for (const slip of slips) {
            const meta = slip.deductionMeta || {}

            // Restore advance installments
            for (const adv of (meta.advances || [])) {
              const ref = advanceDoc(companyId, branchId, adv.docId)
              const snap = await getDoc(ref)
              if (!snap.exists()) continue
              const data = snap.data()
              const installments = (data.installments || []).map(inst =>
                inst.index === adv.index
                  ? { ...inst, status: 'pending', paidAt: null }
                  : inst
              )
              const totalPaid = installments.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
              batch.update(ref, {
                installments,
                totalPaid,
                remainingAmount: data.amount - totalPaid,
                status: 'approved',
                updatedAt: serverTimestamp(),
              })
            }

            // Restore loan installments
            for (const ln of (meta.loans || [])) {
              const ref = loanDoc(companyId, branchId, ln.docId)
              const snap = await getDoc(ref)
              if (!snap.exists()) continue
              const data = snap.data()
              const installments = (data.installments || []).map(inst =>
                inst.index === ln.index
                  ? { ...inst, status: 'pending', paidAt: null }
                  : inst
              )
              const totalPaid = installments.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
              batch.update(ref, {
                installments,
                totalPaid,
                remainingAmount: data.amount - totalPaid,
                status: 'approved',
                updatedAt: serverTimestamp(),
              })
            }
          }

          const reopened = wasPaid
            ? {
                at: new Date().toISOString(),
                by: { uid: user?.uid || '', username: user?.username || '', name: user?.name || user?.username || '' },
                reason: String(reason).trim(),
                paidAt: run.paidAt || null,
                paymentMethod: run.paymentMethod || '',
                paymentReference: run.paymentReference || '',
                totalNet: run.totalNet ?? null,
              }
            : null

          batch.update(runDoc(companyId, branchId, runId), {
            status: 'draft',
            finalizedBy: null,
            finalizedAt: null,
            ...(reopened ? { reopened, reopenHistory: arrayUnion(reopened) } : {}),
            updatedAt: serverTimestamp(),
          })

          await batch.commit()

          // Audit Log
          await createAuditLog({
            companyId,
            branchId,
            user,
            action: wasPaid ? "REOPEN_PAID_PAYROLL_RUN" : "REVERT_PAYROLL_RUN",
            details: wasPaid
              ? `Reopened paid payroll run ID: ${runId} (Period: ${run.period}) to correct it. Reason: ${reopened.reason}`
              : `Reverted payroll run ID: ${runId} back to draft`,
            targetId: runId
          });

          return { data: { runId, status: 'draft' } }
        } catch (e) {
          return { error: { message: e.message } }
        }
      },
      invalidatesTags: (r, e, { runId }) => [
        { type: 'PayrollRun',  id: runId },
        { type: 'PayrollRun',  id: 'LIST' },
        { type: 'PayrollSlip', id: runId },
      ],
    }),

    // ── Mark run as paid ──────────────────────────────────────────────────────
    // Also writes one salary entry per staff into the salaries collection so
    // useBranchData / summary reports pick up payroll-paid salaries correctly.
    // Uses deterministic doc IDs (payroll_{runId}_{staffId}) → idempotent: safe
    // to call again if the payment method is corrected.
    markPayrollRunPaid: builder.mutation({
      async queryFn({ companyId, branchId, runId, paidBy, paymentMethod, paymentReference, paidAt }) {
        try {
          const batch = writeBatch(db)

          // Load run header (need the period for the salary entry)
          const runSnap = await getDoc(runDoc(companyId, branchId, runId))
          if (!runSnap.exists()) return { error: { message: 'Run not found' } }
          const runData = runSnap.data()

          // Load all slips so we know net pay per staff member
          const slipSnap = await getDocs(slipsCol(companyId, branchId, runId))
          const slips = slipSnap.docs.map(d => ({ id: d.id, ...d.data() }))

          const paidDateStr = paidAt
            ? new Date(paidAt).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10)

          const salariesColRef = collection(
            db, 'companies', companyId, 'branches', branchId, 'salaries'
          )

          // A run paid again after a correction: entries of staff no longer in
          // it are removed, so nobody is counted from the old payment
          const keep = new Set(slips.map(slip => `payroll_${runId}_${slip.staffId}`))
          const before = await getDocs(query(salariesColRef, where('payrollRunId', '==', runId)))
          before.docs.forEach(d => { if (!keep.has(d.id)) batch.delete(d.ref) })

          // Write/overwrite one salary entry per staff (batch.set → full overwrite = idempotent)
          for (const slip of slips) {
            const salaryRef = doc(salariesColRef, `payroll_${runId}_${slip.staffId}`)
            
            // We save the FULL slip data so the salary report has a complete breakdown.
            // We also map fields to match the manual SalaryEntry structure (month, paymentDate, totalSalary)
            // for full compatibility across all report components.
            batch.set(salaryRef, {
              ...slip,
              // Compatibility fields for Salary Report / Manual Entry components:
              month:           runData.period        || '', // yyyy-MM
              totalSalary:     slip.netPay           || 0,
              amount:          slip.netPay           || 0,
              paymentDate:     paidDateStr,                 // yyyy-MM-dd
              
              // Standard internal fields:
              date:            paidDateStr,
              period:          runData.period        || '',
              payMethod:       paymentMethod         || 'cash',
              payrollRunId:    runId,
              source:          'payroll',
              companyId,
              branchId,
              createdBy:       paidBy                || {},
              createdAt:       serverTimestamp(),
              updatedAt:       serverTimestamp(),
            })
          }

          // Update run header
          batch.update(runDoc(companyId, branchId, runId), {
            status:           'paid',
            paidBy:           paidBy || {},
            paymentMethod:    paymentMethod    || '',
            paymentReference: paymentReference || '',
            paidAt:           paidAt ? new Date(paidAt) : serverTimestamp(),
            reopened:         null, // paid again: the correction is done (kept in reopenHistory)
            updatedAt:        serverTimestamp(),
          })

          await batch.commit()

          // Audit Log
          await createAuditLog({
            companyId,
            branchId,
            user: paidBy,
            action: "MARK_PAYROLL_PAID",
            details: `Marked payroll run ID: ${runId} as Paid. Method: ${paymentMethod}`,
            targetId: runId
          });

          return { data: { runId, status: 'paid', slipCount: slips.length } }
        } catch (e) {
          return { error: { message: e.message } }
        }
      },
      invalidatesTags: (r, e, { runId }) => [
        { type: 'PayrollRun', id: runId },
        { type: 'PayrollRun', id: 'LIST' },
        { type: 'PayrollSlip', id: `paid_${runId}` },
      ],
    }),

    // ── Delete a draft run (and all its slips) ────────────────────────────────
    deletePayrollRun: builder.mutation({
      async queryFn({ companyId, branchId, runId, user }) {
        try {
          const ref = runDoc(companyId, branchId, runId)
          const snap = await getDoc(ref)
          if (!snap.exists()) return { error: { message: 'Run not found' } }
          const data = snap.data()
          if (data.status !== 'draft') {
            return { error: { message: `Cannot delete a ${data.status} payroll run.` } }
          }

          const slipSnap = await getDocs(slipsCol(companyId, branchId, runId))
          const batch = writeBatch(db)
          slipSnap.docs.forEach(d => batch.delete(d.ref))
          batch.delete(ref)
          await batch.commit()

          // Audit Log
          await createAuditLog({
            companyId,
            branchId,
            user,
            action: "DELETE_PAYROLL_RUN",
            details: `Deleted draft payroll run ID: ${runId} (Period: ${data.period})`,
            targetId: runId
          });

          return { data: { runId } }
        } catch (e) {
          return { error: { message: e.message } }
        }
      },
      invalidatesTags: [{ type: 'PayrollRun', id: 'LIST' }],
    }),

  }),
})

export const {
  useGetPayrollRunsQuery,
  useGetPayrollRunQuery,
  useGetPayrollSlipsQuery,
  useGetRunPaidEntriesQuery,
  useCreatePayrollDraftMutation,
  useSaveDraftSlipsMutation,
  useFinalizePayrollRunMutation,
  useRevertPayrollRunMutation,
  useMarkPayrollRunPaidMutation,
  useDeletePayrollRunMutation,
} = payrollRunApiSlice
