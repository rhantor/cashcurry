"use client";
import React, { useEffect, useState } from "react";
import Sheet from "./Sheet";

/**
 * Replaces window.confirm / window.prompt for the purchase screens.
 *
 * Beyond looking like the rest of the app, this matters on mobile: several
 * browsers suppress `prompt()` outright, and a suppressed prompt silently
 * cancels the action with no explanation. Set `requireReason` to collect text
 * (rejecting an order, for instance) without that risk.
 */
export default function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  requireReason = false,
  reasonLabel = "Reason",
  reasonPlaceholder = "",
  busy = false,
  onConfirm,
  onClose,
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const blocked = requireReason && !reason.trim();

  const confirmTone =
    tone === "danger"
      ? "bg-red-600 active:bg-red-700"
      : tone === "warn"
      ? "bg-amber-600 active:bg-amber-700"
      : "bg-brand active:brightness-95";

  return (
    <Sheet
      open={open}
      title={title}
      onClose={onClose}
      maxWidth="max-w-md"
      footer={
        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button
            onClick={onClose}
            className="min-h-[48px] px-5 rounded-2xl font-semibold text-fg bg-surface-2
                       active:bg-surface-2 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onConfirm?.(reason.trim())}
            disabled={blocked || busy}
            className={`min-h-[48px] px-5 rounded-2xl font-semibold text-white ${confirmTone}
                        disabled:opacity-50 transition-colors`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      }
    >
      {message && <p className="text-[15px] leading-relaxed text-muted">{message}</p>}

      {requireReason && (
        <div className="mt-4">
          <label className="block text-sm font-semibold text-fg mb-1.5">{reasonLabel}</label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
            autoFocus
            className="w-full p-3 text-[15px] border border-line rounded-2xl bg-surface-2/60
                       focus:bg-surface focus:border-brand focus:ring-2 focus:ring-[var(--cc-ring)]/20
                       outline-none transition-colors"
          />
        </div>
      )}
    </Sheet>
  );
}
