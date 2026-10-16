"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "./cn";
import { fade, pop, spring } from "./motion";

/** Shared behaviour: render in <body>, Esc closes, page doesn't scroll behind, focus moves in. */
function useOverlay(open, onClose, panelRef) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    // Focus the first control inside, so keyboard users land in the dialog.
    const t = setTimeout(() => {
      panelRef.current?.querySelector("input, select, textarea, button:not([data-close]), [tabindex]")?.focus();
    }, 50);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [open, onClose, panelRef]);
  return mounted;
}

const Backdrop = ({ onClick }) => (
  <motion.div
    variants={fade}
    initial="hidden"
    animate="show"
    exit="exit"
    onClick={onClick}
    className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
  />
);

const Head = ({ title, description, onClose }) =>
  (title || onClose) && (
    <div className="flex items-start justify-between gap-4 px-6 pt-5">
      <div>
        {title && <h2 className="text-base font-semibold text-fg">{title}</h2>}
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {onClose && (
        <button
          data-close
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-fg"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );

// Stacking: page dialogs sit at z-50; the app-wide layers (popovers 300,
// Ctrl+K 350, confirm/prompt 400, progress bar 450, toasts 500) stay above
// everything, including the older screens' own modals (up to z-[200]).

/** Centred dialog that pops in. `footer` sits on a tinted strip at the bottom. `layer`: its z-index class. */
export function Dialog({ open, onClose, title, description, footer, size = "md", layer = "z-50", children }) {
  const panel = useRef(null);
  const mounted = useOverlay(open, onClose, panel);
  if (!mounted) return null;
  const width = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" }[size];
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={cn("fixed inset-0 flex items-center justify-center p-4", layer)} role="dialog" aria-modal="true">
          <Backdrop onClick={onClose} />
          <motion.div
            ref={panel}
            variants={pop}
            initial="hidden"
            animate="show"
            exit="exit"
            className={cn("relative w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-float", width)}
          >
            <Head title={title} description={description} onClose={onClose} />
            <div className="px-6 py-5">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-line bg-surface-2 px-6 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/**
 * Bottom sheet — the phone-friendly dialog. Slides up from the bottom; drag the
 * handle down (or flick) to close. On wide screens it sits centred at the bottom.
 */
export function Sheet({ open, onClose, title, description, footer, layer = "z-50", children }) {
  const panel = useRef(null);
  const drag = useDragControls();
  const mounted = useOverlay(open, onClose, panel);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={cn("fixed inset-0 flex items-end justify-center", layer)} role="dialog" aria-modal="true">
          <Backdrop onClick={onClose} />
          <motion.div
            ref={panel}
            initial={{ y: "100%" }}
            animate={{ y: 0, transition: spring.soft }}
            exit={{ y: "100%", transition: { duration: 0.2 } }}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose?.();
            }}
            className="relative flex max-h-[90vh] w-full max-w-xl flex-col rounded-t-3xl border border-line bg-surface shadow-float"
          >
            <div
              onPointerDown={(e) => drag.start(e)}
              className="flex cursor-grab touch-none justify-center pb-1 pt-3 active:cursor-grabbing"
            >
              <span className="h-1.5 w-10 rounded-full bg-line" />
            </div>
            <Head title={title} description={description} onClose={onClose} />
            <div className="overflow-y-auto px-6 py-5">{children}</div>
            {footer && (
              <div className="flex gap-2 border-t border-line px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
