"use client";
// Bills waiting (roadmap 4.10): pay-out bills brought back, for branch admin,
// manager or in-charge (and the company roles) to approve — as they are, or
// corrected (the original amount and category are kept) — or send back with
// a reason. Approving turns the bill into a cost.
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, PencilLine, ReceiptText, Undo2 } from "lucide-react";
import { Badge, Button, EmptyState, Field, Select, Sheet, Skeleton, toast } from "@/app/components/ui";
import { promptDialog } from "@/app/components/ui/notify";
import MoneyInput from "@/app/components/entry/MoneyInput";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { can } from "@/lib/authz/permissions";
import { categoryFields, pickable } from "@/lib/costs/categories";
import { useCostCategories } from "@/lib/costs/client";
import { canReviewBill, changeText } from "@/lib/payouts/model";
import { approveBillNow, sendBillBack } from "@/lib/payouts/client";

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

  const approve = async (bill, correction = {}) => {
    setBusy(bill.id);
    try {
      await approveBillNow(companyId, branchId, user, bill, correction);
      toast.success("Approved — it's a cost now");
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
            <li key={b.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex gap-2">
                  {(b.attachments || []).slice(0, 2).map((u) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer" className="size-20 overflow-hidden rounded-xl border border-line">
                      <img src={u} alt="Bill" className="size-full object-cover" />
                    </a>
                  ))}
                  {!b.attachments?.length && (
                    <span className="flex size-20 items-center justify-center rounded-xl bg-warning-soft text-center text-[11px] font-semibold text-warning">No bill<br />paper</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-fg">{money(b.billAmount)}</p>
                    <span className="text-xs text-muted">of {money(b.floatAmount)} given</span>
                    {b.costKind === "notCost" && <Badge tone="neutral">Not a cost</Badge>}
                  </div>
                  <p className="text-sm text-fg">{b.category || "—"}{b.purpose && b.purpose !== b.category ? ` · ${b.purpose}` : ""}</p>
                  <p className="text-xs text-muted">{day(b.date)} · {b.to?.name || "—"} · brought by {b.by?.name || "someone"}</p>
                  <p className="mt-1 text-xs font-medium text-muted">{changeText(b.floatAmount, b.billAmount, money)}</p>
                  {b.voucherReason && <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">&ldquo;{b.voucherReason}&rdquo;</p>}
                  {b.note && <p className="mt-1 text-xs text-muted">{b.note}</p>}
                </div>
                <div className="flex w-full gap-2 sm:w-auto sm:flex-col">
                  {mine ? (
                    <p className="text-xs text-subtle">You handed it out or brought it — someone else approves it.</p>
                  ) : (
                    <>
                      <Button size="sm" icon={Check} loading={busy === b.id} onClick={() => approve(b)} className="flex-1">Approve</Button>
                      <Button size="sm" variant="secondary" icon={PencilLine} disabled={busy === b.id} onClick={() => setCorrecting(b)} className="flex-1">Correct</Button>
                      <Button size="sm" variant="ghost" icon={Undo2} disabled={busy === b.id} onClick={() => back(b)} className="flex-1">Send back</Button>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {correcting && <CorrectSheet bill={correcting} onClose={() => setCorrecting(null)} onApprove={approve} groups={groups} currency={currency} />}
    </>
  );
}
