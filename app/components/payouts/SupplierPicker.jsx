"use client";
// Money spent at a supplier (roadmap 4.10, lib/payouts/supplier.js): which
// supplier, and either the bills it paid — their due bills from Purchases,
// ticked, with how much went to each — or a new bill bought and paid on the
// spot (paid in full or in part; the rest stays due in Purchases).
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Field, Input, Select, Skeleton, cn } from "@/app/components/ui";
import { Chip } from "@/app/components/entry/Choices";
import MoneyInput from "@/app/components/entry/MoneyInput";
import { formatMoney } from "@/lib/region/currency";
import { dueBillsOf, useSuppliers } from "@/lib/payouts/client";

const day = (d) => (d ? format(parseISO(d), "d MMM") : "");

/**
 * value: { vendorId, vendorName, mode: "pays" | "newBill", pays: [{ billId, invoiceNo, amount }],
 *          newBill: { invoiceNo, invoiceDate, total, paid } }
 * modes: which of the two to offer (handing out: only "pays").
 */
export default function SupplierPicker({ companyId, branchId, value, onChange, currency, date, errors = {}, modes = ["pays", "newBill"] }) {
  const suppliers = useSuppliers(companyId);
  const [bills, setBills] = useState(null);
  const money = (v) => formatMoney(v, currency);
  const v = value || {};
  const set = (patch) => onChange({ ...v, ...patch });

  useEffect(() => {
    let live = true;
    setBills(null);
    if (!v.vendorId) return;
    dueBillsOf(companyId, branchId, v.vendorId)
      .then((b) => live && setBills(b))
      .catch(() => live && setBills([]));
    return () => {
      live = false;
    };
  }, [companyId, branchId, v.vendorId]);

  const paying = useMemo(() => Object.fromEntries((v.pays || []).map((p) => [p.billId, p])), [v.pays]);
  const tick = (b) =>
    set({
      pays: paying[b.id]
        ? (v.pays || []).filter((p) => p.billId !== b.id)
        : [...(v.pays || []), { billId: b.id, invoiceNo: b.invoiceNo || "", amount: Number(b.balance) || 0, balance: Number(b.balance) || 0 }],
    });
  const amountFor = (b, amount) => set({ pays: (v.pays || []).map((p) => (p.billId === b.id ? { ...p, amount: Number(amount) || 0 } : p)) });

  return (
    <div className="space-y-4">
      <Field label="Supplier" error={errors.vendor}>
        {({ id, invalid }) => (
          <Select
            id={id}
            invalid={invalid}
            value={v.vendorId || ""}
            onChange={(e) => {
              const s = suppliers.find((x) => x.id === e.target.value);
              onChange({ vendorId: s?.id || "", vendorName: s?.name || "", mode: v.mode || modes[0], pays: [], newBill: { invoiceDate: date, ...(v.newBill || {}) } });
            }}
            className="h-12"
          >
            <option value="">Choose the supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {v.vendorId && modes.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <Chip on={v.mode === "pays"} onClick={() => set({ mode: "pays" })}>Paid bills already in Purchases</Chip>
          <Chip on={v.mode === "newBill"} onClick={() => set({ mode: "newBill" })}>Bought now — a new bill</Chip>
        </div>
      )}
      {errors.mode && <p className="text-xs font-medium text-danger">{errors.mode}</p>}

      {v.vendorId && v.mode === "pays" && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">Their bills still owed</p>
          {bills === null ? (
            <Skeleton className="h-16" rounded="rounded-xl" />
          ) : !bills.length ? (
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">Nothing owed to {v.vendorName} at this branch.{modes.includes("newBill") ? " Bought something new? Choose “a new bill”." : ""}</p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {bills.map((b) => {
                const on = !!paying[b.id];
                return (
                  <li key={b.id} className={cn("flex flex-wrap items-center gap-3 px-3 py-2.5", on && "bg-brand-soft/40")}>
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input type="checkbox" checked={on} onChange={() => tick(b)} className="size-4 accent-[var(--cc-brand)]" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-fg">{b.invoiceNo || "No invoice no."} · {day(b.invoiceDate)}</span>
                        <span className="block text-xs text-muted">
                          owed {money(b.balance)} of {money(b.total)}
                          {b.dueDate ? ` · due ${day(b.dueDate)}` : ""}
                        </span>
                      </span>
                    </label>
                    {on && (
                      <div className="w-36">
                        <MoneyInput currency={currency} value={String(paying[b.id].amount ?? "")} onValueChange={(x) => amountFor(b, x)} aria-label={`Paid on ${b.invoiceNo || "this bill"}`} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {errors.pays && <p className="text-xs font-medium text-danger">{errors.pays}</p>}
        </div>
      )}

      {v.vendorId && v.mode === "newBill" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Invoice no. (on the bill)">
            {({ id }) => <Input id={id} size="lg" value={v.newBill?.invoiceNo || ""} onChange={(e) => set({ newBill: { ...v.newBill, invoiceNo: e.target.value } })} placeholder="e.g. INV-1042" />}
          </Field>
          <Field label="Bill total" error={errors.total}>
            {({ id, invalid }) => <MoneyInput id={id} currency={currency} invalid={invalid} value={String(v.newBill?.total ?? "")} onValueChange={(x) => set({ newBill: { ...v.newBill, total: x } })} />}
          </Field>
          <Field label="Paid now, from this money" error={errors.paid} hint="Less than the total? The rest stays due in Purchases.">
            {({ id, invalid }) => <MoneyInput id={id} currency={currency} invalid={invalid} value={String(v.newBill?.paid ?? "")} onValueChange={(x) => set({ newBill: { ...v.newBill, paid: x } })} />}
          </Field>
        </div>
      )}
    </div>
  );
}
