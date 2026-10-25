/* eslint-disable react/prop-types */
"use client";
// Tools → Reservation Receipt: when a customer pays a deposit to book, the
// cashier saves it here and gets a numbered, professional receipt to share on
// WhatsApp (image or PDF). Receipts stay listed for the branch — find one,
// share it again, mark it Used on the day, Refunded or Cancelled.
// The deposit is not a sale or a cash entry (lib/reservations/receipt.js).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { toJpeg, toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import useCurrency from "@/app/hooks/useCurrency";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { useGetCompanyDetailsQuery } from "@/lib/redux/api/authApiSlice";
import { loadLogo } from "@/utils/pdf/purchaseOrderPdf";
import { createDeposit, setDepositStatus, useDeposits } from "@/lib/reservations/client";
import { DEFAULT_TERMS, METHODS, STATUSES, checkReceipt, dayText, money, receiptMessage, timeText, waNumber } from "@/lib/reservations/receipt";
import ReceiptCard from "./ReceiptCard";

const MANAGERS = ["owner", "gm", "superAdmin", "superadmin", "branchAdmin", "manager", "accountant", "supervisor"];
const TERMS_KEY = (branchId) => `cc_rsv_terms_${branchId}`;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const blank = (terms) => ({ customerName: "", customerPhone: "", reservationDate: "", reservationTime: "", pax: "", occasion: "", notes: "", amount: "", method: "cash", reference: "", terms });

