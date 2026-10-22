"use client";
// Money spent at a supplier (roadmap 4.10, lib/payouts/supplier.js): which
// supplier, and either the bills it paid — their due bills from Purchases,
// ticked, with how much went to each — or a new bill bought and paid on the
// spot (paid in full or in part; the rest stays due in Purchases) — or a
// purchase order collected: what came and at what price, line by line.
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Field, Input, Select, Skeleton, cn } from "@/app/components/ui";
import { Chip } from "@/app/components/entry/Choices";
import MoneyInput from "@/app/components/entry/MoneyInput";
import { formatMoney } from "@/lib/region/currency";
import {
  dueBillsOf,
  getOrder,
  openOrdersOf,
  useSuppliers,
} from "@/lib/payouts/client";
import { linesTotal, poLines } from "@/lib/payouts/supplier";
import { priceRise } from "@/lib/purchases/orders";

const MODE_LABEL = {
  pays: "Paid bills already in Purchases",
  newBill: "Bought now — a new bill",
  po: "Collected a purchase order",
};

const day = (d) => (d ? format(parseISO(d), "d MMM") : "");

/**
 * value: { vendorId, vendorName, mode: "pays" | "newBill", pays: [{ billId, invoiceNo, amount }],
 *          newBill: { invoiceNo, invoiceDate, total, paid } }
 *        po: poId, poNo, totalEst, lines: [{ itemId, name, unit, requestedQty, receivedQty, finalPrice }], invoiceNo, invoiceDate, paid
 * modes: which to offer ("pays", "newBill", "po").
 * receiving: false when handing money out — a purchase order is only picked, not received.
 * settleId: the bill being tried again (its own order still counts as open).
 */
