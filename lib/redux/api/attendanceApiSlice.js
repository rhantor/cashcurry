import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, setDoc, addDoc, serverTimestamp, orderBy } from "firebase/firestore";

export const attendanceApiSlice = createApi({
  reducerPath: "attendanceApi",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["Attendance"],
  endpoints: (builder) => ({
    getBranchAttendanceTokens: builder.query({
      async queryFn({ companyId, branchId, date }) {
        try {
          const q = query(
            collection(db, "companies", companyId, "branches", branchId, "attendance"),
            where("date", "==", date)
          );
          const snap = await getDocs(q);
          const res = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          return { data: res };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      providesTags: ["Attendance"]
    }),

    getBranchAttendanceByPeriod: builder.query({
      async queryFn({ companyId, branchId, startDate, endDate }) {
        try {
          const q = query(
            collection(db, "companies", companyId, "branches", branchId, "attendance"),
            where("date", ">=", startDate),
            where("date", "<=", endDate),
            orderBy("date", "asc")
          );
          const snap = await getDocs(q);
          const res = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          return { data: res };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      providesTags: ["Attendance"]
    }),

    kioskPunch: builder.mutation({
      async queryFn({ companyId, branchId, staffId, staffName, type, date, photoBase64 }) {
        try {
          const punchRef = collection(db, "companies", companyId, "branches", branchId, "attendance");
          
          await addDoc(punchRef, {
            staffId,
            staffName,
            type, // "in" or "out"
            date, // YYYY-MM-DD
            timestamp: serverTimestamp(),
            photoBase64: photoBase64 || null
          });

          // NOTE: Daily roll-up (pairing "in" with matching "out" per staff per day)
          // is performed on read in the attendance summary view, not here — the
          // serverTimestamp isn't readable immediately after addDoc, so any diff
          // computed here would be unreliable. Keeping the write path minimal.
          return { data: "success" };
        } catch (error) {
           return { error: { message: error.message } };
        }
      },
      invalidatesTags: ["Attendance"]
    })
  })
});

export const { 
  useGetBranchAttendanceTokensQuery, 
  useGetBranchAttendanceByPeriodQuery, 
  useKioskPunchMutation 
} = attendanceApiSlice;
