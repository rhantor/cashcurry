// How fast the kiosk reads faces (20 Nov 2026: Lazeez said it had grown slow).
// The tablet keeps a running tally for the day — how long a look at the camera
// takes, reading a face, and the server's answer — shows it in the kiosk's
// corner menu and sends it now and then, so the manager's list of tablets says
// how it is doing. Pure: no React, no storage.

const blank = () => ({ n: 0, sum: 0, max: 0 });
const add = (t = blank(), ms) => (Number.isFinite(ms) && ms >= 0 ? { n: t.n + 1, sum: t.sum + ms, max: Math.max(t.max, ms) } : t);
const avg = (t) => (t?.n ? Math.round(t.sum / t.n) : null);

/** A new day starts a new tally. */
export function emptySpeed(date) {
  return { date: date || "", look: blank(), read: blank(), answer: blank() };
}

/**
 * One measurement into the day's tally. kind: "look" (a quick look for a face),
 * "read" (a near face turned into numbers), "answer" (asking the server who it is).
 */
export function addSpeed(tally, kind, ms, date) {
  const t = tally && tally.date === date ? tally : emptySpeed(date);
  if (!["look", "read", "answer"].includes(kind)) return t;
  return { ...t, [kind]: add(t[kind], Math.round(ms)) };
}

/** The tally in short, as the tablet sends it and the list shows it (ms; null = none yet). */
export function speedSummary(tally, { upHours = null } = {}) {
  if (!tally) return null;
  return {
    date: tally.date,
    lookMs: avg(tally.look),
    readMs: avg(tally.read),
    answerMs: avg(tally.answer),
    answerMax: tally.answer?.n ? tally.answer.max : null,
    reads: tally.read?.n || 0,
    upHours: upHours == null ? null : Math.round(upHours * 10) / 10,
  };
}

/** A summary sent by a tablet, made safe to keep: numbers only, within reason. */
export function cleanSpeed(s) {
  if (!s || typeof s !== "object") return null;
  const num = (v, max) => (v == null || v === "" ? null : Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= max ? Math.round(Number(v) * 10) / 10 : null);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(s.date || "")) ? String(s.date) : null;
  if (!date) return null;
  return { date, lookMs: num(s.lookMs, 600000), readMs: num(s.readMs, 600000), answerMs: num(s.answerMs, 600000), answerMax: num(s.answerMax, 600000), reads: num(s.reads, 1e6), upHours: num(s.upHours, 24 * 365) };
}

/** "Slow" when reading or answering takes this long on average (ms). */
export const SLOW_MS = 1500;
export const isSlow = (s) => !!s && ((s.readMs || 0) >= SLOW_MS || (s.answerMs || 0) >= SLOW_MS);

/**
 * A kiosk left open for days (an iPad on the home screen never reloads) gets
 * slower; it loads itself afresh once the business day turns — when nobody is
 * using it, it's online and no punch is waiting to be sent, and it has been
 * open a while (so it can never loop).
 */
export function timeToReload({ openedDay, today, busy, online, waiting, openMs }) {
  return !!openedDay && !!today && today !== openedDay && !busy && !!online && !waiting && openMs > 60 * 60000;
}
