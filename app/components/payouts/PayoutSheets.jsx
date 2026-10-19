"use client";
// The two steps a till person does (roadmap 4.10): hand money out, and bring
// the bill back (or try again when a bill was sent back).
import { useEffect, useMemo, useState } from "react";
import { Camera, FileText, X } from "lucide-react";
import { Button, DatePicker, Field, Input, Select, Sheet, Switch, Textarea, cn, toast } from "@/app/components/ui";
import MoneyInput from "@/app/components/entry/MoneyInput";
import { Chip } from "@/app/components/entry/Choices";
import { useDefaultDate } from "@/app/hooks/useRegion";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { categoryFields, findCategory, pickable } from "@/lib/costs/categories";
import { useCostCategories } from "@/lib/costs/client";
import { NO_INVOICE_REASONS } from "@/lib/costs/vouchers";
import { changeOf } from "@/lib/payouts/model";
import { bringBill, handOut, resubmitBill, uploadBillFiles } from "@/lib/payouts/client";
import { useGetStaffListQuery } from "@/lib/redux/api/staffApiSlice";

const PURPOSES = ["Cooking gas", "Ice", "Market", "Vegetables", "Taxi / Grab", "Repairs", "Cleaning things"];
const fullName = (s) => `${s.firstName || ""} ${s.lastName || ""}`.trim();

