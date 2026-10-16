"use client";
import { dayKey } from "@/lib/finance/rules";
import React, { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Landmark, NotebookPen, Wallet } from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useUpdateSalesEntryMutation } from "@/lib/redux/api/salesApiSlice";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { hasRole, ALLOWED_EDIT_ROLES } from "@/lib/authz/roles";
import { getSessionUser } from "@/lib/session";
import { Badge, Button, DatePicker, Field, Input, Sheet, cn, toast } from "@/app/components/ui";
import MoneyInput from "@/app/components/entry/MoneyInput";
import ProofUpload from "@/app/components/entry/ProofUpload";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";

// Fallback tenders if no settings found
const DEFAULT_TENDERS = [
  { key: "cash", label: "Cash", includeInTotal: true, order: 1 },
  { key: "card", label: "Card", includeInTotal: true, order: 2 },
  { key: "qr", label: "QR", includeInTotal: true, order: 3 },
  { key: "grab", label: "Grab", includeInTotal: true, order: 4 },
  { key: "foodpanda", label: "Foodpanda", includeInTotal: true, order: 5 },
  { key: "online", label: "Online", includeInTotal: true, order: 6 },
  { key: "cheque", label: "Cheque", includeInTotal: true, order: 7 },
];

/**
 * Change one day's sales from the report: the day, each payment type (with
 * notes), the Z report photo. Every payment type set up for the branch shows,
 * plus any the entry had then. Moving it to a day that already has sales is
 * refused (the day would count twice).
 */
