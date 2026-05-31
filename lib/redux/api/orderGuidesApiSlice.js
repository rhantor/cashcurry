import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
} from "firebase/firestore";

export const orderGuidesApiSlice = createApi({
  reducerPath: "orderGuidesApiSlice",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["OrderGuides"],
  endpoints: (builder) => ({
    getOrderGuides: builder.query({
      async queryFn({ companyId, branchId }) {
        try {
          if (!companyId || !branchId) return { error: { message: "Missing ids" } };
          const colRef = collection(db, "companies", companyId, "branches", branchId, "orderGuides");
          const q = query(colRef, orderBy("createdAt", "desc"));
          const snap = await getDocs(q);
          const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          return { data };
        } catch (error) {
          console.error(error);
          return { error };
        }
      },
      providesTags: (result, _err, { companyId, branchId }) =>
        result
          ? [
              { type: "OrderGuides", id: `LIST:${companyId}_${branchId}` },
              ...result.map((i) => ({ type: "OrderGuides", id: i.id })),
            ]
          : [{ type: "OrderGuides", id: `LIST:${companyId}_${branchId}` }],
    }),

    addOrderGuide: builder.mutation({
      async queryFn({ companyId, branchId, orderGuide }) {
        try {
          if (!companyId || !branchId) return { error: { message: "Missing ids" } };
          const colRef = collection(db, "companies", companyId, "branches", branchId, "orderGuides");
          const now = serverTimestamp();
          
          const docRef = await addDoc(colRef, {
            ...orderGuide,
            createdAt: now,
            updatedAt: now,
          });
          return { data: { id: docRef.id } };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: (_res, _err, { companyId, branchId }) => [
        { type: "OrderGuides", id: `LIST:${companyId}_${branchId}` },
      ],
    }),

    updateOrderGuide: builder.mutation({
      async queryFn({ companyId, branchId, guideId, patch }) {
        try {
          if (!companyId || !branchId || !guideId) return { error: { message: "Missing ids" } };
          const ref = doc(db, "companies", companyId, "branches", branchId, "orderGuides", guideId);
          const data = { ...patch, updatedAt: serverTimestamp() };
          await updateDoc(ref, data);
          return { data: { ok: true } };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: (_res, _err, { guideId, companyId, branchId }) => [
        { type: "OrderGuides", id: guideId },
        { type: "OrderGuides", id: `LIST:${companyId}_${branchId}` },
      ],
    }),

    deleteOrderGuide: builder.mutation({
      async queryFn({ companyId, branchId, guideId }) {
        try {
          if (!companyId || !branchId || !guideId) return { error: { message: "Missing ids" } };
          const ref = doc(db, "companies", companyId, "branches", branchId, "orderGuides", guideId);
          await deleteDoc(ref);
          return { data: { ok: true } };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: (_res, _err, { guideId, companyId, branchId }) => [
        { type: "OrderGuides", id: guideId },
        { type: "OrderGuides", id: `LIST:${companyId}_${branchId}` },
      ],
    }),
  }),
});

export const {
  useGetOrderGuidesQuery,
  useAddOrderGuideMutation,
  useUpdateOrderGuideMutation,
  useDeleteOrderGuideMutation,
} = orderGuidesApiSlice;
