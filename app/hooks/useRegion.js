"use client";
// The active branch's region in React: time zone, day cut-off, currency, and
// today's business date. Kept up to date by <RegionSync /> in the layout.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { activeRegion, businessToday, subscribeRegion } from "@/lib/region";

export function useRegion() {
  return useSyncExternalStore(subscribeRegion, activeRegion, activeRegion);
}

/** Today's business date ("yyyy-MM-dd") on the active branch's clock. */
export function useBusinessToday() {
  const region = useRegion();
  return businessToday(new Date(), region);
}

/**
 * A date field that starts on today's business date and keeps following it
 * (e.g. when the branch's settings arrive) until the user picks a date.
 * Returns [date, setDate, today].
 */
export function useDefaultDate() {
  const today = useBusinessToday();
  const [date, setDate] = useState(today);
  const shown = useRef(today);
  useEffect(() => {
    setDate((d) => (d === shown.current ? today : d));
    shown.current = today;
  }, [today]);
  return [date, setDate, today];
}
