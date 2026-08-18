"use client";
import React, { useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { skipToken } from "@reduxjs/toolkit/query";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import {
  useGetRequisitionsQuery, // Using requisitionsApiSlice as our PO storage
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
import UploadInvoice from "@/app/components/purchases/UploadInvoice";
import Sheet from "@/app/components/purchases/Sheet";
import QtyStepper from "@/app/components/purchases/QtyStepper";
import MoneyInput from "@/app/components/purchases/MoneyInput";
import ConfirmSheet from "@/app/components/purchases/ConfirmSheet";
import ItemFilterBar, { filterItems } from "@/app/components/purchases/ItemFilterBar";
import useToast from "@/app/components/purchases/useToast";
import { uploadInvoiceFile } from "@/utils/storage/uploadInvoice";
import useCurrency from "@/app/hooks/useCurrency";
import buildPurchaseOrderPdf, { loadLogo, poReference } from "@/utils/pdf/purchaseOrderPdf";
import {
  FileText,
  Send,
  PackageOpen,
  Ban,
  Pencil,
  Plus,
  X,
  CheckCircle,
  XCircle,
  Paperclip,
  Search,
  RotateCcw,
  Camera,
} from "lucide-react";
import { useRouter } from "next/navigation";

const STATUS_STYLE = {
  Pending: "bg-amber-100 text-amber-800",
  Approved: "bg-violet-100 text-violet-800",
  Sent: "bg-blue-100 text-blue-800",
  Received: "bg-emerald-100 text-emerald-800",
  Rejected: "bg-red-100 text-red-800",
  Cancelled: "bg-slate-200 text-slate-600",
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
const APPROVER_ROLES = new Set(["owner", "gm", "superAdmin", "superadmin", "branchAdmin", "branchadmin", "manager"]);

const normalizeStatus = (status) => status || "Pending";

const lineTotal = (row, qtyKey = "requestedQty", priceKey = "estPrice") =>
  Number(row?.[qtyKey] || 0) * Number(row?.[priceKey] || 0);
const sumLines = (rows = [], qtyKey, priceKey) =>
  rows.reduce((acc, row) => acc + lineTotal(row, qtyKey, priceKey), 0);

const money = (n) => Number(n || 0).toFixed(2);
const todayISO = () => new Date().toISOString().split("T")[0];

export default function PurchaseOrdersPage() {
  const { ready, companyId, branchId, user } = useResolvedCompanyBranch();
  const currency = useCurrency();
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
  const canApprove = APPROVER_ROLES.has(user?.role);

  const [updateOrder, { isLoading: updating }] = useUpdateRequisitionMutation();
  const [receiveOrder, { isLoading: receiving }] = useReceivePurchaseOrderMutation();
  const [recordBranchPrice] = useRecordBranchPurchasePriceMutation();

  const [invoiceFile, setInvoiceFile] = useState(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploading, setUploading] = useState(false);

  const busy = ordersLoading || updating || receiving || uploading;

  const [selectedOrder, setSelectedOrder] = useState(null);

  /* -------------------------------- filters -------------------------------- */
  // Open orders are what people come here to act on, so hide the settled ones
  // by default rather than making users scroll past months of history.
  const [statusFilter, setStatusFilter] = useState("Open");
  const [search, setSearch] = useState("");

  const visibleOrders = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return orders.filter((order) => {
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
  }, [orders, statusFilter, search]);

  /* ------------------------------ receive (GRN) ----------------------------- */
  const [openReceiveSheet, setOpenReceiveSheet] = useState(false);
  const [receiveData, setReceiveData] = useState({ invoiceNo: "", invoiceDate: todayISO(), items: [] });

  const handleOpenReceive = (order) => {
    setSelectedOrder(order);
    setInvoiceFile(null);
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

  const canEdit = (order) => ["Pending", "Approved", "Sent", "Rejected"].includes(normalizeStatus(order.status));
  const canCancel = (order) => ["Pending", "Approved", "Sent"].includes(normalizeStatus(order.status));

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
          lastEditedByName: user?.displayName || user?.email || "",
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

  const handleSend = (order) =>
    runStatusChange(order, { status: "Sent" }, `Marked as sent to ${order.vendorName}.`);

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
          approvedByName: user?.displayName || user?.email || "",
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
          rejectedByName: user?.displayName || user?.email || "",
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
          : `${order.vendorName} · ${currency} ${money(order.totalEst)}. Once approved it can be sent to the supplier.`,
        confirmLabel: "Approve",
        tone: "default",
      },
      reject: {
        title: "Reject this order?",
        message: `${order.vendorName} · ${currency} ${money(order.totalEst)}. Whoever raised it will see your reason.`,
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
    "w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 bg-slate-50 active:bg-slate-200 transition-colors";

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Purchase Orders</h1>
          <p className="text-slate-500 text-sm mt-0.5">Send orders, then receive the goods when they arrive.</p>
        </div>
        <button
          onClick={() => router.push("/purchases/order-guides")}
          className="min-h-[48px] px-5 rounded-2xl bg-slate-900 text-white font-semibold
                     flex items-center justify-center gap-2 active:bg-slate-700 transition-colors"
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
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 border border-slate-200 active:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search supplier, PO number or item…"
            className="w-full min-h-[48px] pl-10 pr-4 text-[15px] border border-slate-200 rounded-2xl bg-white
                       focus:border-mint-500 focus:ring-2 focus:ring-mint-500/20 outline-none transition-colors"
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
              className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5 flex flex-col"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-bold text-slate-900 text-lg leading-snug min-w-0 truncate">
                  {order.vendorName}
                </h3>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                    STATUS_STYLE[status] || "bg-slate-100 text-slate-600"
                  }`}
                >
                  {status}
                </span>
              </div>

              <p className="text-xs text-slate-500 mb-3">{STATUS_HINT[status] || ""}</p>

              <div className="flex items-baseline justify-between gap-2 mb-3">
                <p className="text-2xl font-bold text-slate-900 tabular-nums">
                  {currency} {money(status === "Received" ? order.finalTotal : order.totalEst)}
                </p>
                <p className="text-xs text-slate-400 shrink-0">
                  {status === "Received" ? "billed" : "estimated"}
                </p>
              </div>

              <div className="text-xs text-slate-500 space-y-1 mb-4">
                <p className="flex justify-between gap-2">
                  <span className="font-mono text-slate-400">{poReference(order)}</span>
                  <span>
                    {order.items?.length || 0} items ·{" "}
                    {order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : "-"}
                  </span>
                </p>

                {order.approvedByName && ["Approved", "Sent", "Received"].includes(status) && (
                  <p className="text-violet-600">
                    Approved by {order.approvedByName}
                    {order.selfApproved && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold">
                        self
                      </span>
                    )}
                  </p>
                )}

                {status === "Rejected" && order.rejectionReason && (
                  <p className="text-red-600">
                    {order.rejectedByName ? `${order.rejectedByName}: ` : ""}
                    {order.rejectionReason}
                  </p>
                )}

                {order.lastEditedAt && status !== "Received" && (
                  <p className="text-slate-400">
                    Edited {new Date(order.lastEditedAt).toLocaleDateString()}
                    {order.lastEditedByName ? ` by ${order.lastEditedByName}` : ""}
                  </p>
                )}

                {status === "Received" && order.invoiceAttachment && (
                  <a
                    href={order.invoiceAttachment}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 active:underline"
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
                      className="flex-1 min-h-[48px] rounded-2xl bg-violet-600 text-white font-bold
                                 flex items-center justify-center gap-2 active:bg-violet-700 transition-colors"
                    >
                      <CheckCircle className="w-5 h-5" /> Approve
                    </button>
                    <button
                      onClick={() => setPendingAction({ kind: "reject", order })}
                      aria-label="Reject"
                      className="w-12 min-h-[48px] flex items-center justify-center rounded-2xl bg-red-50 text-red-600
                                 active:bg-red-100 transition-colors"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {showApproval && !canApprove && (
                  <div className="min-h-[48px] rounded-2xl bg-slate-50 text-slate-500 font-medium text-sm
                                  flex items-center justify-center">
                    Waiting for approval
                  </div>
                )}

                {(status === "Approved" || (status === "Pending" && !requireApproval)) && (
                  <button
                    onClick={() => handleSend(order)}
                    className="w-full min-h-[48px] rounded-2xl bg-blue-600 text-white font-bold
                               flex items-center justify-center gap-2 active:bg-blue-700 transition-colors"
                  >
                    <Send className="w-5 h-5" /> Send to Supplier
                  </button>
                )}

                {status === "Sent" && (
                  <button
                    onClick={() => handleOpenReceive(order)}
                    className="w-full min-h-[48px] rounded-2xl bg-emerald-600 text-white font-bold
                               flex items-center justify-center gap-2 active:bg-emerald-700 transition-colors"
                  >
                    <PackageOpen className="w-5 h-5" /> Goods Arrived
                  </button>
                )}

                {status === "Rejected" && canApprove && (
                  <button
                    onClick={() => setPendingAction({ kind: "reopen", order })}
                    className="w-full min-h-[48px] rounded-2xl bg-slate-100 text-slate-700 font-bold
                               flex items-center justify-center gap-2 active:bg-slate-200 transition-colors"
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
                      className={`${iconBtn} ml-auto active:text-red-600 active:bg-red-50`}
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
          <div className="col-span-full py-16 px-6 text-center bg-white rounded-3xl border border-slate-100">
            <PackageOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-700">
              {orders.length === 0 ? "No orders yet" : "Nothing here"}
            </h3>
            <p className="text-slate-500 mt-1 text-sm max-w-sm mx-auto">
              {orders.length === 0
                ? "Start an order from one of your order guides."
                : "Try the All tab, or clear the search."}
            </p>
            {orders.length === 0 && (
              <button
                onClick={() => router.push("/purchases/order-guides")}
                className="mt-5 min-h-[48px] px-6 rounded-2xl bg-mint-600 text-white font-semibold active:bg-mint-700"
              >
                Go to Order Guides
              </button>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------ Edit sheet ------------------------------ */}
      <Sheet
        open={openEditSheet && !!selectedOrder}
        title="Edit Order"
        subtitle={selectedOrder?.vendorName}
        onClose={() => setOpenEditSheet(false)}
        maxWidth="max-w-2xl"
        footer={
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">New total</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums truncate">
                {currency} {money(editTotal)}
              </p>
            </div>
            <button
              onClick={handleSaveEdit}
              disabled={busy}
              className="flex-1 min-h-[52px] rounded-2xl bg-mint-600 text-white font-bold text-base
                         active:bg-mint-700 disabled:opacity-40 transition-colors"
            >
              Save Changes
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-500 mb-4">
          Change amounts or prices, add items, or remove what you no longer need. Anything left at zero is
          dropped.
        </p>

        <div className="space-y-2.5">
          {editData.items.map((item) => (
            <div key={item.itemId} className="rounded-2xl border border-slate-200 bg-white p-3.5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-[15px] leading-snug">{item.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {item.category ? `${item.category} · ` : ""}
                    {currency} {money(lineTotal(item))} total
                  </p>
                </div>
                <button
                  onClick={() => removeEditRow(item.itemId)}
                  aria-label={`Remove ${item.name}`}
                  className="w-9 h-9 -mt-1 -mr-1 shrink-0 flex items-center justify-center rounded-full
                             text-slate-300 active:bg-red-50 active:text-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">Amount</p>
                  <QtyStepper
                    value={item.requestedQty}
                    onChange={(v) => updateEditRow(item.itemId, "requestedQty", v)}
                    unit={item.unit}
                    size="sm"
                  />
                </div>
                <MoneyInput
                  label={`Price per ${item.unit}`}
                  value={item.estPrice}
                  onChange={(v) => updateEditRow(item.itemId, "estPrice", v)}
                  currency={currency}
                  size="sm"
                />
              </div>
            </div>
          ))}

          {editData.items.length === 0 && (
            <p className="py-8 text-center text-slate-500">No items left — add one below.</p>
          )}
        </div>

        <div className="mt-5 pt-5 border-t border-slate-100 space-y-4">
          {/* A dropdown of a couple of hundred products is unusable on a phone,
              so adding is a searchable, category-filtered list instead. */}
          <div>
            <button
              onClick={() => setShowPicker((v) => !v)}
              disabled={!addableItems.length}
              className="w-full min-h-[48px] rounded-2xl border border-dashed border-slate-300 text-slate-700
                         font-semibold flex items-center justify-center gap-2 active:bg-slate-50
                         disabled:opacity-40 transition-colors"
            >
              <Plus className="w-5 h-5" />
              {!addableItems.length
                ? "Nothing left to add"
                : showPicker
                ? "Done adding"
                : `Add an item (${addableItems.length} available)`}
            </button>

            {showPicker && addableItems.length > 0 && (
              <div className="mt-3 space-y-3">
                <ItemFilterBar
                  items={addableItems}
                  search={pickSearch}
                  onSearchChange={setPickSearch}
                  category={pickCategory}
                  onCategoryChange={setPickCategory}
                  placeholder="Find an item to add…"
                />

                <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100">
                  {pickableItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleAddEditRow(item)}
                      className="w-full flex items-center gap-3 p-3.5 text-left active:bg-mint-50 transition-colors"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-900 text-[15px] truncate">
                          {item.name}
                        </span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                          {item.category || "Uncategorized"} · {item.unit}
                        </span>
                      </span>
                      <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-mint-50 text-mint-700">
                        <Plus className="w-4 h-4" />
                      </span>
                    </button>
                  ))}
                  {pickableItems.length === 0 && (
                    <p className="py-8 text-center text-sm text-slate-500">Nothing matches that filter.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Note for the supplier</label>
            <textarea
              rows={2}
              value={editData.notes}
              onChange={(e) => setEditData((p) => ({ ...p, notes: e.target.value }))}
              placeholder="e.g. Please deliver before noon"
              className="w-full p-3 text-[15px] border border-slate-200 rounded-2xl bg-slate-50
                         focus:bg-white focus:border-mint-500 focus:ring-2 focus:ring-mint-500/20 outline-none
                         transition-colors"
            />
          </div>
        </div>
      </Sheet>

      {/* ----------------------------- Receive sheet ---------------------------- */}
      <Sheet
        open={openReceiveSheet && !!selectedOrder}
        title="Goods Arrived"
        subtitle={selectedOrder?.vendorName}
        onClose={() => setOpenReceiveSheet(false)}
        maxWidth="max-w-2xl"
        footer={
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Invoice total</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums">
                {currency} {money(receiveTotal)}
              </p>
            </div>
            <button
              onClick={handleReceiveOrder}
              disabled={busy || !invoiceFile}
              className="w-full min-h-[52px] rounded-2xl bg-emerald-600 text-white font-bold text-base
                         active:bg-emerald-700 disabled:opacity-40 transition-colors"
            >
              {uploading
                ? `Uploading photo ${Math.round(uploadPct)}%`
                : receiving
                ? "Saving…"
                : !invoiceFile
                ? "Add the invoice photo first"
                : "Confirm & Create Bill"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3.5">
            <p className="text-sm text-emerald-900 leading-relaxed">
              Check what actually turned up and what the supplier charged. Saving this creates the bill you will
              pay later.
            </p>
          </div>

          {/* Invoice photo is required, so it leads rather than hides at the bottom. */}
          <div
            className={`rounded-2xl border p-3.5 ${
              invoiceFile ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/60"
            }`}
          >
            <div className="flex items-start gap-2.5 mb-3">
              <Camera
                className={`w-5 h-5 shrink-0 mt-0.5 ${invoiceFile ? "text-emerald-600" : "text-amber-600"}`}
              />
              <div>
                <p className={`font-bold text-[15px] ${invoiceFile ? "text-emerald-900" : "text-amber-900"}`}>
                  {invoiceFile ? "Invoice photo attached" : "Photo of the invoice — required"}
                </p>
                <p className={`text-xs mt-0.5 ${invoiceFile ? "text-emerald-700" : "text-amber-800"}`}>
                  {invoiceFile
                    ? "It will be saved with the bill."
                    : "So anyone can check these prices against the supplier's paper later."}
                </p>
              </div>
            </div>
            <UploadInvoice file={invoiceFile} onChange={setInvoiceFile} progress={uploadPct} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-semibold text-slate-700 mb-1.5">Invoice number</span>
              <input
                value={receiveData.invoiceNo}
                onChange={(e) => setReceiveData((p) => ({ ...p, invoiceNo: e.target.value }))}
                placeholder="INV-12345"
                className="w-full min-h-[48px] px-4 text-[15px] border border-slate-200 rounded-2xl bg-slate-50
                           focus:bg-white focus:border-mint-500 focus:ring-2 focus:ring-mint-500/20 outline-none
                           transition-colors"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold text-slate-700 mb-1.5">Invoice date</span>
              <input
                type="date"
                value={receiveData.invoiceDate}
                onChange={(e) => setReceiveData((p) => ({ ...p, invoiceDate: e.target.value }))}
                className="w-full min-h-[48px] px-4 text-[15px] border border-slate-200 rounded-2xl bg-slate-50
                           focus:bg-white focus:border-mint-500 focus:ring-2 focus:ring-mint-500/20 outline-none
                           transition-colors"
              />
            </label>
          </div>

          <div className="space-y-2.5">
            {receiveData.items.map((item) => {
              const short = Number(item.receivedQty || 0) !== Number(item.requestedQty || 0);
              return (
                <div
                  key={item.itemId}
                  className={`rounded-2xl border p-3.5 ${
                    short ? "border-amber-200 bg-amber-50/40" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-[15px] leading-snug">{item.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Ordered {item.requestedQty} {item.unit}
                        {short && <span className="text-amber-700 font-semibold ml-1.5">· amount differs</span>}
                      </p>
                    </div>
                    <p className="text-base font-bold text-slate-900 tabular-nums shrink-0">
                      {currency} {money(lineTotal(item, "receivedQty", "finalPrice"))}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1.5">Actually received</p>
                      <QtyStepper
                        value={item.receivedQty}
                        onChange={(v) => updateReceiveRow(item.itemId, "receivedQty", v)}
                        unit={item.unit}
                        size="sm"
                        tone={short ? "warn" : "default"}
                      />
                    </div>
                    <MoneyInput
                      label={`Price charged per ${item.unit}`}
                      value={item.finalPrice}
                      onChange={(v) => updateReceiveRow(item.itemId, "finalPrice", v)}
                      currency={currency}
                      size="sm"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Sheet>

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
  );
}
