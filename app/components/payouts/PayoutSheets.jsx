"use client";
// The two steps a till person does (roadmap 4.10): hand money out, and bring
// the bill back (or try again when a bill was sent back).
import { useEffect, useMemo, useState } from "react";
import { Camera, FileText, Paperclip, ScanLine, X } from "lucide-react";
import {
  Button,
  DatePicker,
  Field,
  Input,
  Select,
  Sheet,
  Switch,
  Textarea,
  cn,
  toast,
} from "@/app/components/ui";
import MoneyInput from "@/app/components/entry/MoneyInput";
import { Chip } from "@/app/components/entry/Choices";
import { useDefaultDate } from "@/app/hooks/useRegion";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { categoryFields, findCategory, pickable } from "@/lib/costs/categories";
import { useCostCategories } from "@/lib/costs/client";
import { NO_INVOICE_REASONS } from "@/lib/costs/vouchers";
import { approvesOwnBill, changeOf, deliveryOf, goodsOf } from "@/lib/payouts/model";
import {
  approveBillNow,
  approveSupplierNow,
  bringBill,
  getBill,
  handOut,
  resubmitBill,
  uploadBillFiles,
} from "@/lib/payouts/client";
import { useGetStaffListQuery } from "@/lib/redux/api/staffApiSlice";
import { FileThumb } from "@/app/components/common/Files";
import ScanToPdf from "@/app/components/common/ScanToPdf";
import SupplierPicker from "./SupplierPicker";
import { checkSupplier, poLines, supplierPaid } from "@/lib/payouts/supplier";
import { getOrder } from "@/lib/payouts/client";

const PURPOSES = [
  "Cooking gas",
  "Ice",
  "Market",
  "Vegetables",
  "Taxi / Grab",
  "Repairs",
  "Cleaning things",
];
const fullName = (s) => `${s.firstName || ""} ${s.lastName || ""}`.trim();

/**
 * Hand money out of the till: how much, to whom, for what — something to buy,
 * or a supplier's bills to pay (picked from Purchases → Due Bills), or a
 * purchase order to collect (paid on delivery).
 * preset: { vendorId, vendorName, bills: [{ id, invoiceNo, balance }] } from Due Bills.
 */
