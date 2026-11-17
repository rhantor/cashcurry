// Business days.
//
// A restaurant day is not a calendar day: a branch that closes at 3am books
// those last hours to the day it opened. Which day a moment belongs to is
// decided by the branch's clock (its time zone) and its day cut-off — with a
// 05:00 cut-off, 01:30 on the 18th is still the 17th's trade.
//
// Same algorithm as the POS (cashcurry_pos/src/lib/businessDay.js), so a sale
// the till posts and a sale typed into v2 land on the same day.
//
// Pure — no React, no Firebase.

/** "HH:MM" → minutes past midnight. Anything unparseable means no cut-off. */
export function cutoffMinutes(cutoffTime) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(cutoffTime || "").trim());
  if (!m) return 0;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return 0;
  return h * 60 + min;
}

/** The device's own IANA time zone, e.g. "Asia/Dhaka". */
export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Is this a time zone the runtime knows? */
export function isValidTimeZone(timeZone) {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Calendar date and minutes past midnight on a wall clock in `timeZone`. */
export function wallClock(date, timeZone) {
  const opts = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };
  if (timeZone) opts.timeZone = timeZone;
  const parts = new Intl.DateTimeFormat("en-CA", opts).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  // Some engines render midnight as hour 24 under hour12:false.
  const hour = Number(get("hour")) % 24;
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), minutes: hour * 60 + Number(get("minute")) };
}

const pad2 = (n) => String(n).padStart(2, "0");

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The business day ("yyyy-MM-dd") a moment belongs to.
 *
 * @param {*} when            Date | Firestore Timestamp | ms | ISO string
 * @param {string} cutoff     "HH:MM" — moments before it belong to the previous day
 * @param {string} [timeZone] IANA zone of the branch; the device's when missing or unknown
 */
export function businessDateFor(when, cutoff = "00:00", timeZone = null) {
  const d = toDate(when);
  if (!d) return null;
  let wc;
  try {
    wc = wallClock(d, timeZone || null);
  } catch {
    wc = wallClock(d, null); // an unknown zone must not lose the day
  }
  if (wc.minutes >= cutoffMinutes(cutoff)) return `${wc.year}-${pad2(wc.month)}-${pad2(wc.day)}`;
  // Before the cut-off: the previous day. Stepped in UTC so no zone shifts it.
  const prev = new Date(Date.UTC(wc.year, wc.month - 1, wc.day));
  prev.setUTCDate(prev.getUTCDate() - 1);
  return `${prev.getUTCFullYear()}-${pad2(prev.getUTCMonth() + 1)}-${pad2(prev.getUTCDate())}`;
}

/**
 * "HH:MM" (24-hour) on the wall clock in `timeZone` — the branch's, not this
 * device's (owner, 17 Nov 2026: seen from Bangladesh, Malaysia's punches read
 * two hours early). No zone: this device's clock.
 */
export function clockText(when, timeZone = null) {
  const d = toDate(when);
  if (!d) return "—";
  let wc;
  try {
    wc = wallClock(d, timeZone || null);
  } catch {
    wc = wallClock(d, null);
  }
  return `${pad2(Math.floor(wc.minutes / 60))}:${pad2(wc.minutes % 60)}`;
}

/**
 * The moment it is `minutes` past midnight on `dateStr` ("yyyy-MM-dd") on the
 * wall clock in `timeZone` — e.g. 09:00 in Kuala Lumpur, whatever this device's
 * own zone. No zone: this device's clock.
 */
export function instantAt(dateStr, minutes, timeZone = null) {
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  if (!timeZone) return new Date(y, m - 1, d, 0, Number(minutes) || 0, 0, 0);
  const want = Date.UTC(y, m - 1, d, 0, Number(minutes) || 0);
  let at = want;
  // twice: once for the zone's offset, once more in case that crossed a clock change
  for (let i = 0; i < 2; i += 1) {
    let wc;
    try {
      wc = wallClock(new Date(at), timeZone);
    } catch {
      return new Date(y, m - 1, d, 0, Number(minutes) || 0, 0, 0);
    }
    const seen = Date.UTC(wc.year, wc.month - 1, wc.day, 0, wc.minutes);
    at += want - seen;
  }
  return new Date(at);
}
