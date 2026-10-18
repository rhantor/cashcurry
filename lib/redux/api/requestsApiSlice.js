// Requests engine (roadmap 4.2): reads advances, staff loans and leave as one
// list (lib/requests/model.js toRequest) and moves any of them through its
// steps — approve, reject, cancel. Leave lives here too; advances and staff
// loans are still created by their own slices, which build the repayment
// schedule. Paying out stays in those slices (PayOutQueue).
import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getOwnDocs, requestFilters } from './recordQueries'
import { createAuditLog } from './auditUtils'
import { advanceApiSlice } from './AdvanceApiSlice'
import { staffLoanApiSlice } from './staffLoanApiSlice'
import {
  REQUEST_TYPES, approvalPatch, byNewest, cancelPatch, leaveDays, newRequestFields, rejectPatch, toRequest,
} from '@/lib/requests/model'

const col = (companyId, branchId, type) =>
  collection(db, 'companies', companyId, 'branches', branchId, REQUEST_TYPES[type].collection)

const ALL = Object.keys(REQUEST_TYPES)

async function load(companyId, branchId, type, { status, unpaid, mine }) {
  const ref = col(companyId, branchId, type)
  if (mine) return getOwnDocs(ref, mine)
  const snap = await getDocs(query(ref, ...requestFilters({ status, unpaid })))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// The money slices cache the same records — tell them when one changes.
function refreshMoney(dispatch, type, id) {
  if (type === 'advance' || type === 'leave') dispatch(advanceApiSlice.util.invalidateTags([{ type: 'Advance', id }, { type: 'Advance', id: 'LIST' }]))
  if (type === 'staffLoan') dispatch(staffLoanApiSlice.util.invalidateTags([{ type: 'Loan', id }, { type: 'Loan', id: 'LIST' }]))
}

const AUDIT = { approve: 'APPROVE_REQUEST', reject: 'REJECT_REQUEST', cancel: 'CANCEL_REQUEST' }

export const requestsApiSlice = createApi({
  reducerPath: 'requestsApiSlice',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Request'],
  endpoints: builder => ({
    /**
     * Requests at a branch, newest first, in one shape.
     * types: which kinds (default all) · status: "pending" or a list ·
     * mine: { uid, staffId } — only this person's (the only query staff may run).
     * A type the user may not read is left out instead of failing the list.
     */
    getRequests: builder.query({
      async queryFn ({ companyId, branchId, types = ALL, status, unpaid, mine }) {
        if (!companyId || !branchId) return { data: [] }
        const lists = await Promise.all(types.map(async type => {
          try {
            return (await load(companyId, branchId, type, { status, unpaid, mine })).map(d => toRequest(type, d))
          } catch (e) {
            if (e?.code === 'permission-denied') return []
            throw e
          }
        })).catch(e => ({ error: e }))
        if (lists.error) return { error: { message: lists.error.message } }
        return { data: lists.flat().sort(byNewest) }
      },
      providesTags: (r = []) => [...r.map(x => ({ type: 'Request', id: `${x.type}/${x.id}` })), { type: 'Request', id: 'LIST' }],
    }),

    /** Ask for leave (or record it, if the user approves leave). */
    addLeave: builder.mutation({
      async queryFn ({ companyId, branchId, user, policy, data }) {
        try {
          const req = {
            type: 'leave',
            staffId: data.staffId || null,
            staffName: data.staffName || '',
            leaveKind: data.leaveKind || 'annual',
            from: data.from,
            to: data.to || data.from,
            halfDay: !!data.halfDay,
            days: leaveDays(data.from, data.to || data.from, data.halfDay),
            reason: data.reason || '',
            createdBy: { uid: user?.uid || '', name: data.createdByName || user?.username || '', role: user?.role || '' },
          }
          if (!req.days) return { error: { message: 'Pick the days of leave' } }
          const now = new Date().toISOString()
          const { type: _type, ...fields } = { ...req, ...newRequestFields(req, user, policy, now) }
          const ref = await addDoc(col(companyId, branchId, 'leave'), { ...fields, companyId, branchId, createdAt: serverTimestamp() })
          await createAuditLog({ companyId, branchId, user, action: 'ADD_LEAVE', details: `Leave for ${req.staffName}: ${req.from} to ${req.to} (${req.days} day${req.days === 1 ? '' : 's'})`, targetId: ref.id })
          return { data: { id: ref.id } }
        } catch (e) {
          return { error: { message: e.message } }
        }
      },
      invalidatesTags: [{ type: 'Request', id: 'LIST' }],
    }),

    /**
     * Approve, reject or cancel any request. Reads it fresh so two managers
     * deciding at once can't skip a step; the database rules check it too.
     */
    decideRequest: builder.mutation({
      async queryFn ({ companyId, branchId, type, id, action, user, policy, reason }) {
        try {
          const ref = doc(col(companyId, branchId, type), id)
          const snap = await getDoc(ref)
          if (!snap.exists()) return { error: { message: 'This request no longer exists' } }
          const req = toRequest(type, { id, ...snap.data() })
          const now = new Date().toISOString()
          const patch =
            action === 'approve' ? approvalPatch(req, user, policy, now)
              : action === 'reject' ? rejectPatch(req, user, policy, reason, now)
                : action === 'cancel' ? cancelPatch(req, user, now)
                  : null
          if (!patch) return { error: { message: `Unknown action: ${action}` } }
          await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() })
          await createAuditLog({
            companyId, branchId, user,
            action: AUDIT[action],
            details: `${action === 'approve' && patch.awaiting ? 'Approved (waiting for the owner)' : action[0].toUpperCase() + action.slice(1) + 'd'} ${REQUEST_TYPES[req.type].label.toLowerCase()} for ${req.staffName}${req.amount ? ` (${req.amount})` : ''}${reason ? `: ${reason}` : ''}`,
            targetId: id,
          })
          return { data: { id, ...patch } }
        } catch (e) {
          return { error: { message: e.message } }
        }
      },
      async onQueryStarted ({ type, id }, { dispatch, queryFulfilled }) {
        try { await queryFulfilled; refreshMoney(dispatch, type, id) } catch { /* shown by the caller */ }
      },
      invalidatesTags: (r, e, { type, id }) => [{ type: 'Request', id: `${type}/${id}` }, { type: 'Request', id: 'LIST' }],
    }),
  }),
})

export const { useGetRequestsQuery, useAddLeaveMutation, useDecideRequestMutation } = requestsApiSlice