export default function SupplierPicker({
  companyId,
  branchId,
  value,
  onChange,
  currency,
  date,
  errors = {},
  modes = ["pays", "newBill", "po"],
  receiving = true,
  settleId = null,
}) {
  const suppliers = useSuppliers(companyId);
  const [bills, setBills] = useState(null);
  const [orders, setOrders] = useState(null);
  const [paidTouched, setPaidTouched] = useState(false);
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
  useEffect(() => {
    let live = true;
    setOrders(null);
    if (!v.vendorId || !modes.includes("po")) return;
    openOrdersOf(companyId, branchId, v.vendorId, settleId)
      .then((o) => live && setOrders(o))
      .catch(() => live && setOrders([]));
    return () => {
      live = false;
    };
  }, [companyId, branchId, v.vendorId, settleId, modes.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  // a purchase order: its lines, as ordered at the planned price, to change to what came
  const pickOrder = async (id) => {
    const po = id ? await getOrder(companyId, branchId, id) : null;
    const lines = poLines(po);
    setPaidTouched(false);
    set({
      poId: po?.id || "",
      poNo: po?.poNo || "",
      totalEst: Number(po?.totalEst) || linesTotal(lines),
      lines,
      invoiceNo: v.invoiceNo || "",
      invoiceDate: v.invoiceDate || date,
      paid: linesTotal(lines),
    });
  };
  const setLine = (i, key, val) => {
    const lines = (v.lines || []).map((l, j) =>
      j === i ? { ...l, [key]: val } : l,
    );
    // what was paid follows the bill's total until someone types it
    set({ lines, ...(paidTouched ? {} : { paid: linesTotal(lines) }) });
  };

  const paying = useMemo(
    () => Object.fromEntries((v.pays || []).map((p) => [p.billId, p])),
    [v.pays],
  );
  const tick = (b) =>
    set({
      pays: paying[b.id]
        ? (v.pays || []).filter((p) => p.billId !== b.id)
        : [
            ...(v.pays || []),
            {
              billId: b.id,
              invoiceNo: b.invoiceNo || "",
              amount: Number(b.balance) || 0,
              balance: Number(b.balance) || 0,
            },
          ],
    });
  const amountFor = (b, amount) =>
    set({
      pays: (v.pays || []).map((p) =>
        p.billId === b.id ? { ...p, amount: Number(amount) || 0 } : p,
      ),
    });

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
              onChange({
                vendorId: s?.id || "",
                vendorName: s?.name || "",
                mode: v.mode || modes[0],
                pays: [],
                newBill: { invoiceDate: date, ...(v.newBill || {}) },
              });
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
          {modes.map((m) => (
            <Chip key={m} on={v.mode === m} onClick={() => set({ mode: m })}>
              {!receiving && m === "po"
                ? "To collect a purchase order"
                : !receiving && m === "pays"
                  ? "To pay bills already in Purchases"
                  : MODE_LABEL[m]}
            </Chip>
          ))}
        </div>
      )}

      {v.vendorId && v.mode === "po" && (
        <div className="space-y-3">
          <Field label="Purchase order" error={errors.po}>
            {({ id, invalid }) => (
              <Select
                id={id}
                invalid={invalid}
                value={v.poId || ""}
                onChange={(e) => pickOrder(e.target.value)}
                className="h-12"
                disabled={orders === null}
              >
                <option value="">
                  {orders === null
                    ? "Loading…"
                    : orders.length
                      ? "Choose the order…"
                      : `No open orders from ${v.vendorName}`}
                </option>
                {(orders || []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.poNo || "Order"} · {o.status} · {(o.items || []).length}{" "}
                    item{(o.items || []).length === 1 ? "" : "s"} · about{" "}
                    {money(o.totalEst || 0)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {v.poId && !receiving && (
            <ul className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-fg">
              {(v.lines || []).map((l) => (
                <li
                  key={l.itemId || l.name}
                  className="flex justify-between gap-3"
                >
                  <span className="truncate">{l.name}</span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {l.requestedQty} {l.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {v.poId && receiving && (
            <>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface-2/60 text-left text-xs text-muted">
                      <th className="px-3 py-2 font-semibold">Item</th>
                      <th className="px-2 py-2 text-right font-semibold">
                        Ordered
                      </th>
                      <th className="px-2 py-2 font-semibold">Came</th>
                      <th className="px-2 py-2 font-semibold">Price each</th>
                      <th className="px-3 py-2 text-right font-semibold">
                        Line
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(v.lines || []).map((l, i) => {
                      const short =
                        Number(l.receivedQty) < Number(l.requestedQty);
                      const rise = priceRise(l.finalPrice, l.estPrice);
                      return (
                        <tr key={l.itemId || i}>
                          <td className="px-3 py-2">
                            <span className="block font-medium text-fg">
                              {l.name}
                            </span>
                            {l.unit && (
                              <span className="text-xs text-muted">
                                {l.unit}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-muted">
                            {l.requestedQty}
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="any"
                              value={l.receivedQty}
                              onChange={(e) =>
                                setLine(i, "receivedQty", e.target.value)
                              }
                              aria-label={`${l.name} that came`}
                              className={cn("w-20", short && "border-warning")}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="0.01"
                              value={l.finalPrice}
                              onChange={(e) =>
                                setLine(i, "finalPrice", e.target.value)
                              }
                              aria-label={`${l.name} price each`}
                              className={cn("w-24", rise && "border-warning")}
                            />
                            {rise && <span className="mt-0.5 block text-[11px] font-semibold text-warning">↑ was {money(rise.was)}</span>}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-fg">
                            {money(
                              (Number(l.receivedQty) || 0) *
                                (Number(l.finalPrice) || 0),
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-line">
                      <td
                        colSpan={4}
                        className="px-3 py-2 text-right text-xs font-semibold text-muted"
                      >
                        The invoice comes to
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-fg">
                        {money(linesTotal(v.lines))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {errors.lines && (
                <p className="text-xs font-medium text-danger">
                  {errors.lines}
                </p>
              )}
              <p className="text-xs text-muted">
                Less came than ordered? Put what came — the order closes with
                that; order the rest again.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Invoice no. (on the bill)"
                  error={errors.invoiceNo}
                >
                  {({ id, invalid }) => (
                    <Input
                      id={id}
                      size="lg"
                      invalid={invalid}
                      value={v.invoiceNo || ""}
                      onChange={(e) => set({ invoiceNo: e.target.value })}
                      placeholder="e.g. INV-2201"
                    />
                  )}
                </Field>
                <Field
                  label="Paid now, from this money"
                  error={errors.paid}
                  hint="Less than the invoice? The rest stays due in Purchases."
                >
                  {({ id, invalid }) => (
                    <MoneyInput
                      id={id}
                      currency={currency}
                      invalid={invalid}
                      value={String(v.paid ?? "")}
                      onValueChange={(x) => {
                        setPaidTouched(true);
                        set({ paid: x });
                      }}
                    />
                  )}
                </Field>
              </div>
            </>
          )}
        </div>
      )}
      {errors.mode && (
        <p className="text-xs font-medium text-danger">{errors.mode}</p>
      )}

      {v.vendorId && v.mode === "pays" && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">
            Their bills still owed
          </p>
          {bills === null ? (
            <Skeleton className="h-16" rounded="rounded-xl" />
          ) : !bills.length ? (
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
              Nothing owed to {v.vendorName} at this branch.
              {modes.includes("newBill")
                ? " Bought something new? Choose “a new bill”."
                : ""}
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {bills.map((b) => {
                const on = !!paying[b.id];
                return (
                  <li
                    key={b.id}
                    className={cn(
                      "flex flex-wrap items-center gap-3 px-3 py-2.5",
                      on && "bg-brand-soft/40",
                    )}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => tick(b)}
                        className="size-4 accent-[var(--cc-brand)]"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-fg">
                          {b.invoiceNo || "No invoice no."} ·{" "}
                          {day(b.invoiceDate)}
                        </span>
                        <span className="block text-xs text-muted">
                          owed {money(b.balance)} of {money(b.total)}
                          {b.dueDate ? ` · due ${day(b.dueDate)}` : ""}
                        </span>
                      </span>
                    </label>
                    {on && (
                      <div className="w-36">
                        <MoneyInput
                          currency={currency}
                          value={String(paying[b.id].amount ?? "")}
                          onValueChange={(x) => amountFor(b, x)}
                          aria-label={`Paid on ${b.invoiceNo || "this bill"}`}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {errors.pays && (
            <p className="text-xs font-medium text-danger">{errors.pays}</p>
          )}
        </div>
      )}

      {v.vendorId && v.mode === "newBill" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Invoice no. (on the bill)">
            {({ id }) => (
              <Input
                id={id}
                size="lg"
                value={v.newBill?.invoiceNo || ""}
                onChange={(e) =>
                  set({ newBill: { ...v.newBill, invoiceNo: e.target.value } })
                }
                placeholder="e.g. INV-1042"
              />
            )}
          </Field>
          <Field label="Bill total" error={errors.total}>
            {({ id, invalid }) => (
              <MoneyInput
                id={id}
                currency={currency}
                invalid={invalid}
                value={String(v.newBill?.total ?? "")}
                onValueChange={(x) =>
                  set({ newBill: { ...v.newBill, total: x } })
                }
              />
            )}
          </Field>
          <Field
            label="Paid now, from this money"
            error={errors.paid}
            hint="Less than the total? The rest stays due in Purchases."
          >
            {({ id, invalid }) => (
              <MoneyInput
                id={id}
                currency={currency}
                invalid={invalid}
                value={String(v.newBill?.paid ?? "")}
                onValueChange={(x) =>
                  set({ newBill: { ...v.newBill, paid: x } })
                }
              />
            )}
          </Field>
        </div>
      )}
    </div>
  );
}
