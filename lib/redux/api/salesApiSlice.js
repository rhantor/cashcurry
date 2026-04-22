// lib/redux/api/salesApiSlice.js
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
import { hasRole, ALLOWED_EDIT_ROLES } from "@/lib/authz/roles"; // <-- add

export const salesApiSlice = createApi({
  reducerPath: "salesApi",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["Sales"],
  endpoints: (builder) => ({
    // ✅ Add new sales entry (no role restriction here; control via UI/rules)
    addSalesEntry: builder.mutation({
      async queryFn({ companyId, branchId, data }) {
        try {
          const salesRef = collection(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "sales"
          );
          const docRef = await addDoc(salesRef, {
            ...data,
            createdAt: serverTimestamp(),
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
      invalidatesTags: [{ type: "Sales", id: "LIST" }],
    }),

    // ✅ Get all sales entries (server-side date filtered, client-side sorted)
    getSalesEntries: builder.query({
      async queryFn({ companyId, branchId, startDate, endDate }) {
        try {
          const salesCollectionRef = collection(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "sales"
          );

          let conditions = [];
          if (startDate) conditions.push(where("date", ">=", startDate));
          if (endDate) conditions.push(where("date", "<=", endDate));

          // No orderBy here — avoids needing a composite Firestore index
          const q = conditions.length > 0
            ? query(salesCollectionRef, ...conditions)
            : query(salesCollectionRef);

          const snapshot = await getDocs(q);
          const entries = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            // Sort client-side: newest date first, then by createdAt descending
            .sort((a, b) => {
              if (b.date !== a.date) return b.date > a.date ? 1 : -1;
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
              ...result.map(({ id }) => ({ type: "Sales", id })),
              { type: "Sales", id: "LIST" },
            ]
          : [{ type: "Sales", id: "LIST" }],
    }),

    // ✅ Get single sales entry (FIXED path: include branchId)
    getSalesEntry: builder.query({
      async queryFn({ companyId, branchId, saleId }) {
        try {
          const docRef = doc(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "sales",
            saleId
          );
          const snapshot = await getDoc(docRef);
          return snapshot.exists()
            ? { data: { id: snapshot.id, ...snapshot.data() } }
            : { error: { message: "Sales entry not found" } };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      providesTags: (result, error, { saleId }) => [
        { type: "Sales", id: saleId },
      ],
    }),

    // ✅ Update sales entry with role check
    updateSalesEntry: builder.mutation({
      /**
       * args: { companyId, branchId, saleId, patch, currentUser }
       */
      async queryFn({ companyId, branchId, saleId, patch, currentUser }) {
        try {
          if (!hasRole(currentUser, ALLOWED_EDIT_ROLES)) {
            return {
              error: { status: 403, message: "Forbidden: insufficient role" },
            };
          }
          const docRef = doc(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "sales",
            saleId
          );
          const payload = {
            ...patch,
            updatedAt: serverTimestamp(),
            updatedBy: {
              uid: currentUser?.uid ?? null,
              username:
                currentUser?.username ?? currentUser?.email ?? "unknown",
              role: currentUser?.role ?? null,
            },
          };
          await updateDoc(docRef, payload);
          return {
            data: {
              id: saleId,
              ...patch,
              updatedAt: new Date().toISOString(),
              updatedBy: payload.updatedBy,
            },
          };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      invalidatesTags: (result, error, { saleId }) => [
        { type: "Sales", id: saleId },
        { type: "Sales", id: "LIST" },
      ],
    }),

    // ✅ Delete sales entry with role check
    deleteSalesEntry: builder.mutation({
      /**
       * args: { companyId, branchId, saleId, currentUser }
       * NOTE: Confirm UI will ensure user typed the date; server rules still recommended.
       */
      async queryFn({ companyId, branchId, saleId, currentUser }) {
        try {
          if (!hasRole(currentUser, ALLOWED_EDIT_ROLES)) {
            return {
              error: { status: 403, message: "Forbidden: insufficient role" },
            };
          }
          const docRef = doc(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "sales",
            saleId
          );
          await deleteDoc(docRef);
          return { data: saleId };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      invalidatesTags: (result, error, { saleId }) => [
        { type: "Sales", id: saleId },
        { type: "Sales", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useAddSalesEntryMutation,
  useGetSalesEntriesQuery,
  useGetSalesEntryQuery,
  useUpdateSalesEntryMutation,
  useDeleteSalesEntryMutation,
} = salesApiSlice;
