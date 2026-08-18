/* eslint-disable react/prop-types */
"use client";
import React, { useEffect } from "react";
import { X } from "lucide-react";

/**
 * A dialog that behaves like a native bottom sheet on a phone and a centred
 * modal on a desktop.
 *
 * The purchase screens are used one-handed on a phone or a tablet in a stock
 * room, so the two things that matter are that the title and the confirm button
 * never scroll away, and that everything you have to hit is a real thumb-sized
 * target. `header` and `footer` are pinned; only `children` scrolls.
 */
export default function Sheet({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth = "max-w-3xl",
}) {
  // A sheet covering the screen while the page behind it still scrolls is
  // disorienting on touch, so freeze the body while one is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidth} bg-white flex flex-col
                    h-[92vh] rounded-t-3xl
                    sm:h-auto sm:max-h-[88vh] sm:rounded-3xl sm:mx-4
                    shadow-2xl animate-in slide-in-from-bottom duration-200 sm:zoom-in-95`}
      >
        {/* Grab handle — tells a touch user this panel can be dismissed. */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-300" />
        </div>

        <div className="flex items-start gap-3 px-5 py-3 sm:py-4 border-b border-slate-100 shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500 truncate mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 -mr-1.5 flex items-center justify-center rounded-full text-slate-400
                       hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-slate-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white rounded-b-3xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
