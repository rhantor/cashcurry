// /lib/redux/api/vendorPaymentsApiSlice.js
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

function toISOFromTs(ts) {
  // ts is a Firestore Timestamp or undefined
  if (!ts) return null;
  try {
    return new Date(ts.seconds * 1000).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

/**
 * List vendor payments for a branch, with optional filters.
 * We avoid orderBy to skip composite index requirements, and sort client-side.
 * Args: { companyId, branchId, vendorId?, method?, from?, to? } (YYYY-MM-DD)
 */
export const vendorPaymentsApiSlice = createApi({
  reducerPath: "vendorPaymentsApiSlice",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["VendorPayments"],
  endpoints: (builder) => ({
    getVendorPayments: builder.query({
      async queryFn({ companyId, branchId, vendorId, method, startDate, endDate }) {
        try {
          if (!companyId || !branchId) {
            return { error: { message: "Missing company/branch" } };
          }

          const colRef = collection(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "vendorPayments"
          );
          const filters = [];
          if (vendorId) filters.push(where("vendorId", "==", vendorId));
          if (method) filters.push(where("paidMethod", "==", method));
          if (startDate) filters.push(where("createdAtClient", ">=", startDate));
          if (endDate) filters.push(where("createdAtClient", "<=", endDate));

          const q = query(colRef, ...filters);
          const snap = await getDocs(q);

          let data = snap.docs.map((d) => {
            const raw = d.data() || {};
            // prefer client ISO, else server timestamp
            const createdISO =
              raw.createdAtClient || toISOFromTs(raw.createdAt) || ""; // "" will sort last
            return {
              id: d.id,
              ...raw,
              createdISO,
            };
          });

          // newest first by createdISO (YYYY-MM-DD)
          data.sort((a, b) => (a.createdISO < b.createdISO ? 1 : -1));

          return { data };
        } catch (error) {
          console.error("[getVendorPayments] error:", error);
          return {
            error: { message: error.message || "Failed to load payments" },
          };
        }
      },
      providesTags: (result, _e, { companyId, branchId }) =>
        result
          ? [
              { type: "VendorPayments", id: `LIST:${companyId}:${branchId}` },
              ...result.map((p) => ({ type: "VendorPayments", id: p.id })),
            ]
          : [{ type: "VendorPayments", id: `LIST:${companyId}:${branchId}` }],
    }),
  }),
});

export const { useGetVendorPaymentsQuery } = vendorPaymentsApiSlice;
