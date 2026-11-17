"use client";
import { personName } from "@/lib/people";
import { Select } from "@/app/components/ui";
import { formatMoney } from "@/lib/region/currency";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { choosable } from "@/lib/purchases/vendors";
import { skipToken } from "@reduxjs/toolkit/query";
import useResolvedCompanyBranch from "@/app/hooks/useResolvedCompanyBranch";
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
import { useBusinessToday } from "@/app/hooks/useRegion";
import { addCount, useInventory } from "@/lib/inventory/client";
import { saveLabel, splitCountOrder } from "@/lib/purchases/countAndOrder";
import { qtyText } from "@/lib/inventory/model";
import ConfirmSheet from "@/app/components/purchases/ConfirmSheet";
import ItemFilterBar, { filterItems } from "@/app/components/purchases/ItemFilterBar";
import useToast from "@/app/components/purchases/useToast";
import useCurrency from "@/app/hooks/useCurrency";
import { GuideReminder, OrdersDue, ReminderSheet, useGuideReminders } from "@/app/components/purchases/OrderReminders";
import {
  Plus,
  Pencil,
  Trash2,
  ShoppingCart,
  ListChecks,
  AlertTriangle,
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


export default function OrderGuidesPage() {
  const { ready, companyId, branchId, user } = useResolvedCompanyBranch();
  // what is in stock, beside each line while ordering (Inventory, 8 Nov)
  const today = useBusinessToday();
  const { data: inventory, reload: reloadStock } = useInventory(ready ? companyId : null, ready ? branchId : null, today);
  const stockOf = (itemId) => (inventory?.started ? inventory.stock?.[itemId] : null);
  const currency = useCurrency();
  const fmtMoney = (n) => formatMoney(n, currency);
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

  // order reminders (4 Nov): which guide a notification came about; the one being set
  const { statusOf } = useGuideReminders(ready ? companyId : null, ready ? branchId : null);
  const [reminderFor, setReminderFor] = useState(null);
  const [dueGuide, setDueGuide] = useState("");
  useEffect(() => {
    setDueGuide(new URLSearchParams(window.location.search).get("due") || "");
  }, []);

  /* -------------------------------- builder -------------------------------- */
  const [openGuideBuilder, setOpenGuideBuilder] = useState(false);
  const [builderForm, setBuilderForm] = useState({ id: null, name: "", vendorId: "", rows: [] });
  const [builderSearch, setBuilderSearch] = useState("");
  const [builderCategory, setBuilderCategory] = useState("");

  // from a vendor's page (?vendor=…): only that supplier's guides
  const [onlyVendor, setOnlyVendor] = useState("");
  useEffect(() => {
    setOnlyVendor(new URLSearchParams(window.location.search).get("vendor") || "");
  }, []);
  const onlyVendorName = vendors.find((v) => v.id === onlyVendor)?.name || "this supplier";
  const shownGuides = onlyVendor ? guides.filter((g) => g.vendorId === onlyVendor) : guides;

  const handleOpenBuilder = (guide = null, vendorId = "") => {
    setBuilderSearch("");
    setBuilderCategory("");
    if (guide) {
      setBuilderForm({
        id: guide.id,
        name: guide.name,
        vendorId: guide.vendorId,
        rows: guideRows(guide).map((r) => ({ itemId: r.itemId, parQty: r.parQty ?? "" })),
      });
    } else {
      setBuilderForm({ id: null, name: "", vendorId, rows: [] });
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
  // Everything this vendor can supply — the pool the category chips count from.
  const vendorItems = useMemo(() => {
    const selected = new Set(builderForm.rows.map((r) => r.itemId));
    if (!builderForm.vendorId) return items;
    return items.filter(
      (i) => selected.has(i.id) || !i.vendorIds?.length || i.vendorIds.includes(builderForm.vendorId)
    );
  }, [items, builderForm.vendorId, builderForm.rows]);

  const selectableItems = useMemo(
    () => filterItems(vendorItems, { search: builderSearch, category: builderCategory }),
    [vendorItems, builderSearch, builderCategory]
  );

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
  const [orderCategory, setOrderCategory] = useState("");

  const handleOpenOrder = (guide) => {
    setSelectedGuide(guide);
    setOrderSearch("");
    setOrderCategory("");
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
          // what's on the shelf now, counted while ordering (17 Nov 2026); blank = not counted
          have: "",
        };
      });
    setOrderItems(defaultRows);
    setOpenOrderSheet(true);
  };

  // from Purchase orders (?order=…): straight to that guide's order
  const orderDone = useRef(false);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("order");
    const guide = id && guides.find((g) => g.id === id);
    if (!guide || !items.length || orderDone.current) return;
    orderDone.current = true;
    handleOpenOrder(guide);
  }, [guides, items]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateOrderRow = (itemId, val, key = "requestedQty") => {
    setOrderItems((prev) => prev.map((row) => (row.itemId === itemId ? { ...row, [key]: val } : row)));
  };

  // count and order on one sheet, like the kitchen's paper one (17 Nov 2026)
  const split = useMemo(
    () => splitCountOrder(orderItems.map((r) => ({ ...r, onHand: stockOf(r.itemId)?.onHand ?? 0 }))),
    [orderItems, inventory] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [savingCount, setSavingCount] = useState(false);
  // Enter / "next" on a phone keyboard moves to the next box
  const nextBox = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const boxes = [...document.querySelectorAll("[data-count-order]")];
    boxes[boxes.indexOf(e.currentTarget) + 1]?.focus();
  };

  const chosen = orderItems.filter((i) => Number(i.requestedQty || 0) > 0);
  const orderTotal = chosen.reduce(
    (acc, curr) => acc + Number(curr.requestedQty) * Number(curr.estPrice || 0),
    0
  );

  const visibleOrderItems = useMemo(
    () => filterItems(orderItems, { search: orderSearch, category: orderCategory }),
    [orderItems, orderSearch, orderCategory]
  );

  const handleSubmitOrder = async () => {
    const bad = Object.keys(split.problems);
    if (bad.length) {
      const row = orderItems.find((r) => r.itemId === bad[0]);
      return toastError(`${row?.name || "An item"}: ${split.problems[bad[0]]}`);
    }
    if (!split.count.length && !split.order.length) {
      return toastError("Fill in what's in stock, or an amount to order.");
    }

    // the stock count first, so goods that come in for this order count on top of it
    if (split.count.length) {
      setSavingCount(true);
      try {
        await addCount(companyId, branchId, {
          date: today,
          vendorId: selectedGuide.vendorId,
          vendorName: selectedGuide.vendorName,
          lines: split.count,
          note: `Counted while ordering: ${selectedGuide.name}`,
        }, user || {});
        reloadStock?.();
      } catch (e) {
        console.error(e);
        setSavingCount(false);
        return toastError("Could not save the stock count. Nothing was ordered — try again.");
      }
      setSavingCount(false);
      if (!split.order.length) {
        setOpenOrderSheet(false);
        return toastOk(`Stock counted: ${split.count.length} item${split.count.length === 1 ? "" : "s"}.`);
      }
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
          createdByName: personName(user, "Unknown"),
          createdByRole: user?.role || "", // a kitchen lead's order waits for approval (16 Nov 2026)
          totalEst: orderTotal,
          status: "Pending", // Maps to Purchase Orders pipeline
        },
      }).unwrap();

      setOpenOrderSheet(false);
      toastOk(`${res?.poNo ? `Order ${res.poNo} created` : "Purchase order created"}${split.count.length ? `, and ${split.count.length} counted` : ""}.`);
      // straight to the new order, shown first and marked
      router.push(res?.id ? `/purchases/purchase-orders?new=${res.id}` : "/purchases/purchase-orders");
    } catch (e) {
      console.error(e);
      toastError(split.count.length ? "The stock count is saved, but the order didn't go through. Try again with only the order filled in." : "Could not submit the order. Please try again.");
    }
  };

  /* --------------------------------- render -------------------------------- */
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Order guides</h1>
          <p className="text-muted text-sm mt-0.5">Tap a guide to place today&apos;s order.</p>
        </div>
        <button
          onClick={() => handleOpenBuilder()}
          disabled={busy}
          className="min-h-[48px] px-5 rounded-2xl bg-brand text-brand-fg font-semibold
                     flex items-center justify-center gap-2 active:brightness-95 disabled:opacity-50 transition-colors"
        >
          <Plus className="w-5 h-5" /> New Guide
        </button>
      </div>

      <OrdersDue companyId={ready ? companyId : null} branchId={ready ? branchId : null} user={user} onPlace={handleOpenOrder} highlight={dueGuide} />

      {onlyVendor && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-brand-soft px-4 py-3 text-sm">
          <span className="font-medium text-fg">
            Guides for {onlyVendorName}
            {shownGuides.length === 0 && guides.length > 0 ? " — none yet" : ""}
          </span>
          <span className="flex gap-2">
            {shownGuides.length === 0 && (
              <button onClick={() => handleOpenBuilder(null, onlyVendor)} className="min-h-[40px] rounded-xl bg-brand px-3 font-semibold text-brand-fg active:brightness-95">
                Make a guide for them
              </button>
            )}
            <button onClick={() => setOnlyVendor("")} className="min-h-[40px] rounded-xl bg-surface px-3 font-semibold text-fg active:bg-surface-2">
              Show all
            </button>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shownGuides.map((guide) => {
          const rows = guideRows(guide);
          const missing = missingCount(guide);
          return (
            <div
              key={guide.id}
              className="bg-surface rounded-3xl border border-line shadow-[0_2px_12px_rgba(0,0,0,0.03)]
                         p-5 flex flex-col"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-bold text-fg text-lg leading-snug">{guide.name}</h3>
                <div className="flex gap-1 shrink-0 -mr-2 -mt-1">
                  <button
                    onClick={() => handleOpenBuilder(guide)}
                    aria-label="Edit guide"
                    className="w-10 h-10 flex items-center justify-center rounded-full text-subtle
                               active:bg-surface-2 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setGuideToDelete(guide)}
                    aria-label="Delete guide"
                    className="w-10 h-10 flex items-center justify-center rounded-full text-subtle
                               active:bg-danger-soft active:text-danger transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-sm font-medium text-muted mb-4">{guide.vendorName}</p>

              <div className="flex items-center gap-2 text-sm text-muted bg-surface-2/60 px-3 py-2.5
                              rounded-xl border border-line">
                <ListChecks className="w-4 h-4 text-brand shrink-0" />
                <span>{rows.length} items</span>
              </div>

              {missing > 0 && (
                <div className="flex items-start gap-2 text-xs text-warning mt-2 bg-warning-soft px-3 py-2.5
                                rounded-xl border border-warning/30">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                  <span>
                    {missing} item{missing > 1 ? "s are" : " is"} no longer in the catalog and will be skipped.
                  </span>
                </div>
              )}

              <GuideReminder guide={guide} status={statusOf(guide)} onEdit={() => setReminderFor(guide)} companyId={companyId} branchId={branchId} />

              <button
                onClick={() => handleOpenOrder(guide)}
                className="mt-4 min-h-[52px] w-full rounded-2xl bg-brand text-brand-fg font-bold text-base
                           flex items-center justify-center gap-2 active:brightness-95 transition-colors"
              >
                <ShoppingCart className="w-5 h-5" /> Place Order
              </button>
            </div>
          );
        })}

        {guides.length === 0 && !guidesLoading && (
          <div className="col-span-full py-16 px-6 text-center bg-surface rounded-3xl border border-line">
            <ListChecks className="w-12 h-12 text-subtle mx-auto mb-4" />
            <h3 className="text-lg font-bold text-fg">No order guides yet</h3>
            <p className="text-muted mt-1 max-w-sm mx-auto text-sm">
              A guide is a saved list of what you normally buy from one supplier. Make one and ordering takes
              seconds.
            </p>
            <button
              onClick={() => handleOpenBuilder()}
              className="mt-5 min-h-[48px] px-6 rounded-2xl bg-brand text-brand-fg font-semibold active:brightness-95"
            >
              Create your first guide
            </button>
          </div>
        )}
      </div>

      {/* ------------------------------ Order sheet ----------------------------- */}
      {/* Count and order (17 Nov 2026): each line has "in stock" and "order", like the
          kitchen's paper sheet — compact rows for a phone or tablet. */}
      <Sheet
        open={openOrderSheet && !!selectedGuide}
        title={selectedGuide?.name || "Order"}
        subtitle={selectedGuide?.vendorName}
        onClose={() => setOpenOrderSheet(false)}
        maxWidth="max-w-2xl"
        footer={
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-subtle uppercase tracking-wide">
                {split.order.length} to order · {split.count.length} counted
              </p>
              <p className="text-xl font-bold text-fg tabular-nums truncate">
                {fmtMoney(orderTotal)}
              </p>
            </div>
            <button
              onClick={handleSubmitOrder}
              disabled={busy || savingCount || (!split.count.length && !split.order.length)}
              className="flex-1 min-h-[52px] rounded-2xl bg-brand text-brand-fg font-bold text-base
                         active:brightness-95 disabled:opacity-40 transition-colors"
            >
              {savingCount ? "Saving the count…" : creatingOrder ? "Sending…" : saveLabel(split)}
            </button>
          </div>
        }
      >
        {orderItems.length === 0 ? (
          <div className="py-12 text-center text-muted">
            None of this guide&apos;s items are in the catalog any more. Edit the guide to fix it.
          </div>
        ) : (
          <>
            {orderItems.length > 6 && (
              <div className="mb-3">
                <ItemFilterBar
                  items={orderItems}
                  search={orderSearch}
                  onSearchChange={setOrderSearch}
                  category={orderCategory}
                  onCategoryChange={setOrderCategory}
                  placeholder="Find an item…"
                />
              </div>
            )}

            <p className="text-sm text-muted mb-2">
              {orderCategory || orderSearch
                ? `Showing ${visibleOrderItems.length} of ${orderItems.length}. What you already filled in is kept.`
                : "Count what's on the shelf, then what to order. Leave a box empty to skip it."}
            </p>

            <div className="rounded-2xl border border-line bg-surface">
              <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_4.75rem_4.75rem] sm:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem] gap-2 rounded-t-2xl border-b border-line bg-surface-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-subtle">
                <span>Item</span>
                <span className="text-center">In stock</span>
                <span className="text-center">Order</span>
              </div>
              {visibleOrderItems.map((item) => {
                const st = stockOf(item.itemId);
                const ordering = Number(item.requestedQty || 0) > 0;
                const counted = item.have !== "" && item.have != null;
                const wrong = split.problems[item.itemId];
                return (
                  <div
                    key={item.itemId}
                    className={`grid grid-cols-[minmax(0,1fr)_4.75rem_4.75rem] sm:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem] items-center gap-2 border-b border-line px-3 py-2 last:border-b-0 ${
                      ordering ? "bg-brand-soft/30" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold leading-snug text-fg">{item.name}</p>
                      <p className={`truncate text-xs ${wrong || st?.low ? "text-danger" : "text-muted"}`}>
                        {wrong
                          ? wrong
                          : [
                              item.unit,
                              st ? `had ${qtyText(Math.max(0, st.onHand), "")}` : "",
                              st?.min > 0 ? `keep ${qtyText(st.min, "")}` : "",
                              Number(item.estPrice) > 0 ? `${fmtMoney(item.estPrice)} each` : "",
                            ].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <input
                      data-count-order
                      inputMode="decimal"
                      enterKeyHint="next"
                      value={item.have}
                      onChange={(e) => updateOrderRow(item.itemId, e.target.value.replace(/[^0-9.]/g, ""), "have")}
                      onKeyDown={nextBox}
                      placeholder={st ? String(Math.max(0, st.onHand)) : "—"}
                      aria-label={`${item.name} in stock now`}
                      className={`h-11 w-full rounded-xl border text-center text-base font-semibold tabular-nums outline-none focus:border-brand ${
                        counted ? "border-line bg-surface" : "border-line bg-surface-2/60 placeholder:text-subtle/60"
                      }`}
                    />
                    <input
                      data-count-order
                      inputMode="decimal"
                      enterKeyHint="next"
                      value={item.requestedQty}
                      onChange={(e) => updateOrderRow(item.itemId, e.target.value.replace(/[^0-9.]/g, ""))}
                      onKeyDown={nextBox}
                      placeholder="0"
                      aria-label={`${item.name} to order`}
                      className={`h-11 w-full rounded-xl border text-center text-base font-bold tabular-nums outline-none focus:border-brand ${
                        ordering ? "border-brand/40 bg-surface text-fg" : "border-line bg-surface-2/60"
                      }`}
                    />
                  </div>
                );
              })}

              {visibleOrderItems.length === 0 && (
                <p className="py-10 text-center text-muted">Nothing matches &ldquo;{orderSearch}&rdquo;.</p>
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
            className="w-full min-h-[52px] rounded-2xl bg-brand text-brand-fg font-bold text-base
                       active:brightness-95 disabled:opacity-40 transition-colors"
          >
            Save Guide ({builderForm.rows.length} item{builderForm.rows.length === 1 ? "" : "s"})
          </button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-fg mb-1.5">Guide name</label>
            <input
              value={builderForm.name}
              onChange={(e) => setBuilderForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Daily Produce"
              className="w-full min-h-[48px] px-4 text-[15px] border border-line rounded-2xl bg-surface-2/60
                         focus:bg-surface focus:border-brand focus:ring-2 focus:ring-[var(--cc-ring)]/20 outline-none
                         transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-fg mb-1.5">Supplier</label>
            <Select
              value={builderForm.vendorId}
              onChange={(e) => setBuilderForm((f) => ({ ...f, vendorId: e.target.value }))}
              className="h-12"
            >
              <option value="">Choose a supplier…</option>
              {choosable(vendors, builderForm.vendorId).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-sm font-semibold text-fg">Items in this guide</label>
              <span className="text-xs text-subtle">{builderForm.rows.length} selected</span>
            </div>

            {vendorItems.length > 6 && (
              <div className="mb-3">
                <ItemFilterBar
                  items={vendorItems}
                  search={builderSearch}
                  onSearchChange={setBuilderSearch}
                  category={builderCategory}
                  onCategoryChange={setBuilderCategory}
                  placeholder="Find an item…"
                />
              </div>
            )}

            <div className="space-y-2">
              {selectableItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">
                  {builderSearch || builderCategory
                    ? "Nothing matches that filter."
                    : builderForm.vendorId
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
                        row ? "border-brand/30 bg-brand-soft/40" : "border-line bg-surface"
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
                                        row ? "bg-brand border-brand" : "border-line bg-surface"
                                      }`}
                        >
                          {row && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-fg text-[15px] leading-snug truncate">
                            {item.name}
                          </span>
                          <span className="block text-xs text-muted mt-0.5">
                            {item.category} · {item.unit}
                          </span>
                        </span>
                      </button>

                      {row && (
                        <div className="px-3.5 pb-3.5 -mt-1">
                          <p className="text-xs font-medium text-muted mb-1.5">
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

      <ReminderSheet guide={reminderFor} onClose={() => setReminderFor(null)} companyId={companyId} branchId={branchId} />

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
