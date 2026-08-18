"use client";
import React, { useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import {
  useGetOrderGuidesQuery,
  useAddOrderGuideMutation,
  useDeleteOrderGuideMutation,
  useUpdateOrderGuideMutation,
} from "@/lib/redux/api/orderGuidesApiSlice";
import { useGetVendorsQuery } from "@/lib/redux/api/vendorsApiSlice";
import { useGetItemsQuery, branchLastPrice } from "@/lib/redux/api/itemsApiSlice";
import { useAddRequisitionMutation } from "@/lib/redux/api/requisitionsApiSlice";
import Sheet from "@/app/components/purchases/Sheet";
import QtyStepper from "@/app/components/purchases/QtyStepper";
import ConfirmSheet from "@/app/components/purchases/ConfirmSheet";
import useToast from "@/app/components/purchases/useToast";
import useCurrency from "@/app/hooks/useCurrency";
import {
  Plus,
  Pencil,
  Trash2,
  ShoppingCart,
  ListChecks,
  AlertTriangle,
  Search,
  Check,
} from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * A guide's item list is stored twice: `guideItems` carries the per-item par
 * quantity, while `itemIds` is kept in sync as a plain array so guides written
 * before par levels existed still open, and so anything reading the old shape
 * keeps working. Read through this helper rather than either field directly.
 */
const guideRows = (guide) => {
  if (Array.isArray(guide?.guideItems) && guide.guideItems.length) return guide.guideItems;
  return (guide?.itemIds || []).map((itemId) => ({ itemId, parQty: "" }));
};

const money = (n) => Number(n || 0).toFixed(2);

export default function OrderGuidesPage() {
  const { ready, companyId, branchId, user } = useResolvedCompanyBranch();
  const currency = useCurrency();
  const router = useRouter();
  const { toastOk, toastError, toastNode } = useToast();

  const args = ready && companyId && branchId ? { companyId, branchId } : skipToken;
  const companyArgs = ready && companyId ? { companyId } : skipToken;

  const { data: guides = [], isLoading: guidesLoading } = useGetOrderGuidesQuery(args);
  const { data: vendors = [], isLoading: vLoading } = useGetVendorsQuery(companyArgs);
  // Guides are branch-scoped, so they may only contain what this branch stocks.
  const { data: items = [], isLoading: iLoading } = useGetItemsQuery(args);

  const [addGuide, { isLoading: addingGuide }] = useAddOrderGuideMutation();
  const [updateGuide, { isLoading: updatingGuide }] = useUpdateOrderGuideMutation();
  const [deleteGuide, { isLoading: deletingGuide }] = useDeleteOrderGuideMutation();
  const [createOrder, { isLoading: creatingOrder }] = useAddRequisitionMutation();

  const busy =
    guidesLoading || vLoading || iLoading || addingGuide || updatingGuide || deletingGuide || creatingOrder;

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  /* -------------------------------- builder -------------------------------- */
  const [openGuideBuilder, setOpenGuideBuilder] = useState(false);
  const [builderForm, setBuilderForm] = useState({ id: null, name: "", vendorId: "", rows: [] });
  const [builderSearch, setBuilderSearch] = useState("");

  const handleOpenBuilder = (guide = null) => {
    setBuilderSearch("");
    if (guide) {
      setBuilderForm({
        id: guide.id,
        name: guide.name,
        vendorId: guide.vendorId,
        rows: guideRows(guide).map((r) => ({ itemId: r.itemId, parQty: r.parQty ?? "" })),
      });
    } else {
      setBuilderForm({ id: null, name: "", vendorId: "", rows: [] });
    }
    setOpenGuideBuilder(true);
  };

  // Only offer items this vendor actually supplies. An item with no vendor
  // mapping is treated as available from anyone, matching how the rest of the
  // purchase screens read `vendorIds`.
  //
  // Anything already on the guide stays listed even when it no longer matches
  // the vendor, otherwise switching vendor on an existing guide would hide rows
  // that are still being saved, with no way to uncheck them.
  const selectableItems = useMemo(() => {
    const selected = new Set(builderForm.rows.map((r) => r.itemId));
    const base = !builderForm.vendorId
      ? items
      : items.filter(
          (i) => selected.has(i.id) || !i.vendorIds?.length || i.vendorIds.includes(builderForm.vendorId)
        );

    const q = builderSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (i) => i.name?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q)
    );
  }, [items, builderForm.vendorId, builderForm.rows, builderSearch]);

  const rowFor = (itemId) => builderForm.rows.find((r) => r.itemId === itemId);

  const toggleItemInGuide = (itemId) => {
    setBuilderForm((prev) => ({
      ...prev,
      rows: prev.rows.some((r) => r.itemId === itemId)
        ? prev.rows.filter((r) => r.itemId !== itemId)
        : [...prev.rows, { itemId, parQty: "" }],
    }));
  };

  const setParQty = (itemId, parQty) => {
    setBuilderForm((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => (r.itemId === itemId ? { ...r, parQty } : r)),
    }));
  };

  const handleSaveGuide = async () => {
    if (!builderForm.name.trim() || !builderForm.vendorId) {
      return toastError("Give the guide a name and pick a supplier.");
    }
    if (builderForm.rows.length === 0) {
      return toastError("Tick at least one item for this guide.");
    }

    const payload = {
      name: builderForm.name,
      vendorId: builderForm.vendorId,
      vendorName: vendors.find((v) => v.id === builderForm.vendorId)?.name || "",
      guideItems: builderForm.rows.map((r) => ({
        itemId: r.itemId,
        parQty: r.parQty === "" ? "" : Number(r.parQty),
      })),
      itemIds: builderForm.rows.map((r) => r.itemId), // legacy shape, kept in sync
    };

    try {
      if (builderForm.id) {
        await updateGuide({ companyId, branchId, guideId: builderForm.id, patch: payload }).unwrap();
      } else {
        await addGuide({
          companyId,
          branchId,
          orderGuide: { ...payload, createdBy: user?.uid || "" },
        }).unwrap();
      }
      setOpenGuideBuilder(false);
      toastOk("Order guide saved.");
    } catch (e) {
      console.error(e);
      toastError("Could not save the order guide.");
    }
  };

  /* -------------------------------- deleting ------------------------------- */
  const [guideToDelete, setGuideToDelete] = useState(null);

  const confirmDeleteGuide = async () => {
    try {
      await deleteGuide({ companyId, branchId, guideId: guideToDelete.id }).unwrap();
      setGuideToDelete(null);
      toastOk("Order guide deleted.");
    } catch (e) {
      console.error(e);
      toastError("Could not delete the guide.");
    }
  };

  // Items a guide points at that are no longer in the active catalog — they
  // would otherwise turn up on the order sheet as "Unknown Item" at 0.00.
  const missingCount = (guide) => guideRows(guide).filter((r) => !itemsById.has(r.itemId)).length;

  /* ------------------------------ placing order ---------------------------- */
  const [openOrderSheet, setOpenOrderSheet] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [orderSearch, setOrderSearch] = useState("");

  const handleOpenOrder = (guide) => {
    setSelectedGuide(guide);
    setOrderSearch("");
    const defaultRows = guideRows(guide)
      .filter((r) => itemsById.has(r.itemId)) // skip retired/deleted catalog entries
      .map((r) => {
        const itemData = itemsById.get(r.itemId);
        return {
          itemId: r.itemId,
          name: itemData.name || "Unknown Item",
          unit: itemData.unit || "Pcs",
          category: itemData.category || "",
          // Par quantity is the normal order size, so start there and let the
          // user override — that is the whole point of a rapid-order guide.
          requestedQty: r.parQty === "" || r.parQty == null ? "" : String(r.parQty),
          // What this branch last paid, falling back to the planning price.
          estPrice: branchLastPrice(itemData, branchId),
        };
      });
    setOrderItems(defaultRows);
    setOpenOrderSheet(true);
  };

  const updateOrderRow = (itemId, val) => {
    setOrderItems((prev) => prev.map((row) => (row.itemId === itemId ? { ...row, requestedQty: val } : row)));
  };

  const chosen = orderItems.filter((i) => Number(i.requestedQty || 0) > 0);
  const orderTotal = chosen.reduce(
    (acc, curr) => acc + Number(curr.requestedQty) * Number(curr.estPrice || 0),
    0
  );

  const visibleOrderItems = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return orderItems;
    return orderItems.filter(
      (i) => i.name.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q)
    );
  }, [orderItems, orderSearch]);

  const handleSubmitOrder = async () => {
    if (chosen.length === 0) {
      return toastError("Add a quantity to at least one item.");
    }

    try {
      const res = await createOrder({
        companyId,
        branchId,
        requisition: {
          vendorId: selectedGuide.vendorId,
          vendorName: selectedGuide.vendorName,
          orderGuideId: selectedGuide.id,
          items: chosen.map((i) => ({
            itemId: i.itemId,
            name: i.name,
            unit: i.unit,
            category: i.category,
            requestedQty: Number(i.requestedQty),
            estPrice: Number(i.estPrice || 0),
          })),
          notes: `Generated from Order Guide: ${selectedGuide.name}`,
          createdBy: user?.uid || "Unknown User",
          createdByName: user?.displayName || user?.email || "Unknown",
          totalEst: orderTotal,
          status: "Pending", // Maps to Purchase Orders pipeline
        },
      }).unwrap();

      setOpenOrderSheet(false);
      toastOk(res?.poNo ? `Order ${res.poNo} created.` : "Purchase order created.");
      router.push("/purchases/purchase-orders");
    } catch (e) {
      console.error(e);
      toastError("Could not submit the order. Please try again.");
    }
  };

  /* --------------------------------- render -------------------------------- */
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Order Guides</h1>
          <p className="text-slate-500 text-sm mt-0.5">Tap a guide to place today&apos;s order.</p>
        </div>
        <button
          onClick={() => handleOpenBuilder()}
          disabled={busy}
          className="min-h-[48px] px-5 rounded-2xl bg-slate-900 text-white font-semibold
                     flex items-center justify-center gap-2 active:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          <Plus className="w-5 h-5" /> New Guide
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {guides.map((guide) => {
          const rows = guideRows(guide);
          const missing = missingCount(guide);
          return (
            <div
              key={guide.id}
              className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)]
                         p-5 flex flex-col"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-bold text-slate-900 text-lg leading-snug">{guide.name}</h3>
                <div className="flex gap-1 shrink-0 -mr-2 -mt-1">
                  <button
                    onClick={() => handleOpenBuilder(guide)}
                    aria-label="Edit guide"
                    className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400
                               active:bg-slate-100 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setGuideToDelete(guide)}
                    aria-label="Delete guide"
                    className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400
                               active:bg-red-50 active:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-sm font-medium text-slate-500 mb-4">{guide.vendorName}</p>

              <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-2.5
                              rounded-xl border border-slate-100">
                <ListChecks className="w-4 h-4 text-mint-600 shrink-0" />
                <span>{rows.length} items</span>
              </div>

              {missing > 0 && (
                <div className="flex items-start gap-2 text-xs text-amber-800 mt-2 bg-amber-50 px-3 py-2.5
                                rounded-xl border border-amber-100">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                  <span>
                    {missing} item{missing > 1 ? "s are" : " is"} no longer in the catalog and will be skipped.
                  </span>
                </div>
              )}

              <button
                onClick={() => handleOpenOrder(guide)}
                className="mt-4 min-h-[52px] w-full rounded-2xl bg-mint-600 text-white font-bold text-base
                           flex items-center justify-center gap-2 active:bg-mint-700 transition-colors"
              >
                <ShoppingCart className="w-5 h-5" /> Place Order
              </button>
            </div>
          );
        })}

        {guides.length === 0 && !guidesLoading && (
          <div className="col-span-full py-16 px-6 text-center bg-white rounded-3xl border border-slate-100">
            <ListChecks className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-700">No order guides yet</h3>
            <p className="text-slate-500 mt-1 max-w-sm mx-auto text-sm">
              A guide is a saved list of what you normally buy from one supplier. Make one and ordering takes
              seconds.
            </p>
            <button
              onClick={() => handleOpenBuilder()}
              className="mt-5 min-h-[48px] px-6 rounded-2xl bg-mint-600 text-white font-semibold active:bg-mint-700"
            >
              Create your first guide
            </button>
          </div>
        )}
      </div>

      {/* ------------------------------ Order sheet ----------------------------- */}
      <Sheet
        open={openOrderSheet && !!selectedGuide}
        title={selectedGuide?.name || "Order"}
        subtitle={selectedGuide?.vendorName}
        onClose={() => setOpenOrderSheet(false)}
        maxWidth="max-w-2xl"
        footer={
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                {chosen.length} item{chosen.length === 1 ? "" : "s"}
              </p>
              <p className="text-xl font-bold text-slate-900 tabular-nums truncate">
                {currency} {money(orderTotal)}
              </p>
            </div>
            <button
              onClick={handleSubmitOrder}
              disabled={busy || chosen.length === 0}
              className="flex-1 min-h-[52px] rounded-2xl bg-mint-600 text-white font-bold text-base
                         active:bg-mint-700 disabled:opacity-40 transition-colors"
            >
              {creatingOrder ? "Sending…" : "Submit Order"}
            </button>
          </div>
        }
      >
        {orderItems.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            None of this guide&apos;s items are in the catalog any more. Edit the guide to fix it.
          </div>
        ) : (
          <>
            {orderItems.length > 6 && (
              <div className="relative mb-3">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Find an item…"
                  className="w-full min-h-[48px] pl-10 pr-4 text-[15px] border border-slate-200 rounded-2xl
                             bg-slate-50 focus:bg-white focus:border-mint-500 focus:ring-2 focus:ring-mint-500/20
                             outline-none transition-colors"
                />
              </div>
            )}

            <p className="text-sm text-slate-500 mb-3">
              Quantities are prefilled from your usual amounts. Change what you need, leave the rest at zero.
            </p>

            <div className="space-y-2.5">
              {visibleOrderItems.map((item) => {
                const qty = Number(item.requestedQty || 0);
                const picked = qty > 0;
                return (
                  <div
                    key={item.itemId}
                    className={`rounded-2xl border p-3.5 transition-colors ${
                      picked ? "border-mint-200 bg-mint-50/40" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {picked && <Check className="w-4 h-4 text-mint-600 shrink-0" />}
                          <span className="font-semibold text-slate-900 text-[15px] leading-snug">
                            {item.name}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {item.category ? `${item.category} · ` : ""}
                          {currency} {money(item.estPrice)} / {item.unit}
                        </p>
                      </div>
                      {picked && (
                        <p className="text-base font-bold text-slate-900 tabular-nums shrink-0">
                          {currency} {money(qty * Number(item.estPrice || 0))}
                        </p>
                      )}
                    </div>

                    <QtyStepper
                      value={item.requestedQty}
                      onChange={(v) => updateOrderRow(item.itemId, v)}
                      unit={item.unit}
                    />
                  </div>
                );
              })}

              {visibleOrderItems.length === 0 && (
                <p className="py-10 text-center text-slate-500">Nothing matches &ldquo;{orderSearch}&rdquo;.</p>
              )}
            </div>
          </>
        )}
      </Sheet>

      {/* ----------------------------- Builder sheet ---------------------------- */}
      <Sheet
        open={openGuideBuilder}
        title={builderForm.id ? "Edit Guide" : "New Guide"}
        onClose={() => setOpenGuideBuilder(false)}
        maxWidth="max-w-2xl"
        footer={
          <button
            onClick={handleSaveGuide}
            disabled={busy}
            className="w-full min-h-[52px] rounded-2xl bg-mint-600 text-white font-bold text-base
                       active:bg-mint-700 disabled:opacity-40 transition-colors"
          >
            Save Guide ({builderForm.rows.length} item{builderForm.rows.length === 1 ? "" : "s"})
          </button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Guide name</label>
            <input
              value={builderForm.name}
              onChange={(e) => setBuilderForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Daily Produce"
              className="w-full min-h-[48px] px-4 text-[15px] border border-slate-200 rounded-2xl bg-slate-50
                         focus:bg-white focus:border-mint-500 focus:ring-2 focus:ring-mint-500/20 outline-none
                         transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Supplier</label>
            <select
              value={builderForm.vendorId}
              onChange={(e) => setBuilderForm((f) => ({ ...f, vendorId: e.target.value }))}
              className="w-full min-h-[48px] px-4 text-[15px] border border-slate-200 rounded-2xl bg-slate-50
                         focus:bg-white focus:border-mint-500 focus:ring-2 focus:ring-mint-500/20 outline-none
                         transition-colors"
            >
              <option value="">Choose a supplier…</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700">Items in this guide</label>
              <span className="text-xs text-slate-400">{builderForm.rows.length} selected</span>
            </div>

            {items.length > 6 && (
              <div className="relative mb-2.5">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={builderSearch}
                  onChange={(e) => setBuilderSearch(e.target.value)}
                  placeholder="Find an item…"
                  className="w-full min-h-[48px] pl-10 pr-4 text-[15px] border border-slate-200 rounded-2xl
                             bg-slate-50 focus:bg-white focus:border-mint-500 focus:ring-2 focus:ring-mint-500/20
                             outline-none transition-colors"
                />
              </div>
            )}

            <div className="space-y-2">
              {selectableItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  {builderForm.vendorId
                    ? "No items are linked to this supplier yet."
                    : "No items in the catalog for this branch."}
                </p>
              ) : (
                selectableItems.map((item) => {
                  const row = rowFor(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border transition-colors ${
                        row ? "border-mint-200 bg-mint-50/40" : "border-slate-200 bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleItemInGuide(item.id)}
                        className="w-full flex items-center gap-3 p-3.5 text-left"
                      >
                        <span
                          className={`w-6 h-6 rounded-lg border-2 shrink-0 flex items-center justify-center
                                      transition-colors ${
                                        row ? "bg-mint-600 border-mint-600" : "border-slate-300 bg-white"
                                      }`}
                        >
                          {row && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-slate-900 text-[15px] leading-snug truncate">
                            {item.name}
                          </span>
                          <span className="block text-xs text-slate-500 mt-0.5">
                            {item.category} · {item.unit}
                          </span>
                        </span>
                      </button>

                      {row && (
                        <div className="px-3.5 pb-3.5 -mt-1">
                          <p className="text-xs font-medium text-slate-500 mb-1.5">
                            Usual order amount (prefilled when ordering)
                          </p>
                          <QtyStepper
                            value={row.parQty}
                            onChange={(v) => setParQty(item.id, v)}
                            unit={item.unit}
                            size="sm"
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Sheet>

      <ConfirmSheet
        open={!!guideToDelete}
        title="Delete this guide?"
        message={
          guideToDelete
            ? `"${guideToDelete.name}" will be removed. Orders already placed from it are not affected.`
            : ""
        }
        confirmLabel="Delete"
        tone="danger"
        busy={deletingGuide}
        onConfirm={confirmDeleteGuide}
        onClose={() => setGuideToDelete(null)}
      />

      {toastNode}
    </div>
  );
}
