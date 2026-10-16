"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "./cn";
import { spring } from "./motion";
import { Spinner } from "./Spinner";
import { registerToasts } from "./notify";

const ToastContext = createContext(null);

const TONES = {
  success: { icon: CheckCircle2, color: "text-success", bar: "bg-success" },
  error: { icon: XCircle, color: "text-danger", bar: "bg-danger" },
  warning: { icon: AlertTriangle, color: "text-warning", bar: "bg-warning" },
  info: { icon: Info, color: "text-info", bar: "bg-info" },
  loading: { icon: null, color: "text-brand", bar: "bg-brand" },
};

/**
 * Toasts — the replacement for alert(). Inside React: useToast(); anywhere
 * else: `toast` from ./notify. Wrap the app in <ToastProvider>, then:
 *   const toast = useToast();
 *   toast.success("Sale saved");
 *   toast.error("Could not save", { description: err.message });
 *   await toast.promise(save(), { loading: "Saving…", success: "Saved", error: "Failed" });
 * They stack, close themselves (hover pauses), and can be swiped away.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const show = useCallback((tone, title, opts = {}) => {
    const id = opts.id ?? nextId.current++;
    const toast = { id, tone, title, description: opts.description, duration: opts.duration ?? (tone === "loading" ? null : 4000) };
    setToasts((all) => [...all.filter((t) => t.id !== id), toast].slice(-4));
    return id;
  }, []);

  const api = useMemo(() => {
    const t = {
      success: (title, o) => show("success", title, o),
      error: (title, o) => show("error", title, o),
      warning: (title, o) => show("warning", title, o),
      info: (title, o) => show("info", title, o),
      dismiss,
      /** Shows "loading", then turns into success or error in place. */
      promise: async (p, { loading = "Working…", success = "Done", error = "Something went wrong" } = {}) => {
        const id = show("loading", loading);
        try {
          const result = await p;
          show("success", typeof success === "function" ? success(result) : success, { id });
          return result;
        } catch (e) {
          show("error", typeof error === "function" ? error(e) : error, { id, description: e?.message });
          throw e;
        }
      },
    };
    return t;
  }, [show, dismiss]);

  // Make toast.success(…) from ./notify reach this list (code outside React too).
  useEffect(() => registerToasts(api), [api]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:top-auto sm:items-end"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onClose={() => dismiss(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }) {
  const [paused, setPaused] = useState(false);
  const tone = TONES[toast.tone];
  const Icon = tone.icon;

  // A real timer (not the bar's animation), so it still closes for users with
  // reduced motion; hovering pauses it and keeps the time that was left.
  const left = useRef(toast.duration);
  useEffect(() => {
    left.current = toast.duration;
  }, [toast.duration, toast.title, toast.tone]);
  useEffect(() => {
    if (!toast.duration || paused) return;
    const started = Date.now();
    const t = setTimeout(onClose, left.current);
    return () => {
      clearTimeout(t);
      left.current -= Date.now() - started;
    };
  }, [paused, toast.duration, toast.title, toast.tone, onClose]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: spring.soft }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={(_, info) => Math.abs(info.offset.x) > 90 && onClose()}
      onHoverStart={() => setPaused(true)}
      onHoverEnd={() => setPaused(false)}
      className="pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-surface shadow-float"
    >
      <div className="flex items-start gap-3 p-4 pr-10">
        <span className={cn("mt-0.5 shrink-0", tone.color)}>
          {Icon ? <Icon className="size-5" /> : <Spinner size={18} />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">{toast.title}</p>
          {toast.description && <p className="mt-0.5 text-xs text-muted">{toast.description}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded-lg p-1.5 text-subtle transition hover:bg-surface-2 hover:text-fg"
      >
        <X className="size-4" />
      </button>
      {toast.duration && (
        // Shows the time left; pauses with the timer.
        <span
          key={toast.tone + toast.title}
          className={cn("absolute bottom-0 left-0 h-0.5 w-full origin-left", tone.bar)}
          style={{
            animation: `cc-shrink ${toast.duration}ms linear forwards`,
            animationPlayState: paused ? "paused" : "running",
          }}
        />
      )}
    </motion.div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast needs <ToastProvider> (see app/components/ui/UIProvider)");
  return ctx;
}
