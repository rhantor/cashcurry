import { businessToday } from "@/lib/region";
import { dayKey } from "@/lib/finance/rules";
import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import {
  collection, doc, addDoc, getDoc, getDocs,
  writeBatch, serverTimestamp, query, where, orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createAuditLog } from './auditUtils'
import { applyRepayment } from '@/lib/payroll/repayments'
import { payslipCopy } from '@/lib/payroll/payslipCopy'

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
 *   deductionMeta: { advances:[{docId,index,amount,due}], loans:[…] } — amount = what the slip took
 *
 * On finalize the run also keeps repaymentUndo: each advance/loan as it was
 * before, so a revert puts them back exactly (carry-overs included).
 *   createdAt, updatedAt
 */

const runsPath = (cId, bId) =>
  collection(db, 'companies', cId, 'branches', bId, 'payrollRuns')

const runDoc = (cId, bId, runId) =>
  doc(db, 'companies', cId, 'branches', bId, 'payrollRuns', runId)

// Each person's own copy of their slip (lib/payroll/payslipCopy.js)
const payslipDoc = (cId, bId, staffId, runId) =>
  doc(db, 'companies', cId, 'branches', bId, 'staffPrivate', staffId, 'payslips', runId)

const slipsCol = (cId, bId, runId) =>
  collection(db, 'companies', cId, 'branches', bId, 'payrollRuns', runId, 'slips')

const slipDoc = (cId, bId, runId, slipId) =>
  doc(db, 'companies', cId, 'branches', bId, 'payrollRuns', runId, 'slips', slipId)