export default function SalesEditModal({ item, branchData, companyId, branchId, onClose }) {
  const currentUser = getSessionUser();
  const canEdit = hasRole(currentUser, ALLOWED_EDIT_ROLES);
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);

  // Pull branch tender settings here so we can show *all* configured tenders
  const { data: settings } = useGetBranchSettingsQuery({ companyId, branchId }, { skip: !companyId || !branchId });

  // 1) Build baseline from settings (enabled tenders)
  const baselineFromSettings = useMemo(() => {
    const list = settings?.financeSales?.tenders || [];
    const enabled = list
      .filter((t) => t.enabled !== false)
      .map((t) => ({
        key: t.key,
        label: t.label ?? t.key,
        includeInTotal: t.includeInTotal !== false,
        requireProof: !!t.requireProof,
        banked: !!t.banked,
        order: t.order ?? 9999,
      }));
    return enabled.length ? enabled : DEFAULT_TENDERS;
  }, [settings]);

  // 2) Merge with snapshot (item.tenderMeta) so we preserve labels/flags if they existed then
  const tenders = useMemo(() => {
    const snapshot = Array.isArray(item?.tenderMeta) ? item.tenderMeta : [];
    const byKeySnap = new Map(snapshot.map((t) => [t.key, t]));
    // start from settings baseline (this guarantees all configured tenders appear)
    const merged = baselineFromSettings.map((s) => {
      const snap = byKeySnap.get(s.key);
      return {
        key: s.key,
        label: snap?.label ?? s.label ?? s.key,
        includeInTotal: snap?.includeInTotal !== undefined ? !!snap.includeInTotal : s.includeInTotal !== false,
        requireProof: snap?.requireProof !== undefined ? !!snap.requireProof : !!s.requireProof,
        banked: snap?.banked !== undefined ? !!snap.banked : !!s.banked,
        order: snap?.order !== undefined && snap.order !== null ? snap.order : s.order ?? 9999,
      };
    });
    // also include any snapshot tenders that are not in settings (legacy keys)
    snapshot.forEach((snap) => {
      if (!merged.find((m) => m.key === snap.key)) {
        merged.push({
          key: snap.key,
          label: snap.label ?? snap.key,
          includeInTotal: snap.includeInTotal !== false,
          requireProof: !!snap.requireProof,
          banked: !!snap.banked,
          order: snap.order ?? 9999,
        });
      }
    });
    merged.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    return merged;
  }, [baselineFromSettings, item?.tenderMeta]);

  // Local state (date, form, notes) must include *all* tender keys
  const initialDate = useMemo(() => {
    try {
      return dayKey(item.date) || item.date;
    } catch {
      return item.date;
    }
  }, [item?.date]);
  const [date, setDate] = useState(initialDate);
  const [form, setForm] = useState(() => Object.fromEntries(tenders.map((t) => [t.key, item?.[t.key] ?? ""])));
  const [notes, setNotes] = useState(() => {
    const n = { ...(item?.notes || {}) };
    tenders.forEach((t) => {
      if (!(t.key in n)) n[t.key] = ""; // ensure note field exists
    });
    return n;
  });

  // Re-initialize when tenders finish loading/merging
  useEffect(() => {
    setForm((prev) => Object.fromEntries(tenders.map((t) => [t.key, prev?.[t.key] ?? item?.[t.key] ?? ""])));
    setNotes((prev) => {
      const next = { ...(prev || {}) };
      tenders.forEach((t) => {
        if (!(t.key in next)) next[t.key] = item?.notes?.[t.key] ?? "";
      });
      return next;
    });
  }, [tenders, item]);

  // Z report photo (optional replacement)
  const [zReportFile, setZReportFile] = useState(null);
  const [zReportPreview, setZReportPreview] = useState(item?.zReportUrl || null);
  const [zReportUrl, setZReportUrl] = useState(item?.zReportUrl || null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [openNote, setOpenNote] = useState(null);
  const [busy, setBusy] = useState(false);

  const uploadZReport = () => {
    if (!zReportFile || !companyId || !branchId) return null;
    const extRaw = (zReportFile.type?.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const ext = ["png", "jpg", "webp"].includes(extRaw) ? extRaw : "jpg";
    const storageRef = ref(storage, `zReports/${companyId}/${branchId}/${date}.${ext}`);
    const metadata = { contentType: zReportFile.type || (ext === "png" ? "image/png" : "image/jpeg"), cacheControl: "public, max-age=31536000" };
    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, zReportFile, metadata);
      task.on("state_changed", (snap) => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100), reject, async () =>
        resolve(await getDownloadURL(task.snapshot.ref))
      );
    });
  };

  // totals & proof rule based on *merged* tenders
  const total = useMemo(
    () => tenders.filter((t) => t.includeInTotal !== false).reduce((sum, t) => sum + Math.round((parseFloat(form[t.key]) || 0) * 100), 0) / 100,
    [tenders, form]
  );
  const proofRequired = useMemo(() => tenders.some((t) => t.requireProof && (parseFloat(form[t.key]) || 0) > 0), [tenders, form]);

  const [updateSales, { isLoading: updating }] = useUpdateSalesEntryMutation();

  const onSave = async () => {
    if (!canEdit) return toast.warning("You can't change sales", { description: "Ask a manager." });
    if (proofRequired && !(zReportFile || zReportUrl)) return toast.warning("A Z report photo is needed for these payment types");
    setBusy(true);
    try {
      // another entry already on the new day? then the day would count twice
      if (date !== initialDate) {
        const snap = await getDocs(query(collection(db, "companies", companyId, "branches", branchId, "sales"), where("date", "==", date)));
        if (snap.docs.some((d) => d.id !== item.id)) {
          toast.error("That day already has sales", { description: "Change that day's entry instead." });
          return;
        }
      }
      let finalUrl = zReportUrl || null;
      if (zReportFile) {
        finalUrl = await uploadZReport();
        setZReportUrl(finalUrl);
      }
      // keep tenderMeta as-is on the document (snapshot stays stable)
      const patch = { date, ...form, notes, total, zReportUrl: finalUrl };
      await updateSales({ companyId, branchId, saleId: item.id, patch, currentUser }).unwrap();
      toast.success("Sales updated", { description: `${format(parseISO(date), "EEE, d MMM")} · ${money(total)}` });
      onClose?.();
    } catch (err) {
      console.error("Update failed", err);
      toast.error("Couldn't update the sales", { description: "Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  const uploading = uploadProgress > 0 && uploadProgress < 100;
  const branchTitle = Array.isArray(branchData) ? branchData.map((b) => b.name).join(", ") : branchData?.name || "Branch";

  return (
    <Sheet
      open
      onClose={onClose}
      title="Change sales"
      description={`${branchTitle} · ${initialDate ? format(parseISO(initialDate), "EEE, d MMM yyyy") : ""}`}
      footer={
        <>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">New total</p>
            <p className="truncate text-lg font-bold tabular-nums text-fg">{money(total)}</p>
          </div>
          <Button variant="ghost" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" onClick={onSave} loading={(busy || updating) && !uploading} disabled={!canEdit || uploading}>
            {uploading ? `Uploading ${Math.round(uploadProgress)}%` : "Save"}
          </Button>
        </>
      }
    >
      {!canEdit && <p className="mb-4 rounded-xl bg-warning-soft px-3 py-2 text-xs text-fg">You can look, but only a manager can change sales.</p>}
      <Field label="Day">{() => <DatePicker size="lg" value={date} onChange={setDate} />}</Field>

      <div className="mt-5 grid gap-x-4 gap-y-4 sm:grid-cols-2">
        {tenders.map((t) => (
          <div key={t.key}>
            <div className="mb-1.5 flex items-center gap-1.5">
              <label htmlFor={`edit-${t.key}`} className="text-xs font-semibold text-muted">
                {t.label}
              </label>
              {t.key === "cash" ? <Wallet className="size-3 text-brand" /> : t.banked ? <Landmark className="size-3 text-info" /> : null}
              {t.requireProof && <Badge tone="warning">Photo needed</Badge>}
              {t.includeInTotal === false && <Badge>Not in total</Badge>}
              <button
                type="button"
                onClick={() => setOpenNote(openNote === t.key ? null : t.key)}
                aria-label={`Note for ${t.label}`}
                className={cn("ml-auto rounded-lg p-1 transition", notes[t.key] ? "text-brand" : "text-subtle hover:bg-surface-2 hover:text-fg")}
              >
                <NotebookPen className="size-3.5" />
              </button>
            </div>
            <MoneyInput id={`edit-${t.key}`} currency={currency} value={form[t.key]} onValueChange={(v) => setForm((p) => ({ ...p, [t.key]: v }))} />
            <AnimatePresence initial={false}>
              {(openNote === t.key || notes[t.key]) && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <Input
                    className="mt-2 h-9 text-xs"
                    placeholder={`Note for ${t.label}…`}
                    value={notes[t.key] ?? ""}
                    onChange={(e) => setNotes((p) => ({ ...p, [t.key]: e.target.value }))}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <ProofUpload
          label="Z report photo"
          pageDrop={false}
          preview={zReportPreview}
          progress={uploadProgress}
          required={proofRequired}
          onPick={(file, url) => {
            setZReportFile(file);
            setZReportPreview(url);
            setUploadProgress(0);
          }}
          onRemove={() => {
            setZReportFile(null);
            setZReportPreview(null);
            setZReportUrl(null);
          }}
        />
      </div>
    </Sheet>
  );
}
