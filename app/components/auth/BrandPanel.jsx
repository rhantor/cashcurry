"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MapPin } from "lucide-react";
import { formatMoney } from "@/lib/region/currency";
import { cn } from "@/app/components/ui";

// A day closing in restaurants around the world — the receipt that prints
// on the sign-in screen. Made-up figures, one city after another.
const DAYS = [
  { city: "Kuala Lumpur", currency: "MYR", lines: [["Cash", 1240.5], ["Card", 860], ["QR", 395.25]], costs: 612.4 },
  { city: "Dhaka", currency: "BDT", lines: [["Cash", 48650], ["bKash", 21300], ["Card", 9800]], costs: 22450 },
  { city: "Singapore", currency: "SGD", lines: [["Cash", 980], ["Card", 1420.8], ["PayNow", 310]], costs: 705.6 },
  { city: "New York", currency: "USD", lines: [["Cash", 1310], ["Card", 3985.4], ["Online", 742.2]], costs: 1620 },
  { city: "Mumbai", currency: "INR", lines: [["Cash", 38400], ["UPI", 52150], ["Card", 14600]], costs: 31200 },
];
const SIGNS = ["RM", "৳", "S$", "$", "₹", "€", "£", "¥", "₱", "฿", "د.إ", "₩"];
const PRINT = 0.32; // seconds between receipt lines

/** A paper receipt that prints line by line, adds up, and gets stamped. */
function Receipt({ day, reduce }) {
  const money = (v) => formatMoney(v, day.currency);
  const sales = day.lines.reduce((n, [, v]) => n + v, 0);
  const rows = [...day.lines.map(([k, v]) => ({ k, v })), { k: "Sales", v: sales, strong: true }, { k: "Costs", v: -day.costs }];
  const at = (i) => (reduce ? 0 : 0.5 + i * PRINT);
  return (
    <motion.div
      initial={reduce ? false : { y: -40, opacity: 0, rotate: -4 }}
      animate={{ y: 0, opacity: 1, rotate: -2.5 }}
      exit={reduce ? undefined : { y: 30, opacity: 0, rotate: 3, transition: { duration: 0.35 } }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
      className="relative w-[17.5rem] font-mono text-[13px] text-[#1d2b27]"
    >
      <div className="rounded-t-md bg-[#fbfaf6] px-5 pb-4 pt-5 shadow-[0_30px_60px_-25px_rgba(0,0,0,0.55)]">
        <div className="text-center">
          <p className="text-[11px] font-bold tracking-[0.3em]">CASH CURRY</p>
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#5b6b66]">
            <MapPin className="size-3" /> {day.city} · day close
          </p>
        </div>
        <div className="my-3 border-t border-dashed border-[#c9d3cf]" />
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
            <motion.li
              key={r.k}
              initial={reduce ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: at(i), duration: 0.2 }}
              className={cn("flex justify-between gap-3", r.strong && "border-t border-dashed border-[#c9d3cf] pt-1.5 font-bold")}
            >
              <span>{r.k}</span>
              <span className="tabular-nums">{r.v < 0 ? `− ${money(-r.v)}` : money(r.v)}</span>
            </motion.li>
          ))}
        </ul>
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: at(rows.length) }}
          className="mt-3 flex items-baseline justify-between border-t-2 border-[#1d2b27] pt-2"
        >
          <span className="text-[11px] font-bold tracking-wider">KEPT TODAY</span>
          <span className="text-lg font-bold tabular-nums">{money(sales - day.costs)}</span>
        </motion.div>

        {/* the stamp */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 2.2, rotate: -28 }}
          animate={{ opacity: 1, scale: 1, rotate: -14 }}
          transition={{ delay: at(rows.length + 1.4), type: "spring", stiffness: 420, damping: 16 }}
          className="pointer-events-none absolute bottom-10 right-3 rounded-md border-[3px] border-[#22a082] px-2 py-1 text-[11px] font-black tracking-[0.18em] text-[#22a082] opacity-90 mix-blend-multiply"
        >
          ✓ BALANCED
        </motion.div>
      </div>
      {/* torn paper edge */}
      <svg viewBox="0 0 280 10" preserveAspectRatio="none" className="block h-2.5 w-full" aria-hidden>
        <path d="M0 0 H280 V2 L270 10 L260 2 L250 10 L240 2 L230 10 L220 2 L210 10 L200 2 L190 10 L180 2 L170 10 L160 2 L150 10 L140 2 L130 10 L120 2 L110 10 L100 2 L90 10 L80 2 L70 10 L60 2 L50 10 L40 2 L30 10 L20 2 L10 10 L0 2 Z" fill="#fbfaf6" />
      </svg>
    </motion.div>
  );
}