// ─── Advance/Loan helpers ───────────────────────────────────────────────────

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

    // ── Create draft run (header only, no slips yet) ──────────────────────────
    createPayrollDraft: builder.mutation({
      async queryFn({ companyId, branchId, period, createdBy }) {
        try {
          const ref = await addDoc(runsPath(companyId, branchId), {
            period,
            status: 'draft',
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
      async queryFn({ companyId, branchId, runId, period, slips, user }) {
        try {
          const batch = writeBatch(db)

          let totalGross = 0, totalNet = 0, totalEmployerCost = 0, totalDeductions = 0

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
            updatedAt: serverTimestamp(),
          })

          await batch.commit()

          // Audit Log
          await createAuditLog({
            companyId,
            branchId,
            user,
            action: "SAVE_PAYROLL_SLIPS",
            details: `Saved/Updated ${slips.length} slips for payroll run period: ${period}`,
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

          // Mark what each slip took repaid (a shortfall carries to next
          // month — lib/payroll/repayments). Several slips can touch one
          // advance or loan, so work on one copy per document; keep what each
          // looked like before so reverting the run can put it back.
          const docs = new Map()
          const load = async (kind, docId) => {
            const key = `${kind}/${docId}`
            if (!docs.has(key)) {
              const ref  = kind === 'advance' ? advanceDoc(companyId, branchId, docId) : loanDoc(companyId, branchId, docId)
              const snap = await getDoc(ref)
              docs.set(key, snap.exists() ? { ref, kind, docId, before: snap.data(), data: { ...snap.data() } } : null)
            }
            return docs.get(key)
          }
          const now = new Date().toISOString()
          for (const slip of slips) {
            const meta = slip.deductionMeta || {}
            const items = [
              ...(meta.advances || []).map(it => ['advance', it]),
              ...(meta.loans    || []).map(it => ['loan', it]),
            ]
            for (const [kind, it] of items) {
              const d = await load(kind, it.docId)
              if (!d) continue
              const res = applyRepayment(d.data.installments || [], it.index, it.amount, { amount: d.data.amount, now })
              if (!res) continue
              d.data = {
                ...d.data,
                installments: res.installments,
                totalPaid: res.totalPaid,
                remainingAmount: res.remainingAmount,
                status: res.allPaid ? 'closed' : d.data.status,
              }
            }
          }
          const undo = []
          for (const d of docs.values()) {
            if (!d) continue
            const { installments, totalPaid, remainingAmount, status } = d.data
            batch.update(d.ref, { installments, totalPaid, remainingAmount, status, updatedAt: serverTimestamp() })
            undo.push({
              kind: d.kind, docId: d.docId,
              installments: d.before.installments || [],
              totalPaid: d.before.totalPaid ?? 0,
              remainingAmount: d.before.remainingAmount ?? d.before.amount ?? 0,
              status: d.before.status || 'approved',
            })
          }

          // Staff see their own slip from now on
          for (const slip of slips) {
            if (slip.staffId) batch.set(payslipDoc(companyId, branchId, slip.staffId, runId), payslipCopy(slip, { runId, status: 'finalized' }))
          }

          // Lock the run
          batch.update(runDoc(companyId, branchId, runId), {
            status: 'finalized',
            repaymentUndo: undo,
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
            details: `Finalized a payroll run`,
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
    revertPayrollRun: builder.mutation({
      async queryFn({ companyId, branchId, runId, user }) {
        try {
          const slipSnap = await getDocs(slipsCol(companyId, branchId, runId))
          const slips = slipSnap.docs.map(d => ({ id: d.id, ...d.data() }))

          const batch = writeBatch(db)

          const runSnap = await getDoc(runDoc(companyId, branchId, runId))
          const undo = runSnap.data()?.repaymentUndo
          if (Array.isArray(undo)) {
            // Put each advance and loan back exactly as it was before finalize
            for (const u of undo) {
              const ref = u.kind === 'advance' ? advanceDoc(companyId, branchId, u.docId) : loanDoc(companyId, branchId, u.docId)
              batch.update(ref, {
                installments: u.installments,
                totalPaid: u.totalPaid,
                remainingAmount: u.remainingAmount,
                status: u.status,
                updatedAt: serverTimestamp(),
              })
            }
          } else {
          // Runs finalized before repaymentUndo existed
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

          }

          // Back to a draft: staff no longer see these slips
          for (const slip of slips) {
            if (slip.staffId) batch.delete(payslipDoc(companyId, branchId, slip.staffId, runId))
          }

          batch.update(runDoc(companyId, branchId, runId), {
            status: 'draft',
            repaymentUndo: null,
            finalizedBy: null,
            finalizedAt: null,
            updatedAt: serverTimestamp(),
          })

          await batch.commit()

          // Audit Log
          await createAuditLog({
            companyId,
            branchId,
            user,
            action: "REVERT_PAYROLL_RUN",
            details: `Reverted a payroll run to draft`,
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

          // The picked date as-is, or today on the branch's clock. (Was UTC:
          // paying at 1am on the 1st booked salaries to the previous month.)
          const paidDateStr = (paidAt && dayKey(paidAt)) || businessToday()

          const salariesColRef = collection(
            db, 'companies', companyId, 'branches', branchId, 'salaries'
          )

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

          // Staff see their slip as paid
          for (const slip of slips) {
            if (slip.staffId) batch.set(payslipDoc(companyId, branchId, slip.staffId, runId), payslipCopy(slip, { runId, status: 'paid', paidOn: paidDateStr }))
          }

          // Update run header
          batch.update(runDoc(companyId, branchId, runId), {
            status:           'paid',
            paidBy:           paidBy || {},
            paymentMethod:    paymentMethod    || '',
            paymentReference: paymentReference || '',
            paidAt:           paidAt ? new Date(paidAt) : serverTimestamp(),
            updatedAt:        serverTimestamp(),
          })

          await batch.commit()

          // Audit Log
          await createAuditLog({
            companyId,
            branchId,
            user: paidBy,
            action: "MARK_PAYROLL_PAID",
            details: `Marked a payroll run as paid. Method: ${paymentMethod}`,
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
            details: `Deleted the draft payroll run for ${data.period}`,
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
  useCreatePayrollDraftMutation,
  useSaveDraftSlipsMutation,
  useFinalizePayrollRunMutation,
  useRevertPayrollRunMutation,
  useMarkPayrollRunPaidMutation,
  useDeletePayrollRunMutation,
} = payrollRunApiSlice
