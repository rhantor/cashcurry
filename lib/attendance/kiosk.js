// The branch kiosk (owner's choice A, 11 Nov 2026): one tablet per branch,
// set up once by a manager, then no sign-in. Staff tap their name and enter
// their PIN; the server checks the PIN, decides in or out from their last
// punch, keeps a small photo, and files the punch under the branch's business
// day. With no internet the tablet keeps the punch and sends it later.
// Pure rules here; the server side is lib/server/kiosk.js.
import { businessDateFor, cutoffMinutes, wallClock } from "@/lib/region/businessDay";
import { parseTimeToMinutes } from "./shifts";

/** An "in" older than this is a forgotten clock-out: the next punch starts a new day's "in". */
export const OPEN_PUNCH_HOURS = 20;
/** Wrong PINs in a row before that person is locked out on that tablet… */
export const PIN_TRIES = 5;
/** …for this long. */
export const PIN_LOCK_MINUTES = 5;
/** A punch kept on the tablet is taken at its own time when sent within this. */
export const OFFLINE_HOURS = 48;
/** Largest photo the kiosk may send (a ~320 px JPEG is ~20 KB). */
export const MAX_PHOTO_BYTES = 200 * 1024;

const ms = (t) => {
  if (!t) return null;
  if (t instanceof Date) return t.getTime();
  if (typeof t?.toMillis === "function") return t.toMillis();
  if (typeof t?.seconds === "number") return t.seconds * 1000;
  const n = new Date(t).getTime();
  return Number.isNaN(n) ? null : n;
};

/** Their latest punch before `at` (punches: [{ type, timestamp }]), or null. */
export function lastPunchBefore(punches = [], at = new Date()) {
  const t = ms(at);
  let best = null;
  for (const p of punches) {
    const pt = ms(p.timestamp);
    if (pt == null || pt > t) continue;
    if (!best || pt > ms(best.timestamp)) best = p;
  }
  return best;
}

/** "in" or "out": out when their last punch is an "in" from the last OPEN_PUNCH_HOURS. */
export function nextPunchType(last, at = new Date()) {
  if (!last || last.type !== "in") return "in";
  return ms(at) - ms(last.timestamp) < OPEN_PUNCH_HOURS * 3600000 ? "out" : "in";
}

/** Minutes still to wait when the last punch was under `intervalMin` minutes ago (0 = fine). */
export function minutesToWait(last, at = new Date(), intervalMin = 0) {
  const gap = Number(intervalMin) || 0;
  if (!last || gap <= 0) return 0;
  const passed = (ms(at) - ms(last.timestamp)) / 60000;
  return passed < gap ? Math.ceil(gap - passed) : 0;
}

/**
 * When the punch happened. A punch sent live is taken at the server's time; one
 * kept on the tablet while offline at the tablet's time, if that is believable
 * (not in the future, not older than OFFLINE_HOURS). → { at: Date, offline, doubtful }
 */
export function punchMoment({ offline = false, clientAt = null } = {}, now = new Date()) {
  if (!offline) return { at: now, offline: false, doubtful: false };
  const t = ms(clientAt);
  const ok = t != null && t <= now.getTime() + 2 * 60000 && now.getTime() - t <= OFFLINE_HOURS * 3600000;
  return ok ? { at: new Date(Math.min(t, now.getTime())), offline: true, doubtful: false } : { at: now, offline: true, doubtful: true };
}

/** The business day a punch at `at` belongs to (branch zone and cut-off). */
export const punchDate = (at, { timeZone = null, cutoff = "00:00" } = {}) => businessDateFor(at, cutoff || "00:00", timeZone);

/**
 * How many minutes before their shift start a clock-in at `at` is (negative =
 * after the start), on the branch's own clock. null without a shift.
 * Times before the cut-off belong to the day before, so they count past 24:00.
 */
export function minutesBeforeShift(at, shift, { timeZone = null, cutoff = "00:00" } = {}) {
  const start = parseTimeToMinutes(shift?.start);
  if (start == null) return null;
  const cut = cutoffMinutes(cutoff || "00:00");
  const day = (m) => (m < cut ? m + 1440 : m);
  let now;
  try {
    now = wallClock(new Date(ms(at)), timeZone || null).minutes;
  } catch {
    now = wallClock(new Date(ms(at)), null).minutes;
  }
  return day(start) - day(now);
}

/** Wrong-PIN state for one person on one tablet: { count, until (ms) }. Is it locked at `now`? */
export const pinLocked = (fails, now = Date.now()) => !!fails && Number(fails.until || 0) > now;

/** After a wrong PIN: the new state and how many tries are left (0 = now locked). */
export function afterWrongPin(fails, now = Date.now()) {
  const fresh = !fails || (fails.until && fails.until <= now);
  const count = (fresh ? 0 : fails.count || 0) + 1;
  if (count >= PIN_TRIES) return { fails: { count, until: now + PIN_LOCK_MINUTES * 60000 }, left: 0 };
  return { fails: { count, until: 0 }, left: PIN_TRIES - count };
}

/** A photo sent as a data URL: { buffer, contentType } or null when it isn't a small JPEG/PNG/WebP. */
export function photoFrom(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) return null;
  const buffer = globalThis.Buffer.from(m[2], "base64"); // server only
  if (!buffer.length || buffer.length > MAX_PHOTO_BYTES) return null;
  return { buffer, contentType: m[1] };
}

/** What the tablet may know about a staff member — never their PIN. */
export function kioskStaff(s, { last = null, now = new Date(), biometrics = false, face = false } = {}) {
  const next = nextPunchType(last, now);
  return {
    id: s.id,
    firstName: s.firstName || "",
    lastName: s.lastName || "",
    role: s.role || "",
    photoUrl: s.photoUrl || null,
    hasPin: /^\d{4}$/.test(String(s.pinCode || "")),
    credentialId: biometrics ? s.biometric?.credentialId || null : null,
    face: !!face,
    in: next === "out",
    since: next === "out" ? new Date(ms(last.timestamp)).toISOString() : null,
  };
}

/** A punch the tablet sends: checked and trimmed, or { error }. */
export function cleanPunch(body = {}) {
  const id = String(body.id || "");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return { error: "Bad punch id" };
  const staffId = String(body.staffId || "");
  if (!staffId || staffId.includes("/")) return { error: "Who is punching?" };
  const method = ["biometric", "face"].includes(body.method) ? body.method : "pin";
  const pin = String(body.pin || "");
  if (method === "pin" && !/^\d{4}$/.test(pin)) return { error: "Enter the 4-digit PIN" };
  return {
    id,
    staffId,
    method,
    pin,
    photo: body.photo || null,
    offline: !!body.offline,
    clientAt: body.at || null,
    timeZone: typeof body.timeZone === "string" ? body.timeZone.slice(0, 64) : null,
    check: !!body.check,
    descriptor: method === "face" ? body.descriptor || null : null,
  };
}
