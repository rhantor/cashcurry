import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
  limit,
  runTransaction,
  increment,
} from "firebase/firestore";

/**
 * Short, stable branch tag for document numbers, e.g. "KL".
 *
 * Prefers the branch's own `code`. Without one, a slug of the name reads far
 * better on a document a vendor has to quote back than a chunk of Firestore id,
 * which is the last resort.
 */
function branchTag(branch, branchId) {
  const code = String(branch?.code || "").trim();
  if (code) return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) || "BR";

  const fromName = String(branch?.name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
  if (fromName) return fromName;

  return String(branchId || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "BR";
}

/**
 * Reserve the next human-readable PO number, e.g. "PO-KL-2608-0007".
 *
 * The sequence is per branch and restarts each calendar month, so the branch tag
 * is what keeps two branches from both handing a vendor a "PO-2608-0001".
 * Vendors need something they can quote back on a delivery note — a
 * 20-character Firestore id is not that.
 *
 * Returns null when the counter cannot be written (for instance before the
 * `counters` rule has been deployed). Callers must treat the number as
 * optional and fall back to the document id.
 */
async function reservePoNumber(companyId, branchId) {
  try {
    const now = new Date();
    const period = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const counterRef = doc(db, "companies", companyId, "branches", branchId, "counters", "purchaseOrders");

    // Read outside the transaction: branch metadata is not part of what the
    // counter needs to stay consistent with.
    let tag = "BR";
    try {
      const branchSnap = await getDoc(doc(db, "companies", companyId, "branches", branchId));
      tag = branchTag(branchSnap.exists() ? branchSnap.data() : null, branchId);
    } catch {
      tag = branchTag(null, branchId);
    }

    const seq = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      const data = snap.exists() ? snap.data() : {};
      const next = (data[period] || 0) + 1;
      tx.set(counterRef, { [period]: next, updatedAt: serverTimestamp() }, { merge: true });
      return next;
    });

    return `PO-${tag}-${period}-${String(seq).padStart(4, "0")}`;
  } catch (error) {
    console.warn("[reservePoNumber] could not reserve a PO number:", error?.message);
    return null;
  }
}

