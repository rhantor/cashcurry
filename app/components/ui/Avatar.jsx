"use client";
import { useState } from "react";
import { cn } from "./cn";
import usePhoto from "@/app/hooks/usePhoto";

// Soft background + strong text, picked from the name so a person keeps their colour.
const SWATCHES = [
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
];
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const initials = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

const SIZES = { sm: "size-7 text-[10px]", md: "size-9 text-xs", lg: "size-12 text-sm" };

/**
 * A person's photo, or their initials on a colour that's always theirs. `status` adds an online dot.
 * `staffId` / `uid`: their staff record's photo is found by itself (12 Nov 2026), when `src` isn't given.
 */
export default function Avatar({ name, src, staffId, uid, size = "md", status, className }) {
  const found = usePhoto({ uid, staffId, name: typeof name === "string" ? name : "" });
  const [broken, setBroken] = useState(null);
  const url = src || found;
  const show = url && url !== broken;
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {show ? (
        // Staff photos come from Storage URLs (a plain <img>, not next/image).
        <img src={url} alt={name || ""} onError={() => setBroken(url)} className={cn("rounded-full object-cover", SIZES[size])} />
      ) : (
        <span className={cn("inline-flex items-center justify-center rounded-full font-bold", SIZES[size], SWATCHES[hash(name) % SWATCHES.length])}>
          {initials(name)}
        </span>
      )}
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-surface",
            status === "online" ? "bg-success" : status === "busy" ? "bg-warning" : "bg-subtle"
          )}
        />
      )}
    </span>
  );
}
