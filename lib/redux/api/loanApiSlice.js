import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  updateDoc,
  getDoc,
  where,
  writeBatch,
} from "firebase/firestore";

export const loanApiSlice = createApi({
  reducerPath: "loanApiSlice",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["Loan"],
  endpoints: (builder) => ({
    // ✅ Add Loan Request
    addLoanEntry: builder.mutation({
      async queryFn({ companyId, data }) {
        try {
          const loanRef = collection(db, "companies", companyId, "loans");
          const payload = {
            ...data,
            type: "loan",
            status: "pending",
            createdAt: serverTimestamp(),
          };
          const docRef = await addDoc(loanRef, payload);
          return { data: { id: docRef.id, ...payload } };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      invalidatesTags: [{ type: "Loan", id: "LIST" }],
    }),

    // ✅ Add Repayment Entry (supports proof & payment metadata)
    addRepaymentEntry: builder.mutation({
      async queryFn({
        companyId,
        loanId = null,
        fromBranchId,
        toBranchId,
        amount,
        note,
        requestedBy, // { uid, username, role, email? }
        paymentMethod, // "cash" | "online"
        proofUrl, // Firebase Storage URL
        proofMime = null,
        voucherNo = null, // cash
        bankName = null, // online
        referenceNo = null, // online
        autoApprove = false,
        approvedBy = null,
      }) {
        try {
          const amt = Number(amount);
          if (!companyId) return { error: { message: "Missing companyId" } };
          if (!fromBranchId || !toBranchId || fromBranchId === toBranchId) {
            return { error: { message: "Invalid branches" } };
          }
          if (!Number.isFinite(amt) || amt <= 0) {
            return { error: { message: "Invalid amount" } };
          }
          if (!paymentMethod || !proofUrl) {
            return {
              error: { message: "Payment method and proof are required" },
            };
          }

          const repaymentRef = collection(db, "companies", companyId, "loans");
          const payload = {
            loanId,
            fromBranchId,
            toBranchId,
            amount: Number(amt.toFixed(2)),
            type: "repayment",
            note: note || "",
            requestedBy: requestedBy || null,
            paymentMethod,
            proofUrl,
            proofMime,
            voucherNo,
            bankName,
            referenceNo,
            status: autoApprove ? "approved" : "pending",
            createdAt: serverTimestamp(),
            ...(autoApprove
              ? {
                  approvedBy: approvedBy || requestedBy || null,
                  updatedAt: serverTimestamp(),
                }
              : {}),
          };

          const docRef = await addDoc(repaymentRef, payload);
          return { data: { id: docRef.id, ...payload } };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      invalidatesTags: [{ type: "Loan", id: "LIST" }],
    }),

    // ✅ Get Loan & Repayment Entries (INCOMING to this branch only)
    getLoanEntries: builder.query({
      async queryFn({ companyId, branchId }) {
        try {
          const loanRef = collection(db, "companies", companyId, "loans");
          const qAll = query(loanRef, orderBy("createdAt", "desc")); // newest first
          const snapshot = await getDocs(qAll);

          const rows = snapshot.docs.map((docSnap) => {
            const d = docSnap.data();
            // normalize old/new field names
            const _fromBranchId =
              d.requestFromBranchId ?? d.fromBranchId ?? null;
            const _toBranchId = d.requestedToBranchId ?? d.toBranchId ?? null;
            return { id: docSnap.id, ...d, _fromBranchId, _toBranchId };
          });

          // only incoming to this branch
          const incoming = rows.filter((r) => r._toBranchId === branchId);
          return { data: incoming };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      providesTags: (result = []) =>
        result.length
          ? [
              ...result.map(({ id }) => ({ type: "Loan", id })),
              { type: "Loan", id: "LIST" },
            ]
          : [{ type: "Loan", id: "LIST" }],
    }),

    // ✅ Update Loan Entry (approve/reject with auto-offset; initializes remainingAmount)
    updateLoanEntry: builder.mutation({
      async queryFn({ companyId, id, data }) {
        try {
          const loanDocRef = doc(db, "companies", companyId, "loans", id);
          const snap = await getDoc(loanDocRef);
          if (!snap.exists()) return { error: { message: "Loan not found" } };

          const loan = snap.data();

          // Allow rejecting ANY document type here.
          if (data?.status === "rejected") {
            await updateDoc(loanDocRef, {
              status: "rejected",
              approvedBy: data?.approvedBy || null,
              updatedAt: serverTimestamp(),
            });
            const updated = (await getDoc(loanDocRef)).data();
            return { data: { id, ...updated } };
          }

          // Approvals here are only for LOANS (repayments use FIFO mutation)
          if (loan.type === "repayment") {
            return {
              error: {
                message:
                  "Use approveRepaymentWithAllocation to approve repayments",
              },
            };
          }

          const fromBranchId =
            loan.fromBranchId ?? loan.requestFromBranchId ?? null;
          const toBranchId =
            loan.toBranchId ?? loan.requestedToBranchId ?? null;
          const originalAmount = Number(loan.amount) || 0;
          if (!fromBranchId || !toBranchId) {
            return { error: { message: "Loan branches are invalid" } };
          }

          // Compute net owed between the pair using APPROVED docs only
          const allRef = collection(db, "companies", companyId, "loans");
          const allSnap = await getDocs(allRef);

          let netOwed = 0; // >0 means from->to owes; <0 means to->from owes
          allSnap.forEach((d) => {
            const e = d.data();
            if (e.status !== "approved") return;

            const eFrom = e.fromBranchId ?? e.requestFromBranchId;
            const eTo = e.toBranchId ?? e.requestedToBranchId;
            if (!eFrom || !eTo) return;

            const isBetween =
              (eFrom === fromBranchId && eTo === toBranchId) ||
              (eFrom === toBranchId && eTo === fromBranchId);
            if (!isBetween) return;

            const sign = eFrom === fromBranchId ? 1 : -1;
            const amt = Number(e.amount) || 0;
            if (e.type === "loan") netOwed += sign * amt;
            else if (e.type === "repayment") netOwed -= sign * amt;
          });

          // If lender owes borrower (netOwed < 0), offset this new loan
          let repaymentApplied = 0;
          let remainder = originalAmount;
          if (netOwed < 0) {
            repaymentApplied = Math.min(remainder, Math.abs(netOwed));
            remainder -= repaymentApplied;
          }

          // Approve this loan and initialize remainingAmount for FIFO
          await updateDoc(loanDocRef, {
            status: "approved",
            approvedBy: data?.approvedBy || null,
            originalAmount,
            amount: remainder, // after offset
            offsetApplied: repaymentApplied,
            remainingAmount: remainder, // 🔑 for later repayments
            updatedAt: serverTimestamp(),
          });

          // If offset happened, record it as an APPROVED repayment (to -> from)
          if (repaymentApplied > 0) {
            await addDoc(collection(db, "companies", companyId, "loans"), {
              loanId: id,
              fromBranchId: toBranchId, // payer
              toBranchId: fromBranchId, // receiver
              amount: repaymentApplied,
              type: "repayment",
              note: "Auto-offset on loan approval",
              status: "approved",
              createdAt: serverTimestamp(),
            });
          }

          const updated = (await getDoc(loanDocRef)).data();
          return {
            data: {
              id,
              ...updated,
              _meta: { repaymentApplied, remainderBeforeSave: remainder },
            },
          };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      invalidatesTags: (r, e, { id }) => [
        { type: "Loan", id },
        { type: "Loan", id: "LIST" },
      ],
    }),

    // ✅ Approve repayment and allocate FIFO to oldest loans (borrower -> lender)
    approveRepaymentWithAllocation: builder.mutation({
      async queryFn({ companyId, id, approvedBy }) {
        try {
          const repayRef = doc(db, "companies", companyId, "loans", id);
          const repaySnap = await getDoc(repayRef);
          if (!repaySnap.exists())
            return { error: { message: "Repayment not found" } };

          const repay = repaySnap.data();
          if (repay.type !== "repayment")
            return { error: { message: "Not a repayment document" } };
          if (repay.status === "approved") return { data: { id, ...repay } };

          const fromBranchId = repay.requestFromBranchId ?? repay.fromBranchId; // borrower
          const toBranchId = repay.requestedToBranchId ?? repay.toBranchId; // lender
          const repayAmt = Number(repay.amount) || 0;
          if (!fromBranchId || !toBranchId || !repayAmt) {
            return { error: { message: "Invalid repayment" } };
          }

          // 🔁 Helper to get ms from various timestamp shapes
          const tsToMs = (ts) => {
            if (!ts) return 0;
            if (typeof ts === "number") return ts;
            if (ts?.seconds) return ts.seconds * 1000;
            const parsed = Date.parse(ts);
            return Number.isNaN(parsed) ? 0 : parsed;
          };

          // 👇 Query minimal (single field) to avoid composite index:
          const loansRef = collection(db, "companies", companyId, "loans");
          const qLoans = query(loansRef, where("type", "==", "loan"));
          const loansSnap = await getDocs(qLoans);

          // Filter in JS to this borrower→lender pair and approved only
          const candidateLoans = loansSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((ln) => {
              const from = ln.requestFromBranchId ?? ln.fromBranchId;
              const to = ln.requestedToBranchId ?? ln.toBranchId;
              return (
                ln.status === "approved" &&
                from === fromBranchId &&
                to === toBranchId
              );
            })
            // FIFO: oldest first by createdAt
            .sort((a, b) => tsToMs(a.createdAt) - tsToMs(b.createdAt));

          let remaining = repayAmt;
          const allocations = [];
          const batch = writeBatch(db);

          for (const loan of candidateLoans) {
            if (remaining <= 0) break;

            const loanId = loan.id;
            const currentRemaining =
              Number(loan.remainingAmount ?? loan.amount ?? 0) || 0;
            if (currentRemaining <= 0) continue;

            const alloc = Math.min(currentRemaining, remaining);
            const nextRemaining = Number((currentRemaining - alloc).toFixed(2));
            const oneLoanRef = doc(db, "companies", companyId, "loans", loanId);

            const update = {
              remainingAmount: nextRemaining,
              updatedAt: serverTimestamp(),
            };
            if (nextRemaining <= 0.000001) {
              update.settledAt = serverTimestamp();
              update.settledBy = approvedBy || null;
            }
            batch.update(oneLoanRef, update);

            allocations.push({ loanId, allocated: alloc });
            remaining = Number((remaining - alloc).toFixed(2));
          }

          // Approve repayment + record allocation
          batch.update(repayRef, {
            status: "approved",
            approvedBy: approvedBy || null,
            updatedAt: serverTimestamp(),
            allocation: allocations,
            unallocatedRemainder: Math.max(0, remaining),
          });

          await batch.commit();
          const refreshed = (await getDoc(repayRef)).data();
          return { data: { id, ...refreshed } };
        } catch (error) {
          // Optional: surface more detail to UI
          return { error: { message: error?.message || "Approval failed" } };
        }
      },
      invalidatesTags: [{ type: "Loan", id: "LIST" }],
    }),

    // ✅ Approved summary (loans + repayments, status = approved)
    getApprovedLoanSummary: builder.query({
      async queryFn({ companyId, fromMs = null, toMs = null }) {
        try {
          const ref = collection(db, "companies", companyId, "loans");
          const q = query(ref, where("status", "==", "approved"));
          const snap = await getDocs(q);

          const summary = {};
          const ensure = (bid) => {
            if (!summary[bid]) {
              summary[bid] = {
                provided: 0,
                taken: 0,
                net: 0,
                relations: {}, // { otherId: { provided, taken, net, providedLoans[], takenLoans[], lastActivity } }
                providedDetails: [],
                takenDetails: [],
              };
            }
            return summary[bid];
          };
          const ensureRel = (a, b) => {
            const sa = ensure(a);
            if (!sa.relations[b]) {
              sa.relations[b] = {
                provided: 0,
                taken: 0,
                net: 0,
                providedLoans: [],
                takenLoans: [],
                lastActivity: null,
              };
            }
            return sa.relations[b];
          };
          const tsToMs = (ts) => {
            if (!ts) return null;
            if (typeof ts === "number") return ts;
            if (ts?.seconds) return ts.seconds * 1000;
            const parsed = Date.parse(ts);
            return Number.isNaN(parsed) ? null : parsed;
          };

          snap.forEach((d) => {
            const e = d.data();
            const from = e.requestFromBranchId ?? e.fromBranchId ?? null; // borrower
            const to = e.requestedToBranchId ?? e.toBranchId ?? null; // lender
            const amt = Number(e.amount) || 0;
            const type = e.type;
            if (!from || !to || !amt) return;
            if (type !== "loan" && type !== "repayment") return;

            // Date range filter (JS-side — no extra Firestore index needed)
            if (fromMs || toMs) {
              const createdAtMs = tsToMs(e.createdAt);
              if (fromMs && createdAtMs && createdAtMs < fromMs) return;
              if (toMs   && createdAtMs && createdAtMs > toMs)   return;
            }

            const createdAtMs = tsToMs(e.createdAt);
            const approvedAtMs = tsToMs(e.updatedAt) ?? createdAtMs;
            const sign = type === "loan" ? +1 : -1;

            // By-branch totals
            ensure(to).provided += sign * amt;
            ensure(from).taken += sign * amt;

            // Pairwise
            const relForLender = ensureRel(to, from);
            const relForBorrower = ensureRel(from, to);
            relForLender.provided += sign * amt;
            relForBorrower.taken += sign * amt;

            if (type === "loan") {
              const outstanding = Number(e.remainingAmount ?? e.amount ?? 0);
              const settled = outstanding <= 0.000001;
              const settledAtMs = tsToMs(e.settledAt);

              const row = {
                loanId: d.id,
                amount: amt, // original approved amount (for reference)
                outstanding, // 🔹 what's left to pay now
                settled, // 🔹 fully paid?
                settledAt: settledAtMs || null,
                createdAt: createdAtMs,
                approvedAt: approvedAtMs,
                durationDays:
                  createdAtMs && approvedAtMs
                    ? Math.max(
                        0,
                        Math.round((approvedAtMs - createdAtMs) / 86400000)
                      )
                    : 0,
                requestedBy: e.requestedBy ?? e.createdBy ?? null,
                approvedBy: e.approvedBy ?? null,
                fromBranchId: from, // borrower
                toBranchId: to,     // lender
                requestFrom: e.requestFrom || null,   // borrower branch name (stored at creation)
                requestedTo: e.requestedTo || null,   // lender branch name (stored at creation)
                reason: e.reason || null,
                type: "loan",
              };

              // lender’s provided list & relation
              summary[to].providedDetails.push(row);
              relForLender.providedLoans.push(row);

              // borrower’s taken list & relation
              summary[from].takenDetails.push(row);
              relForBorrower.takenLoans.push(row);
            }

            const activity = approvedAtMs ?? createdAtMs ?? null;
            if (activity) {
              relForLender.lastActivity = Math.max(
                relForLender.lastActivity ?? 0,
                activity
              );
              relForBorrower.lastActivity = Math.max(
                relForBorrower.lastActivity ?? 0,
                activity
              );
            }
          });

          // finalize nets
          Object.values(summary).forEach((s) => {
            s.net = Number(s.provided) - Number(s.taken);
            Object.values(s.relations).forEach((r) => {
              r.net = Number(r.provided) - Number(r.taken);
            });
          });

          return { data: summary };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      providesTags: [{ type: "Loan", id: "LIST" }],
    }),
    // loanApiSlice.js (inside endpoints:)
    getLoanActivities: builder.query({
      async queryFn({
        companyId,
        branchId,
        direction = "all",
        status = "all",
        type = "all",
        fromMs = null,
        toMs = null,
        pageLimit = 100,
      }) {
        try {
          if (!companyId) return { data: [] };

          const ref = collection(db, "companies", companyId, "loans");
          const q = query(ref, orderBy("createdAt", "desc"), limit(pageLimit));
          const snap = await getDocs(q);

          const tsToMs = (v) => {
            if (!v) return null;
            if (typeof v === "number") return v;
            if (v?.seconds) return v.seconds * 1000;
            const p = Date.parse(v);
            return Number.isNaN(p) ? null : p;
          };

          const rows = snap.docs.map((d) => {
            const e = d.data();
            const _fromBranchId =
              e.requestFromBranchId ?? e.fromBranchId ?? null; // borrower / payer
            const _toBranchId = e.requestedToBranchId ?? e.toBranchId ?? null; // lender / receiver
            return { id: d.id, ...e, _fromBranchId, _toBranchId };
          });

          // filter by date range
          const byDate = rows.filter((r) => {
            if (!fromMs && !toMs) return true;
            const ms = tsToMs(r.createdAt);
            if (!ms) return true;
            if (fromMs && ms < fromMs) return false;
            if (toMs   && ms > toMs)   return false;
            return true;
          });

          // filter by branch & direction
          const byDirection = byDate.filter((r) => {
            if (!branchId || direction === "all") return true;
            if (direction === "incoming") return r._toBranchId === branchId;
            if (direction === "outgoing") return r._fromBranchId === branchId;
            return true;
          });

          // filter by status
          const byStatus = byDirection.filter((r) =>
            status === "all" ? true : r.status === status
          );

          // filter by type
          const byType = byStatus.filter((r) =>
            type === "all" ? true : r.type === type
          );

          return { data: byType };
        } catch (error) {
          return {
            error: { message: error?.message || "Failed to load activities" },
          };
        }
      },
      providesTags: [{ type: "Loan", id: "LIST" }],
    }),
    // Get all loans/repayments created/requested by THIS user (company-wide)
    getMyLoanActivities: builder.query({
      async queryFn({ companyId, userId }) {
        try {
          if (!companyId || !userId) return { data: [] };
          const ref = collection(db, "companies", companyId, "loans");

          // two simple queries; merge in JS (no composite index needed)
          const q1 = query(ref, where("createdBy.uid", "==", userId));
          const q2 = query(ref, where("requestedBy.uid", "==", userId));

          const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);

          // merge & dedupe
          const map = new Map();
          for (const snap of [s1, s2]) {
            snap.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
          }

          // normalize helper
          const tsToMs = (v) => {
            if (!v) return 0;
            if (v?.seconds) return v.seconds * 1000;
            const ms = Date.parse(v);
            return Number.isNaN(ms) ? 0 : ms;
          };

          const rows = [...map.values()].map((r) => ({
            ...r,
            _fromBranchId: r.requestFromBranchId ?? r.fromBranchId ?? null,
            _toBranchId: r.requestedToBranchId ?? r.toBranchId ?? null,
            _createdMs: tsToMs(r.createdAt) || tsToMs(r.date) || 0,
          }));

          return { data: rows };
        } catch (error) {
          return {
            error: {
              message: error?.message || "Failed to load my activities",
            },
          };
        }
      },
      providesTags: [{ type: "Loan", id: "LIST" }],
    }),
    // loanApiSlice.js (inside endpoints)
    rejectRepaymentEntry: builder.mutation({
      async queryFn({
        companyId,
        id,
        requireRefund = false,
        refundNote = "",
        rejectedBy,
      }) {
        try {
          const repaymentRef = doc(db, "companies", companyId, "loans", id);
          const snap = await getDoc(repaymentRef);
          if (!snap.exists()) throw new Error("Repayment not found");

          const r = snap.data();
          if (r.type !== "repayment") throw new Error("Not a repayment");

          // 1) Mark as rejected
          await updateDoc(repaymentRef, {
            status: "rejected",
            rejectedBy: rejectedBy || null,
            rejectedAt: serverTimestamp(),
            rejectionNote: refundNote || r.note || "",
          });

          let refundId = null;

          // 2) Auto-create refund (reverse direction) if requested
          if (requireRefund) {
            const fromBranchId = r.toBranchId ?? r.requestedToBranchId; // receiver will return funds
            const toBranchId = r.fromBranchId ?? r.requestFromBranchId; // original payer receives refund

            const refundPayload = {
              type: "repayment",
              fromBranchId,
              toBranchId,
              amount: Number(r.amount) || 0,
              status: "pending",
              note: refundNote || `Refund for rejected repayment (${id})`,
              relatedRepaymentId: id,
              createdAt: serverTimestamp(),
              // you can carry forward proof if you want, but usually refund will have its own proof
            };

            const ref = await addDoc(
              collection(db, "companies", companyId, "loans"),
              refundPayload
            );
            refundId = ref.id;
          }

          return { data: { id, refundId } };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      invalidatesTags: [{ type: "Loan", id: "LIST" }],
    }),
  }),
});

export const {
  useAddLoanEntryMutation,
  useAddRepaymentEntryMutation,
  useGetLoanEntriesQuery,
  useUpdateLoanEntryMutation,
  useApproveRepaymentWithAllocationMutation,
  useGetApprovedLoanSummaryQuery,
  useGetLoanActivitiesQuery,
  useGetMyLoanActivitiesQuery,
  useRejectRepaymentEntryMutation,
} = loanApiSlice;
