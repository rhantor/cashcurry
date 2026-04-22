// lib/redux/api/notificationApiSlice.js
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";

export const notificationApi = createApi({
  reducerPath: "notificationApi",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["Notification"],
  endpoints: (builder) => ({
    // ✅ Add notification
    addNotification: builder.mutation({
      async queryFn({ companyId, notification }) {
        try {
          await addDoc(
            collection(db, "companies", companyId, "notifications"),
            {
              ...notification,
              createdAt: new Date().toISOString(),
              read: false,
            }
          );
          return { data: "Notification added" };
        } catch (err) {
          return { error: err };
        }
      },
      invalidatesTags: ["Notification"],
    }),

    // ✅ Get notifications (for boss dashboard)
    getNotifications: builder.query({
      async queryFn({ companyId }) {
        try {
          const q = query(
            collection(db, "companies", companyId, "notifications")
          );
          const querySnapshot = await getDocs(q);
          const notifications = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          return { data: notifications };
        } catch (err) {
          return { error: err };
        }
      },
      providesTags: ["Notification"],
    }),

    // ✅ Mark as read
    markAsRead: builder.mutation({
      async queryFn({ companyId, id }) {
        try {
          await updateDoc(
            doc(db, "companies", companyId, "notifications", id),
            {
              read: true,
            }
          );
          return { data: "Updated" };
        } catch (err) {
          return { error: err };
        }
      },
      invalidatesTags: ["Notification"],
    }),
  }),
});

export const {
  useAddNotificationMutation,
  useGetNotificationsQuery,
  useMarkAsReadMutation,
} = notificationApi;
