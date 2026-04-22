// lib/redux/api/auditApiSlice.js
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export const auditApiSlice = createApi({
  reducerPath: "auditApiSlice",
  baseQuery: fetchBaseQuery({ baseUrl: "/" }),
  tagTypes: ["Audit"],
  endpoints: (builder) => ({
    getAuditLogs: builder.query({
      async queryFn({ companyId, startDate, endDate }) {
        try {
          const ref = collection(db, "companies", companyId, "auditLog");

          let q;
          if (startDate && endDate) {
            const start = new Date(startDate + "T00:00:00");
            const end = new Date(endDate + "T23:59:59");
            q = query(
              ref,
              where("timestamp", ">=", start),
              where("timestamp", "<=", end),
              orderBy("timestamp", "desc"),
              limit(500)
            );
          } else {
            q = query(ref, orderBy("timestamp", "desc"), limit(500));
          }

          const snap = await getDocs(q);
          const logs = snap.docs.map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              ...d,
              timestamp: d.timestamp?.toDate
                ? d.timestamp.toDate().toISOString()
                : d.timestamp ?? null,
            };
          });

          return { data: logs };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: error.message } };
        }
      },
      providesTags: [{ type: "Audit", id: "LIST" }],
    }),

    getBranchAuditLogs: builder.query({
      async queryFn({ companyId, branchId, startDate, endDate }) {
        try {
          const ref = collection(db, "companies", companyId, "auditLog");

          // Avoid composite index requirement: filter only by branchId in Firestore,
          // then sort and apply date range client-side.
          const q = query(
            ref,
            where("branchId", "==", branchId),
            limit(500)
          );

          const snap = await getDocs(q);
          let logs = snap.docs.map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              ...d,
              timestamp: d.timestamp?.toDate
                ? d.timestamp.toDate().toISOString()
                : d.timestamp ?? null,
            };
          });

          // Client-side date filter
          if (startDate && endDate) {
            const start = new Date(startDate + "T00:00:00").getTime();
            const end = new Date(endDate + "T23:59:59").getTime();
            logs = logs.filter((l) => {
              if (!l.timestamp) return false;
              const t = new Date(l.timestamp).getTime();
              return t >= start && t <= end;
            });
          }

          // Client-side sort descending
          logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

          return { data: logs };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: error.message } };
        }
      },
      providesTags: [{ type: "Audit", id: "BRANCH_LIST" }],
    }),
  }),
});

export const { useGetAuditLogsQuery, useGetBranchAuditLogsQuery } = auditApiSlice;
