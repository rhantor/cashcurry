"use client";
import { useEffect, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { motion } from "framer-motion";
import { Building2 } from "lucide-react";
import { CountUp } from "@/app/components/ui";

const greeting = (h) => (h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");

/**
 * The top of the home page: the day, a greeting, who you are and which
 * branch — and, for people who see the money, today at a glance.
 * `today` = null hides the figures; while `today.loading`, they shimmer.
 */
export default function HomeHero({ name, role, branchName, company, today }) {
  // The device's clock, read after mounting (the server's would differ).
  const [now, setNow] = useState(null);
  useEffect(() => setNow(new Date()), []);

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1f9a7c] via-[#178a6f] to-[#0f5c4c] p-5 text-white shadow-float sm:p-7">
      {/* soft light shapes */}
      <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 size-72 rounded-full bg-[#75d6b8]/20 blur-3xl" />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">{now ? format(now, "EEEE, d MMMM") : " "}</p>
          {branchName && (
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              <Building2 className="size-3.5 shrink-0" />
              <span className="truncate">{branchName}</span>
            </span>
          )}
        </div>
        <motion.h1
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl"
        >
          {now ? greeting(now.getHours()) : "Welcome"}
          {name ? `, ${name}` : ""}
        </motion.h1>
        <p className="mt-1 text-sm text-white/75">{[role, company].filter(Boolean).join(" · ")}</p>

        {today && <TodayStrip {...today} />}
      </div>
    </section>
  );
}

function Figure({ label, value, loading, money }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/65">{label}</p>
      {loading ? (
        <div className="mt-1.5 h-7 w-28 animate-pulse rounded-lg bg-white/20" />
      ) : (
        <CountUp value={value} format={money} className="mt-0.5 block whitespace-nowrap text-xl font-bold tracking-tight sm:text-2xl" />
      )}
    </div>
  );
}

/** Today's sales, cash in hand, and the last seven days as little bars. */
function TodayStrip({ loading, todayKey, sales = 0, cash = 0, week = [], money }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const key = format(subDays(parseISO(todayKey), 6 - i), "yyyy-MM-dd");
    return { key, value: week.find((d) => d.date === key)?.total || 0 };
  });
  const weekTotal = days.reduce((n, d) => n + d.value, 0);
  const max = Math.max(1, ...days.map((d) => d.value));

  return (
    <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur sm:grid-cols-[1fr_1fr_1.4fr] sm:p-5">
      <Figure label="Today's sales" value={sales} loading={loading} money={money} />
      <Figure label="Cash in hand" value={cash} loading={loading} money={money} />
      <div className="col-span-2 sm:col-span-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/65">Last 7 days</p>
          {!loading && <p className="text-sm font-bold tabular-nums">{money(weekTotal)}</p>}
        </div>
        <div className="mt-2 flex h-12 items-end gap-1.5" aria-hidden>
          {days.map((d, i) => (
            <div key={d.key} className="flex h-full flex-1 flex-col justify-end">
              <motion.div
                className={i === 6 ? "rounded-md bg-white" : "rounded-md bg-white/40"}
                initial={{ height: 0 }}
                animate={{ height: loading ? "12%" : `${Math.max(6, (d.value / max) * 100)}%` }}
                transition={{ duration: 0.6, delay: 0.15 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                title={`${format(parseISO(d.key), "EEE d MMM")}: ${money(d.value)}`}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1.5 text-center text-[10px] font-medium text-white/60">
          {days.map((d, i) => (
            <span key={d.key} className="flex-1">
              {i === 6 ? "Today" : format(parseISO(d.key), "EEEEE")}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