const STATUS_STYLE = {
  held: "bg-amber-50 text-amber-700 border-amber-200",
  used: "bg-emerald-50 text-emerald-700 border-emerald-200",
  refunded: "bg-sky-50 text-sky-700 border-sky-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

const inputCls = "w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3 text-[15px] focus:border-mint-500 focus:ring-2 focus:ring-mint-200 outline-none";

function Field({ label, error, children, wide }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="block text-sm font-semibold text-gray-700 mb-1">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className={`w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-xl"} max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="h-9 w-9 rounded-full text-gray-500 hover:bg-gray-100" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-gray-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export default function ReservationReceiptPage() {
  const { ready, user, companyId, branchId } = useResolvedCompanyBranch();
  const currency = useCurrency();
  const args = ready && companyId && branchId ? { companyId, branchId } : skipToken;
  const { data: settings } = useGetBranchSettingsQuery(args);
  const { data: branch } = useGetSingleBranchQuery(args);
  const { data: company } = useGetCompanyDetailsQuery(ready && companyId ? companyId : skipToken);
  const { list, loading, error } = useDeposits(ready ? companyId : null, ready ? branchId : null);

  // the letterhead, from the company and the branch's settings
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
      (r) =>
        (status === "all" || r.status === status) &&
        (!k || [r.receiptNo, r.customerName, r.customerPhone, r.occasion].some((x) => String(x || "").toLowerCase().includes(k)))
    );
  }, [list, q, status]);
  const held = list.filter((r) => r.status === "held");

  // ── new receipt ─────────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blank(DEFAULT_TERMS));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const openNew = () => {
    let terms = DEFAULT_TERMS;
    try {
      terms = localStorage.getItem(TERMS_KEY(branchId)) || DEFAULT_TERMS;
    } catch {
      /* storage blocked: use the default terms */
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
      /* storage blocked: use the default terms */
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
  const makePng = async () => toPng(cardRef.current, { pixelRatio: 2.5, backgroundColor: "#ffffff", cacheBust: true });
  const asFile = async (dataUrl, name, type) => new File([await (await fetch(dataUrl)).blob()], name, { type });
  const makePdf = async () => {
    // a JPEG inside keeps the PDF small enough for WhatsApp (a PNG made it ~9 MB)
    const jpg = await toJpeg(cardRef.current, { pixelRatio: 2.5, quality: 0.92, backgroundColor: "#ffffff", cacheBust: true });
    const node = cardRef.current;
    const w = 120; // mm — a little wider than A6, prints well and reads on a phone
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
  const text = current ? receiptMessage(current, { business: business.branch || business.name, currency }) : "";
  const wa = current ? waNumber(current.customerPhone) : "";

  const share = async (kind) => {
    if (!current) return;
    setBusy(kind);
    setMsg("");
    try {
      const file =
        kind === "pdf" ? new File([(await makePdf()).blob], fileName("pdf"), { type: "application/pdf" }) : await asFile(await makePng(), fileName("png"), "image/png");
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
  const save1 = async (kind) => {
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

  const canMark = current && current.id && (MANAGERS.includes(user?.role) || current.createdBy?.uid === user?.uid);
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

  if (!ready) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-5 pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Reservation receipts</h1>
          <p className="text-sm text-gray-500 mt-0.5">A numbered receipt for every reservation deposit — share it on WhatsApp as an image or a PDF.</p>
        </div>
        <button onClick={openNew} className="min-h-[48px] rounded-2xl bg-mint-600 px-5 font-semibold text-white hover:bg-mint-700 active:brightness-95">
          + New receipt
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500">Deposits held</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{money(held.reduce((s, r) => s + (Number(r.amount) || 0), 0), currency)}</p>
          <p className="text-xs text-gray-400">{held.length} reservation{held.length === 1 ? "" : "s"} still to come</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500">Coming up (7 days)</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{held.filter((r) => r.reservationDate >= today() && r.reservationDate <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)).length}</p>
          <p className="text-xs text-gray-400">held reservations</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find by receipt no., name or phone…" className={inputCls} aria-label="Find a receipt" />
        <div className="flex flex-wrap gap-1.5">
          {["all", ...Object.keys(STATUSES)].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`min-h-[40px] rounded-full border px-3 text-sm font-semibold ${status === s ? "bg-mint-600 border-mint-600 text-white" : "bg-white border-gray-200 text-gray-600"}`}
            >
              {s === "all" ? "All" : STATUSES[s].label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Could not load the receipts ({error.code || error.message}).</p>}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-center text-gray-400 animate-pulse">Loading…</p>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-semibold text-gray-800">{list.length ? "Nothing matches" : "No receipts yet"}</p>
            <p className="mt-1 text-sm text-gray-500">{list.length ? "Try another word or status." : "When a customer pays a deposit for a reservation, make their receipt here."}</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {shown.map((r) => (
              <li key={r.id}>
                <button onClick={() => setViewing(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">
                      {r.customerName} <span className="font-normal text-gray-400">· {r.customerPhone}</span>
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      <span className="font-mono">{r.receiptNo}</span> · for {dayText(r.reservationDate)}
                      {r.reservationTime ? `, ${timeText(r.reservationTime)}` : ""}
                      {r.pax ? ` · ${r.pax} pax` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[r.status] || STATUS_STYLE.held}`}>{STATUSES[r.status]?.label || r.status}</span>
                  <span className="shrink-0 font-bold tabular-nums text-gray-900">{money(r.amount, currency)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* new receipt */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="New reservation receipt"
        footer={
          <div className="space-y-2">
            {errors.save && <p className="text-sm text-red-600">{errors.save}</p>}
            <button onClick={save} disabled={saving} className="w-full min-h-[50px] rounded-2xl bg-mint-600 font-bold text-white hover:bg-mint-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save & make receipt"}
            </button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer name" error={errors.customerName}>
            <input className={inputCls} value={form.customerName} onChange={set("customerName")} placeholder="e.g. Aisha Rahman" />
          </Field>
          <Field label="Customer phone (WhatsApp)" error={errors.customerPhone}>
            <input className={inputCls} type="tel" inputMode="tel" value={form.customerPhone} onChange={set("customerPhone")} placeholder="e.g. 012-345 6789" />
          </Field>
          <Field label="Reservation date" error={errors.reservationDate}>
            <input className={inputCls} type="date" min={today()} value={form.reservationDate} onChange={set("reservationDate")} />
          </Field>
          <Field label="Time">
            <input className={inputCls} type="time" value={form.reservationTime} onChange={set("reservationTime")} />
          </Field>
          <Field label="Guests (pax)" error={errors.pax}>
            <input className={inputCls} type="number" inputMode="numeric" min={1} value={form.pax} onChange={set("pax")} placeholder="e.g. 12" />
          </Field>
          <Field label="Occasion (optional)">
            <input className={inputCls} value={form.occasion} onChange={set("occasion")} placeholder="e.g. Birthday dinner" />
          </Field>
          <Field label={`Deposit amount (${currency})`} error={errors.amount}>
            <input className={inputCls} type="number" inputMode="decimal" min={0} step="0.01" value={form.amount} onChange={set("amount")} placeholder="0.00" />
          </Field>
          <Field label="Paid by">
            <select className={inputCls} value={form.method} onChange={set("method")}>
              {METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          {form.method !== "cash" && (
            <Field label="Reference / approval no." error={errors.reference} wide>
              <input className={inputCls} value={form.reference} onChange={set("reference")} placeholder="From the card slip, bank or e-wallet" />
            </Field>
          )}
          <Field label="Notes on the receipt (optional)" wide>
            <input className={inputCls} value={form.notes} onChange={set("notes")} placeholder="e.g. Private room, cake brought by customer" />
          </Field>
          <Field label="Terms printed on the receipt" wide>
            <textarea className={`${inputCls} min-h-[84px] py-2`} value={form.terms} onChange={set("terms")} />
            <span className="mt-1 block text-xs text-gray-400">Remembered for this branch on this device.</span>
          </Field>
        </div>
      </Modal>

      {/* one receipt */}
      <Modal open={!!current} onClose={() => setViewing(null)} title={current?.receiptNo || "Receipt"} wide>
        {current && (
          <div className="grid gap-5 md:grid-cols-[auto_1fr]">
            <div className="overflow-x-auto rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="mx-auto w-[420px] shadow-sm">
                <ReceiptCard ref={cardRef} r={current} business={business} currency={currency} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Send to the customer</p>
                <button onClick={() => share("png")} disabled={!!busy} className="w-full min-h-[48px] rounded-xl bg-[#25D366] font-semibold text-white hover:brightness-95 disabled:opacity-50">
                  {busy === "png" ? "Making…" : "WhatsApp — image"}
                </button>
                <button onClick={() => share("pdf")} disabled={!!busy} className="w-full min-h-[48px] rounded-xl border border-[#25D366] font-semibold text-[#128C7E] hover:bg-green-50 disabled:opacity-50">
                  {busy === "pdf" ? "Making…" : "WhatsApp — PDF"}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => save1("png")} disabled={!!busy} className="min-h-[42px] rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    Download image
                  </button>
                  <button onClick={() => save1("pdf")} disabled={!!busy} className="min-h-[42px] rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    Download PDF
                  </button>
                </div>
                <p className="text-xs text-gray-400">On a phone, choose WhatsApp and the customer’s chat. On a computer the file is saved and their chat opens with a message.</p>
              </div>

              <div className="space-y-2 rounded-xl border border-gray-100 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Status</p>
                <p className="text-sm">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[current.status] || STATUS_STYLE.held}`}>{STATUSES[current.status]?.label}</span>
                  <span className="ml-2 text-gray-500">{STATUSES[current.status]?.hint}</span>
                </p>
                {current.statusNote && (
                  <p className="text-xs text-gray-500">
                    “{current.statusNote}” — {current.statusBy?.name || current.statusBy?.username}
                  </p>
                )}
                {canMark && (
                  <>
                    <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (needed to refund or cancel)" />
                    <div className="flex flex-wrap gap-2">
                      {current.status !== "used" && (
                        <button onClick={() => mark("used")} disabled={!!busy} className="min-h-[40px] rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-50">
                          Used on the bill
                        </button>
                      )}
                      {current.status !== "refunded" && (
                        <button onClick={() => mark("refunded")} disabled={!!busy} className="min-h-[40px] rounded-xl border border-sky-300 px-3 text-sm font-semibold text-sky-700 disabled:opacity-50">
                          Refunded
                        </button>
                      )}
                      {current.status !== "cancelled" && (
                        <button onClick={() => mark("cancelled")} disabled={!!busy} className="min-h-[40px] rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-600 disabled:opacity-50">
                          Cancel receipt
                        </button>
                      )}
                      {current.status !== "held" && (
                        <button onClick={() => mark("held")} disabled={!!busy} className="min-h-[40px] rounded-xl border border-amber-300 px-3 text-sm font-semibold text-amber-700 disabled:opacity-50">
                          Back to held
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
              {msg && <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{msg}</p>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
