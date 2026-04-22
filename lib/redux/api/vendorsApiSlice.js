// lib/redux/api/vendorsApiSlice.js
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
} from "firebase/firestore";

/**
 * Vendors live under: companies/{companyId}/vendors/{vendorId}
 * Recommended fields:
 * { name, code, termsDays, maxOpenBills, currentBalance, contacts[], createdAt, updatedAt }
 */

export const vendorsApiSlice = createApi({
  reducerPath: "vendorsApiSlice",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["Vendors"],
  endpoints: (builder) => ({
    /** List vendors (ordered by name) */
    getVendors: builder.query({
      async queryFn({ companyId }) {
        try {
          if (!companyId) return { error: { message: "Missing companyId" } };
          const colRef = collection(db, "companies", companyId, "vendors");
          const q = query(colRef, orderBy("name", "asc"));
          const snap = await getDocs(q);
          const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          return { data };
        } catch (error) {
          return { error };
        }
      },
      providesTags: (result, _err, { companyId }) =>
        result
          ? [
              { type: "Vendors", id: `LIST:${companyId}` },
              ...result.map((v) => ({ type: "Vendors", id: v.id })),
            ]
          : [{ type: "Vendors", id: `LIST:${companyId}` }],
    }),

    /** Add vendor */
    addVendor: builder.mutation({
      async queryFn({ companyId, vendor }) {
        try {
          if (!companyId) return { error: { message: "Missing companyId" } };
          const colRef = collection(db, "companies", companyId, "vendors");
          const now = serverTimestamp();
          const docRef = await addDoc(colRef, {
            name: vendor?.name?.trim() || "",
            code: vendor?.code?.trim() || "",
            termsDays: Number(vendor?.termsDays ?? 0) || null,
            maxOpenBills: Number(vendor?.maxOpenBills ?? 0) || null,
            currentBalance: Number(vendor?.currentBalance ?? 0) || 0,
            totalPaid: 0,
            totalBilled: 0,
            lastPaymentDate: null,
            contacts: vendor?.contacts || [],
            phone: vendor?.phone?.trim() || "",
            email: vendor?.email?.trim() || "",
            address: vendor?.address?.trim() || "",
            taxNumber: vendor?.taxNumber?.trim() || "",
            registrationNumber: vendor?.registrationNumber?.trim() || "",
            bankName: vendor?.bankName?.trim() || "",
            bankAccountNumber: vendor?.bankAccountNumber?.trim() || "",
            createdAt: now,
            updatedAt: now,
          });
          return { data: { id: docRef.id } };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: (_res, _err, { companyId }) => [
        { type: "Vendors", id: `LIST:${companyId}` },
      ],
    }),

    /** Update vendor */
    updateVendor: builder.mutation({
      async queryFn({ companyId, vendorId, patch }) {
        try {
          if (!companyId || !vendorId)
            return { error: { message: "Missing ids" } };
          const ref = doc(db, "companies", companyId, "vendors", vendorId);
          const data = { ...patch, updatedAt: serverTimestamp() };
          await updateDoc(ref, data);
          return { data: { ok: true } };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: (_res, _err, { vendorId, companyId }) => [
        { type: "Vendors", id: vendorId },
        { type: "Vendors", id: `LIST:${companyId}` },
      ],
    }),

    /** Delete vendor */
    deleteVendor: builder.mutation({
      async queryFn({ companyId, vendorId }) {
        try {
          if (!companyId || !vendorId)
            return { error: { message: "Missing ids" } };
          const ref = doc(db, "companies", companyId, "vendors", vendorId);
          await deleteDoc(ref);
          return { data: { ok: true } };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: (_res, _err, { vendorId, companyId }) => [
        { type: "Vendors", id: vendorId },
        { type: "Vendors", id: `LIST:${companyId}` },
      ],
    }),
  }),
});

export const {
  useGetVendorsQuery,
  useAddVendorMutation,
  useUpdateVendorMutation,
  useDeleteVendorMutation,
} = vendorsApiSlice;
