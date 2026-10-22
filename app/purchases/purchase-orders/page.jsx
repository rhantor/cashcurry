"use client";
import { format } from "date-fns";
import { personName } from "@/lib/people";
import { formatMoney } from "@/lib/region/currency";
import { businessToday } from "@/lib/region";
import React, { useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { skipToken } from "@reduxjs/toolkit/query";
import useResolvedCompanyBranch from "@/app/hooks/useResolvedCompanyBranch";
import {
  useGetRequisitionsQuery, // Using requisitionsApiSlice as our PO storage
  useAddRequisitionMutation,
  useUpdateRequisitionMutation,
  useReceivePurchaseOrderMutation,
} from "@/lib/redux/api/requisitionsApiSlice";
import { vendorBillsApiSlice } from "@/lib/redux/api/vendorBillsApiSlice";
import { useGetVendorsQuery } from "@/lib/redux/api/vendorsApiSlice";
import {
  useGetItemsQuery,
  useRecordBranchPurchasePriceMutation,
  branchLastPrice,
} from "@/lib/redux/api/itemsApiSlice";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { useGetCompanyDetailsQuery } from "@/lib/redux/api/authApiSlice";
import ConfirmSheet from "@/app/components/purchases/ConfirmSheet";
import { filterItems } from "@/app/components/purchases/ItemFilterBar";
import useToast from "@/app/components/purchases/useToast";
import { uploadInvoiceFile } from "@/lib/storage/uploadInvoice";
import useCurrency from "@/app/hooks/useCurrency";
import buildPurchaseOrderPdf, { loadLogo, poReference } from "@/lib/purchases/purchaseOrderPdf";
import {
  FileText,
  Send,
  PackageOpen,
  Ban,
  Pencil,
  Plus,
  CheckCircle,
  XCircle,
  Paperclip,
  Search,
  RotateCcw,
  Repeat,
  ListPlus,
} from "lucide-react";
import { SENT_VIA, dueText, followUpOrder, lateDays, missingLines, repeatOrder } from "@/lib/purchases/orders";
import { useRouter } from "next/navigation";
import { OrdersContext } from "./OrdersContext";
import EditOrderSheet from "./components/EditOrderSheet";
import ReceiveSheet from "./components/ReceiveSheet";
import SendOrderSheet from "./components/SendOrderSheet";
import { lineTotal } from "./shared";
import { can } from "@/lib/authz/permissions";

const STATUS_STYLE = {
  Pending: "bg-warning-soft text-warning",
  Approved: "bg-violet-100 text-info",
  Sent: "bg-info-soft text-info",
  Received: "bg-brand-soft text-brand",
  Rejected: "bg-danger-soft text-danger",
  Cancelled: "bg-surface-2 text-muted",
};

/** Plain-language description of each state, for staff who don't live in this screen. */
const STATUS_HINT = {
  Pending: "Not sent to the supplier yet",
  Approved: "Approved — ready to send",
  Sent: "With the supplier, waiting for delivery",
  Received: "Delivered and billed",
  Rejected: "Turned down",
  Cancelled: "Cancelled",
};

/** Roles allowed to approve or reject a purchase order. */

const normalizeStatus = (status) => status || "Pending";

const sumLines = (rows = [], qtyKey, priceKey) =>
  rows.reduce((acc, row) => acc + lineTotal(row, qtyKey, priceKey), 0);

const todayISO = () => businessToday(); // on the branch's clock

export default function PurchaseOrdersPage() {
  const { ready, companyId, branchId, user } = useResolvedCompanyBranch();
  const currency = useCurrency();
  const fmtMoney = (n) => formatMoney(n, currency);
  const router = useRouter();
  const dispatch = useDispatch();
  const { toastOk, toastError, toastNode } = useToast();

  const args = ready && companyId && branchId ? { companyId, branchId } : skipToken;
  const companyArgs = ready && companyId ? { companyId } : skipToken;

  const { data: orders = [], isLoading: ordersLoading } = useGetRequisitionsQuery(args);
  const { data: vendors = [] } = useGetVendorsQuery(companyArgs);
  // Only what this branch stocks — adding another branch's product to an order
  // would be a mistake, not a convenience.
  const { data: catalog = [] } = useGetItemsQuery(args);
  const { data: branchSettings } = useGetBranchSettingsQuery(args);
  // Letterhead details for the printed order.
  const { data: branch } = useGetSingleBranchQuery(args);
  const { data: company } = useGetCompanyDetailsQuery(ready && companyId ? companyId : skipToken);

  // Approval is a per-branch policy, off by default — see PurchasesSection in
  // branch settings.
  const requireApproval = branchSettings?.purchases?.requirePoApproval === true;
  const canApprove = can(user?.role, "purchases.approve");

  const [updateOrder, { isLoading: updating }] = useUpdateRequisitionMutation();
  const [addOrder, { isLoading: adding }] = useAddRequisitionMutation();
  const today = todayISO();
  const [receiveOrder, { isLoading: receiving }] = useReceivePurchaseOrderMutation();
  const [recordBranchPrice] = useRecordBranchPurchasePriceMutation();

  const [invoiceFile, setInvoiceFile] = useState(null);
  const [invoicePreview, setInvoicePreview] = useState(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploading, setUploading] = useState(false);

  const busy = ordersLoading || updating || receiving || uploading || adding;

  const [selectedOrder, setSelectedOrder] = useState(null);

  /* -------------------------------- filters -------------------------------- */
  // Open orders are what people come here to act on, so hide the settled ones
  // by default rather than making users scroll past months of history.
  const [statusFilter, setStatusFilter] = useState("Open");
  const [search, setSearch] = useState("");

  const visibleOrders = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const shown = orders.filter((order) => {
      const status = normalizeStatus(order.status);
      const settled = status === "Received" || status === "Cancelled" || status === "Rejected";
      if (statusFilter === "Open" && settled) return false;
      if (statusFilter === "Done" && !settled) return false;
      if (needle) {
        const haystack = [order.vendorName, order.poNo, order.invoiceNo, order.notes]
          .concat((order.items || []).map((i) => i.name))
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
    // late deliveries first — they need a phone call
    return [...shown].sort((a, b) => lateDays(b, today) - lateDays(a, today));
  }, [orders, statusFilter, search, today]);

  /* ------------------------------ receive (GRN) ----------------------------- */
  const [openReceiveSheet, setOpenReceiveSheet] = useState(false);
  const [receiveData, setReceiveData] = useState({ invoiceNo: "", invoiceDate: todayISO(), items: [] });

  const handleOpenReceive = (order) => {
    setSelectedOrder(order);
    setInvoiceFile(null);
    setInvoicePreview(null);
    setUploadPct(0);
    setReceiveData({
      invoiceNo: "",
      invoiceDate: todayISO(),
      items: (order.items || []).map((i) => ({
        itemId: i.itemId,
        name: i.name,
        category: i.category,
        unit: i.unit,
        requestedQty: i.requestedQty,
        receivedQty: String(i.requestedQty ?? ""), // default to receiving exactly what was ordered
        finalPrice: String(i.estPrice ?? ""), // default to est price
        estPrice: Number(i.estPrice) || 0, // what was expected — a dearer price is flagged
      })),
    });
    setOpenReceiveSheet(true);
  };

  const updateReceiveRow = (itemId, key, val) => {
    setReceiveData((prev) => ({
      ...prev,
      items: prev.items.map((row) => (row.itemId === itemId ? { ...row, [key]: val } : row)),
    }));
  };

  const receiveTotal = sumLines(receiveData.items, "receivedQty", "finalPrice");

  const handleReceiveOrder = async () => {
    if (!receiveData.invoiceNo.trim()) return toastError("Enter the supplier's invoice number.");
    if (!invoiceFile) {
      return toastError("Take a photo of the invoice first — it's needed to check the prices later.");
    }
    if (receiveTotal <= 0) return toastError("The invoice total must be more than zero.");

    const vendor = vendors.find((v) => v.id === selectedOrder.vendorId);
    const vendorTermsDays = Number(vendor?.termsDays ?? vendor?.creditDays ?? 0) || 0;

    try {
      // Upload first: a failed upload should leave nothing behind, whereas a
      // bill without its invoice image cannot be verified later.
      setUploading(true);
      setUploadPct(0);
      const attachment = await uploadInvoiceFile(
        {
          companyId,
          branchId,
          vendorId: selectedOrder.vendorId,
          invoiceNo: receiveData.invoiceNo,
          invoiceDate: receiveData.invoiceDate,
        },
        invoiceFile,
        setUploadPct
      );
      setUploading(false);

      // The bill, the vendor balance and the PO status all move together — see
      // receivePurchaseOrder in requisitionsApiSlice for the transaction.
      await receiveOrder({
        companyId,
        branchId,
        requisitionId: selectedOrder.id,
        invoiceNo: receiveData.invoiceNo,
        invoiceDate: receiveData.invoiceDate,
        receivedItems: receiveData.items,
        vendorTermsDays,
        receivedBy: user || {},
        attachment,
      }).unwrap();

      // The bill lives in a different api slice, so refresh it by hand.
      dispatch(
        vendorBillsApiSlice.util.invalidateTags([
          { type: "VendorBills", id: `LIST:${companyId}:${branchId}` },
        ])
      );

      // Record what the goods actually cost, against this branch. Bookkeeping
      // only, so it runs outside the transaction — a failure here must not undo
      // the bill. Prices are kept per branch: two branches buying the same
      // product at different rates should not overwrite each other, and
      // `defaultPrice` (the company planning price) is never touched.
      await Promise.allSettled(
        receiveData.items
          .filter((item) => Number(item.finalPrice) > 0)
          .map((item) =>
            recordBranchPrice({
              companyId,
              branchId,
              itemId: item.itemId,
              price: Number(item.finalPrice),
              date: receiveData.invoiceDate,
            })
          )
      );

      setOpenReceiveSheet(false);
      setInvoiceFile(null);
      setInvoicePreview(null);
      toastOk("Goods received. The supplier's bill has been created.");
    } catch (e) {
      console.error(e);
      toastError(e?.message || "Could not receive this order. Nothing was saved.");
    } finally {
      setUploading(false);
    }
  };

  /* --------------------------------- edit ---------------------------------- */
  const [openEditSheet, setOpenEditSheet] = useState(false);
  const [editData, setEditData] = useState({ items: [], notes: "" });
  const [showPicker, setShowPicker] = useState(false);
  const [pickSearch, setPickSearch] = useState("");
  const [pickCategory, setPickCategory] = useState("");
  const [confirmReapproval, setConfirmReapproval] = useState(false);

  // an order collected with a pay-out waits on that bill: nothing changes it meanwhile
  const canEdit = (order) => !order.payoutHold && ["Pending", "Approved", "Sent", "Rejected"].includes(normalizeStatus(order.status));
  const canCancel = (order) => !order.payoutHold && ["Pending", "Approved", "Sent"].includes(normalizeStatus(order.status));

  const handleOpenEdit = (order) => {
    setSelectedOrder(order);
    setEditData({
      items: (order.items || []).map((i) => ({ ...i, requestedQty: String(i.requestedQty ?? ""), estPrice: String(i.estPrice ?? "") })),
      notes: order.notes || "",
    });
    setShowPicker(false);
    setPickSearch("");
    setPickCategory("");
    setOpenEditSheet(true);
  };

  const updateEditRow = (itemId, key, val) => {
    setEditData((prev) => ({
      ...prev,
      items: prev.items.map((row) => (row.itemId === itemId ? { ...row, [key]: val } : row)),
    }));
  };

  const removeEditRow = (itemId) => {
    setEditData((prev) => ({ ...prev, items: prev.items.filter((row) => row.itemId !== itemId) }));
  };

  // Catalog entries not already on this PO. Items mapped to specific vendors are
  // only offered when they include this PO's vendor; unmapped items suit anyone.
  const addableItems = useMemo(() => {
    if (!selectedOrder) return [];
    const already = new Set(editData.items.map((i) => i.itemId));
    return catalog.filter(
      (item) =>
        !already.has(item.id) &&
        (!item.vendorIds?.length || item.vendorIds.includes(selectedOrder.vendorId))
    );
  }, [catalog, editData.items, selectedOrder]);

  const pickableItems = useMemo(
    () => filterItems(addableItems, { search: pickSearch, category: pickCategory }),
    [addableItems, pickSearch, pickCategory]
  );

  const handleAddEditRow = (item) => {
    setEditData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          itemId: item.id,
          name: item.name || "Unknown Item",
          unit: item.unit || "Pcs",
          category: item.category || "",
          requestedQty: "",
          estPrice: String(branchLastPrice(item, branchId)),
        },
      ],
    }));
  };

  const editTotal = sumLines(editData.items);

  const saveEdit = async (resetApproval) => {
    const validItems = editData.items.filter((i) => Number(i.requestedQty || 0) > 0);

    try {
      await updateOrder({
        companyId,
        branchId,
        requisitionId: selectedOrder.id,
        patch: {
          items: validItems.map((i) => ({
            itemId: i.itemId,
            name: i.name,
            unit: i.unit,
            category: i.category,
            requestedQty: Number(i.requestedQty),
            estPrice: Number(i.estPrice || 0),
          })),
          notes: editData.notes,
          totalEst: sumLines(validItems),
          lastEditedAt: new Date().toISOString(),
          lastEditedBy: user?.uid || "",
          lastEditedByName: personName(user),
          ...(resetApproval
            ? {
                status: "Pending",
                approvedBy: "",
                approvedByName: "",
                approvedAt: "",
                selfApproved: false,
              }
            : {}),
        },
      }).unwrap();
      setConfirmReapproval(false);
      setOpenEditSheet(false);
      toastOk(resetApproval ? "Saved — the order needs approving again." : "Order updated.");
    } catch (e) {
      console.error(e);
      toastError("Could not save the changes.");
    }
  };

  const handleSaveEdit = () => {
    const validItems = editData.items.filter((i) => Number(i.requestedQty || 0) > 0);
    if (validItems.length === 0) {
      return toastError("Keep at least one item with a quantity above zero.");
    }

    // Changing what was approved invalidates the approval, so the order goes
    // back for a fresh one rather than being sent with quantities nobody signed
    // off. Without the approval policy there is nothing to reset.
    const wasApproved = normalizeStatus(selectedOrder.status) === "Approved";
    if (requireApproval && wasApproved) {
      setConfirmReapproval(true);
      return;
    }
    saveEdit(false);
  };

  /* -------------------------- status / approvals --------------------------- */
  const [pendingAction, setPendingAction] = useState(null); // { kind, order }

  const runStatusChange = async (order, patch, okMessage) => {
    try {
      await updateOrder({ companyId, branchId, requisitionId: order.id, patch }).unwrap();
      setPendingAction(null);
      toastOk(okMessage);
    } catch (e) {
      console.error(e);
      toastError("Could not update the order.");
    }
  };

  // sending opens the send sheet: WhatsApp, PDF, email (components/SendOrderSheet)
  const [sendingOrder, setSendingOrder] = useState(null);
  const handleSend = (order) => setSendingOrder(order);

  /* ------------------------ order again / what's missing --------------------- */
  const startOrder = async (data, okMessage) => {
    try {
      const res = await addOrder({ companyId, branchId, requisition: data }).unwrap();
      setStatusFilter("Open");
      toastOk(okMessage(res?.poNo));
      return res;
    } catch (e) {
      console.error(e);
      toastError("Could not make the order.");
      return null;
    }
  };

  const orderMissing = async (order) => {
    const res = await startOrder(followUpOrder(order, { uid: user?.uid, name: personName(user) }), (no) => `${no || "New order"} made for what was missing — send it when ready.`);
    if (res) await updateOrder({ companyId, branchId, requisitionId: order.id, patch: { followUpPoId: res.id, followUpPoNo: res.poNo || "" } }).unwrap().catch(() => {});
  };

  const orderAgain = (order) => {
    const byId = new Map(catalog.map((i) => [i.id, i]));
    const data = repeatOrder(order, { uid: user?.uid, name: personName(user) }, { inCatalog: (id) => byId.has(id), priceOf: (id) => branchLastPrice(byId.get(id), branchId) });
    if (!data.items.length) return toastError("None of these items are sold at this branch any more.");
    return startOrder(data, (no) => `${no || "New order"} made — change it if you need, then send it.`);
  };

  const confirmPendingAction = async (reason) => {
    const { kind, order } = pendingAction;

    if (kind === "cancel") {
      return runStatusChange(order, { status: "Cancelled" }, "Order cancelled.");
    }

    if (kind === "approve") {
      // A branch with a single manager would deadlock if approving your own
      // order were blocked, so it is allowed and flagged instead.
      const isSelf = !!order.createdBy && order.createdBy === user?.uid;
      return runStatusChange(
        order,
        {
          status: "Approved",
          approvedBy: user?.uid || "",
          approvedByName: personName(user),
          approvedAt: new Date().toISOString(),
          selfApproved: isSelf,
          rejectionReason: "",
        },
        "Order approved."
      );
    }

    if (kind === "reject") {
      return runStatusChange(
        order,
        {
          status: "Rejected",
          rejectedBy: user?.uid || "",
          rejectedByName: personName(user),
          rejectedAt: new Date().toISOString(),
          rejectionReason: reason,
        },
        "Order rejected."
      );
    }

    if (kind === "reopen") {
      return runStatusChange(
        order,
        {
          status: "Pending",
          rejectionReason: "",
          approvedBy: "",
          approvedByName: "",
          approvedAt: "",
          selfApproved: false,
        },
        "Order reopened."
      );
    }
  };

  const actionCopy = () => {
    if (!pendingAction) return {};
    const { kind, order } = pendingAction;
    const isSelf = !!order.createdBy && order.createdBy === user?.uid;
    return {
      approve: {
        title: "Approve this order?",
        message: isSelf
          ? `You raised this order for ${order.vendorName}. Approving it yourself is allowed, but it will be recorded as a self-approval.`
          : `${order.vendorName} · ${fmtMoney(order.totalEst)}. Once approved it can be sent to the supplier.`,
        confirmLabel: "Approve",
        tone: "default",
      },
      reject: {
        title: "Reject this order?",
        message: `${order.vendorName} · ${fmtMoney(order.totalEst)}. Whoever raised it will see your reason.`,
        confirmLabel: "Reject order",
        tone: "danger",
        requireReason: true,
        reasonLabel: "Why is it being rejected?",
        reasonPlaceholder: "e.g. Too much stock already, order again next week",
      },
      cancel: {
        title: "Cancel this order?",
        message: `The order for ${order.vendorName} will be closed. This cannot be undone.`,
        confirmLabel: "Cancel order",
        tone: "danger",
      },
      reopen: {
        title: "Reopen this order?",
        message: "It goes back to Pending so it can be corrected and approved again.",
        confirmLabel: "Reopen",
        tone: "default",
      },
    }[kind];
  };

  /* ---------------------------------- pdf ---------------------------------- */
  const [printing, setPrinting] = useState(null);

  const exportPDF = async (order) => {
    setPrinting(order.id);
    try {
      // The logo is fetched per print rather than cached: it is one small
      // request, and a stale data URL is worse than a slightly slower export.
      const logoDataUrl = await loadLogo(company?.logo);

      buildPurchaseOrderPdf({
        order,
        vendor: vendors.find((v) => v.id === order.vendorId),
        company,
        branch,
        branchBasic: branchSettings?.basic,
        currency,
        logoDataUrl,
      });
    } catch (e) {
      console.error(e);
      toastError("Could not build the PDF.");
    } finally {
      setPrinting(null);
    }
  };

  /* --------------------------------- render -------------------------------- */
  const iconBtn =
    "w-11 h-11 flex items-center justify-center rounded-xl text-muted bg-surface-2/60 active:bg-surface-2 transition-colors";

  return (
    <OrdersContext.Provider value={{ receiving, ready, companyId, branchId, user, currency, fmtMoney, router, dispatch, toastOk, toastError, toastNode, args, companyArgs, orders, ordersLoading, vendors, catalog, branchSettings, branch, company, requireApproval, canApprove, invoiceFile, setInvoiceFile, invoicePreview, setInvoicePreview, uploadPct, setUploadPct, uploading, setUploading, busy, selectedOrder, setSelectedOrder, statusFilter, setStatusFilter, search, setSearch, visibleOrders, openReceiveSheet, setOpenReceiveSheet, receiveData, setReceiveData, handleOpenReceive, updateReceiveRow, receiveTotal, handleReceiveOrder, openEditSheet, setOpenEditSheet, editData, setEditData, showPicker, setShowPicker, pickSearch, setPickSearch, pickCategory, setPickCategory, confirmReapproval, setConfirmReapproval, canEdit, canCancel, handleOpenEdit, updateEditRow, removeEditRow, addableItems, pickableItems, handleAddEditRow, editTotal, saveEdit, handleSaveEdit, pendingAction, setPendingAction, runStatusChange, handleSend, sendingOrder, setSendingOrder, confirmPendingAction, actionCopy, printing, setPrinting, exportPDF }}>
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-5 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Purchase orders</h1>
          <p className="text-muted text-sm mt-0.5">Send orders, then receive the goods when they arrive.</p>
        </div>
        <button
          onClick={() => router.push("/purchases/order-guides")}
          className="min-h-[48px] px-5 rounded-2xl bg-brand text-brand-fg font-semibold
                     flex items-center justify-center gap-2 active:brightness-95 transition-colors"
        >
          <Plus className="w-5 h-5" /> New Order
        </button>
      </div>

      {/* Filters — two big tabs plus search, rather than three dropdowns. */}
      <div className="space-y-3">
        <div className="flex gap-2">
          {[
            { id: "Open", label: "To do" },
            { id: "Done", label: "Completed" },
            { id: "All", label: "All" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`flex-1 sm:flex-none sm:px-6 min-h-[44px] rounded-2xl font-semibold text-sm transition-colors ${
                statusFilter === tab.id
                  ? "bg-brand text-brand-fg"
                  : "bg-surface text-muted border border-line active:bg-surface-2"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search supplier, PO number or item…"
            className="w-full min-h-[48px] pl-10 pr-4 text-[15px] border border-line rounded-2xl bg-surface
                       focus:border-brand focus:ring-2 focus:ring-[var(--cc-ring)]/20 outline-none transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleOrders.map((order) => {
          const status = normalizeStatus(order.status);
          const showApproval = status === "Pending" && requireApproval;
          return (
            <div
              key={order.id}
              className="bg-surface rounded-3xl border border-line shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5 flex flex-col"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-bold text-fg text-lg leading-snug min-w-0 truncate">
                  {order.vendorName}
                </h3>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                    STATUS_STYLE[status] || "bg-surface-2 text-muted"
                  }`}
                >
                  {status}
                </span>
              </div>

              <p className="text-xs text-muted mb-3">{STATUS_HINT[status] || ""}</p>

              {status === "Sent" && order.deliverBy && !order.payoutHold && (
                <p
                  className={`-mt-1.5 mb-3 inline-flex self-start rounded-lg px-2 py-1 text-xs font-semibold ${
                    lateDays(order, today) > 0 ? "bg-danger-soft text-danger" : "bg-info-soft text-info"
                  }`}
                >
                  {dueText(order, today)}
                  {lateDays(order, today) > 0 ? " — call the supplier" : ""} · {format(new Date(`${order.deliverBy}T12:00:00`), "d MMM")}
                </p>
              )}

              <div className="flex items-baseline justify-between gap-2 mb-3">
                <p className="text-2xl font-bold text-fg tabular-nums">
                  {fmtMoney(status === "Received" ? order.finalTotal : order.totalEst)}
                </p>
                <p className="text-xs text-subtle shrink-0">
                  {status === "Received" ? "billed" : "estimated"}
                </p>
              </div>

              <div className="text-xs text-muted space-y-1 mb-4">
                <p className="flex justify-between gap-2">
                  <span className="font-mono text-subtle">{poReference(order)}</span>
                  <span>
                    {order.items?.length || 0} item{order.items?.length === 1 ? "" : "s"} ·{" "}
                    {order.createdAt?.seconds ? format(new Date(order.createdAt.seconds * 1000), "d MMM yyyy") : "-"}
                  </span>
                </p>

                {order.approvedByName && ["Approved", "Sent", "Received"].includes(status) && (
                  <p className="text-info">
                    Approved by {order.approvedByName}
                    {order.selfApproved && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-warning-soft text-warning font-semibold">
                        self
                      </span>
                    )}
                  </p>
                )}

                {order.sentAt && ["Sent", "Received"].includes(status) && (
                  <p>
                    Sent {order.sentVia && order.sentVia !== "other" ? `by ${SENT_VIA[order.sentVia]} ` : ""}
                    {format(new Date(order.sentAt), "d MMM, h:mm a")}
                    {order.sentByName ? ` · ${order.sentByName}` : ""}
                  </p>
                )}

                {status === "Received" && missingLines(order).length > 0 && (
                  <p className="text-warning font-medium">
                    Came short: {missingLines(order).map((l) => `${l.name} ${l.requestedQty} ${l.unit}`.trim()).join(", ")}
                    {order.followUpPoNo ? ` — ordered again on ${order.followUpPoNo}` : order.followUpPoId ? " — ordered again" : ""}
                  </p>
                )}

                {(order.followUpOf || order.repeatOf) && order.notes && <p className="text-subtle">{order.notes}</p>}

                {status === "Rejected" && order.rejectionReason && (
                  <p className="text-danger">
                    {order.rejectedByName ? `${order.rejectedByName}: ` : ""}
                    {order.rejectionReason}
                  </p>
                )}

                {order.lastEditedAt && status !== "Received" && (
                  <p className="text-subtle">
                    Edited {format(new Date(order.lastEditedAt), "d MMM yyyy")}
                    {order.lastEditedByName ? ` by ${order.lastEditedByName}` : ""}
                  </p>
                )}

                {status === "Received" && order.invoiceAttachment && (
                  <a
                    href={order.invoiceAttachment}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-brand active:underline"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    {order.invoiceNo ? `Invoice ${order.invoiceNo}` : "View invoice"}
                  </a>
                )}
              </div>

              {/* Primary action gets the full width; everything else is a small icon. */}
              <div className="mt-auto space-y-2">
                {showApproval && canApprove && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPendingAction({ kind: "approve", order })}
                      className="flex-1 min-h-[48px] rounded-2xl bg-info text-white font-bold
                                 flex items-center justify-center gap-2 active:brightness-95 transition-colors"
                    >
                      <CheckCircle className="w-5 h-5" /> Approve
                    </button>
                    <button
                      onClick={() => setPendingAction({ kind: "reject", order })}
                      aria-label="Reject"
                      className="w-12 min-h-[48px] flex items-center justify-center rounded-2xl bg-danger-soft text-danger
                                 active:bg-danger-soft transition-colors"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {showApproval && !canApprove && (
                  <div className="min-h-[48px] rounded-2xl bg-surface-2/60 text-muted font-medium text-sm
                                  flex items-center justify-center">
                    Waiting for approval
                  </div>
                )}

                {order.payoutHold && status !== "Received" && (
                  <div className="min-h-[48px] rounded-2xl bg-warning-soft px-3 py-2 text-sm font-medium text-fg flex items-center justify-center text-center">
                    Arrived with a pay-out — its bill is waiting for approval in Pay-outs
                  </div>
                )}

                {!order.payoutHold && (status === "Approved" || (status === "Pending" && !requireApproval)) && (
                  <button
                    onClick={() => handleSend(order)}
                    className="w-full min-h-[48px] rounded-2xl bg-info text-white font-bold
                               flex items-center justify-center gap-2 active:brightness-95 transition-colors"
                  >
                    <Send className="w-5 h-5" /> Send to Supplier
                  </button>
                )}

                {status === "Sent" && !order.payoutHold && (
                  <button
                    onClick={() => handleOpenReceive(order)}
                    className="w-full min-h-[48px] rounded-2xl bg-brand text-brand-fg font-bold
                               flex items-center justify-center gap-2 active:brightness-95 transition-colors"
                  >
                    <PackageOpen className="w-5 h-5" /> Goods Arrived
                  </button>
                )}

                {status === "Received" && missingLines(order).length > 0 && !order.followUpPoId && (
                  <button
                    onClick={() => orderMissing(order)}
                    disabled={busy}
                    className="w-full min-h-[48px] rounded-2xl bg-warning-soft text-fg font-bold
                               flex items-center justify-center gap-2 active:brightness-95 disabled:opacity-50 transition-colors"
                  >
                    <ListPlus className="w-5 h-5" /> Order the missing ({missingLines(order).length})
                  </button>
                )}

                {status === "Rejected" && canApprove && (
                  <button
                    onClick={() => setPendingAction({ kind: "reopen", order })}
                    className="w-full min-h-[48px] rounded-2xl bg-surface-2 text-fg font-bold
                               flex items-center justify-center gap-2 active:bg-surface-2 transition-colors"
                  >
                    <RotateCcw className="w-5 h-5" /> Reopen
                  </button>
                )}

                <div className="flex gap-2">
                  {canEdit(order) && (
                    <button onClick={() => handleOpenEdit(order)} aria-label="Edit order" className={iconBtn}>
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {status === "Sent" && !order.payoutHold && (
                    <button onClick={() => handleSend(order)} aria-label="Send again" title="Send again" className={iconBtn}>
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                  {["Received", "Cancelled"].includes(status) && (
                    <button onClick={() => orderAgain(order)} disabled={busy} aria-label="Order again" title="Order again" className={`${iconBtn} disabled:opacity-50`}>
                      <Repeat className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => exportPDF(order)}
                    disabled={printing === order.id}
                    aria-label="Download PDF"
                    className={`${iconBtn} disabled:opacity-50`}
                  >
                    <FileText className={`w-4 h-4 ${printing === order.id ? "animate-pulse" : ""}`} />
                  </button>
                  {canCancel(order) && (
                    <button
                      onClick={() => setPendingAction({ kind: "cancel", order })}
                      aria-label="Cancel order"
                      className={`${iconBtn} ml-auto active:text-danger active:bg-danger-soft`}
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {visibleOrders.length === 0 && !ordersLoading && (
          <div className="col-span-full py-16 px-6 text-center bg-surface rounded-3xl border border-line">
            <PackageOpen className="w-12 h-12 text-subtle mx-auto mb-4" />
            <h3 className="text-lg font-bold text-fg">
              {orders.length === 0 ? "No orders yet" : "Nothing here"}
            </h3>
            <p className="text-muted mt-1 text-sm max-w-sm mx-auto">
              {orders.length === 0
                ? "Start an order from one of your order guides."
                : "Try the All tab, or clear the search."}
            </p>
            {orders.length === 0 && (
              <button
                onClick={() => router.push("/purchases/order-guides")}
                className="mt-5 min-h-[48px] px-6 rounded-2xl bg-brand text-brand-fg font-semibold active:brightness-95"
              >
                Go to Order Guides
              </button>
            )}
          </div>
        )}
      </div>

      <EditOrderSheet />

      <ReceiveSheet />

      <SendOrderSheet today={today} />

      <ConfirmSheet
        open={!!pendingAction}
        busy={updating}
        onConfirm={confirmPendingAction}
        onClose={() => setPendingAction(null)}
        {...actionCopy()}
      />

      <ConfirmSheet
        open={confirmReapproval}
        title="This order is already approved"
        message="Saving your changes will send it back for approval before it can go to the supplier."
        confirmLabel="Save anyway"
        tone="warn"
        busy={updating}
        onConfirm={() => saveEdit(true)}
        onClose={() => setConfirmReapproval(false)}
      />

      {toastNode}
    </div>
    </OrdersContext.Provider>
  );
}
