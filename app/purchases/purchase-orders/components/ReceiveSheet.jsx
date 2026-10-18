"use client";

import React from "react";
import { DatePicker } from "@/app/components/ui";
import ProofUpload from "@/app/components/entry/ProofUpload";
import Sheet from "@/app/components/purchases/Sheet";
import QtyStepper from "@/app/components/purchases/QtyStepper";
import MoneyInput from "@/app/components/purchases/MoneyInput";
import { lineTotal } from "../shared";
import { useOrdersContext } from "../OrdersContext";

export default function ReceiveSheet() {
  const { receiving, currency, fmtMoney, invoiceFile, setInvoiceFile, invoicePreview, setInvoicePreview, uploadPct, uploading, busy, selectedOrder, openReceiveSheet, setOpenReceiveSheet, receiveData, setReceiveData, updateReceiveRow, receiveTotal, handleReceiveOrder } = useOrdersContext();
  return (
    <>
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
              <p className="text-xs font-semibold text-subtle uppercase tracking-wide">Invoice total</p>
              <p className="text-xl font-bold text-fg tabular-nums">
                {fmtMoney(receiveTotal)}
              </p>
            </div>
            <button
              onClick={handleReceiveOrder}
              disabled={busy || !invoiceFile}
              className="w-full min-h-[52px] rounded-2xl bg-brand text-brand-fg font-bold text-base
                         active:brightness-95 disabled:opacity-40 transition-colors"
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
          <div className="rounded-2xl bg-brand-soft border border-brand/20 p-3.5">
            <p className="text-sm text-brand leading-relaxed">
              Check what actually turned up and what the supplier charged. Saving this creates the bill you will
              pay later.
            </p>
          </div>

          {/* Invoice photo is required, so it leads rather than hides at the bottom. */}
          <ProofUpload
            label="Photo of the invoice"
            hint="So anyone can check these prices against the supplier's paper later."
            pdf
            required
            pageDrop={false}
            shrink={{ maxMB: 0.6, maxSide: 1600 }}
            file={invoiceFile}
            preview={invoicePreview}
            progress={uploadPct}
            onPick={(f, url) => {
              setInvoiceFile(f);
              setInvoicePreview(f && !/pdf/i.test(f.type) ? url : null);
            }}
            onRemove={() => {
              setInvoiceFile(null);
              setInvoicePreview(null);
            }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-semibold text-fg mb-1.5">Invoice number</span>
              <input
                value={receiveData.invoiceNo}
                onChange={(e) => setReceiveData((p) => ({ ...p, invoiceNo: e.target.value }))}
                placeholder="INV-12345"
                className="w-full min-h-[48px] px-4 text-[15px] border border-line rounded-2xl bg-surface-2/60
                           focus:bg-surface focus:border-brand focus:ring-2 focus:ring-[var(--cc-ring)]/20 outline-none
                           transition-colors"
              />
            </label>
            <div>
              <span className="block text-sm font-semibold text-fg mb-1.5">Invoice date</span>
              <DatePicker size="lg" value={receiveData.invoiceDate} onChange={(v) => setReceiveData((p) => ({ ...p, invoiceDate: v }))} />
            </div>
          </div>

          <div className="space-y-2.5">
            {receiveData.items.map((item) => {
              const short = Number(item.receivedQty || 0) !== Number(item.requestedQty || 0);
              return (
                <div
                  key={item.itemId}
                  className={`rounded-2xl border p-3.5 ${
                    short ? "border-warning/30 bg-warning-soft/40" : "border-line bg-surface"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-fg text-[15px] leading-snug">{item.name}</p>
                      <p className="text-xs text-muted mt-0.5">
                        Ordered {item.requestedQty} {item.unit}
                        {short && <span className="text-warning font-semibold ml-1.5">· amount differs</span>}
                      </p>
                    </div>
                    <p className="text-base font-bold text-fg tabular-nums shrink-0">
                      {fmtMoney(lineTotal(item, "receivedQty", "finalPrice"))}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <p className="text-xs font-medium text-muted mb-1.5">Actually received</p>
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
    </>
  );
}
