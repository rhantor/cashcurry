import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, setDoc, addDoc, deleteDoc, serverTimestamp, orderBy } from "firebase/firestore";

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
      async queryFn({ companyId, branchId, staffId, staffName, type, date, photoBase64, method, matchDistance }) {
        try {
          const punchRef = collection(db, "companies", companyId, "branches", branchId, "attendance");

          await addDoc(punchRef, {
            staffId,
            staffName,
            type, // "in" or "out"
            date, // YYYY-MM-DD
            timestamp: serverTimestamp(),
            photoBase64: photoBase64 || null,
            method: method || "pin", // "face" | "pin" | "biometric"
            ...(matchDistance != null ? { matchDistance } : {})
          });

          return { data: "success" };
        } catch (error) {
           return { error: { message: error.message } };
        }
      },
      invalidatesTags: ["Attendance"]
    }),

    addAttendancePunch: builder.mutation({
      async queryFn({ companyId, branchId, data }) {
        try {
          const punchRef = collection(db, "companies", companyId, "branches", branchId, "attendance");
          const docRef = await addDoc(punchRef, {
            ...data,
            timestamp: data.timestamp ? new Date(data.timestamp) : serverTimestamp(),
            isManual: true
          });
          return { data: { id: docRef.id, ...data } };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      invalidatesTags: ["Attendance"]
    }),

    updateAttendancePunch: builder.mutation({
      async queryFn({ companyId, branchId, punchId, data }) {
        try {
          const punchRef = doc(db, "companies", companyId, "branches", branchId, "attendance", punchId);
          await setDoc(punchRef, {
            ...data,
            timestamp: data.timestamp ? new Date(data.timestamp) : serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
          return { data: "success" };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      invalidatesTags: ["Attendance"]
    }),

    deleteAttendancePunch: builder.mutation({
      async queryFn({ companyId, branchId, punchId }) {
        try {
          const punchRef = doc(db, "companies", companyId, "branches", branchId, "attendance", punchId);
          await deleteDoc(punchRef);
          return { data: punchId };
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
  useLazyGetBranchAttendanceByPeriodQuery,
  useKioskPunchMutation,
  useAddAttendancePunchMutation,
  useUpdateAttendancePunchMutation,
  useDeleteAttendancePunchMutation
} = attendanceApiSlice;
