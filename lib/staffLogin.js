// lib/staffLogin.js — staff log in with their phone or IC number and a
// 6-digit PIN (docs/STAFF_APP.md, decided 19 Oct 2026). Used by the login
// page and by the server routes that make and reset staff logins.
//
// staffLogins/{key} { uid, email } finds the login behind a phone or IC
// number. The key is a hash, so the public list never shows anyone's phone
// or IC number; you must already know the number to find its login.

/**
 * A phone number as its national digits, so "012-345 6789", "+60 12-345 6789"
 * and "60123456789" all match; same for Bangladesh ("+880 1712…" / "01712…").
 */
export function normalPhone(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.startsWith("880")) d = d.slice(3);
  else if (d.startsWith("60")) d = d.slice(2);
  d = d.replace(/^0+/, "");
  return d.length >= 7 ? d : "";
}

/** An IC / passport / NID number without spaces or dashes, upper case. */
export function normalIc(v) {
  const s = String(v || "").replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{6,20}$/.test(s) ? s : "";
}

/** A 6-digit PIN (Firebase needs 6 characters at least). */
export const isPin = (v) => /^\d{6}$/.test(String(v || ""));

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The staffLogins keys for a phone and an IC number (whichever are given). */
export async function loginKeys({ phone, ic } = {}) {
  const keys = [];
  const p = normalPhone(phone);
  const i = normalIc(ic);
  if (p) keys.push(await sha256(`phone:${p}`));
  if (i) keys.push(await sha256(`ic:${i}`));
  return keys;
}

/**
 * What someone typed in the login box could be a phone or an IC number:
 * the keys to try, phone first.
 */
export async function keysForTyped(typed) {
  const raw = String(typed || "").trim();
  const keys = [];
  if (normalPhone(raw) && /^[+\d\s()-]+$/.test(raw)) keys.push(...(await loginKeys({ phone: raw })));
  if (normalIc(raw)) keys.push(...(await loginKeys({ ic: raw })));
  return [...new Set(keys)];
}

/** Does the typed text look like a staff login (a phone or IC number rather than a username or email)? */
export const looksLikeStaffId = (typed) => {
  const raw = String(typed || "").trim();
  return !raw.includes("@") && (/^[+\d\s()-]{7,}$/.test(raw) || /^\d{6}-?\d{2}-?\d{4}$/.test(raw) || /^[A-Z]{1,2}\d{6,9}$/i.test(raw));
};

/** A random 6-digit PIN for a new login or a reset (the server's, not Math.random). */
export function randomPin() {
  const n = new Uint32Array(1);
  globalThis.crypto.getRandomValues(n);
  return String(n[0] % 1_000_000).padStart(6, "0");
}
