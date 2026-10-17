"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationFrame, useReducedMotion } from "framer-motion";
import { CircleCheck } from "lucide-react";

// Restaurants closing their day around the world — made-up figures for the
// sign-in screen. lat/lon in degrees; each is shown in its own money.
export const CITIES = [
  { city: "Kuala Lumpur", lat: 3.1, lon: 101.7, currency: "MYR", kept: 1883.35 },
  { city: "Dhaka", lat: 23.8, lon: 90.4, currency: "BDT", kept: 57300 },
  { city: "Dubai", lat: 25.2, lon: 55.3, currency: "AED", kept: 6420 },
  { city: "London", lat: 51.5, lon: -0.1, currency: "GBP", kept: 2310 },
  { city: "New York", lat: 40.7, lon: -74, currency: "USD", kept: 4417.6 },
  { city: "São Paulo", lat: -23.5, lon: -46.6, currency: "BRL", kept: 9870 },
  { city: "Tokyo", lat: 35.7, lon: 139.7, currency: "JPY", kept: 412000 },
  { city: "Sydney", lat: -33.9, lon: 151.2, currency: "AUD", kept: 3155.8 },
];
const SIGNS = ["RM", "৳", "S$", "$", "₹", "€", "£", "¥", "₱", "฿", "د.إ", "₩"];
export const R = 100; // globe radius in the SVG's units
export const TURN_SECONDS = 48; // one full turn
const TILT = (-18 * Math.PI) / 180; // the globe leans back a little
const rad = (d) => (d * Math.PI) / 180;
/**
 * Is this city turned towards us, crossing the globe's middle line? That is
 * when its day "closes". By longitude, so cities far north or south (which
 * never face us head-on on a tilted globe) still get their turn.
 */
export const isFront = (c, spin) => Math.cos(rad(c.lon) + spin) > 0.96;
const isAway = (c, spin) => Math.cos(rad(c.lon) + spin) < 0.5;
const money = (v, currency) => {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: v >= 10000 ? 0 : 2 }).format(v);
  } catch {
    return `${currency} ${v}`;
  }
};

/** Where a point on the globe lands on screen when turned by `spin` (orthographic, tilted). */
export function project(latDeg, lonDeg, spin) {
  const lat = rad(latDeg);
  const lon = rad(lonDeg) + spin;
  const x = R * Math.cos(lat) * Math.sin(lon);
  const y0 = -R * Math.sin(lat);
  const z0 = R * Math.cos(lat) * Math.cos(lon);
  // lean back around the x axis
  const y = y0 * Math.cos(TILT) - z0 * Math.sin(TILT);
  const z = y0 * Math.sin(TILT) + z0 * Math.cos(TILT);
  return { x, y, z };
}

