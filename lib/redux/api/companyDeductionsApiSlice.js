import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  query
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export const companyDeductionsApiSlice = createApi({
  reducerPath: "companyDeductionsApi",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["CompanyDeductions"],
  endpoints: (builder) => ({
    
    getCompanyDeductions: builder.query({
      async queryFn(companyId) {
        try {
          if (!companyId) return { data: [] };
          const ref = collection(db, "companies", companyId, "manual_deductions");
          const q = query(ref, orderBy("createdAt", "asc"));
          const snapshot = await getDocs(q);
          const deductions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          return { data: deductions };
        } catch (err) {
          console.error("Firestore error [getCompanyDeductions]:", err);
          return { error: err };
        }
      },
      providesTags: ["CompanyDeductions"],
    }),

    addCompanyDeduction: builder.mutation({
      async queryFn({ companyId, data }) {
        try {
          const ref = collection(db, "companies", companyId, "manual_deductions");
          await addDoc(ref, {
            ...data,
            createdAt: serverTimestamp(),
          });
          return { data: "ok" };
        } catch (err) {
          console.error("Firestore error [addCompanyDeduction]:", err);
          return { error: err };
        }
      },
      invalidatesTags: ["CompanyDeductions"],
    }),

    deleteCompanyDeduction: builder.mutation({
      async queryFn({ companyId, deductionId }) {
        try {
          const ref = doc(db, "companies", companyId, "manual_deductions", deductionId);
          await deleteDoc(ref);
          return { data: "ok" };
        } catch (err) {
          console.error("Firestore error [deleteCompanyDeduction]:", err);
          return { error: err };
        }
      },
      invalidatesTags: ["CompanyDeductions"],
    }),
    
  }),
});

export const {
  useGetCompanyDeductionsQuery,
  useAddCompanyDeductionMutation,
  useDeleteCompanyDeductionMutation,
} = companyDeductionsApiSlice;
