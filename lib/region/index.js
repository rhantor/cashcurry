// A branch's region: its time zone, day cut-off and currency, and "today"
// on its clock.
//
// Read from branch settings, in fields that already existed where possible:
//   time zone  basic.timeZone             (device's own zone when not set)
//   cut-off    attendance.dayCutoffTime   (the POS uses the same setting)
//   currency   financeSales.currency
//
// The active branch's region is kept here once loaded (see RegionSync) and
// remembered on the device, so any code — a form, an API slice — can ask for
// today's business date without loading settings itself.
import { businessDateFor, deviceTimeZone, isValidTimeZone } from "./businessDay";
import { currencyInfo } from "./currency";

export { businessDateFor, cutoffMinutes, deviceTimeZone, isValidTimeZone } from "./businessDay";
export { CURRENCIES, currencyInfo, formatMoney } from "./currency";

/** Offered in settings; any valid IANA zone also works. */
export const TIME_ZONES = [
  { id: "Asia/Kuala_Lumpur", label: "Malaysia (Kuala Lumpur) — UTC+8" },
  { id: "Asia/Dhaka", label: "Bangladesh (Dhaka) — UTC+6" },
  { id: "Asia/Singapore", label: "Singapore — UTC+8" },
  { id: "Asia/Kolkata", label: "India (Kolkata) — UTC+5:30" },
  { id: "Asia/Dubai", label: "UAE (Dubai) — UTC+4" },
  { id: "Asia/Riyadh", label: "Saudi Arabia (Riyadh) — UTC+3" },
  { id: "Europe/London", label: "United Kingdom (London)" },
  { id: "UTC", label: "UTC" },
];

/** A branch's region from its settings document. */
export function regionOf(settings) {
  const tz = settings?.basic?.timeZone;
  return {
    timeZone: isValidTimeZone(tz) ? tz : deviceTimeZone(),
    timeZoneIsSet: isValidTimeZone(tz),
    cutoffTime: settings?.attendance?.dayCutoffTime || "00:00",
    currency: currencyInfo(settings?.financeSales?.currency),
  };
}

// ── the active branch's region ──────────────────────────────────────────────
const STORAGE_KEY = "cc_region";
const listeners = new Set();
let active = null;

function load() {
  if (active || typeof window === "undefined") return active;
  try {
    const cached = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    if (cached?.cutoffTime) active = { ...cached, currency: currencyInfo(cached.currency?.code) };
  } catch {
    /* no cache — defaults below */
  }
  return active;
}

let fallback = null;

/** The active branch's region (defaults until settings have loaded once). */
export function activeRegion() {
  return load() || (fallback ||= regionOf(null));
}

/** Set by RegionSync when the active branch's settings load or change. */
export function setActiveRegion(region) {
  const same = active && JSON.stringify(active) === JSON.stringify(region);
  active = region;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(region));
  } catch {
    /* private mode etc. — still works for this page */
  }
  if (!same) listeners.forEach((fn) => fn());
}

export function subscribeRegion(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Today's business date ("yyyy-MM-dd") for the active branch. */
export function businessToday(now = new Date(), region = activeRegion()) {
  return businessDateFor(now, region.cutoffTime, region.timeZone);
}
