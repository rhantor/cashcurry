// lib/redux/api/cashWithdrawApiSlice.js
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
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export const cashWithdrawApiSlice = createApi({
  reducerPath: "cashWithdrawApi",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["Withdrawals"],
  endpoints: (builder) => ({
    // Create
    addWithdrawEntry: builder.mutation({
      async queryFn({ companyId, branchId, data }) {
        try {
          const ref = collection(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "cashWithdrawals"
          );

          // Derive month for reporting (YYYY-MM)
          const dateStr = data.date; // YYYY-MM-DD
          const month = dateStr?.slice(0, 7) || null;

          const docRef = await addDoc(ref, {
            ...data,
            month,
            createdAt: serverTimestamp(),
          });

          return {
            data: {
              id: docRef.id,
              ...data,
              month,
              createdAt: new Date().toISOString(),
            },
          };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      invalidatesTags: [{ type: "Withdrawals", id: "LIST" }],
    }),

    // List (Server-Side Filtered)
    getWithdrawEntries: builder.query({
      async queryFn({ companyId, branchId, startDate, endDate }) {
        try {
          const ref = collection(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "cashWithdrawals"
          );

          let conditions = [];
          if (startDate) conditions.push(where("date", ">=", startDate));
          if (endDate) conditions.push(where("date", "<=", endDate));

          const qy = conditions.length > 0
            ? query(ref, ...conditions)
            : query(ref);

          const snap = await getDocs(qy);
          const rows = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => {
              if (b.date !== a.date) return b.date > a.date ? 1 : -1;
              return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
            });
          return { data: rows };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Withdrawals", id })),
              { type: "Withdrawals", id: "LIST" },
            ]
          : [{ type: "Withdrawals", id: "LIST" }],
    }),

    // Single
    getWithdrawEntry: builder.query({
      async queryFn({ companyId, branchId, withdrawId }) {
        try {
          const ref = doc(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "cashWithdrawals",
            withdrawId
          );
          const snap = await getDoc(ref);
          if (!snap.exists()) return { error: { message: "Entry not found" } };
          return { data: { id: snap.id, ...snap.data() } };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      providesTags: (r, e, { withdrawId }) => [{ type: "Withdrawals", id: withdrawId }],
    }),

    // Update
    updateWithdrawEntry: builder.mutation({
      async queryFn({ companyId, branchId, withdrawId, ...data }) {
        try {
          const ref = doc(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "cashWithdrawals",
            withdrawId
          );

          // keep month in sync if date changed
          const month = data.date ? data.date.slice(0, 7) : undefined;

          await updateDoc(ref, {
            ...data,
            ...(month ? { month } : {}),
            updatedAt: serverTimestamp(),
          });

          return {
            data: {
              id: withdrawId,
              ...data,
              ...(month ? { month } : {}),
              updatedAt: new Date().toISOString(),
            },
          };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      invalidatesTags: (r, e, { withdrawId }) => [
        { type: "Withdrawals", id: withdrawId },
        { type: "Withdrawals", id: "LIST" },
      ],
    }),

    // Delete
    deleteWithdrawEntry: builder.mutation({
      async queryFn({ companyId, branchId, withdrawId }) {
        try {
          const ref = doc(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "cashWithdrawals",
            withdrawId
          );
          await deleteDoc(ref);
          return { data: withdrawId };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      invalidatesTags: (r, e, { withdrawId }) => [
        { type: "Withdrawals", id: withdrawId },
        { type: "Withdrawals", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useAddWithdrawEntryMutation,
  useGetWithdrawEntriesQuery,
  useGetWithdrawEntryQuery,
  useUpdateWithdrawEntryMutation,
  useDeleteWithdrawEntryMutation,
} = cashWithdrawApiSlice;
