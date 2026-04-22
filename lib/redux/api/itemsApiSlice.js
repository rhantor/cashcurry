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
  writeBatch,
} from "firebase/firestore";

export const itemsApiSlice = createApi({
  reducerPath: "itemsApiSlice",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["Items"],
  endpoints: (builder) => ({
    /** List all items */
    getItems: builder.query({
      async queryFn({ companyId }) {
        try {
          if (!companyId) return { error: { message: "Missing companyId" } };
          const colRef = collection(db, "companies", companyId, "items");
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
              { type: "Items", id: `LIST:${companyId}` },
              ...result.map((i) => ({ type: "Items", id: i.id })),
            ]
          : [{ type: "Items", id: `LIST:${companyId}` }],
    }),

    /** Add single item */
    addItem: builder.mutation({
      async queryFn({ companyId, item }) {
        try {
          if (!companyId) return { error: { message: "Missing companyId" } };
          const colRef = collection(db, "companies", companyId, "items");
          const now = serverTimestamp();
          const docRef = await addDoc(colRef, {
            name: item.name?.trim() || "",
            category: item.category?.trim() || "",
            unit: item.unit?.trim() || "Pcs",
            defaultPrice: Number(item.defaultPrice || 0),
            vendorIds: item.vendorIds || [],
            createdAt: now,
            updatedAt: now,
          });
          return { data: { id: docRef.id } };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: (_res, _err, { companyId }) => [
        { type: "Items", id: `LIST:${companyId}` },
      ],
    }),

    /** Update item */
    updateItem: builder.mutation({
      async queryFn({ companyId, itemId, patch }) {
        try {
          if (!companyId || !itemId) return { error: { message: "Missing ids" } };
          const ref = doc(db, "companies", companyId, "items", itemId);
          const data = { ...patch, updatedAt: serverTimestamp() };
          await updateDoc(ref, data);
          return { data: { ok: true } };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: (_res, _err, { itemId, companyId }) => [
        { type: "Items", id: itemId },
        { type: "Items", id: `LIST:${companyId}` },
      ],
    }),

    /** Delete item */
    deleteItem: builder.mutation({
      async queryFn({ companyId, itemId }) {
        try {
          if (!companyId || !itemId) return { error: { message: "Missing ids" } };
          const ref = doc(db, "companies", companyId, "items", itemId);
          await deleteDoc(ref);
          return { data: { ok: true } };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: (_res, _err, { itemId, companyId }) => [
        { type: "Items", id: itemId },
        { type: "Items", id: `LIST:${companyId}` },
      ],
    }),

    /** Bulk Add multiple items (from Excel import) */
    addMultipleItems: builder.mutation({
      async queryFn({ companyId, items = [] }) {
        try {
          if (!companyId) return { error: { message: "Missing companyId" } };
          if (!items.length) return { data: { count: 0 } };

          const batch = writeBatch(db);
          const colRef = collection(db, "companies", companyId, "items");
          const now = serverTimestamp();

          items.forEach((item) => {
            const newDocRef = doc(colRef);
            batch.set(newDocRef, {
              name: item.name?.trim() || "",
              category: item.category?.trim() || "Uncategorized",
              unit: item.unit?.trim() || "Pcs",
              defaultPrice: Number(item.defaultPrice || 0),
              vendorIds: item.vendorIds || [],
              createdAt: now,
              updatedAt: now,
            });
          });

          await batch.commit();
          return { data: { count: items.length } };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: (_res, _err, { companyId }) => [
        { type: "Items", id: `LIST:${companyId}` },
      ],
    }),
  }),
});

export const {
  useGetItemsQuery,
  useAddItemMutation,
  useUpdateItemMutation,
  useDeleteItemMutation,
  useAddMultipleItemsMutation,
} = itemsApiSlice;
