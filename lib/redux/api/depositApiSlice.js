import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from "firebase/firestore";
import { getDocsSince } from "./recordQueries";

export const depositApiSlice = createApi({
  reducerPath: "depositApiSlice",
  baseQuery: fetchBaseQuery({ baseUrl: "/" }),
  tagTypes: ["deposit"],
  endpoints: (builder) => ({
    addDepositEntry: builder.mutation({
      async queryFn({ companyId, branchId, data }) {
        try {
          const depositRef = collection(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "deposits" // separate subcollection for deposit entries
          );

          const docRef = await addDoc(depositRef, {
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
      invalidatesTags: [{ type: "deposit", id: "LIST" }],
    }),

    // ✅ Get deposit Entries (Server-Side Filtered, Client-Side Sorted)
    getDepositEntry: builder.query({
      // since: records from that day on only (dashboards; see lib/redux/api/recordQueries.js)
      // latest: only the newest N (the entry screen's "recent" list)
      async queryFn({ companyId, branchId, startDate, endDate, since, latest }) {
        try {
          const depositRef = collection(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "deposits"
          );

          let conditions = [];
          if (startDate) conditions.push(where("date", ">=", startDate));
          if (endDate) conditions.push(where("date", "<=", endDate));

          const q = latest
            ? query(depositRef, orderBy("date", "desc"), limit(latest))
            : conditions.length > 0
              ? query(depositRef, ...conditions)
              : query(depositRef);

          const deposits = (since
            ? await getDocsSince(depositRef, "date", since)
            : (await getDocs(q)).docs.map((doc) => ({ id: doc.id, ...doc.data() })))
            .sort((a, b) => {
              if (b.date !== a.date) return b.date > a.date ? 1 : -1;
              return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
            });
          return { data: deposits };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      providesTags: (result = []) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "deposit", id })),
              { type: "deposit", id: "LIST" },
            ]
          : [{ type: "deposit", id: "LIST" }],
    }),
  }),
});

export const { useAddDepositEntryMutation, useGetDepositEntryQuery } =
  depositApiSlice;
