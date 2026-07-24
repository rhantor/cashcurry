import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, getDoc, doc, setDoc, addDoc, deleteDoc, serverTimestamp, orderBy } from "firebase/firestore";

const otRequestsRef = (companyId, branchId) =>
  collection(db, "companies", companyId, "branches", branchId, "otRequests");

export const attendanceApiSlice = createApi({
  reducerPath: "attendanceApi",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["Attendance", "OtRequest"],
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
    }),

    // ── Early-OT requests (shift templates) ────────────────────────────────
    // Raised when someone punches in well before their shift starts. Approval
    // decides whether those extra minutes are paid as OT. One doc per staff per
    // business day (id = `${staffId}_${date}`), so repeat punches can't
    // duplicate a request.
    getOtRequests: builder.query({
      async queryFn({ companyId, branchId, startDate, endDate }) {
        try {
          const clauses = [];
          if (startDate) clauses.push(where("date", ">=", startDate));
          if (endDate) clauses.push(where("date", "<=", endDate));
          const q = clauses.length
            ? query(otRequestsRef(companyId, branchId), ...clauses, orderBy("date", "desc"))
            : query(otRequestsRef(companyId, branchId), orderBy("date", "desc"));
          const snap = await getDocs(q);
          return { data: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      providesTags: ["OtRequest"]
    }),

    // Create-if-absent: never clobbers an already approved/rejected decision.
    createOtRequest: builder.mutation({
      async queryFn({ companyId, branchId, id, data }) {
        try {
          const ref = doc(otRequestsRef(companyId, branchId), id);
          const existing = await getDoc(ref);
          if (existing.exists()) return { data: { id, skipped: true } };
          await setDoc(ref, {
            ...data,
            status: "pending",
            createdAt: serverTimestamp()
          });
          return { data: { id } };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      invalidatesTags: ["OtRequest"]
    }),

    updateOtRequest: builder.mutation({
      async queryFn({ companyId, branchId, id, data }) {
        try {
          const ref = doc(otRequestsRef(companyId, branchId), id);
          await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
          return { data: id };
        } catch (error) {
          return { error: { message: error.message } };
        }
      },
      invalidatesTags: ["OtRequest"]
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
  useDeleteAttendancePunchMutation,
  useGetOtRequestsQuery,
  useLazyGetOtRequestsQuery,
  useCreateOtRequestMutation,
  useUpdateOtRequestMutation
} = attendanceApiSlice;