export function HandOutSheet({
  open,
  onClose,
  companyId,
  branchId,
  user,
  preset = null,
}) {
  const currency = useCurrency();
  const [date, setDate] = useDefaultDate();
  const [amount, setAmount] = useState("");
  const [staffId, setStaffId] = useState("");
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [kind, setKind] = useState("buy"); // "buy" | "supplier"
  const [supplier, setSupplier] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const { data: staff = [] } = useGetStaffListQuery(
    { companyId, branchId },
    { skip: !open || !companyId || !branchId },
  );

  useEffect(() => {
    if (!open) return;
    setStaffId("");
    setName("");
    setErrors({});
    if (preset?.vendorId) {
      const pays = (preset.bills || []).map((b) => ({
        billId: b.id,
        invoiceNo: b.invoiceNo || "",
        amount: Number(b.balance) || 0,
        balance: Number(b.balance) || 0,
      }));
      setKind("supplier");
      setSupplier({
        vendorId: preset.vendorId,
        vendorName: preset.vendorName || "",
        mode: "pays",
        pays,
      });
      setAmount(String(pays.reduce((n, p) => n + p.amount, 0) || ""));
      setPurpose(`Pay ${preset.vendorName || "the supplier"}`);
    } else {
      setKind("buy");
      setSupplier(null);
      setAmount("");
      setPurpose("");
    }
  }, [open, preset?.vendorId]); // eslint-disable-line react-hooks/exhaustive-deps
  // paying bills: the money is what the ticked bills come to (it can still be changed);
  // collecting an order: about what the order comes to
  const pickSupplier = (s) => {
    setSupplier(s);
    if (s?.mode === "po") {
      if (s.poId) {
        if (Number(s.totalEst) > 0) setAmount(String(s.totalEst));
        setPurpose(`Collect ${s.poNo || "the order"} from ${s.vendorName}`);
      }
      return;
    }
    const total = supplierPaid(s);
    if (total > 0) setAmount(String(total));
    if (s?.vendorName) setPurpose(`Pay ${s.vendorName}`);
  };

  const save = async () => {
    const person = staff.find((s) => s.id === staffId);
    const e = {};
    if (!(Number(amount) > 0)) e.amount = "How much?";
    if (!person && !name.trim()) e.to = "Who took it?";
    if (!purpose.trim()) e.purpose = "What is it for?";
    if (kind === "supplier") {
      if (supplier?.mode === "po") {
        if (!supplier.vendorId) e.vendor = "Which supplier?";
        else if (!supplier.poId) e.po = "Which purchase order?";
      } else Object.assign(e, checkSupplier({ ...supplier, mode: "pays" }));
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const forSupplier =
        kind !== "supplier"
          ? {}
          : supplier.mode === "po"
            ? {
                forVendor: {
                  vendorId: supplier.vendorId,
                  vendorName: supplier.vendorName,
                },
                forPo: {
                  poId: supplier.poId,
                  poNo: supplier.poNo,
                  totalEst: supplier.totalEst,
                },
              }
            : {
                forVendor: {
                  vendorId: supplier.vendorId,
                  vendorName: supplier.vendorName,
                },
                forBills: supplier.pays || [],
              };
      await handOut(companyId, branchId, user, {
        date,
        amount,
        to: person ? { name: fullName(person), staffId: person.id } : { name },
        purpose,
        ...forSupplier,
      });
      toast.success("Handed out", {
        description: `${formatMoney(Number(amount), currency)} · the till goes down now`,
      });
      onClose();
    } catch (err) {
      toast.error("Couldn't save", { description: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Hand out money"
      description="From the till, to buy something. Bring the bill back when it's bought."
      footer={
        <Button onClick={save} loading={busy}>
          Hand it out
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <Chip on={kind === "buy"} onClick={() => setKind("buy")}>
            To buy something
          </Chip>
          <Chip on={kind === "supplier"} onClick={() => setKind("supplier")}>
            For a supplier
          </Chip>
        </div>
        {kind === "supplier" && (
          <SupplierPicker
            companyId={companyId}
            branchId={branchId}
            value={supplier}
            onChange={pickSupplier}
            currency={currency}
            date={date}
            errors={errors}
            modes={["pays", "po"]}
            receiving={false}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount" error={errors.amount}>
            {({ id, invalid }) => (
              <MoneyInput
                id={id}
                currency={currency}
                value={amount}
                invalid={invalid}
                onValueChange={setAmount}
              />
            )}
          </Field>
          <Field label="Day">
            {() => <DatePicker size="lg" value={date} onChange={setDate} />}
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Given to (staff)">
            {({ id }) => (
              <Select
                id={id}
                value={staffId}
                onChange={(e) => {
                  setStaffId(e.target.value);
                  if (e.target.value) setName("");
                }}
                className="h-12"
              >
                <option value="">— Someone else —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {fullName(s) || s.id}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="…or their name" error={errors.to}>
            {({ id, invalid }) => (
              <Input
                id={id}
                size="lg"
                disabled={!!staffId}
                invalid={invalid}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. the driver"
              />
            )}
          </Field>
        </div>
        <Field label="For" error={errors.purpose}>
          {({ id, invalid }) => (
            <Input
              id={id}
              size="lg"
              invalid={invalid}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="What will be bought"
            />
          )}
        </Field>
        {kind === "buy" && (
          <div className="flex flex-wrap gap-1.5">
            {PURPOSES.map((p) => (
              <Chip key={p} on={purpose === p} onClick={() => setPurpose(p)}>
                {p}
              </Chip>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

const MAX_MB = 10; // storage.rules: payouts files up to 10 MB each

/**
 * Photos or PDFs, with a way to take one away: the camera for a quick photo,
 * or "Photo or PDF" to pick files (a scanned 8-page bill as one PDF, or many
 * photos). `existing` = files saved before (a bill tried again).
 */
function FilePicker({ files, setFiles, existing = [], setExisting, max }) {
  const previews = useMemo(
    () =>
      files.map((f) => ({
        f,
        url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      })),
    [files],
  );
  useEffect(
    () => () => previews.forEach((p) => p.url && URL.revokeObjectURL(p.url)),
    [previews],
  );
  const room = max - files.length - existing.length;
  const add = (e) => {
    const picked = [...(e.target.files || [])];
    e.target.value = "";
    const big = picked.filter(
      (f) => f.type === "application/pdf" && f.size > MAX_MB * 1024 * 1024,
    );
    if (big.length)
      toast.error(
        `${big.length === 1 ? "A PDF is" : "Some PDFs are"} over ${MAX_MB} MB`,
        { description: "Split it in two, or take photos of the pages." },
      );
    const ok = picked.filter(
      (f) =>
        !big.includes(f) &&
        (f.type.startsWith("image/") || f.type === "application/pdf"),
    );
    if (ok.length > room)
      toast.warning(`Only ${max} files fit`, {
        description: `${ok.length - room} left out.`,
      });
    setFiles((list) => [...list, ...ok].slice(0, max - existing.length));
  };
  const remove =
    "absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white";
  return (
    <div className="flex flex-wrap gap-2">
      {existing.map((u) => (
        <div key={u} className="relative">
          <FileThumb url={u} label="Saved file" />
          {setExisting && (
            <button
              type="button"
              aria-label="Remove"
              onClick={() => setExisting((list) => list.filter((x) => x !== u))}
              className={remove}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      ))}
      {previews.map(({ f, url }, i) => (
        <div
          key={i}
          className="relative size-20 overflow-hidden rounded-xl border border-line bg-surface-2"
        >
          {url ? (
            <img src={url} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-0.5 bg-danger-soft/60 px-1 text-danger">
              <FileText className="size-6" />
              <span className="w-full truncate text-center text-[10px] font-semibold">
                {f.name || "PDF"}
              </span>
            </span>
          )}
          <button
            type="button"
            aria-label="Remove"
            onClick={() => setFiles((list) => list.filter((_, j) => j !== i))}
            className={remove}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      {room > 0 && (
        <>
          <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-xs font-medium text-muted hover:bg-surface-2">
            <Camera className="size-5" /> Camera
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={add}
            />
          </label>
          <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line px-1 text-center text-xs font-medium leading-tight text-muted hover:bg-surface-2">
            <Paperclip className="size-5" /> Photo or PDF
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="sr-only"
              onChange={add}
            />
          </label>
        </>
      )}
    </div>
  );
}

/**
 * The bill back for a pay-out: exact amount, photo (or no paper — a voucher),
 * what it was for. `retry` = a bill that was sent back, tried again.
 */
export function BillSheet({
  payout,
  retry,
  onClose,
  companyId,
  branchId,
  user,
}) {
  const open = !!(payout || retry);
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);
  const { groups } = useCostCategories(companyId);
  const [date, setDate] = useDefaultDate();
  const [amount, setAmount] = useState("");
  const [files, setFiles] = useState([]);
  const [kept, setKept] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [keptReceipts, setKeptReceipts] = useState([]);
  const [noPaper, setNoPaper] = useState(false);
  const [reason, setReason] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [where, setWhere] = useState("shop"); // "shop" | "supplier"
  const [supplier, setSupplier] = useState(null);
  // a delivery / transport charge paid on top: its own cost, category and receipt
  const [deliveryOn, setDeliveryOn] = useState(false);
  const [deliveryAmt, setDeliveryAmt] = useState("");
  const [deliveryCat, setDeliveryCat] = useState("");
  const [deliveryFiles, setDeliveryFiles] = useState([]);
  const [keptDelivery, setKeptDelivery] = useState([]);
  const [scanning, setScanning] = useState(false); // many pages → one PDF
  const float = Number(retry ? retry.floatAmount : payout?.amount) || 0;
  // the branch's "Transport & delivery" category, to start the delivery in
  const deliveryDefault = useMemo(() => {
    const all = pickable(groups).flatMap((g) => g.categories);
    return (all.find((c) => c.id === "delivery") || all.find((c) => /deliver|transport/i.test(c.name)) || {}).id || "";
  }, [groups]);

  useEffect(() => {
    if (!open) return;
    // money sent for a supplier's bills comes back as those bills; a bill sent back keeps its supplier
    const sent = payout?.forVendor;
    const po = payout?.forPo;
    const start =
      retry?.supplier ||
      (sent && po?.poId
        ? {
            vendorId: sent.vendorId,
            vendorName: sent.vendorName,
            mode: "po",
            poId: po.poId,
            poNo: po.poNo,
            totalEst: po.totalEst,
            lines: [],
            invoiceNo: "",
            invoiceDate: payout.date,
            paid: 0,
          }
        : sent
          ? {
              vendorId: sent.vendorId,
              vendorName: sent.vendorName,
              mode: "pays",
              pays: (payout.forBills || []).map((b) => ({
                ...b,
                amount: b.balance,
              })),
            }
          : null);
    setWhere(start ? "supplier" : "shop");
    setSupplier(start);
    // money sent to collect an order: its lines, as ordered, to change to what came
    if (!retry && po?.poId) {
      getOrder(companyId, branchId, po.poId)
        .then((o) => {
          const lines = poLines(o);
          setSupplier((s) =>
            s?.poId === po.poId && !s.lines?.length
              ? {
                  ...s,
                  lines,
                  paid: Math.min(
                    Number(payout.amount) || 0,
                    lines.reduce((n, l) => n + l.receivedQty * l.finalPrice, 0),
                  ),
                }
              : s,
          );
        })
        .catch(() => {});
    }
    // a bill sent back: its amount without the delivery, which has its own box
    setAmount(retry ? String(goodsOf(retry)) : "");
    const d = retry ? deliveryOf(retry) : null;
    setDeliveryOn(!!d);
    setDeliveryAmt(d ? String(d.amount) : "");
    setDeliveryCat(d?.categoryId || "");
    setDeliveryFiles([]);
    setKeptDelivery(d?.receipts || []);
    setFiles([]);
    setKept(retry?.attachments || []);
    setReceipts([]);
    setKeptReceipts(retry?.receipts || []);
    setNoPaper(!!retry?.voucherReason);
    setReason(retry?.voucherReason || "");
    setCategoryId(retry?.categoryId || "");
    setNote(retry?.note || "");
    setErrors({});
    // keyed on the pay-out's id, not the object: a live update must not wipe what is being typed
  }, [open, retry, payout?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const atSupplier = where === "supplier";
  // at a supplier, what was spent is what went to their bills; a delivery charge comes on top
  const delivery = deliveryOn ? Number(deliveryAmt) || 0 : 0;
  const bill = (atSupplier ? supplierPaid(supplier) : Number(amount) || 0) + delivery;
  const deliveryCatId = deliveryCat || deliveryDefault;
  const change = changeOf(float, bill);

  const save = async () => {
    const e = {};
    if (atSupplier) {
      Object.assign(e, checkSupplier(supplier));
      if (
        (supplier?.mode === "newBill" || supplier?.mode === "po") &&
        !files.length &&
        !kept.length
      )
        e.files = "Add the supplier's bill (photo or PDF)";
    } else {
      if (!(Number(amount) > 0)) e.amount = "The amount on the bill";
      if (!findCategory(groups, categoryId)) e.category = "What was it for?";
      if (!files.length && !kept.length && !noPaper)
        e.files = "Add the bill (photo or PDF) — or say there is none";
      if (noPaper && !files.length && !reason.trim())
        e.reason = "Why is there no bill?";
    }
    if (deliveryOn && !(delivery > 0)) e.delivery = "How much was the delivery?";
    if (deliveryOn && !findCategory(groups, deliveryCatId)) e.deliveryCat = "Which category?";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const uploaded = files.length
        ? await uploadBillFiles(companyId, branchId, user.uid, files)
        : [];
      const paid = receipts.length
        ? await uploadBillFiles(companyId, branchId, user.uid, receipts)
        : [];
      const deliveryPaid = deliveryOn && deliveryFiles.length
        ? await uploadBillFiles(companyId, branchId, user.uid, deliveryFiles)
        : [];
      const supplierData = atSupplier
        ? {
            vendorId: supplier.vendorId,
            vendorName: supplier.vendorName,
            mode: supplier.mode,
            ...(supplier.mode === "po"
              ? {
                  poId: supplier.poId,
                  poNo: supplier.poNo || "",
                  lines: (supplier.lines || []).map((l) => ({
                    itemId: l.itemId || "",
                    name: l.name || "",
                    unit: l.unit || "",
                    category: l.category || "",
                    requestedQty: Number(l.requestedQty) || 0,
                    receivedQty: Number(l.receivedQty) || 0,
                    finalPrice: Number(l.finalPrice) || 0,
                    estPrice: Number(l.estPrice) || 0,
                  })),
                  invoiceNo: String(supplier.invoiceNo || "").trim(),
                  invoiceDate: supplier.invoiceDate || date,
                  paid: Number(supplier.paid) || 0,
                }
              : supplier.mode === "newBill"
                ? {
                    newBill: {
                      invoiceNo: supplier.newBill?.invoiceNo || "",
                      invoiceDate: supplier.newBill?.invoiceDate || date,
                      total: Number(supplier.newBill?.total) || 0,
                      paid: Number(supplier.newBill?.paid) || 0,
                    },
                  }
                : {
                    pays: (supplier.pays || []).map((p) => ({
                      billId: p.billId,
                      invoiceNo: p.invoiceNo || "",
                      amount: Number(p.amount) || 0,
                    })),
                  }),
          }
        : null;
      const data = {
        date,
        billAmount: bill,
        fields: atSupplier
          ? categoryFields(groups, null)
          : categoryFields(groups, categoryId),
        files: [...kept, ...uploaded],
        receipts: [...keptReceipts, ...paid],
        voucherReason:
          !atSupplier && !uploaded.length && !kept.length && noPaper
            ? reason
            : "",
        note,
        supplier: supplierData,
        delivery: deliveryOn
          ? {
              amount: delivery,
              fields: categoryFields(groups, deliveryCatId),
              receipts: [...keptDelivery, ...deliveryPaid],
            }
          : null,
      };
      let settleId = retry?.id;
      if (retry) await resubmitBill(companyId, branchId, user, retry, data);
      else settleId = await bringBill(companyId, branchId, user, payout, data);
      // a company role's bill needs no one: approved as it is brought back (owner, 31 Oct)
      if (approvesOwnBill(user)) {
        const fresh = await getBill(companyId, branchId, settleId);
        if (fresh?.supplier) await approveSupplierNow(companyId, branchId, user, fresh);
        else if (fresh) await approveBillNow(companyId, branchId, user, fresh);
      }
      toast.success(approvesOwnBill(user) ? "Bill saved and approved" : "Bill saved", {
        description:
          change > 0
            ? `Put ${money(change)} back in the till`
            : change < 0
              ? `${money(-change)} more from the till`
              : "Exact amount",
      });
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
      footer={
        <Button onClick={save} loading={busy}>
          Save the bill
        </Button>
      }
    >
      <div className="space-y-5">
        {retry?.review?.note && (
          <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-fg">
            Sent back: {retry.review.note}
          </p>
        )}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">
            Where was it spent?
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Chip on={!atSupplier} onClick={() => setWhere("shop")}>
              A shop or market
            </Chip>
            <Chip on={atSupplier} onClick={() => setWhere("supplier")}>
              A supplier (Purchases)
            </Chip>
          </div>
          {atSupplier && (
            <p className="text-xs text-muted">
              Goes into Purchases: the supplier&apos;s bills and what
              they&apos;re owed move with it.
            </p>
          )}
        </div>
        {atSupplier && (
          <SupplierPicker
            companyId={companyId}
            branchId={branchId}
            value={supplier}
            onChange={setSupplier}
            currency={currency}
            date={date}
            errors={errors}
            settleId={retry?.id || null}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {!atSupplier && (
            <Field label="Amount on the bill" error={errors.amount}>
              {({ id, invalid }) => (
                <MoneyInput
                  id={id}
                  currency={currency}
                  value={amount}
                  invalid={invalid}
                  onValueChange={setAmount}
                />
              )}
            </Field>
          )}
          {!retry && (
            <Field label="Day">
              {() => <DatePicker size="lg" value={date} onChange={setDate} />}
            </Field>
          )}
        </div>
        {/* a delivery / transport charge on top: its own cost in its own category */}
        <div
          className={cn(
            "rounded-2xl border p-3",
            deliveryOn ? "border-brand/30 bg-brand-soft/30" : "border-line",
          )}
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">
                Delivery / transport charge
              </p>
              <p className="text-xs text-muted">
                Paid on top — kept as its own cost.
              </p>
            </div>
            <Switch checked={deliveryOn} onChange={setDeliveryOn} aria-label="Delivery / transport charge" />
          </div>
          {deliveryOn && (
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Delivery amount" error={errors.delivery}>
                  {({ id, invalid }) => (
                    <MoneyInput
                      id={id}
                      currency={currency}
                      value={deliveryAmt}
                      invalid={invalid}
                      onValueChange={setDeliveryAmt}
                    />
                  )}
                </Field>
                <Field label="Category" error={errors.deliveryCat}>
                  {({ id, invalid }) => (
                    <Select
                      id={id}
                      value={deliveryCatId}
                      invalid={invalid}
                      onChange={(e) => setDeliveryCat(e.target.value)}
                      className="h-12"
                    >
                      <option value="">Choose…</option>
                      {pickable(groups).map((g) => (
                        <optgroup key={g.id} label={g.kind === "notCost" ? `${g.name} — not a cost` : g.name}>
                          {g.categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-muted">
                  Delivery receipt (optional)
                </p>
                <FilePicker
                  files={deliveryFiles}
                  setFiles={setDeliveryFiles}
                  existing={keptDelivery}
                  setExisting={setKeptDelivery}
                  max={4}
                />
              </div>
              {bill > 0 && (
                <p className="text-xs font-medium text-muted">
                  Total spent: {money(bill - delivery)} + {money(delivery)} delivery = {money(bill)}
                </p>
              )}
            </div>
          )}
        </div>
        {bill > 0 && (
          <div
            className={cn(
              "rounded-2xl px-4 py-3 text-sm font-semibold",
              change > 0
                ? "bg-brand-soft text-brand"
                : change < 0
                  ? "bg-warning-soft text-warning"
                  : "bg-surface-2 text-fg",
            )}
          >
            {change > 0
              ? `${money(change)} change — put it back in the till`
              : change < 0
                ? `${money(-change)} more — paid from the till`
                : "Exact — nothing comes back"}
          </div>
        )}
        {!atSupplier && (
          <Field label="What was it for?" error={errors.category}>
            {({ id, invalid }) => (
              <Select
                id={id}
                value={categoryId}
                invalid={invalid}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-12"
              >
                <option value="">Choose…</option>
                {pickable(groups).map((g) => (
                  <optgroup
                    key={g.id}
                    label={
                      g.kind === "notCost" ? `${g.name} — not a cost` : g.name
                    }
                  >
                    {g.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            )}
          </Field>
        )}
        <div>
          <p className="mb-2 text-xs font-semibold text-muted">
            {atSupplier && supplier?.mode === "pays"
              ? "The supplier's receipt (optional)"
              : "The bill"}
          </p>
          {!noPaper && (
            <FilePicker
              files={files}
              setFiles={setFiles}
              existing={kept}
              setExisting={setKept}
              max={12}
            />
          )}
          {!noPaper && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={ScanLine}
                onClick={() => setScanning(true)}
                disabled={files.length + kept.length >= 12}
              >
                Scan pages into one PDF
              </Button>
              <p className="min-w-0 flex-1 text-xs text-muted">
                A long bill (20 pages or more): scan every page here into one PDF — no other app needed.
              </p>
            </div>
          )}
          <ScanToPdf
            open={scanning}
            onClose={() => setScanning(false)}
            maxMb={MAX_MB}
            onDone={(pdf) => setFiles((list) => [...list, pdf].slice(0, 12 - kept.length))}
          />
          {errors.files && (
            <p className="mt-2 text-xs font-medium text-danger">
              {errors.files}
            </p>
          )}
          {!atSupplier && !files.length && !kept.length && (
            <div
              className={cn(
                "mt-3 rounded-2xl border p-3",
                noPaper
                  ? "border-warning/40 bg-warning-soft/50"
                  : "border-line",
              )}
            >
              <div className="flex items-center gap-3">
                <p className="flex-1 text-sm font-medium text-fg">
                  No bill paper
                </p>
                <Switch checked={noPaper} onChange={setNoPaper} />
              </div>
              {noPaper && (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {NO_INVOICE_REASONS.map((r) => (
                      <Chip
                        key={r}
                        on={reason === r}
                        onClick={() => setReason(r)}
                      >
                        {r}
                      </Chip>
                    ))}
                  </div>
                  <Field error={errors.reason}>
                    {({ id, invalid }) => (
                      <Input
                        id={id}
                        invalid={invalid}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Why there is no bill"
                      />
                    )}
                  </Field>
                </div>
              )}
            </div>
          )}
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-muted">
            Payment receipt (optional)
          </p>
          <p className="mb-2 text-xs text-muted">
            If the shop gave a separate receipt for the payment, add it here.
          </p>
          <FilePicker
            files={receipts}
            setFiles={setReceipts}
            existing={keptReceipts}
            setExisting={setKeptReceipts}
            max={4}
          />
        </div>
        <Field label="Note (optional)">
          {({ id }) => (
            <Textarea
              id={id}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything the manager should know"
            />
          )}
        </Field>
      </div>
    </Sheet>
  );
}
