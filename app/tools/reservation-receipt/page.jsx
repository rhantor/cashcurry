"use client";
// Tools → Reservation Receipt (on main 25 Oct 2026, here in dev's design):
// when a customer pays a deposit to book, it is saved here and they get a
// numbered, professional receipt to share on WhatsApp (image or PDF).
// Receipts stay listed for the branch — find one, share it again, mark it
// Used on the day, Refunded or Cancelled. Not a sale or a cash entry
// (lib/reservations/receipt.js); who may do what: reservations.* in
// lib/authz/permissions.js.
import { useEffect, useMemo, useRef, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { toJpeg, toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { CalendarClock, Download, FileText, Image as ImageIcon, MessageCircle, Plus, ReceiptText, Search, Wallet } from "lucide-react";
import useResolvedCompanyBranch from "@/app/hooks/useResolvedCompanyBranch";
import useCurrency from "@/app/hooks/useCurrency";
import { useBusinessToday } from "@/app/hooks/useRegion";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { useGetCompanyDetailsQuery } from "@/lib/redux/api/authApiSlice";
import { loadLogo } from "@/lib/purchases/purchaseOrderPdf";
import { addDays, waNumber } from "@/lib/purchases/orders";
import { regionOf } from "@/lib/region";
import { currencyInfo } from "@/lib/region/currency";
import { can } from "@/lib/authz/permissions";
import { createDeposit, setDepositStatus, useDeposits } from "@/lib/reservations/client";
import { DEFAULT_TERMS, METHODS, STATUSES, checkReceipt, dayText, money as moneyText, receiptMessage, timeText } from "@/lib/reservations/receipt";
import { Badge, Button, DatePicker, EmptyState, Field, Input, Select, Sheet, Skeleton, Textarea } from "@/app/components/ui";
import { Chip } from "@/app/components/entry/Choices";
import MoneyInput from "@/app/components/entry/MoneyInput";
import StatTiles from "@/app/components/purchases/StatTiles";
import ReceiptCard from "./ReceiptCard";

const TERMS_KEY = (branchId) => `cc_rsv_terms_${branchId}`;
const TONE = { held: "warning", used: "success", refunded: "info", cancelled: "neutral" };
const blank = (terms) => ({ customerName: "", customerPhone: "", reservationDate: "", reservationTime: "", pax: "", occasion: "", notes: "", amount: "", method: "cash", reference: "", terms });

export default function ReservationReceiptPage() {
  const { ready, user, companyId, branchId } = useResolvedCompanyBranch();
  const today = useBusinessToday();
  const code = useCurrency();
  const sign = currencyInfo(code).symbol; // "RM", "৳" — as printed on the receipt
  const money = (v) => moneyText(v, sign);
  const args = ready && companyId && branchId ? { companyId, branchId } : skipToken;
  const { data: settings } = useGetBranchSettingsQuery(args);
  const { data: branch } = useGetSingleBranchQuery(args);
  const { data: company } = useGetCompanyDetailsQuery(ready && companyId ? companyId : skipToken);
  const { list, loading, error } = useDeposits(ready ? companyId : null, ready ? branchId : null);

  // the letterhead: Branch Settings → company name, registration, address, phone, email; the company's logo
  const [logo, setLogo] = useState(null);
  useEffect(() => {
    let live = true;
    if (company?.logo) loadLogo(company.logo).then((d) => live && setLogo(d)).catch(() => {});
    return () => {
      live = false;
    };
  }, [company?.logo]);
  const basic = settings?.basic || {};
  const business = {
    name: basic.companyName || company?.name || branch?.name || "",
    branch: branch?.name || "",
    registration: basic.companyRegistration || company?.registrationNo || "",
    address: typeof basic.address === "string" ? basic.address : [basic.address?.line1, basic.address?.line2, basic.address?.city].filter(Boolean).join(", "),
    phone: basic.phone || basic.whatsapp || "",
    email: basic.email || "",
    logo,
  };

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return list.filter(
      (r) => (status === "all" || r.status === status) && (!k || [r.receiptNo, r.customerName, r.customerPhone, r.occasion].some((x) => String(x || "").toLowerCase().includes(k)))
    );
  }, [list, q, status]);
  const held = list.filter((r) => r.status === "held");
  const soon = held.filter((r) => r.reservationDate >= today && r.reservationDate <= addDays(today, 7));

  // ── new receipt ─────────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blank(DEFAULT_TERMS));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }));
  const openNew = () => {
    let terms = DEFAULT_TERMS;
    try {
      terms = localStorage.getItem(TERMS_KEY(branchId)) || DEFAULT_TERMS;
    } catch {
      /* storage blocked: the default terms */
    }
    setForm(blank(terms));
    setErrors({});
    setFormOpen(true);
  };
  const save = async () => {
    const e = checkReceipt(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      try {
        localStorage.setItem(TERMS_KEY(branchId), form.terms);
      } catch {
        /* storage blocked: the terms just aren't remembered */
      }
      const { id, receiptNo } = await createDeposit(companyId, branchId, user, form);
      setFormOpen(false);
      setViewing({ id, receiptNo, ...form, amount: Number(form.amount), pax: form.pax ? Number(form.pax) : null, status: "held", createdBy: { name: user?.name || user?.username, uid: user?.uid }, createdAt: new Date() });
    } catch (err) {
      console.error(err);
      setErrors({ save: `Could not save: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // ── one receipt: share, mark ────────────────────────────────────────────────
  const [viewing, setViewing] = useState(null);
  const current = viewing ? list.find((r) => r.id === viewing.id) || viewing : null; // live once saved
  const cardRef = useRef(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    setNote("");
    setMsg("");
  }, [viewing?.id]);

  const fileName = (ext) => `${current?.receiptNo || "receipt"}.${ext}`;
  const makePng = () => toPng(cardRef.current, { pixelRatio: 2.5, backgroundColor: "#ffffff", cacheBust: true });
  const makePdf = async () => {
    // a JPEG inside keeps the PDF small enough for WhatsApp (a PNG made it ~9 MB)
    const jpg = await toJpeg(cardRef.current, { pixelRatio: 2.5, quality: 0.92, backgroundColor: "#ffffff", cacheBust: true });
    const node = cardRef.current;
    const w = 120; // mm
    const h = (node.offsetHeight / node.offsetWidth) * w;
    const pdf = new jsPDF({ unit: "mm", format: [w, h] });
    pdf.addImage(jpg, "JPEG", 0, 0, w, h);
    return { pdf, blob: pdf.output("blob") };
  };
  const download = (href, name) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
  };
  const text = current ? receiptMessage(current, { business: business.branch || business.name, currency: sign }) : "";
  const wa = current ? waNumber(current.customerPhone, regionOf(settings).timeZone) : "";

  const share = async (kind) => {
    if (!current) return;
    setBusy(kind);
    setMsg("");
    try {
      const file =
        kind === "pdf"
          ? new File([(await makePdf()).blob], fileName("pdf"), { type: "application/pdf" })
          : new File([await (await fetch(await makePng())).blob()], fileName("png"), { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text, title: current.receiptNo });
        } catch (e) {
          if (e?.name !== "AbortError") throw e;
        }
      } else {
        // a computer: save the file, then open the customer's chat with the message
        const url = URL.createObjectURL(file);
        download(url, file.name);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        setMsg(`${kind === "pdf" ? "PDF" : "Image"} saved — attach it in the WhatsApp chat that opens.`);
        if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
      }
    } catch (e) {
      console.error(e);
      setMsg("Could not make the receipt file. Try again.");
    } finally {
      setBusy("");
    }
  };
  const saveFile = async (kind) => {
    setBusy(`dl-${kind}`);
    try {
      if (kind === "pdf") (await makePdf()).pdf.save(fileName("pdf"));
      else download(await makePng(), fileName("png"));
    } catch (e) {
      console.error(e);
      setMsg("Could not make the receipt file. Try again.");
    } finally {
      setBusy("");
    }
  };

  const canMark = current?.id && (can(user?.role, "reservations.manage") || current.createdBy?.uid === user?.uid);
  const mark = async (s) => {
    if ((s === "refunded" || s === "cancelled") && !note.trim()) return setMsg("Write why (a short note) before refunding or cancelling.");
    setBusy(s);
    try {
      await setDepositStatus(companyId, branchId, current.id, s, user, note);
      setMsg(`Marked ${STATUSES[s].label}.`);
      setNote("");
    } catch (e) {
      console.error(e);
      setMsg(`Could not change it: ${e.message}`);
    } finally {
      setBusy("");
    }
  };

  if (!ready) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-5 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Reservation receipts</h1>
          <p className="text-sm text-muted">A numbered receipt for every reservation deposit — share it on WhatsApp as an image or a PDF.</p>
        </div>
        <Button icon={Plus} onClick={openNew}>
          New receipt
        </Button>
      </div>

      <StatTiles
        loading={loading}
        tiles={[
          { label: "Deposits held", value: money(held.reduce((s, r) => s + (Number(r.amount) || 0), 0)), note: `${held.length} reservation${held.length === 1 ? "" : "s"} still to come`, icon: Wallet, tone: "bg-brand-soft text-brand" },
          { label: "Coming up (7 days)", value: String(soon.length), note: "Held reservations", icon: CalendarClock, tone: soon.length ? "bg-warning-soft text-warning" : "bg-surface-2 text-muted" },
          { label: "Receipts", value: String(list.length), note: "At this branch — never deleted", icon: ReceiptText, tone: "bg-surface-2 text-muted" },
        ]}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find by receipt no., name or phone…" className="pl-10" aria-label="Find a receipt" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["all", ...Object.keys(STATUSES)].map((s) => (
            <Chip key={s} on={status === s} onClick={() => setStatus(s)}>
              {s === "all" ? "All" : STATUSES[s].label}
            </Chip>
          ))}
        </div>
      </div>

      {error && <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">Could not load the receipts ({error.code || error.message}).</p>}

      {loading ? (
        <Skeleton className="h-40" rounded="rounded-2xl" />
      ) : shown.length === 0 ? (
        <EmptyState
          className="rounded-2xl border border-line bg-surface py-12"
          icon={ReceiptText}
          title={list.length ? "Nothing matches" : "No receipts yet"}
          description={list.length ? "Try another word or status." : "When a customer pays a deposit for a reservation, make their receipt here."}
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {shown.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setViewing(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/60">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-fg">
                    {r.customerName} <span className="font-normal text-muted">· {r.customerPhone}</span>
                  </p>
                  <p className="truncate text-xs text-muted">
                    <span className="font-mono">{r.receiptNo}</span> · for {dayText(r.reservationDate)}
                    {r.reservationTime ? `, ${timeText(r.reservationTime)}` : ""}
                    {r.pax ? ` · ${r.pax} pax` : ""}
                  </p>
                </div>
                <Badge tone={TONE[r.status] || "neutral"}>{STATUSES[r.status]?.label || r.status}</Badge>
                <span className="shrink-0 font-bold tabular-nums text-fg">{money(r.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* new receipt */}
      <Sheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="New reservation receipt"
        description="The customer gets it on WhatsApp as soon as it's saved."
        footer={
          <div className="space-y-2">
            {errors.save && <p className="text-sm text-danger">{errors.save}</p>}
            <Button className="w-full" size="lg" loading={saving} onClick={save}>
              Save & make receipt
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer name" error={errors.customerName}>
            {({ id, invalid }) => <Input id={id} size="lg" invalid={invalid} value={form.customerName} onChange={set("customerName")} placeholder="e.g. Aisha Rahman" />}
          </Field>
          <Field label="Customer phone (WhatsApp)" error={errors.customerPhone}>
            {({ id, invalid }) => <Input id={id} size="lg" type="tel" inputMode="tel" invalid={invalid} value={form.customerPhone} onChange={set("customerPhone")} placeholder="e.g. 012-345 6789" />}
          </Field>
          <Field label="Reservation date" error={errors.reservationDate}>
            {() => <DatePicker size="lg" value={form.reservationDate} onChange={set("reservationDate")} />}
          </Field>
          <Field label="Time">
            {({ id }) => <Input id={id} size="lg" type="time" value={form.reservationTime} onChange={set("reservationTime")} />}
          </Field>
          <Field label="Guests (pax)" error={errors.pax}>
            {({ id, invalid }) => <Input id={id} size="lg" type="number" inputMode="numeric" min={1} invalid={invalid} value={form.pax} onChange={set("pax")} placeholder="e.g. 12" />}
          </Field>
          <Field label="Occasion (optional)">
            {({ id }) => <Input id={id} size="lg" value={form.occasion} onChange={set("occasion")} placeholder="e.g. Birthday dinner" />}
          </Field>
          <Field label="Deposit amount" error={errors.amount}>
            {({ id, invalid }) => <MoneyInput id={id} currency={code} invalid={invalid} value={form.amount} onValueChange={set("amount")} />}
          </Field>
          <Field label="Paid by">
            {({ id }) => (
              <Select id={id} className="h-12" value={form.method} onChange={set("method")}>
                {METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {form.method !== "cash" && (
            <Field label="Reference / approval no." error={errors.reference} className="sm:col-span-2">
              {({ id, invalid }) => <Input id={id} size="lg" invalid={invalid} value={form.reference} onChange={set("reference")} placeholder="From the card slip, bank or e-wallet" />}
            </Field>
          )}
          <Field label="Notes on the receipt (optional)" className="sm:col-span-2">
            {({ id }) => <Input id={id} size="lg" value={form.notes} onChange={set("notes")} placeholder="e.g. Private room, cake brought by customer" />}
          </Field>
          <Field label="Terms printed on the receipt" hint="Remembered for this branch on this device." className="sm:col-span-2">
            {({ id }) => <Textarea id={id} rows={3} value={form.terms} onChange={set("terms")} />}
          </Field>
        </div>
      </Sheet>

      {/* one receipt */}
      <Sheet open={!!current} onClose={() => setViewing(null)} size="lg" title={current?.receiptNo || "Receipt"} description={current ? `${current.customerName} · ${money(current.amount)}` : undefined}>
        {current && (
          <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
            <div className="overflow-x-auto rounded-2xl border border-line bg-surface-2/60 p-3">
              <div className="mx-auto w-[420px] shadow-sm">
                <ReceiptCard ref={cardRef} r={current} business={business} currency={sign} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Send to the customer</p>
                <button
                  type="button"
                  onClick={() => share("png")}
                  disabled={!!busy}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
                >
                  <MessageCircle className="size-5" /> {busy === "png" ? "Making…" : "WhatsApp — image"}
                </button>
                <button
                  type="button"
                  onClick={() => share("pdf")}
                  disabled={!!busy}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-[#25D366] font-semibold text-[#128C7E] transition hover:bg-[#25D366]/10 disabled:opacity-50 dark:text-[#25D366]"
                >
                  <FileText className="size-5" /> {busy === "pdf" ? "Making…" : "WhatsApp — PDF"}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" icon={ImageIcon} disabled={!!busy} onClick={() => saveFile("png")}>
                    Image
                  </Button>
                  <Button variant="secondary" icon={Download} disabled={!!busy} onClick={() => saveFile("pdf")}>
                    PDF
                  </Button>
                </div>
                <p className="text-xs text-subtle">On a phone, choose WhatsApp and the customer’s chat. On a computer the file is saved and their chat opens with a message.</p>
              </div>

              <div className="space-y-2 rounded-2xl border border-line p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Status</p>
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={TONE[current.status] || "neutral"}>{STATUSES[current.status]?.label}</Badge>
                  <span className="text-muted">{STATUSES[current.status]?.hint}</span>
                </p>
                {current.statusNote && (
                  <p className="text-xs text-muted">
                    “{current.statusNote}” — {current.statusBy?.name || current.statusBy?.username}
                  </p>
                )}
                {canMark && (
                  <>
                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (needed to refund or cancel)" aria-label="Note" />
                    <div className="flex flex-wrap gap-2">
                      {current.status !== "used" && (
                        <Button size="sm" disabled={!!busy} onClick={() => mark("used")}>
                          Used on the bill
                        </Button>
                      )}
                      {current.status !== "refunded" && (
                        <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => mark("refunded")}>
                          Refunded
                        </Button>
                      )}
                      {current.status !== "cancelled" && (
                        <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" disabled={!!busy} onClick={() => mark("cancelled")}>
                          Cancel receipt
                        </Button>
                      )}
                      {current.status !== "held" && (
                        <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => mark("held")}>
                          Back to held
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
              {msg && <p className="rounded-xl bg-surface-2 p-3 text-sm text-fg">{msg}</p>}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
