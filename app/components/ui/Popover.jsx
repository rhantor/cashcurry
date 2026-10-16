"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "./cn";
import { spring } from "./motion";

/**
 * A floating panel attached to a trigger (menus, date pickers). Opens below
 * (or above, if there's no room), lines up with the trigger's start or end,
 * follows it on scroll, and closes on Esc or a click outside.
 *
 *   <Popover trigger={({ open, toggle, ref }) => <button ref={ref} onClick={toggle}>…</button>}>
 *     {({ close }) => …}
 *   </Popover>
 */
export default function Popover({ trigger, children, align = "start", width, className, open: openProp, onOpenChange }) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = useCallback(
    (v) => {
      setOpenState(v);
      onOpenChange?.(v);
    },
    [onOpenChange]
  );
  const anchor = useRef(null);
  const panel = useRef(null);
  const [pos, setPos] = useState(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const a = anchor.current?.getBoundingClientRect();
    const p = panel.current?.getBoundingClientRect();
    if (!a) return;
    const h = p?.height ?? 0;
    const w = p?.width ?? 0;
    const below = a.bottom + 8 + h <= window.innerHeight || a.top - 8 - h < 0;
    let left = align === "end" ? a.right - w : a.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8)); // stay on screen
    setPos({ top: below ? a.bottom + 8 : a.top - 8 - h, left, below });
  }, [align]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!panel.current?.contains(e.target) && !anchor.current?.contains(e.target)) setOpen(false);
    };
    // Esc closes only this popover, not the sheet or dialog it sits in:
    // caught on the way down and stopped there.
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setOpen(false);
        anchor.current?.focus?.();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place, setOpen]);

  const close = () => setOpen(false);
  return (
    <>
      {trigger({ open, toggle: () => setOpen(!open), close, ref: anchor })}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={(el) => {
                  panel.current = el;
                  if (el && !pos) requestAnimationFrame(place); // measure once it exists
                }}
                initial={{ opacity: 0, scale: 0.96, y: pos?.below === false ? 4 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0, transition: spring.snappy }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
                style={{
                  position: "fixed",
                  top: pos?.top ?? -9999,
                  left: pos?.left ?? -9999,
                  width,
                  transformOrigin: `${align === "end" ? "right" : "left"} ${pos?.below === false ? "bottom" : "top"}`,
                }}
                className={cn("z-[300] rounded-2xl border border-line bg-surface p-1.5 shadow-float", className)}
              >
                {typeof children === "function" ? children({ close }) : children}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