/** A line of constant longitude or latitude, as a path of its front (or back) half. */
function linePath(points, front) {
  let d = "";
  let pen = false;
  for (const p of points) {
    const show = front ? p.z >= 0 : p.z < 0;
    if (show) {
      d += `${pen ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      pen = true;
    } else pen = false;
  }
  return d;
}

/**
 * The turning globe with the cities on it. As a city comes round to face
 * you it lights up, sends out a ring, shows the day it just closed, and
 * calls `onClose(city)` — the ledger beside the globe writes it down.
 */
function SpinningGlobe({ onClose, reduce }) {
  const [spin, setSpin] = useState(rad(-60));
  const spinRef = useRef(spin);
  const facing = useRef(new Set()); // cities currently counted as facing us

  // turn a little each frame; a city "closes its day" as it comes round to the front
  useAnimationFrame((t, delta) => {
    if (reduce) return;
    const s = spinRef.current - (Math.min(delta, 100) / 1000) * ((2 * Math.PI) / TURN_SECONDS);
    spinRef.current = s;
    for (const c of CITIES) {
      if (isFront(c, s) && !facing.current.has(c.city)) {
        facing.current.add(c.city);
        onClose?.(c);
      } else if (isAway(c, s)) facing.current.delete(c.city);
    }
    setSpin(s);
  });

  const meridians = Array.from({ length: 12 }, (_, i) => i * 30 - 180);
  const parallels = [-60, -30, 0, 30, 60];
  const steps = Array.from({ length: 37 }, (_, i) => i * 5 - 90);
  const ring = Array.from({ length: 73 }, (_, i) => i * 5 - 180);

  const dots = CITIES.map((c) => ({ ...c, ...project(c.lat, c.lon, spin) }));

  return (
    <svg viewBox="-120 -120 240 240" className="absolute inset-0 size-full overflow-visible" aria-hidden>
      <defs>
        <radialGradient id="globe-shade" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
        </radialGradient>
      </defs>
      <circle r={R} fill="url(#globe-shade)" stroke="white" strokeOpacity="0.45" strokeWidth="1" />
      {/* back half of the grid, very faint */}
      {meridians.map((lon) => (
        <path key={`mb${lon}`} d={linePath(steps.map((lat) => project(lat, lon, spin)), false)} fill="none" stroke="white" strokeOpacity="0.07" strokeWidth="0.6" />
      ))}
      {/* front half */}
      {meridians.map((lon) => (
        <path key={`mf${lon}`} d={linePath(steps.map((lat) => project(lat, lon, spin)), true)} fill="none" stroke="white" strokeOpacity="0.3" strokeWidth="0.7" />
      ))}
      {parallels.map((lat) => (
        <path key={`p${lat}`} d={linePath(ring.map((lon) => project(lat, lon, spin)), true)} fill="none" stroke="white" strokeOpacity="0.22" strokeWidth="0.6" />
      ))}
      {/* the cities */}
      {dots
        .filter((d) => d.z > -R * 0.05)
        .map((d) => {
          const near = Math.max(0, d.z / R); // 0 at the edge, 1 facing us
          const lit = isFront(d, spin);
          return (
            <g key={d.city} transform={`translate(${d.x.toFixed(1)} ${d.y.toFixed(1)})`} opacity={0.35 + near * 0.65}>
              {lit && !reduce && (
                <motion.circle
                  r="3"
                  fill="none"
                  stroke="#a9e9d1"
                  strokeWidth="1.2"
                  initial={{ r: 3, opacity: 0.9 }}
                  animate={{ r: 16, opacity: 0 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                />
              )}
              <circle r={lit ? 3.6 : 2.4} fill={lit ? "#ffffff" : "#a9e9d1"} />
              {lit && (
                <g>
                  <rect x="7" y="-17" rx="5" width={Math.max(62, d.city.length * 5.2 + 14)} height="28" fill="#ffffff" fillOpacity="0.95" />
                  <text x="13" y="-6" fontSize="7" fontWeight="700" fill="#0b4d40">
                    {d.city}
                  </text>
                  <text x="13" y="5" fontSize="7" fontWeight="600" fill="#14806a">
                    {money(d.kept, d.currency)}
                  </text>
                </g>
              )}
            </g>
          );
        })}
    </svg>
  );
}

/** The days closed so far, newest on top — the "accounting" beside the globe. */
function Ledger({ rows }) {
  return (
    <div className="w-48 rounded-2xl border border-white/20 bg-white/10 p-2.5 text-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45)] backdrop-blur-md">
      <p className="flex items-center gap-1.5 px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#a9e9d1] opacity-70" />
          <span className="relative inline-flex size-1.5 rounded-full bg-[#a9e9d1]" />
        </span>
        Live day close
      </p>
      <ul className="space-y-1">
        <AnimatePresence initial={false}>
          {rows.map((r) => (
            <motion.li
              key={r.id}
              layout
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1.5"
            >
              <CircleCheck className="size-3.5 shrink-0 text-[#a9e9d1]" />
              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">{r.city}</span>
              <span className="shrink-0 text-[11px] font-bold tabular-nums">{money(r.kept, r.currency)}</span>
            </motion.li>
          ))}
        </AnimatePresence>
        {rows.length === 0 && <li className="px-1 py-2 text-[11px] text-white/60">Waiting for the first branch to close…</li>}
      </ul>
    </div>
  );
}

/** A slowly turning wire globe (light version, for the phone header). `className` places and sizes it. */
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
 * The sign-in screen's brand side (computers): the world turning, and as
 * each city comes round its restaurant closes the day — the city lights
 * up with what it kept, in its own money, and the ledger writes it down.
 */
export default function BrandPanel() {
  const reduce = useReducedMotion();
  const [rows, setRows] = useState(() =>
    reduce ? CITIES.slice(0, 3).map((c, i) => ({ ...c, id: i })) : []
  );
  const next = useRef(0);
  const closed = (c) => setRows((r) => [{ ...c, id: next.current++ }, ...r].slice(0, 3));

  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#1f9a7c] via-[#14806a] to-[#0b4d40] shadow-[20px_0_60px_-30px_rgba(11,77,64,0.6)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[52%] lg:flex-col lg:justify-between lg:gap-6 lg:rounded-r-[2.5rem] lg:p-10 xl:p-12">
      <motion.div
        aria-hidden
        className="absolute -left-32 -top-32 size-[28rem] rounded-full bg-[#75d6b8]/25 blur-3xl"
        animate={reduce ? undefined : { x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08]"
        style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      />

      <div className="relative flex items-center gap-3 text-white">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-white text-lg font-black text-[#14806a] shadow-lg">C</span>
        <span className="text-xl font-bold tracking-tight">Cash Curry</span>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center pb-24">
        {/* the globe, and the ledger it writes into */}
        <div className="relative size-[min(36rem,56vh)]">
          <SpinningGlobe onClose={closed} reduce={reduce} />
          {/* from the bottom middle of the globe down and across to the ledger; dashes flow towards it */}
          <svg className="absolute left-1/2 top-[91.7%] h-12 w-28 overflow-visible" viewBox="0 0 112 48" fill="none" aria-hidden>
            <path d="M0 0 V30 Q0 42 12 42 H112" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" />
            <motion.path
              d="M0 0 V30 Q0 42 12 42 H112"
              stroke="#a9e9d1"
              strokeWidth="1.5"
              strokeDasharray="4 8"
              strokeLinecap="round"
              animate={reduce ? undefined : { strokeDashoffset: [0, -24] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
            />
            <circle cx="0" cy="0" r="3" fill="#a9e9d1" />
          </svg>
          <div className="absolute left-[calc(50%+7rem)] top-[calc(91.7%+42px)] -translate-y-[1.05rem]">
            <Ledger rows={rows} />
          </div>
        </div>
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
