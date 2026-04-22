/* eslint-disable react/prop-types */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import imageCompression from "browser-image-compression";
import { format } from "date-fns";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useUpdateSalesEntryMutation } from "@/lib/redux/api/salesApiSlice";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { getCurrentUser, hasRole, ALLOWED_EDIT_ROLES } from "@/lib/authz/roles";

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

const fmt = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

export default function SalesEditModal({
  item,
  branchData,
  companyId,
  branchId,
  onClose,
}) {
  const currentUser = getCurrentUser();
  const canEdit = hasRole(currentUser, ALLOWED_EDIT_ROLES);

  // Pull branch tender settings here so we can show *all* configured tenders
  const { data: settings } = useGetBranchSettingsQuery(
    { companyId, branchId },
    { skip: !companyId || !branchId }
  );

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
        includeInTotal:
          snap?.includeInTotal !== undefined
            ? !!snap.includeInTotal
            : s.includeInTotal !== false,
        requireProof:
          snap?.requireProof !== undefined
            ? !!snap.requireProof
            : !!s.requireProof,
        order:
          snap?.order !== undefined && snap.order !== null
            ? snap.order
            : s.order ?? 9999,
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
          order: snap.order ?? 9999,
        });
      }
    });

    // sort by order
    merged.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    return merged;
  }, [baselineFromSettings, item?.tenderMeta]);

  // Local state (date, form, notes) must include *all* tender keys
  const initialDate = useMemo(() => {
    try {
      const d = new Date(item.date);
      return !isNaN(d) ? d.toISOString().slice(0, 10) : item.date;
    } catch {
      return item.date;
    }
  }, [item?.date]);

  const [date, setDate] = useState(initialDate);

  const [form, setForm] = useState(() => {
    const f = {};
    tenders.forEach((t) => (f[t.key] = item?.[t.key] ?? ""));
    return f;
  });
  const [notes, setNotes] = useState(() => {
    const n = { ...(item?.notes || {}) };
    tenders.forEach((t) => {
      if (!(t.key in n)) n[t.key] = ""; // ensure note field exists
    });
    return n;
  });

  // Re-initialize when tenders finish loading/merging
  useEffect(() => {
    setForm((prev) => {
      const next = {};
      tenders.forEach(
        (t) => (next[t.key] = prev?.[t.key] ?? item?.[t.key] ?? "")
      );
      return next;
    });
    setNotes((prev) => {
      const next = { ...(prev || {}) };
      tenders.forEach((t) => {
        if (!(t.key in next)) next[t.key] = item?.notes?.[t.key] ?? "";
      });
      return next;
    });
  }, [tenders, item]);

  // Z-report file upload (optional replacement)
  const [zReportFile, setZReportFile] = useState(null);
  const [zReportPreview, setZReportPreview] = useState(
    item?.zReportUrl || null
  );
  const [zReportUrl, setZReportUrl] = useState(item?.zReportUrl || null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const TARGET_MAX_MB = 1.2;
  const HARD_LIMIT_MB = 3;
  const MAX_DIMENSION = 2200;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith("image/")) return;

    try {
      let working = file;
      if (file.size > TARGET_MAX_MB * 1024 * 1024) {
        working = await imageCompression(file, {
          maxSizeMB: TARGET_MAX_MB,
          maxWidthOrHeight: MAX_DIMENSION,
          useWebWorker: true,
        });
      }
      if (working.size > HARD_LIMIT_MB * 1024 * 1024) {
        alert(
          `Image is too large (${(working.size / 1024 / 1024).toFixed(
            2
          )} MB). Max is ${HARD_LIMIT_MB} MB.`
        );
        return;
      }
      setZReportFile(working);
      setZReportPreview(URL.createObjectURL(working));
      setUploadProgress(0);
    } catch (err) {
      console.error("compression failed", err);
      alert("Failed to process image. Try another file.");
    }
  };

  const uploadZReport = () => {
    if (!zReportFile || !companyId || !branchId) return null;

    const extRaw = (zReportFile.type?.split("/")[1] || "jpg").replace(
      "jpeg",
      "jpg"
    );
    const ext = ["png", "jpg", "webp"].includes(extRaw) ? extRaw : "jpg";
    const filePath = `zReports/${companyId}/${branchId}/${date}.${ext}`;
    const storageRef = ref(storage, filePath);
    const metadata = {
      contentType:
        zReportFile.type || (ext === "png" ? "image/png" : "image/jpeg"),
      cacheControl: "public, max-age=31536000",
    };

    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, zReportFile, metadata);
      task.on(
        "state_changed",
        (snap) => {
          const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
          setUploadProgress(pct);
        },
        (err) => reject(err),
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        }
      );
    });
  };

  // number validation handlers
  const handleAmountChange = (key, val) => {
    const n = parseFloat(val);
    if (!isNaN(n) && n >= 0) setForm((p) => ({ ...p, [key]: val }));
    else if (val === "") setForm((p) => ({ ...p, [key]: "" }));
  };

  const [openNote, setOpenNote] = useState(null);
  const handleNoteChange = (key, val) =>
    setNotes((p) => ({ ...p, [key]: val }));

  // totals & proof rule based on *merged* tenders
  const total = useMemo(() => {
    const cents = tenders
      .filter((t) => t.includeInTotal !== false)
      .reduce(
        (sum, t) => sum + Math.round((parseFloat(form[t.key]) || 0) * 100),
        0
      );
    return cents / 100;
  }, [tenders, form]);

  const proofRequired = useMemo(
    () =>
      tenders.some((t) => t.requireProof && (parseFloat(form[t.key]) || 0) > 0),
    [tenders, form]
  );

  const branchTitle = Array.isArray(branchData)
    ? branchData.map((b) => b.name).join(", ")
    : branchData?.name || "Branch";

  const [updateSales, { isLoading: updating, error: updateError }] =
    useUpdateSalesEntryMutation();

  const onSave = async () => {
    if (!canEdit) {
      alert("You don't have permission to edit.");
      return;
    }
    if (proofRequired && !(zReportFile || zReportUrl)) {
      alert("Proof required. Please attach a Z Report image.");
      return;
    }

    try {
      let finalUrl = zReportUrl || null;
      if (zReportFile) {
        finalUrl = await uploadZReport();
        setZReportUrl(finalUrl);
      }

      const patch = {
        date,
        ...form,
        notes,
        total,
        zReportUrl: finalUrl,
        // keep tenderMeta as-is on the document (snapshot stays stable)
      };

      await updateSales({
        companyId,
        branchId,
        saleId: item.id,
        patch,
        currentUser,
      }).unwrap();

      onClose?.();
    } catch (err) {
      console.error("Update failed", err);
      alert("❌ Failed to update. Please try again.");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold">{branchTitle}</h2>
            <p className="text-xs text-gray-500">
              Editing:{" "}
              {item?.date ? format(new Date(item.date), "dd/MM/yyyy") : "-"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {!canEdit && (
          <div className="mb-3 text-xs text-gray-700 bg-gray-50 border rounded p-2">
            Only managers, branch admins, or accountants can edit.
          </div>
        )}

        {/* Date */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Date
          </label>
          <input
            type="date"
            value={date || ""}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-lg border p-2 text-sm"
          />
        </div>

        {/* Dynamic tenders (ALL configured + snapshot) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tenders.map((t) => (
            <div key={t.key} className="bg-white border rounded-lg p-3">
              <label className="block text-sm font-medium text-gray-600">
                {t.label}
                {t.requireProof ? (
                  <span className="ml-2 text-[10px] text-mint-600 uppercase">
                    requires proof
                  </span>
                ) : null}
              </label>

              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form[t.key] ?? ""}
                  onChange={(e) => handleAmountChange(t.key, e.target.value)}
                  className="mt-1 w-full rounded-lg border p-2 text-sm text-gray-700"
                />
                <button
                  type="button"
                  onClick={() => setOpenNote(openNote === t.key ? null : t.key)}
                  className="mt-1 px-2 py-1 rounded bg-mint-100 hover:bg-mint-200 text-mint-700 text-xs"
                  title="Add note"
                >
                  📝
                </button>
              </div>

              {openNote === t.key && (
                <textarea
                  placeholder="Add a note"
                  value={notes[t.key] ?? ""}
                  onChange={(e) => handleNoteChange(t.key, e.target.value)}
                  className="mt-2 w-full rounded-lg border p-2 text-xs text-gray-700"
                />
              )}
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="bg-green-50 rounded-lg border mt-4 mb-3 p-3 text-center">
          <p className="text-gray-500 text-xs">Total</p>
          <p className="text-xl font-bold text-green-600">{fmt(total)}</p>
        </div>

        {/* Z Report Upload / Preview */}
        <div className="border rounded-lg p-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Z Report (optional)
          </label>

          <div className="flex items-center gap-3">
            <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-mint-100 hover:bg-mint-200 rounded-lg text-mint-700 text-sm">
              <span>Choose Image</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg,image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {zReportPreview ? (
              <a
                href={zReportPreview}
                target="_blank"
                rel="noreferrer"
                title="Open full size"
              >
                <img
                  src={zReportPreview}
                  alt="Z Report"
                  className="w-16 h-16 object-cover rounded border"
                />
              </a>
            ) : (
              <span className="text-xs text-gray-500">No file selected</span>
            )}
          </div>

          {zReportFile && (
            <div className="mt-2 text-xs text-gray-600">
              New file ready to upload
            </div>
          )}

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-mint-500 h-2 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                {uploadProgress.toFixed(0)}%
              </p>
            </div>
          )}

          <p className="mt-2 text-[11px] text-gray-500">
            Images auto-compress to ~1.2 MB (max after compression 3 MB).
          </p>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={
              !canEdit ||
              updating ||
              (uploadProgress > 0 && uploadProgress < 100)
            }
            className={`px-4 py-2 rounded-lg text-white text-sm ${
              !canEdit ||
              updating ||
              (uploadProgress > 0 && uploadProgress < 100)
                ? "bg-mint-300 cursor-not-allowed"
                : "bg-mint-500 hover:bg-mint-600"
            }`}
          >
            {updating
              ? "Saving..."
              : uploadProgress > 0 && uploadProgress < 100
              ? "Uploading..."
              : "Save Changes"}
          </button>
        </div>

        {updateError && (
          <p className="text-red-600 text-xs mt-2">
            ❌ Failed to update. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}
