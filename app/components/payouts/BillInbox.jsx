"use client";
// Bills waiting (roadmap 4.10): pay-out bills brought back, for branch admin,
// manager or in-charge (and the company roles) to approve — as they are, or
// corrected (the original amount and category are kept) — or send back with
// a reason. Approving turns the bill into a cost.
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, PencilLine, ReceiptText, Undo2 } from "lucide-react";
import { Badge, Button, EmptyState, Field, Select, Sheet, Skeleton, cn, toast } from "@/app/components/ui";
import { promptDialog } from "@/app/components/ui/notify";
import MoneyInput from "@/app/components/entry/MoneyInput";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { can } from "@/lib/authz/permissions";
import { categoryFields, pickable } from "@/lib/costs/categories";
import { useCostCategories } from "@/lib/costs/client";
import { canReviewBill, changeText } from "@/lib/payouts/model";
import { FileThumb, FilesSheet } from "@/app/components/common/Files";
import { approveBillNow, approveSupplierNow, sendBillBack } from "@/lib/payouts/client";
import { linesTotal, supplierText } from "@/lib/payouts/supplier";
import { priceRise } from "@/lib/purchases/orders";

const day = (d) => (d ? format(parseISO(d), "EEE d MMM") : "");

/** Approve with a correction: the real amount and/or what it was for. */
function CorrectSheet({ bill, onClose, onApprove, groups, currency }) {
  const [amount, setAmount] = useState(bill ? String(bill.billAmount) : "");
  const [categoryId, setCategoryId] = useState(bill?.categoryId || "");
  const [busy, setBusy] = useState(false);
  if (!bill) return null;
  const go = async () => {
    setBusy(true);
    await onApprove(bill, { billAmount: Number(amount), fields: categoryFields(groups, categoryId) || undefined });
    setBusy(false);
    onClose();
  };
  return (
    <Sheet open={!!bill} onClose={onClose} title="Correct and approve" description="The amount and category as brought back are kept on the bill." footer={<Button onClick={go} loading={busy} disabled={!(Number(amount) > 0)}>Approve corrected</Button>}>
      <div className="space-y-4">
        <Field label="Real amount">{({ id }) => <MoneyInput id={id} currency={currency} value={amount} onValueChange={setAmount} />}</Field>
        <Field label="What it was for">
          {({ id }) => (
            <Select id={id} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-12">
              {pickable(groups).map((g) => (
                <optgroup key={g.id} label={g.kind === "notCost" ? `${g.name} — not a cost` : g.name}>
                  {g.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </Select>
          )}
        </Field>
        <p className="text-xs text-muted">{changeText(bill.floatAmount, Number(amount) || 0, (v) => formatMoney(v, currency))} — the till count should match.</p>
      </div>
    </Sheet>
  );
}

export default function BillInbox({ companyId, branchId, user, bills, loading }) {
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);
  const { groups } = useCostCategories(companyId);
  const [busy, setBusy] = useState(null);
  const [correcting, setCorrecting] = useState(null);
  const [viewing, setViewing] = useState(null);

  const approve = async (bill, correction = {}) => {
    setBusy(bill.id);
    try {
      if (bill.supplier) {
        // spent at a supplier: into Purchases — their bills, a payment, what they're owed
        const r = await approveSupplierNow(companyId, branchId, user, bill);
        toast.success("Approved — in Purchases now", { description: `${money(r.paid)} paid to ${bill.supplier.vendorName}` });
      } else {
        await approveBillNow(companyId, branchId, user, bill, correction);
        toast.success("Approved — it's a cost now");
      }
    } catch (e) {
      toast.error("Couldn't approve", { description: e.message });
    } finally {
      setBusy(null);
    }
  };
  const back = async (bill) => {
    const note = await promptDialog({ title: "Send the bill back", label: "What's wrong?", placeholder: "e.g. The photo is blurry — take it again" });
    if (note === null || note === undefined) return;
    setBusy(bill.id);
    try {
      await sendBillBack(companyId, branchId, user, bill, note);
      toast.success("Sent back");
    } catch (e) {
      toast.error("Couldn't send it back", { description: e.message });
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-28" rounded="rounded-2xl" />)}</div>;
  if (!bills.length) return <EmptyState icon={ReceiptText} title="No bills waiting" description="Bills brought back for money handed out show up here." />;

  return (
    <>
      <ul className="space-y-2">
        {[...bills].sort((a, b) => String(a.date).localeCompare(String(b.date))).map((b) => {
          const mine = !canReviewBill(user, b, can);
          return (
            <li key={b.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="flex gap-4 p-4">
                <div className="flex shrink-0 flex-col gap-2">
                  {(b.attachments || []).slice(0, 1).map((u) => <FileThumb key={u} url={u} label="Bill" />)}
                  {/* every page and receipt in one sheet */}
                  {(b.attachments?.length || 0) + (b.receipts?.length || 0) > 1 && (
                    <button type="button" onClick={() => setViewing(b)} className="flex size-20 flex-col items-center justify-center rounded-xl border border-line bg-surface-2 text-xs font-semibold text-fg hover:bg-surface">
                      <span className="text-base">{(b.attachments?.length || 0) + (b.receipts?.length || 0)}</span>
                      files
                    </button>
                  )}
                  {!b.attachments?.length && (
                    b.supplier ? (
                      <span className="flex size-20 items-center justify-center rounded-xl bg-surface-2 text-center text-[11px] font-semibold leading-tight text-muted">No<br />receipt</span>
                    ) : (
                      <span className="flex size-20 items-center justify-center rounded-xl bg-warning-soft text-center text-[11px] font-semibold leading-tight text-warning">No bill<br />paper</span>
                    )
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p className="text-lg font-semibold leading-none text-fg">{money(b.billAmount)}</p>
                    <span className="text-xs text-muted">of {money(b.floatAmount)} given</span>
                    {b.costKind === "notCost" && <Badge tone="neutral">Not a cost</Badge>}
                  </div>
                  {b.supplier ? (
                    <p className="text-sm font-medium text-fg">
                      <Badge tone="info" className="mr-1.5 px-2 py-px text-[10px]">Supplier</Badge>
                      {supplierText(b.supplier, money)}
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-fg">{b.category || "—"}{b.purpose && b.purpose !== b.category ? ` · ${b.purpose}` : ""}</p>
                  )}
                  {b.supplier?.mode === "po" && (
                    // what came against the order, to check against the invoice before approving
                    <ul className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-fg">
                      {(b.supplier.lines || []).map((l, i) => {
                        const short = Number(l.receivedQty) < Number(l.requestedQty);
                        const rise = priceRise(l.finalPrice, l.estPrice);
                        return (
                          <li key={l.itemId || i} className="flex justify-between gap-3 py-0.5">
                            <span className="min-w-0 truncate">{l.name}</span>
                            <span className="shrink-0 tabular-nums">
                              <span className={cn(short && "font-semibold text-warning")}>{l.receivedQty}</span>
                              <span className="text-muted"> of {l.requestedQty} {l.unit} × </span>
                              <span className={cn(rise ? "font-semibold text-warning" : "text-muted")} title={rise ? `Was ${money(rise.was)} (+${rise.pct}%)` : undefined}>
                                {money(l.finalPrice)}
                                {rise ? ` ↑ was ${money(rise.was)}` : ""}
                              </span>
                            </span>
                          </li>
                        );
                      })}
                      <li className="mt-1 flex justify-between gap-3 border-t border-line pt-1 font-semibold">
                        <span>Invoice {b.supplier.invoiceNo}</span>
                        <span className="tabular-nums">{money(linesTotal(b.supplier.lines))}</span>
                      </li>
                    </ul>
                  )}
                  <p className="text-xs text-muted">{day(b.date)} · {b.to?.name || "—"} · brought by {b.by?.name || "someone"}</p>
                  <p className="inline-flex rounded-lg bg-brand-soft px-2 py-1 text-xs font-medium text-brand">{changeText(b.floatAmount, b.billAmount, money)}</p>
                  {b.voucherReason && <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-fg">&ldquo;{b.voucherReason}&rdquo;</p>}
                  {b.receipts?.length > 0 && <p className="text-xs text-muted">With a payment receipt</p>}
                  {b.note && <p className="text-xs text-muted">{b.note}</p>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/40 px-4 py-3">
                {mine ? (
                  <p className="text-xs text-subtle">You handed it out or brought it — someone else approves it.</p>
                ) : (
                  <>
                    <Button size="sm" icon={Check} loading={busy === b.id} onClick={() => approve(b)} className="min-w-28 flex-1 sm:flex-none">Approve</Button>
                    {!b.supplier && <Button size="sm" variant="secondary" icon={PencilLine} disabled={busy === b.id} onClick={() => setCorrecting(b)} className="min-w-28 flex-1 sm:flex-none">Correct</Button>}
                    <Button size="sm" variant="ghost" icon={Undo2} disabled={busy === b.id} onClick={() => back(b)} className="flex-1 sm:ml-auto sm:flex-none">Send back</Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <FilesSheet
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `${money(viewing.billAmount)} · ${viewing.category || viewing.purpose || "Bill"}` : "Files"}
        groups={viewing ? [{ title: "Bill", urls: viewing.attachments || [] }, { title: "Payment receipt", urls: viewing.receipts || [] }] : []}
      />
      {correcting && <CorrectSheet bill={correcting} onClose={() => setCorrecting(null)} onApprove={approve} groups={groups} currency={currency} />}
    </>
  );
}
