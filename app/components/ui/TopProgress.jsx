"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

/**
 * A thin brand-coloured bar across the top while moving between pages, so a
 * tap always feels answered. Starts when an in-app link is clicked, finishes
 * when the new page's address arrives. Use <TopProgressBar active /> to drive
 * it by hand (e.g. while a big report loads).
 */
export function TopProgressBar({ active }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="fixed inset-x-0 top-0 z-[70] h-0.5 origin-left bg-brand shadow-[0_0_8px_var(--cc-brand)]"
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 0.85, transition: { duration: 6, ease: [0.1, 0.8, 0.2, 1] } }}
          exit={{ scaleX: 1, opacity: 0, transition: { scaleX: { duration: 0.2 }, opacity: { delay: 0.15, duration: 0.2 } } }}
        />
      )}
    </AnimatePresence>
  );
}

export default function TopProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);
  const here = useRef(null);

  // Arrived: the address changed.
  useEffect(() => {
    here.current = `${pathname}?${search}`;
    setActive(false);
  }, [pathname, search]);

  // Leaving: an internal link was clicked (not new-tab, not a hash on this page).
  useEffect(() => {
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest?.("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (`${url.pathname}?${url.searchParams}` === here.current) return;
      setActive(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return <TopProgressBar active={active} />;
}
