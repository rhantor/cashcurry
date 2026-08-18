"use client";
import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle, XCircle, Info } from "lucide-react";

const ICONS = { ok: CheckCircle, error: XCircle, info: Info };
const TONES = {
  ok: "bg-mint-600",
  error: "bg-red-600",
  info: "bg-slate-800",
};

/**
 * Small toast to replace `alert()` on the purchase screens.
 *
 * `alert()` blocks the whole page until dismissed, which on a phone means a
 * system dialog covering the order the user was halfway through. A toast says
 * the same thing without stealing the screen. Errors stay up longer, since
 * those are the ones worth reading.
 */
export default function useToast() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const ms = toast.type === "error" ? 6000 : 3500;
    const t = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(t);
  }, [toast]);

  const show = useCallback((msg, type = "ok") => {
    setToast({ msg, type, id: Date.now() });
  }, []);

  const toastOk = useCallback((msg) => show(msg, "ok"), [show]);
  const toastError = useCallback((msg) => show(msg, "error"), [show]);
  const toastInfo = useCallback((msg) => show(msg, "info"), [show]);

  const Icon = toast ? ICONS[toast.type] || Info : null;

  const toastNode = toast ? (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2rem)] max-w-sm
                 bottom-[max(1.25rem,env(safe-area-inset-bottom))]
                 animate-in slide-in-from-bottom-4 fade-in duration-200"
    >
      <div
        className={`${TONES[toast.type] || TONES.info} text-white rounded-2xl shadow-2xl
                    px-4 py-3.5 flex items-start gap-3`}
      >
        <Icon className="w-5 h-5 shrink-0 mt-0.5" />
        <span className="text-[15px] font-medium leading-snug whitespace-pre-line">{toast.msg}</span>
      </div>
    </div>
  ) : null;

  return { toastOk, toastError, toastInfo, toastNode };
}