/** A slowly turning wire globe. `className` places and sizes it. */
export function Globe({ reduce: reduceProp, className = "absolute left-1/2 top-1/2 size-[30rem] -translate-x-1/2 -translate-y-1/2 opacity-25" }) {
  const reduceMotion = useReducedMotion();
  const reduce = reduceProp ?? reduceMotion;
  const meridians = [0, 1, 2, 3];
  return (
    <svg viewBox="-110 -110 220 220" className={className} aria-hidden>
      <circle r="100" fill="none" stroke="white" strokeWidth="1" />
      {[-60, -30, 0, 30, 60].map((lat) => {
        const y = (lat / 90) * 100;
        const rx = Math.sqrt(100 * 100 - y * y);
        return <ellipse key={lat} cy={y} rx={rx} ry={rx * 0.12} fill="none" stroke="white" strokeWidth="0.6" />;
      })}
      {meridians.map((i) => (
        <motion.ellipse
          key={i}
          ry="100"
          fill="none"
          stroke="white"
          strokeWidth="0.6"
          initial={{ rx: 100 }}
          animate={reduce ? { rx: 100 - i * 25 } : { rx: [100, 0, 100] }}
          transition={{ duration: 16, repeat: Infinity, ease: "linear", delay: -i * 4 }}
        />
      ))}
    </svg>
  );
}

/** Money signs from around the world, drifting by. */
function Signs({ reduce }) {
  const row = [...SIGNS, ...SIGNS];
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]" aria-hidden>
      <motion.div
        className="flex w-max gap-6 text-lg font-bold text-white/35"
        animate={reduce ? undefined : { x: ["0%", "-50%"] }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      >
        {row.map((s, i) => (
          <span key={i}>{s}</span>
        ))}
      </motion.div>
    </div>
  );
}

/**
 * The sign-in screen's brand side (computers): a receipt printing a day's
 * close in one city after another, each in its own money, over a turning
 * globe — what Cash Curry does, for restaurants anywhere.
 */
export default function BrandPanel() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((n) => (n + 1) % DAYS.length), 7000);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#1f9a7c] via-[#14806a] to-[#0b4d40] lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[52%] lg:flex-col lg:justify-between lg:gap-6 lg:p-10 xl:p-12">
      <motion.div
        aria-hidden
        className="absolute -left-32 -top-32 size-[28rem] rounded-full bg-[#75d6b8]/25 blur-3xl"
        animate={reduce ? undefined : { x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative flex items-center gap-3 text-white">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-white text-lg font-black text-[#14806a] shadow-lg">C</span>
        <span className="text-xl font-bold tracking-tight">Cash Curry</span>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <Globe reduce={reduce} />
        <AnimatePresence mode="wait">
          <Receipt key={i} day={DAYS[i]} reduce={reduce} />
        </AnimatePresence>
      </div>

      <div className="relative max-w-md text-white">
        <Signs reduce={reduce} />
        <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-5 text-2xl font-bold leading-tight tracking-tight xl:text-3xl">
          Every till, every branch, every country — in one place.
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-3 text-sm text-white/75">
          Sales, costs, cash and the bank for all your restaurants, in their own money, the moment the day closes.
        </motion.p>
      </div>
    </div>
  );
}
