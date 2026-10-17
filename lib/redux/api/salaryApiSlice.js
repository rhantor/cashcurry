import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where
} from "firebase/firestore";
import { getDocsSince } from "./recordQueries";
import { db } from "@/lib/firebase";
import { createAuditLog } from "./auditUtils";

export const salaryApiSlice = createApi({
  reducerPath: "salaryApiSlice",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["Salaries"],
  endpoints: (builder) => ({
    // ✅ Add new salary entry
    addSalaryEntry: builder.mutation({
      async queryFn({ companyId, branchId, data }) {
        try {
          const salariesRef = collection(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "salaries"
          );

          const docRef = await addDoc(salariesRef, {
            ...data,
            createdAt: serverTimestamp(),
          });

          // Audit Log
          await createAuditLog({
            companyId,
            branchId,
            user: data.createdBy,
            action: "ADD_SALARY",
            details: `Added salary entry for ${data.staffName || data.month} (Amount: ${data.amount})`,
            targetId: docRef.id
          });

          return {
            data: {
              id: docRef.id,
              ...data,
              createdAt: new Date().toISOString(),
            },
          };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      invalidatesTags: [{ type: "Salaries", id: "LIST" }],
    }),

    // ✅ Get salary entries (Server-Side Filtered, Client-Side Sorted)
    getSalaryEntries: builder.query({
      // since: paid from that day on only (dashboards; see lib/redux/api/recordQueries.js)
      async queryFn({ companyId, branchId, startDate, endDate, dateField = "date", since }) {
        try {
          const salariesRef = collection(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "salaries"
          );

          // `month` is stored as "yyyy-MM", so compare it with months: as text,
          // "2026-10" < "2026-10-01", and the first month of a range was missed.
          const bound = (v) => (v && dateField === "month" ? String(v).slice(0, 7) : v);
          let conditions = [];
          if (startDate) conditions.push(where(dateField, ">=", bound(startDate)));
          if (endDate) conditions.push(where(dateField, "<=", bound(endDate)));

          const q = conditions.length > 0
            ? query(salariesRef, ...conditions)
            : query(salariesRef);

          const entries = (since
            ? await getDocsSince(salariesRef, "paymentDate", since)
            : (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() })))
            .sort((a, b) => {
              const aVal = a[dateField] ?? "";
              const bVal = b[dateField] ?? "";
              if (bVal !== aVal) return bVal > aVal ? 1 : -1;
              return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
            });

          return { data: entries };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Salaries", id })),
              { type: "Salaries", id: "LIST" },
            ]
          : [{ type: "Salaries", id: "LIST" }],
    }),

    // ✅ Get single salary entry
    getSalaryEntry: builder.query({
      async queryFn({ companyId, branchId, salaryId }) {
        try {
          const ref = doc(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "salaries",
            salaryId
          );
          const snapshot = await getDoc(ref);
          if (!snapshot.exists()) {
            return { error: { message: "Salary entry not found" } };
          }
          return { data: { id: snapshot.id, ...snapshot.data() } };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      providesTags: (result, error, { salaryId }) => [
        { type: "Salaries", id: salaryId },
      ],
    }),

    // ✅ Update salary entry (FIXED)
    updateSalaryEntry: builder.mutation({
      // We accept 'entryId' (matching component) and 'data' (the payload object)
      async queryFn({ companyId, branchId, entryId, data, user }) {
        try {
          if (!companyId || !branchId || !entryId) {
             throw new Error("Missing ID parameters");
          }

          const ref = doc(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "salaries",
            entryId // Used 'entryId' here
          );

          // Spread 'data' correctly so fields like amount, notes are at the root level
          await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });

          // Audit Log
          await createAuditLog({
            companyId,
            branchId,
            user: user || data.updatedBy,
            action: "UPDATE_SALARY",
            details: `Updated salary entry ID: ${entryId}. New Amount: ${data.amount}`,
            targetId: entryId
          });

          return {
            data: {
              id: entryId,
              ...data,
              updatedAt: new Date().toISOString(),
            },
          };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      invalidatesTags: (result, error, { entryId }) => [
        { type: "Salaries", id: entryId },
        { type: "Salaries", id: "LIST" },
      ],
    }),

    // ✅ Delete salary entry
    deleteSalaryEntry: builder.mutation({
      async queryFn({ companyId, branchId, salaryId, user }) {
        try {
          const ref = doc(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "salaries",
            salaryId
          );
          
          const snap = await getDoc(ref);
          const oldData = snap.exists() ? snap.data() : {};

          await deleteDoc(ref);

          // Audit Log
          await createAuditLog({
            companyId,
            branchId,
            user,
            action: "DELETE_SALARY",
            details: `Deleted salary entry for ${oldData.staffName || oldData.month} (Amount: ${oldData.amount})`,
            targetId: salaryId
          });

          return { data: salaryId };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      invalidatesTags: (result, error, { salaryId }) => [
        { type: "Salaries", id: salaryId },
        { type: "Salaries", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useAddSalaryEntryMutation,
  useGetSalaryEntriesQuery,
  useGetSalaryEntryQuery,
  useUpdateSalaryEntryMutation,
  useDeleteSalaryEntryMutation,
} = salaryApiSlice;