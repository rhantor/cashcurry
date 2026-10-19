"use client";
// Vouchers sent back to the person who saved them (roadmap 4.9), shown on
// Cost Entry: add the invoice after all, or explain again and send it back
// for approval. The "Voucher sent back" notification opens straight here
// (?voucher=<id> marks the one it is about).
import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { FilePlus2, MessageSquareText, Undo2 } from "lucide-react";
import { Button, Card, Field, Input, Sheet, cn, toast } from "@/app/components/ui";
import ProofUpload from "@/app/components/entry/ProofUpload";
import { Chip } from "@/app/components/entry/Choices";
import { storage } from "@/lib/firebase";
import { formatMoney } from "@/lib/region/currency";
import useCurrency from "@/app/hooks/useCurrency";
import { NO_INVOICE_REASONS } from "@/lib/costs/vouchers";
import { addInvoiceToVoucher, resubmitVoucher, useMySentBackVouchers } from "@/lib/costs/client";
import { uploadCostFile } from "@/app/entry-data/cost-entry/logic/storageUpload";

const SHRINK = { maxMB: 0.6, maxSide: 1600 };

/** Add the invoice that turned up, or give a better reason. */
function FixSheet({ cost, mode, onClose, companyId, branchId, user }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [progress, setProgress] = useState(0);
  const [reason, setReason] = useState(cost?.voucher?.reason || "");
  const [busy, setBusy] = useState(false);
  if (!cost) return null;

  const save = async () => {
    setBusy(true);
    try {
      if (mode === "invoice") {
        if (!file) return toast.warning("Add a photo or PDF of the invoice");
        const url = await uploadCostFile({ storage, file, companyId, branchId, resolvedCategory: cost.category, paidFromOffice: cost.paidFromOffice, date: cost.date, onProgress: setProgress });
        await addInvoiceToVoucher(companyId, branchId, cost, user, url);
        toast.success("Invoice added", { description: "The voucher is closed." });
      } else {
        if (!reason.trim()) return toast.warning("Say why there is no invoice");
        await resubmitVoucher(companyId, branchId, cost.id, user, reason);
        toast.success("Sent for approval again");
      }
      onClose();
    } catch (e) {
      toast.error("Couldn't save", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={!!cost}
      onClose={onClose}
      title={mode === "invoice" ? "Add the invoice" : "Explain again"}
      description={cost.voucher?.note ? `Sent back: “${cost.voucher.note}”` : "Sent back for a better reason or the invoice."}
      footer={<Button onClick={save} loading={busy}>{mode === "invoice" ? "Add invoice" : "Send for approval"}</Button>}
    >
      {mode === "invoice" ? (
        <ProofUpload label="Invoice" pdf shrink={SHRINK} file={file} preview={preview} progress={progress} onPick={(f, url) => { setFile(f); setPreview(url); }} onRemove={() => { setFile(null); setPreview(null); }} />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {NO_INVOICE_REASONS.map((r) => <Chip key={r} on={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}
          </div>
          <Field label="Why there is no invoice">{({ id }) => <Input id={id} size="lg" value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        </div>
      )}
    </Sheet>
  );
}

export default function SentBackVouchers({ companyId, branchId, user }) {
  const currency = useCurrency();
  const list = useMySentBackVouchers(companyId, branchId, user?.uid);
  const [fixing, setFixing] = useState(null); // { cost, mode }
  const [marked, setMarked] = useState(null);
  const box = useRef(null);

  // Opened from the notification: show which one it is about
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("voucher");
    if (id) setMarked(id);
  }, []);
  useEffect(() => {
    if (marked && list.some((c) => c.id === marked)) box.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [marked, list]);

  if (!list.length) return null;
  return (
    <section ref={box} className="mx-auto mb-4 max-w-6xl space-y-2 px-4 pt-4 sm:px-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <Undo2 className="size-4 text-warning" /> Sent back to you ({list.length})
      </h2>
      {list.map((c) => (
        <Card key={c.id} className={cn("overflow-hidden border-warning/40", marked === c.id && "ring-2 ring-warning")}>
          <div className="space-y-1 p-4">
            <p className="text-sm font-semibold text-fg">{formatMoney(c.amount, currency)} · {c.category || "Cost"}{c.paidTo ? ` · ${c.paidTo}` : ""}</p>
            <p className="text-xs text-muted">{c.date ? format(parseISO(c.date), "EEE d MMM") : ""} · your reason: “{c.voucher?.reason || "—"}”</p>
            <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-fg">
              {c.voucher?.decidedBy?.name || "A manager"}: {c.voucher?.note || "no reason given"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line bg-surface-2/40 px-4 py-3">
            <Button size="sm" icon={FilePlus2} onClick={() => setFixing({ cost: c, mode: "invoice" })} className="flex-1 sm:flex-none">Add the invoice</Button>
            <Button size="sm" variant="secondary" icon={MessageSquareText} onClick={() => setFixing({ cost: c, mode: "reason" })} className="flex-1 sm:flex-none">Explain again</Button>
          </div>
        </Card>
      ))}
      {fixing && <FixSheet key={fixing.cost.id + fixing.mode} cost={fixing.cost} mode={fixing.mode} onClose={() => setFixing(null)} companyId={companyId} branchId={branchId} user={user} />}
    </section>
  );
}
