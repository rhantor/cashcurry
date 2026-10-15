"use client";
import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

/**
 * A number that counts up to its value when it comes into view, and glides
 * to new values when they change (e.g. a KPI after a filter change).
 * `format` turns the number into text — pass formatMoney for currency.
 */
export default function CountUp({ value, format = (v) => Math.round(v).toLocaleString(), duration = 0.9, className }) {
  const ref = useRef(null);
  const from = useRef(0);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  // Latest formatter without restarting the count when an inline function changes.
  const fmt = useRef(format);
  fmt.current = format;

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    const target = Number(value) || 0;
    if (reduce) {
      el.textContent = fmt.current(target);
      from.current = target;
      return;
    }
    const controls = animate(from.current, target, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = fmt.current(v);
      },
    });
    from.current = target;
    return () => controls.stop();
  }, [value, inView, reduce, duration]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {format(0)}
    </span>
  );
}