/** Hand money out of the till: how much, to whom, for what. */
export function HandOutSheet({ open, onClose, companyId, branchId, user }) {
  const currency = useCurrency();
  const [date, setDate] = useDefaultDate();
  const [amount, setAmount] = useState("");
  const [staffId, setStaffId] = useState("");
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const { data: staff = [] } = useGetStaffListQuery({ companyId, branchId }, { skip: !open || !companyId || !branchId });

  useEffect(() => {
    if (open) { setAmount(""); setStaffId(""); setName(""); setPurpose(""); setErrors({}); }
  }, [open]);

  const save = async () => {
    const person = staff.find((s) => s.id === staffId);
    const e = {};
    if (!(Number(amount) > 0)) e.amount = "How much?";
    if (!person && !name.trim()) e.to = "Who took it?";
    if (!purpose.trim()) e.purpose = "What is it for?";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await handOut(companyId, branchId, user, { date, amount, to: person ? { name: fullName(person), staffId: person.id } : { name }, purpose });
      toast.success("Handed out", { description: `${formatMoney(Number(amount), currency)} · the till goes down now` });
      onClose();
    } catch (err) {
      toast.error("Couldn't save", { description: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Hand out money" description="From the till, to buy something. Bring the bill back when it's bought." footer={<Button onClick={save} loading={busy}>Hand it out</Button>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount" error={errors.amount}>
            {({ id, invalid }) => <MoneyInput id={id} currency={currency} value={amount} invalid={invalid} onValueChange={setAmount} />}
          </Field>
          <Field label="Day">{() => <DatePicker size="lg" value={date} onChange={setDate} />}</Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Given to (staff)">
            {({ id }) => (
              <Select id={id} value={staffId} onChange={(e) => { setStaffId(e.target.value); if (e.target.value) setName(""); }} className="h-12">
                <option value="">— Someone else —</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{fullName(s) || s.id}</option>)}
              </Select>
            )}
          </Field>
          <Field label="…or their name" error={errors.to}>
            {({ id, invalid }) => <Input id={id} size="lg" disabled={!!staffId} invalid={invalid} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. the driver" />}
          </Field>
        </div>
        <Field label="For" error={errors.purpose}>
          {({ id, invalid }) => <Input id={id} size="lg" invalid={invalid} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="What will be bought" />}
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {PURPOSES.map((p) => <Chip key={p} on={purpose === p} onClick={() => setPurpose(p)}>{p}</Chip>)}
        </div>
      </div>
    </Sheet>
  );
}

/** Photos (or PDFs) of the bill, a few at most, with a way to take one away. */
function BillFiles({ files, setFiles, existing = [] }) {
  const previews = useMemo(() => files.map((f) => ({ f, url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null })), [files]);
  useEffect(() => () => previews.forEach((p) => p.url && URL.revokeObjectURL(p.url)), [previews]);
  return (
    <div className="flex flex-wrap gap-2">
      {existing.map((u) => (
        <a key={u} href={u} target="_blank" rel="noreferrer" className="size-20 overflow-hidden rounded-xl border border-line">
          <img src={u} alt="Bill" className="size-full object-cover" />
        </a>
      ))}
      {previews.map(({ url }, i) => (
        <div key={i} className="relative size-20 overflow-hidden rounded-xl border border-line bg-surface-2">
          {url ? <img src={url} alt="" className="size-full object-cover" /> : <FileText className="m-auto mt-6 size-8 text-muted" />}
          <button type="button" aria-label="Remove" onClick={() => setFiles((list) => list.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      {files.length < 4 && (
        <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-xs font-medium text-muted hover:bg-surface-2">
          <Camera className="size-5" /> Photo
          <input type="file" accept="image/*,application/pdf" capture="environment" multiple className="sr-only" onChange={(e) => { const picked = [...(e.target.files || [])]; e.target.value = ""; setFiles((list) => [...list, ...picked].slice(0, 4)); }} />
        </label>
      )}
    </div>
  );
}

/**
 * The bill back for a pay-out: exact amount, photo (or no paper — a voucher),
 * what it was for. `retry` = a bill that was sent back, tried again.
 */
export function BillSheet({ payout, retry, onClose, companyId, branchId, user }) {
  const open = !!(payout || retry);
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);
  const { groups } = useCostCategories(companyId);
  const [date, setDate] = useDefaultDate();
  const [amount, setAmount] = useState("");
  const [files, setFiles] = useState([]);
  const [noPaper, setNoPaper] = useState(false);
  const [reason, setReason] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const float = Number(retry ? retry.floatAmount : payout?.amount) || 0;

  useEffect(() => {
    if (!open) return;
    setAmount(retry ? String(retry.billAmount) : "");
    setFiles([]);
    setNoPaper(!!retry?.voucherReason);
    setReason(retry?.voucherReason || "");
    setCategoryId(retry?.categoryId || "");
    setNote(retry?.note || "");
    setErrors({});
  }, [open, retry]);

  const bill = Number(amount) || 0;
  const change = changeOf(float, bill);
  const kept = retry?.attachments || [];

  const save = async () => {
    const e = {};
    if (!(bill > 0)) e.amount = "The amount on the bill";
    if (!findCategory(groups, categoryId)) e.category = "What was it for?";
    if (!files.length && !kept.length && !noPaper) e.files = "Take a photo of the bill — or say there is none";
    if (noPaper && !files.length && !reason.trim()) e.reason = "Why is there no bill?";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const uploaded = files.length ? await uploadBillFiles(companyId, branchId, user.uid, files) : [];
      const data = { date, billAmount: bill, fields: categoryFields(groups, categoryId), files: [...kept, ...uploaded], voucherReason: !uploaded.length && !kept.length && noPaper ? reason : "", note };
      if (retry) await resubmitBill(companyId, branchId, user, retry, data);
      else await bringBill(companyId, branchId, user, payout, data);
      toast.success("Bill saved", { description: change > 0 ? `Put ${money(change)} back in the till` : change < 0 ? `${money(-change)} more from the till` : "Exact amount" });
      onClose();
    } catch (err) {
      toast.error("Couldn't save the bill", { description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const who = retry?.to?.name || payout?.to?.name;
  const what = retry?.purpose || payout?.purpose;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={retry ? "Try the bill again" : "Bill back"}
      description={`${money(float)} given to ${who || "—"}${what ? ` for ${what}` : ""}`}
      footer={<Button onClick={save} loading={busy}>Save the bill</Button>}
    >
      <div className="space-y-5">
        {retry?.review?.note && <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-fg">Sent back: {retry.review.note}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount on the bill" error={errors.amount}>
            {({ id, invalid }) => <MoneyInput id={id} currency={currency} value={amount} invalid={invalid} onValueChange={setAmount} />}
          </Field>
          {!retry && <Field label="Day">{() => <DatePicker size="lg" value={date} onChange={setDate} />}</Field>}
        </div>
        {bill > 0 && (
          <div className={cn("rounded-2xl px-4 py-3 text-sm font-semibold", change > 0 ? "bg-brand-soft text-brand" : change < 0 ? "bg-warning-soft text-warning" : "bg-surface-2 text-fg")}>
            {change > 0 ? `${money(change)} change — put it back in the till` : change < 0 ? `${money(-change)} more — paid from the till` : "Exact — nothing comes back"}
          </div>
        )}
        <Field label="What was it for?" error={errors.category}>
          {({ id, invalid }) => (
            <Select id={id} value={categoryId} invalid={invalid} onChange={(e) => setCategoryId(e.target.value)} className="h-12">
              <option value="">Choose…</option>
              {pickable(groups).map((g) => (
                <optgroup key={g.id} label={g.kind === "notCost" ? `${g.name} — not a cost` : g.name}>
                  {g.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </Select>
          )}
        </Field>
        <div>
          <p className="mb-2 text-xs font-semibold text-muted">The bill</p>
          {!noPaper && <BillFiles files={files} setFiles={setFiles} existing={kept} />}
          {errors.files && <p className="mt-2 text-xs font-medium text-danger">{errors.files}</p>}
          {!files.length && !kept.length && (
            <div className={cn("mt-3 rounded-2xl border p-3", noPaper ? "border-warning/40 bg-warning-soft/50" : "border-line")}>
              <div className="flex items-center gap-3">
                <p className="flex-1 text-sm font-medium text-fg">No bill paper</p>
                <Switch checked={noPaper} onChange={setNoPaper} />
              </div>
              {noPaper && (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {NO_INVOICE_REASONS.map((r) => <Chip key={r} on={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}
                  </div>
                  <Field error={errors.reason}>{({ id, invalid }) => <Input id={id} invalid={invalid} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why there is no bill" />}</Field>
                </div>
              )}
            </div>
          )}
        </div>
        <Field label="Note (optional)">{({ id }) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the manager should know" />}</Field>
      </div>
    </Sheet>
  );
}
