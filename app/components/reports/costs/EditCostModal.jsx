"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { parseISO, format, isValid } from "date-fns";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useUpdateCostEntryMutation } from "@/lib/redux/api/costApiSlice";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { Button, DatePicker, Field, Input, Sheet, Textarea, toast } from "@/app/components/ui";
import MoneyInput from "@/app/components/entry/MoneyInput";
import ProofUpload from "@/app/components/entry/ProofUpload";
import { Chip, PaidFromChoice } from "@/app/components/entry/Choices";
import { CATEGORIES, BACK_OFFICE_METHODS } from "@/app/entry-data/cost-entry/logic/constants";

const SHRINK = { maxMB: 0.5, maxSide: 1024 };
const toDay = (v) => {
  const d = typeof v === "string" ? parseISO(v) : v ? new Date(v) : new Date();
  return format(isValid(d) ? d : new Date(), "yyyy-MM-dd");
};

/**
 * Change a cost from the report: day, amount, till or bank (and how), what
 * for, note, invoice and payment receipt. Attachments are kept in step the
 * way the viewers and exports read them (see the comments in save).
 * Props as before: cost, onClose, onSuccess.
 */
export default function EditCostModal({ cost, onClose, onSuccess }) {
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);
  const { companyId, branchId } = useResolvedCompanyBranch();
  const [updateCostEntry, { isLoading: isUpdating }] = useUpdateCostEntryMutation();

  const known = CATEGORIES.includes(cost?.category);
  const [date, setDate] = useState(() => toDay(cost?.date));
  const [amount, setAmount] = useState(cost?.amount != null ? String(cost.amount) : "");
  const [category, setCategory] = useState(cost?.category ? (known ? cost.category : "Other") : "");
  const [customCategory, setCustomCategory] = useState(cost?.category && !known ? cost.category : "");
  const [description, setDescription] = useState(cost?.description || "");
  const [paidFromOffice, setPaidFromOffice] = useState(cost?.paidFromOffice || "front");
  const [paidMethod, setPaidMethod] = useState(cost?.paidMethod || "cash");

  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(cost?.fileURL || null);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Optional proof of payment. Only entries that carry an explicit
  // `receiptURL` are treated as having one — a vendor-bill cost stores several
  // invoices in `attachments` with no receipt among them, and guessing at the
  // last element there would let the user overwrite an invoice.
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(cost?.receiptURL || null);
  const [receiptProgress, setReceiptProgress] = useState(0);
  const [receiptRemoved, setReceiptRemoved] = useState(false);
  const [busy, setBusy] = useState(false);

  const resolvedCategory = useMemo(() => (category === "Other" ? (customCategory || "Other").trim() : category), [category, customCategory]);

  const setOffice = (o) => {
    setPaidFromOffice(o);
    // keep the method in step with the office
    if (o === "front") setPaidMethod("cash");
    else if (paidMethod === "cash") setPaidMethod("");
  };

  const uploadFile = (target, onProgress, kind = "invoice") => {
    if (!target || !companyId || !branchId) return null;
    const ext = target.name.split(".").pop();
    const safeCategory = (resolvedCategory || "uncategorized").replace(/[^\w-]+/g, "_");
    const officeFolder = paidFromOffice === "front" ? "front" : "back";
    const kindFolder = kind === "receipt" ? "receipts/" : "";
    const task = uploadBytesResumable(ref(storage, `costs/${companyId}/${branchId}/${safeCategory}/${officeFolder}/${kindFolder}${Date.now()}.${ext}`), target);
    return new Promise((resolve, reject) => {
      task.on("state_changed", (s) => onProgress((s.bytesTransferred / s.totalBytes) * 100), reject, async () => resolve(await getDownloadURL(task.snapshot.ref)));
    });
  };

  const handleSave = async () => {
    if (!(Number(amount) > 0)) return toast.warning("Enter the amount");
    if (!resolvedCategory) return toast.warning("Pick what this cost was for");
    if (category === "Other" && !customCategory.trim()) return toast.warning("Give the category a name");
    if (paidFromOffice === "back" && !paidMethod) return toast.warning("Pick how it was paid");
    setBusy(true);
    try {
      // Viewers and exports read `attachments` in preference to `fileURL`, so
      // every change has to be mirrored into the array by identity — otherwise
      // the report keeps showing the old file. Anything we did not touch
      // (a vendor-bill cost carries several invoices here) is left alone.
      let fileURL = cost?.fileURL;
      let receiptURL = cost?.receiptURL || null;
      let attachments = Array.isArray(cost?.attachments) ? [...cost.attachments] : null;

      if (file) {
        const newURL = await uploadFile(file, setUploadProgress, "invoice");
        if (attachments) {
          const i = attachments.indexOf(cost?.fileURL);
          if (i >= 0) attachments[i] = newURL;
          else attachments = [newURL, ...attachments];
        }
        fileURL = newURL;
      }
      if (receiptFile) {
        const newURL = await uploadFile(receiptFile, setReceiptProgress, "receipt");
        if (attachments) {
          const i = receiptURL ? attachments.indexOf(receiptURL) : -1;
          if (i >= 0) attachments[i] = newURL;
          else attachments.push(newURL);
        }
        receiptURL = newURL;
      } else if (receiptRemoved) {
        if (attachments && receiptURL) attachments = attachments.filter((u) => u !== receiptURL);
        receiptURL = null;
      }
      // Entry pre-dates the attachments array — build one now that it holds more than a single file.
      if (!attachments && receiptURL) attachments = [fileURL, receiptURL].filter(Boolean);

      const data = {
        date,
        amount: Number(amount),
        category: resolvedCategory,
        description: description?.trim() || "",
        fileURL: fileURL || null,
        receiptURL: receiptURL || null,
        ...(attachments ? { attachments } : {}),
        paidFromOffice,
        paidMethod: paidFromOffice === "front" ? "cash" : paidMethod,
        isFrontOffice: paidFromOffice === "front",
        isBackOffice: paidFromOffice === "back",
        updatedAt: new Date().toISOString(),
      };
      await updateCostEntry({ companyId, branchId, costId: cost.id, data }).unwrap();
      toast.success("Cost updated", { description: `${resolvedCategory} · ${money(amount)}` });
      onSuccess?.();
    } catch (err) {
      console.error("Update failed:", err);
      toast.error("Couldn't update the cost", { description: "Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  const uploading = (uploadProgress > 0 && uploadProgress < 100) || (receiptProgress > 0 && receiptProgress < 100);

  return (
    <Sheet
      open
      onClose={onClose}
      title="Change cost"
      description={cost?.date ? format(parseISO(toDay(cost.date)), "EEE, d MMM yyyy") : undefined}
      footer={
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-subtle">{resolvedCategory || "Cost"}</p>
            <p className="truncate text-lg font-bold tabular-nums text-fg">{money(amount || 0)}</p>
          </div>
          <Button variant="ghost" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" onClick={handleSave} loading={(busy || isUpdating) && !uploading} disabled={uploading}>
            {uploading ? "Uploading…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Day">{() => <DatePicker size="lg" value={date} onChange={setDate} />}</Field>
        <Field label="Amount">{({ id }) => <MoneyInput id={id} currency={currency} value={amount} onValueChange={setAmount} />}</Field>
      </div>

      <p className="mb-2 mt-5 text-xs font-semibold text-muted">Paid from</p>
      <PaidFromChoice value={paidFromOffice} onChange={setOffice} bankNote="Card, QR, online, transfer" />
      <AnimatePresence initial={false}>
        {paidFromOffice === "back" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-3 flex flex-wrap gap-2">
              {BACK_OFFICE_METHODS.map((m) => (
                <Chip key={m.value} on={paidMethod === m.value} onClick={() => setPaidMethod(m.value)}>
                  {m.label}
                </Chip>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mb-2 mt-5 text-xs font-semibold text-muted">What for</p>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Chip key={c} on={category === c} onClick={() => setCategory(c)}>
            {c}
          </Chip>
        ))}
      </div>
      {category === "Other" && (
        <Field label="Name the category" className="mt-3">
          {({ id }) => <Input id={id} size="lg" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="e.g. Pest control" />}
        </Field>
      )}

      <Field label="Note" className="mt-5">
        {({ id }) => <Textarea id={id} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />}
      </Field>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <ProofUpload
          label="Invoice"
          pdf
          pageDrop={false}
          shrink={SHRINK}
          file={file}
          preview={filePreview}
          progress={uploadProgress}
          onPick={(f, url) => {
            setFile(f);
            setFilePreview(url);
          }}
          onRemove={() => {
            setFile(null);
            setFilePreview(cost?.fileURL || null);
          }}
        />
        <ProofUpload
          label="Payment receipt"
          pdf
          pageDrop={false}
          shrink={SHRINK}
          file={receiptFile}
          preview={receiptPreview}
          progress={receiptProgress}
          onPick={(f, url) => {
            setReceiptFile(f);
            setReceiptPreview(url);
            setReceiptRemoved(false);
          }}
          onRemove={() => {
            setReceiptFile(null);
            setReceiptPreview(null);
            setReceiptRemoved(true);
            setReceiptProgress(0);
          }}
        />
      </div>
    </Sheet>
  );
}
