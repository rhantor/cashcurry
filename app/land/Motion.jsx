"use client";
// The landing's light motion (7 Nov 2026). Without JavaScript, or with
// "reduce motion" on, everything simply shows: the hidden start state only
// applies once this has switched it on.
import { useEffect, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Turns on the motion class on the page, then reveals each `.reveal` as it scrolls in. */
export function Reveal({ root, motion, reveal, shown }) {
  useEffect(() => {
    if (reduced() || !("IntersectionObserver" in window)) return;
    const page = document.querySelector(`.${root}`);
    if (!page) return;
    page.classList.add(motion);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add(shown);
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    page.querySelectorAll(`.${reveal}`).forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [root, motion, reveal, shown]);
  return null;
}

/**
 * A money figure that counts up once, e.g. 8,412.60. It stays hidden (`hold`)
 * until this runs, then shows (`live`) and counts from 0. Without JavaScript,
 * or on a very slow phone, the hold class shows it anyway after a moment.
 */
export function CountUp({ to, hold, live, ms = 1300 }) {
  const fmt = (n) => n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [value, setValue] = useState(to);
  const [counting, setCounting] = useState(false);
  useEffect(() => {
    if (reduced() || performance.now() > 2000) return;
    let raf;
    let start;
    setValue(0);
    setCounting(true);
    const tick = (t) => {
      if (start === undefined) start = t;
      const k = Math.min(1, (t - start) / ms);
      setValue(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <span className={counting ? live : hold}>{fmt(value)}</span>;
}
