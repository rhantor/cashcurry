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

export const requisitionsApiSlice = createApi({
  reducerPath: "requisitionsApiSlice",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["Requisitions"],
  endpoints: (builder) => ({
    /** List all requisitions */
    getRequisitions: builder.query({
      async queryFn({ companyId, branchId, vendorId }) {
        try {
          if (!companyId || !branchId) return { error: { message: "Missing ids" } };
          const colRef = collection(db, "companies", companyId, "branches", branchId, "requisitions");
          
          let q = query(colRef, orderBy("createdAt", "desc"));
          if (vendorId) {
             q = query(colRef, where("vendorId", "==", vendorId), orderBy("createdAt", "desc"));
          }
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
              { type: "Requisitions", id: `LIST:${companyId}_${branchId}` },
              ...result.map((i) => ({ type: "Requisitions", id: i.id })),
            ]
          : [{ type: "Requisitions", id: `LIST:${companyId}_${branchId}` }],
    }),

    /** Add single requisition */
    addRequisition: builder.mutation({
      async queryFn({ companyId, branchId, requisition }) {
        try {
          if (!companyId || !branchId) return { error: { message: "Missing ids" } };
          const colRef = collection(db, "companies", companyId, "branches", branchId, "requisitions");
          const now = serverTimestamp();
          
          const docRef = await addDoc(colRef, {
            ...requisition,
            status: requisition.status || "Pending",
            createdAt: now,
            updatedAt: now,
          });
          return { data: { id: docRef.id } };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: (_res, _err, { companyId, branchId }) => [
        { type: "Requisitions", id: `LIST:${companyId}_${branchId}` },
      ],
    }),

    /** Update requisition */
    updateRequisition: builder.mutation({
      async queryFn({ companyId, branchId, requisitionId, patch }) {
        try {
          if (!companyId || !branchId || !requisitionId) return { error: { message: "Missing ids" } };
          const ref = doc(db, "companies", companyId, "branches", branchId, "requisitions", requisitionId);
          const data = { ...patch, updatedAt: serverTimestamp() };
          await updateDoc(ref, data);
          return { data: { ok: true } };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: (_res, _err, { requisitionId, companyId, branchId }) => [
        { type: "Requisitions", id: requisitionId },
        { type: "Requisitions", id: `LIST:${companyId}_${branchId}` },
      ],
    }),

    /** Delete requisition */
    deleteRequisition: builder.mutation({
      async queryFn({ companyId, branchId, requisitionId }) {
        try {
          if (!companyId || !branchId || !requisitionId) return { error: { message: "Missing ids" } };
          const ref = doc(db, "companies", companyId, "branches", branchId, "requisitions", requisitionId);
          await deleteDoc(ref);
          return { data: { ok: true } };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: (_res, _err, { requisitionId, companyId, branchId }) => [
        { type: "Requisitions", id: requisitionId },
        { type: "Requisitions", id: `LIST:${companyId}_${branchId}` },
      ],
    }),

  }),
});

export const {
  useGetRequisitionsQuery,
  useAddRequisitionMutation,
  useUpdateRequisitionMutation,
  useDeleteRequisitionMutation,
} = requisitionsApiSlice;
