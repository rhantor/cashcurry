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
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

/**
 * Catalog rows are matched on name alone, case- and spacing-insensitively.
 * Staff type the same product a dozen slightly different ways ("Tomato ",
 * "tomato", "TOMATO"), and the Excel import would happily create one row for
 * each of them.
 */
export const itemKey = (name) => String(name || "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Is this item stocked by the given branch?
 *
 * The catalog is company-wide, but branches do not all sell the same things. An
 * empty or missing `branchIds` means "every branch" — which is what every item
 * written before branch scoping existed looks like, so old data keeps behaving
 * as it always did.
 */
export const itemInBranch = (item, branchId) =>
  !branchId || !item?.branchIds?.length || item.branchIds.includes(branchId);

/**
 * What this branch last paid for an item.
 *
 * Prices differ between branches — different suppliers, different delivery
 * runs, different negotiated rates — so each branch keeps its own figure under
 * `lastPurchaseByBranch`. The company-wide value is only a fallback for a
 * branch that has never bought the item itself.
 */
export const branchLastPrice = (item, branchId) => {
  const local = branchId ? item?.lastPurchaseByBranch?.[branchId]?.price : undefined;
  if (Number(local) > 0) return Number(local);
  if (Number(item?.lastPurchasePrice) > 0) return Number(item.lastPurchasePrice);
  return Number(item?.defaultPrice || 0);
};

/** Date of this branch's last purchase, falling back to the company-wide one. */
export const branchLastPriceDate = (item, branchId) =>
  (branchId ? item?.lastPurchaseByBranch?.[branchId]?.date : "") || item?.lastPurchaseDate || "";

export const itemsApiSlice = createApi({
  reducerPath: "itemsApiSlice",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["Items"],
  endpoints: (builder) => ({
    /** List all items */
    getItems: builder.query({
      // Retired items are filtered out here rather than deleted, so that order
      // guides and past purchase orders that reference them still resolve to a
      // real name and unit. Pass includeInactive to see them again.
      //
      // Pass `branchId` to get only what that branch stocks — that is what every
      // ordering screen wants. Omit it (or pass includeAllBranches) to see the
      // whole company catalog, which the Items page needs so a branch can pull
      // in a product another branch already set up.
      async queryFn({ companyId, branchId, includeInactive = false, includeAllBranches = false }) {
        try {
          if (!companyId) return { error: { message: "Missing companyId" } };
          const colRef = collection(db, "companies", companyId, "items");
          const q = query(colRef, orderBy("name", "asc"));
          const snap = await getDocs(q);
          const data = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((item) => includeInactive || item.isActive !== false)
            .filter((item) => includeAllBranches || itemInBranch(item, branchId));
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
            // Empty means every branch — see itemInBranch.
            branchIds: item.branchIds || [],
            isActive: true,
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

    /**
     * Start stocking a company item at one branch ("pull it in").
     *
     * Uses arrayUnion so two branches adopting the same item at the same moment
     * cannot overwrite each other.
     */
    addItemToBranch: builder.mutation({
      async queryFn({ companyId, itemId, branchId }) {
        try {
          if (!companyId || !itemId || !branchId) return { error: { message: "Missing ids" } };
          const ref = doc(db, "companies", companyId, "items", itemId);
          await updateDoc(ref, {
            branchIds: arrayUnion(branchId),
            updatedAt: serverTimestamp(),
          });
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

    /**
     * Stop stocking a company item at one branch.
     *
     * An item with an empty `branchIds` means "every branch", so there is
     * nothing to remove from — the list has to be materialised as every other
     * branch first. That is why the caller supplies `allBranchIds`.
     */
    removeItemFromBranch: builder.mutation({
      async queryFn({ companyId, itemId, branchId, currentBranchIds = [], allBranchIds = [] }) {
        try {
          if (!companyId || !itemId || !branchId) return { error: { message: "Missing ids" } };
          const ref = doc(db, "companies", companyId, "items", itemId);

          if (!currentBranchIds.length) {
            const others = allBranchIds.filter((id) => id !== branchId);
            if (!others.length) {
              return { error: { message: "This is the only branch — the item cannot be removed from it" } };
            }
            await updateDoc(ref, { branchIds: others, updatedAt: serverTimestamp() });
          } else {
            await updateDoc(ref, {
              branchIds: arrayRemove(branchId),
              updatedAt: serverTimestamp(),
            });
          }
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

    /**
     * Record what a branch actually paid for an item at goods receipt.
     *
     * Written with a dotted field path so each branch only touches its own key
     * and cannot clobber another branch's figure. The company-wide fields are
     * kept updated too, purely as a fallback for branches that have never
     * bought the item. `defaultPrice` is deliberately never touched — it is the
     * planning price and belongs to whoever maintains the catalog.
     */
    recordBranchPurchasePrice: builder.mutation({
      async queryFn({ companyId, branchId, itemId, price, date }) {
        try {
          if (!companyId || !branchId || !itemId) return { error: { message: "Missing ids" } };
          const value = Number(price || 0);
          if (!(value > 0)) return { data: { ok: false, skipped: true } };

          const ref = doc(db, "companies", companyId, "items", itemId);
          await updateDoc(ref, {
            [`lastPurchaseByBranch.${branchId}`]: { price: value, date: date || "" },
            lastPurchasePrice: value,
            lastPurchaseDate: date || "",
            updatedAt: serverTimestamp(),
          });
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

    /**
     * Retire an item (soft delete).
     *
     * Preferred over deleteItem: order guides hold bare item ids and past
     * purchase orders hold a snapshot, so hard-deleting a row leaves guides
     * rendering "Unknown Item" at 0.00 with no way to tell what it used to be.
     */
    retireItem: builder.mutation({
      async queryFn({ companyId, itemId, retiredBy = "" }) {
        try {
          if (!companyId || !itemId) return { error: { message: "Missing ids" } };
          const ref = doc(db, "companies", companyId, "items", itemId);
          await updateDoc(ref, {
            isActive: false,
            retiredAt: serverTimestamp(),
            retiredBy,
            updatedAt: serverTimestamp(),
          });
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

    /** Bring a retired item back into the catalog */
    restoreItem: builder.mutation({
      async queryFn({ companyId, itemId }) {
        try {
          if (!companyId || !itemId) return { error: { message: "Missing ids" } };
          const ref = doc(db, "companies", companyId, "items", itemId);
          await updateDoc(ref, { isActive: true, updatedAt: serverTimestamp() });
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

    /** Delete item permanently. Prefer retireItem — see the note there. */
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

    /**
     * Bulk add from an Excel import.
     *
     * Rows whose name already exists in the catalog are skipped, along with
     * duplicates inside the sheet itself, so re-importing the same file is
     * harmless instead of doubling every product. The caller gets back what was
     * skipped so it can tell the user.
     */
    addMultipleItems: builder.mutation({
      async queryFn({ companyId, items = [] }) {
        try {
          if (!companyId) return { error: { message: "Missing companyId" } };
          if (!items.length) return { data: { count: 0, skipped: [] } };

          const colRef = collection(db, "companies", companyId, "items");

          // Retired rows count as existing — importing a name back should be a
          // deliberate restore, not a second copy sitting beside the old one.
          const existingSnap = await getDocs(colRef);
          const seen = new Set(existingSnap.docs.map((d) => itemKey(d.data()?.name)));

          const fresh = [];
          const skipped = [];
          items.forEach((item) => {
            const key = itemKey(item.name);
            if (!key) return;
            if (seen.has(key)) {
              skipped.push(item.name);
              return;
            }
            seen.add(key);
            fresh.push(item);
          });

          if (!fresh.length) return { data: { count: 0, skipped } };

          const batch = writeBatch(db);
          const now = serverTimestamp();

          fresh.forEach((item) => {
            const newDocRef = doc(colRef);
            batch.set(newDocRef, {
              name: item.name?.trim() || "",
              category: item.category?.trim() || "Uncategorized",
              unit: item.unit?.trim() || "Pcs",
              defaultPrice: Number(item.defaultPrice || 0),
              vendorIds: item.vendorIds || [],
              branchIds: item.branchIds || [],
              isActive: true,
              createdAt: now,
              updatedAt: now,
            });
          });

          await batch.commit();
          return { data: { count: fresh.length, skipped } };
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
  useRetireItemMutation,
  useRestoreItemMutation,
  useAddItemToBranchMutation,
  useRemoveItemFromBranchMutation,
  useRecordBranchPurchasePriceMutation,
  useAddMultipleItemsMutation,
} = itemsApiSlice;
