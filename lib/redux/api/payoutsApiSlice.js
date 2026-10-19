// Pay-outs and their bills (roadmap 4.10, lib/payouts/model.js) for the money
// engine's screens (dashboards, summary report, cash tracker). The pay-outs
// page itself listens live and writes through lib/payouts/client.js.
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getDocsSince } from "./recordQueries";

export const payoutsApiSlice = createApi({
  reducerPath: "payoutsApi",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["Payout"],
  // the till changes as soon as money is handed out — don't sit on old figures
  keepUnusedDataFor: 15,
  endpoints: (builder) => ({
    // since: records from that day on only (dashboards; see recordQueries.js)
    getPayouts: builder.query({
      async queryFn({ companyId, branchId, since }) {
        if (!companyId || !branchId) return { data: [] };
        try {
          const ref = collection(db, "companies", companyId, "branches", branchId, "payouts");
          const data = since ? await getDocsSince(ref, "date", since) : (await getDocs(ref)).docs.map((d) => ({ id: d.id, ...d.data() }));
          return { data };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      providesTags: [{ type: "Payout", id: "LIST" }],
    }),
  }),
});

export const { useGetPayoutsQuery } = payoutsApiSlice;