/** Add `days` to a YYYY-MM-DD string (UTC safe). Mirrors new-bill/page.jsx. */
function addDaysISO(iso, days) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + Number(days || 0));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export const requisitionsApiSlice = createApi({
  reducerPath: "requisitionsApiSlice",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["Requisitions"],
  endpoints: (builder) => ({
    /** List all requisitions */
    getRequisitions: builder.query({
      // `limitCount` caps how many of the newest orders are pulled down. The
      // board is a card grid with no server-side paging, so an unbounded read
      // would grow forever; pass 0 to opt out and fetch everything.
      async queryFn({ companyId, branchId, vendorId, limitCount = 200 }) {
        try {
          if (!companyId || !branchId) return { error: { message: "Missing ids" } };
          const colRef = collection(db, "companies", companyId, "branches", branchId, "requisitions");

          const constraints = [];
          // NOTE: combining this with orderBy needs a composite index on
          // (vendorId, createdAt) — create it before using the vendor filter.
          if (vendorId) constraints.push(where("vendorId", "==", vendorId));
          constraints.push(orderBy("createdAt", "desc"));
          if (limitCount > 0) constraints.push(limit(limitCount));

          const snap = await getDocs(query(colRef, ...constraints));
          const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          return { data };
        } catch (error) {
          console.error(error);
          return { error };
        }
      },
      providesTags: (result, _err, { companyId, branchId }) =>
        result
          ? [
              { type: "Requisitions", id: `LIST:${companyId}_${branchId}` },
              ...result.map((i) => ({ type: "Requisitions", id: i.id })),
            ]
          : [{ type: "Requisitions", id: `LIST:${companyId}_${branchId}` }],
    }),

    /** Add single requisition */
    addRequisition: builder.mutation({
      async queryFn({ companyId, branchId, requisition }) {
        try {
          if (!companyId || !branchId) return { error: { message: "Missing ids" } };
          const colRef = collection(db, "companies", companyId, "branches", branchId, "requisitions");
          const now = serverTimestamp();
          const poNo = await reservePoNumber(companyId, branchId);

          const docRef = await addDoc(colRef, {
            ...requisition,
            ...(poNo ? { poNo } : {}),
            status: requisition.status || "Pending",
            createdAt: now,
            updatedAt: now,
          });
          return { data: { id: docRef.id, poNo } };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: (_res, _err, { companyId, branchId }) => [
        { type: "Requisitions", id: `LIST:${companyId}_${branchId}` },
      ],
    }),

    /** Update requisition */
    updateRequisition: builder.mutation({
      async queryFn({ companyId, branchId, requisitionId, patch }) {
        try {
          if (!companyId || !branchId || !requisitionId) return { error: { message: "Missing ids" } };
          const ref = doc(db, "companies", companyId, "branches", branchId, "requisitions", requisitionId);
          const data = { ...patch, updatedAt: serverTimestamp() };
          await updateDoc(ref, data);
          return { data: { ok: true } };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: (_res, _err, { requisitionId, companyId, branchId }) => [
        { type: "Requisitions", id: requisitionId },
        { type: "Requisitions", id: `LIST:${companyId}_${branchId}` },
      ],
    }),

    /** Delete requisition */
    deleteRequisition: builder.mutation({
      async queryFn({ companyId, branchId, requisitionId }) {
        try {
          if (!companyId || !branchId || !requisitionId) return { error: { message: "Missing ids" } };
          const ref = doc(db, "companies", companyId, "branches", branchId, "requisitions", requisitionId);
          await deleteDoc(ref);
          return { data: { ok: true } };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: (_res, _err, { requisitionId, companyId, branchId }) => [
        { type: "Requisitions", id: requisitionId },
        { type: "Requisitions", id: `LIST:${companyId}_${branchId}` },
      ],
    }),

    /**
     * Orders received within a date window, for the purchasing report.
     *
     * Only `createdAt` is range-queried — a single-field range needs no composite
     * index. Goods can arrive well after the order is raised, so the window is
     * widened by `lagDays` and the caller narrows on the effective received date;
     * that is cheaper than maintaining an index on a field older documents do not
     * even have.
     */
    getReceivedOrders: builder.query({
      async queryFn({ companyId, branchId, startDate, endDate, lagDays = 90 }) {
        try {
          if (!companyId || !branchId) return { error: { message: "Missing ids" } };
          const colRef = collection(db, "companies", companyId, "branches", branchId, "requisitions");

          const constraints = [];
          if (startDate) {
            const from = new Date(startDate);
            from.setDate(from.getDate() - lagDays);
            constraints.push(where("createdAt", ">=", from));
          }
          if (endDate) {
            const to = new Date(endDate);
            to.setHours(23, 59, 59, 999);
            constraints.push(where("createdAt", "<=", to));
          }
          constraints.push(orderBy("createdAt", "desc"));

          const snap = await getDocs(query(colRef, ...constraints));
          const data = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((r) => r.status === "Received");
          return { data };
        } catch (error) {
          console.error("[getReceivedOrders]", error);
          return { error };
        }
      },
      providesTags: (result, _err, { companyId, branchId }) => [
        { type: "Requisitions", id: `LIST:${companyId}_${branchId}` },
      ],
    }),

    /**
     * Receive goods against a PO (GRN) and raise the Accounts Payable bill.
     *
     * Everything happens inside a single transaction so a mid-way failure can
     * never leave a bill created against a PO that still reads "Sent" — the
     * situation that used to allow a retry to post the same invoice twice and
     * double-count the vendor balance.
     *
     * Guards:
     *  - a PO already marked "Received" is rejected (idempotent retry)
     *  - a "Cancelled" PO cannot be received
     */
    receivePurchaseOrder: builder.mutation({
      async queryFn({
        companyId,
        branchId,
        requisitionId,
        invoiceNo,
        invoiceDate,
        receivedItems = [],
        vendorTermsDays = 0,
        receivedBy = {},
        attachment = null,
      }) {
        try {
          if (!companyId || !branchId || !requisitionId) {
            return { error: { message: "Missing ids" } };
          }
          if (!String(invoiceNo || "").trim()) {
            return { error: { message: "Vendor invoice number is required" } };
          }
          // The scanned invoice is the only way anyone can later check the
          // prices entered here against what the vendor actually charged, so
          // the bill is not allowed to exist without it.
          if (!attachment?.url) {
            return { error: { message: "A photo or PDF of the vendor invoice is required" } };
          }

          const poRef = doc(db, "companies", companyId, "branches", branchId, "requisitions", requisitionId);
          const billsColRef = collection(db, "companies", companyId, "branches", branchId, "vendorBills");
          const billRef = doc(billsColRef); // pre-generate id so we can set() inside the txn

          const invDate = invoiceDate || new Date().toISOString().split("T")[0];

          // Quantities and prices arrive as strings from the number inputs;
          // coerce before they are written so the stored line items can be
          // summed and reported on without re-parsing everywhere.
          const lines = receivedItems.map((i) => ({
            ...i,
            receivedQty: Number(i.receivedQty || 0),
            finalPrice: Number(i.finalPrice || 0),
            requestedQty: Number(i.requestedQty || 0),
          }));

          const finalTotal = lines.reduce((acc, i) => acc + i.receivedQty * i.finalPrice, 0);
          if (!(finalTotal > 0)) {
            return { error: { message: "Total invoice amount must be greater than 0" } };
          }

          await runTransaction(db, async (tx) => {
            // ---- reads first (Firestore requires all reads before writes) ----
            const poSnap = await tx.get(poRef);
            if (!poSnap.exists()) throw new Error("Purchase order no longer exists");

            const po = poSnap.data();
            if (po.status === "Received") {
              throw new Error("This purchase order has already been received");
            }
            if (po.status === "Cancelled" || po.status === "Rejected") {
              throw new Error("A cancelled purchase order cannot be received");
            }
            if (!po.vendorId) throw new Error("Purchase order has no vendor");

            const vendorRef = doc(db, "companies", companyId, "vendors", po.vendorId);

            // ---- writes ----
            tx.set(billRef, {
              vendorId: po.vendorId,
              vendorName: po.vendorName || "",
              invoiceNo: String(invoiceNo).trim(),
              invoiceDate: invDate,
              // Honour the vendor's credit terms instead of making every
              // GRN-generated bill due on the day it was received.
              dueDate: addDaysISO(invDate, vendorTermsDays) || invDate,
              total: finalTotal,
              paid: 0,
              balance: finalTotal,
              status: "unpaid",
              items: lines,
              attachments: [attachment.url],
              attachmentPath: attachment.path || "",
              notes: `Received from PO: ${po.poNo || requisitionId}`,
              sourcePoId: requisitionId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              createdBy: receivedBy || {},
            });

            tx.update(vendorRef, {
              currentBalance: increment(finalTotal),
              totalBilled: increment(finalTotal),
              updatedAt: serverTimestamp(),
            });

            tx.update(poRef, {
              status: "Received",
              receivedItems: lines,
              finalTotal,
              receivedAt: serverTimestamp(),
              receivedBy: receivedBy || {},
              billId: billRef.id,
              invoiceNo: String(invoiceNo).trim(),
              invoiceAttachment: attachment.url,
              updatedAt: serverTimestamp(),
            });

            // TODO(pos-inventory): when the POS module lands, this is the hook
            // point for stock-in. Inside this same transaction, for each row of
            // `receivedItems`, increment companies/{companyId}/branches/{branchId}
            // /itemStock/{itemId}.qty and append a PURCHASE_RECEIPT document to
            // .../inventoryMovements. Deliberately left out for now: nothing in
            // the app decrements stock yet, so wiring it up would only ever grow
            // the numbers and produce misleading stock reports.
          });

          return { data: { ok: true, billId: billRef.id, finalTotal } };
        } catch (error) {
          console.error("[receivePurchaseOrder] error:", error);
          return { error: { message: error?.message || "Failed to receive order" } };
        }
      },
      invalidatesTags: (_res, _err, { requisitionId, companyId, branchId }) => [
        { type: "Requisitions", id: requisitionId },
        { type: "Requisitions", id: `LIST:${companyId}_${branchId}` },
      ],
    }),

  }),
});

export const {
  useGetRequisitionsQuery,
  useGetReceivedOrdersQuery,
  useAddRequisitionMutation,
  useUpdateRequisitionMutation,
  useDeleteRequisitionMutation,
  useReceivePurchaseOrderMutation,
} = requisitionsApiSlice;
