"use client";

import React from "react";
import Sheet from "@/app/components/purchases/Sheet";
import QtyStepper from "@/app/components/purchases/QtyStepper";
import MoneyInput from "@/app/components/purchases/MoneyInput";
import ItemFilterBar from "@/app/components/purchases/ItemFilterBar";
import { Plus, X } from "lucide-react";
import { lineTotal } from "../shared";
import { useOrdersContext } from "../OrdersContext";

export default function EditOrderSheet() {
  const { currency, fmtMoney, busy, selectedOrder, openEditSheet, setOpenEditSheet, editData, setEditData, showPicker, setShowPicker, pickSearch, setPickSearch, pickCategory, setPickCategory, updateEditRow, removeEditRow, addableItems, pickableItems, handleAddEditRow, editTotal, handleSaveEdit } = useOrdersContext();
  return (
    <>
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
              <p className="text-xs font-semibold text-subtle uppercase tracking-wide">New total</p>
              <p className="text-xl font-bold text-fg tabular-nums truncate">
                {fmtMoney(editTotal)}
              </p>
            </div>
            <button
              onClick={handleSaveEdit}
              disabled={busy}
              className="flex-1 min-h-[52px] rounded-2xl bg-brand text-brand-fg font-bold text-base
                         active:brightness-95 disabled:opacity-40 transition-colors"
            >
              Save Changes
            </button>
          </div>
        }
      >
        <p className="text-sm text-muted mb-4">
          Change amounts or prices, add items, or remove what you no longer need. Anything left at zero is
          dropped.
        </p>

        <div className="space-y-2.5">
          {editData.items.map((item) => (
            <div key={item.itemId} className="rounded-2xl border border-line bg-surface p-3.5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="font-semibold text-fg text-[15px] leading-snug">{item.name}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {item.category ? `${item.category} · ` : ""}
                    {fmtMoney(lineTotal(item))} total
                  </p>
                </div>
                <button
                  onClick={() => removeEditRow(item.itemId)}
                  aria-label={`Remove ${item.name}`}
                  className="w-9 h-9 -mt-1 -mr-1 shrink-0 flex items-center justify-center rounded-full
                             text-subtle active:bg-danger-soft active:text-danger transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <p className="text-xs font-medium text-muted mb-1.5">Amount</p>
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
            <p className="py-8 text-center text-muted">No items left — add one below.</p>
          )}
        </div>

        <div className="mt-5 pt-5 border-t border-line space-y-4">
          {/* A dropdown of a couple of hundred products is unusable on a phone,
              so adding is a searchable, category-filtered list instead. */}
          <div>
            <button
              onClick={() => setShowPicker((v) => !v)}
              disabled={!addableItems.length}
              className="w-full min-h-[48px] rounded-2xl border border-dashed border-line text-fg
                         font-semibold flex items-center justify-center gap-2 active:bg-surface-2/60
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

                <div className="max-h-72 overflow-y-auto rounded-2xl border border-line divide-y divide-line">
                  {pickableItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleAddEditRow(item)}
                      className="w-full flex items-center gap-3 p-3.5 text-left active:bg-brand-soft transition-colors"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-fg text-[15px] truncate">
                          {item.name}
                        </span>
                        <span className="block text-xs text-muted mt-0.5">
                          {item.category || "Uncategorized"} · {item.unit}
                        </span>
                      </span>
                      <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-brand-soft text-brand">
                        <Plus className="w-4 h-4" />
                      </span>
                    </button>
                  ))}
                  {pickableItems.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted">Nothing matches that filter.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-fg mb-1.5">Note for the supplier</label>
            <textarea
              rows={2}
              value={editData.notes}
              onChange={(e) => setEditData((p) => ({ ...p, notes: e.target.value }))}
              placeholder="e.g. Please deliver before noon"
              className="w-full p-3 text-[15px] border border-line rounded-2xl bg-surface-2/60
                         focus:bg-surface focus:border-brand focus:ring-2 focus:ring-[var(--cc-ring)]/20 outline-none
                         transition-colors"
            />
          </div>
        </div>
      </Sheet>
    </>
  );
}
