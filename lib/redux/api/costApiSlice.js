import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where
} from "firebase/firestore";

export const costApiSlice = createApi({
  reducerPath: "costApiSlice",
  baseQuery: fetchBaseQuery({ baseUrl: "/" }),
  tagTypes: ["Cost"],
  endpoints: (builder) => ({
    addCostEntry: builder.mutation({
      async queryFn({ companyId, branchId, data }) {
        try {
          const costRef = collection(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "costs" // separate subcollection for cost entries
          );

          const docRef = await addDoc(costRef, {
            ...data,
            createdAt: serverTimestamp(),
          });

          return {
            data: {
              id: docRef.id,
              ...data,
              createdAt: new Date().toISOString(), // immediate timestamp for UI
            },
          };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      invalidatesTags: [{ type: "Cost", id: "LIST" }],
    }),

    // ✅ Get Cost Entries with Optional Date Filtering
    getCostEntries: builder.query({
      async queryFn({ companyId, branchId, startDate, endDate }) {
        if (!companyId || !branchId) return { data: [] };
        try {
          const costRef = collection(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "costs"
          );
          
          let q = costRef;
          if (startDate && endDate) {
            // Fetch only records within this date range to prevent lag/memory issues
            q = query(costRef, where("date", ">=", startDate), where("date", "<=", endDate));
          }

          const snapshot = await getDocs(q);
          const costs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          return { data: costs };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      providesTags: (result = []) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Cost", id })),
              { type: "Cost", id: "LIST" },
            ]
          : [{ type: "Cost", id: "LIST" }],
    }),

    // ✅ Update Cost Entry
    updateCostEntry: builder.mutation({
      async queryFn({ companyId, branchId, costId, data }) {
        try {
          const docRef = doc(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "costs",
            costId
          );
          await updateDoc(docRef, data);
          return { data: { id: costId, ...data } };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      invalidatesTags: (result, error, { costId }) => [
        { type: "Cost", id: costId },
        { type: "Cost", id: "LIST" },
      ],
    }),

    // ✅ Delete Cost Entry
    deleteCostEntry: builder.mutation({
      async queryFn({ companyId, branchId, costId }) {
        try {
          const docRef = doc(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "costs",
            costId
          );
          await deleteDoc(docRef);
          return { data: costId };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      invalidatesTags: [{ type: "Cost", id: "LIST" }],
    }),
  }),
});

export const { 
  useAddCostEntryMutation, 
  useGetCostEntriesQuery, 
  useUpdateCostEntryMutation, 
  useDeleteCostEntryMutation 
} = costApiSlice;
