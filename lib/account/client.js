// lib/account/client.js — your own profile (owner, 1 Nov): the name the app
// and vouchers show, a photo, a phone number, your password and which
// notifications you get. Saved on your login record (users/{uid}, which you
// may change except role, company, branch and staff record) and copied to your
// entry in the company's people list, which everyone in the company reads.
"use client";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { updateSessionUser } from "@/lib/session";

const me = (uid) => doc(db, "users", uid);
const entry = (companyId, uid) => doc(db, "companies", companyId, "users", uid);

/** Save a change to your profile, everywhere it is shown. */
async function saveProfile(user, patch) {
  await updateDoc(me(user.uid), patch);
  if (user.companyId) await setDoc(entry(user.companyId, user.uid), patch, { merge: true });
  updateSessionUser(patch);
}

/** Your name as the app shows it. */
export function saveMyName(user, firstName, lastName) {
  const first = String(firstName || "").trim();
  const last = String(lastName || "").trim();
  if (!first) throw new Error("Enter your name");
  const name = [first, last].filter(Boolean).join(" ");
  return saveProfile(user, { firstName: first, lastName: last, name, fullName: name });
}

/** Your phone number (digits, spaces and + only). */
export function saveMyPhone(user, phone) {
  const p = String(phone || "").trim();
  if (p && !/^\+?[\d\s-]{7,20}$/.test(p)) throw new Error("That doesn't look like a phone number");
  return saveProfile(user, { phone: p });
}

/** A square photo, small enough to keep with your profile (a JPEG data URL). */
export async function photoFrom(file, size = 256) {
  if (!file?.type?.startsWith("image/")) throw new Error("Pick a photo");
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  c.getContext("2d").drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close?.();
  return c.toDataURL("image/jpeg", 0.85);
}

/** Your photo (a data URL), or null to remove it. */
export const saveMyPhoto = (user, dataUrl) => saveProfile(user, { photo: dataUrl || null });

/** Change your password: your current one first, then the new one (8 or more). */
export async function changeMyPassword(current, next) {
  const u = auth.currentUser;
  if (!u?.email) throw new Error("You're not signed in");
  if (String(next || "").length < 8) throw new Error("The new password needs 8 or more characters");
  try {
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, current));
  } catch {
    throw new Error("Your current password isn't right");
  }
  await updatePassword(u, next);
}

// ── notifications you've turned off for yourself (lib/notify/model.js withoutMuted) ──
const prefsDoc = (companyId, uid) => doc(db, "companies", companyId, "users", uid, "prefs", "notifications");

/** [muted, setOn(type, on)] — the kinds you've turned off. */
export function useMuted(companyId, uid) {
  const [muted, setMuted] = useState(null);
  useEffect(() => {
    if (!companyId || !uid) return;
    getDoc(prefsDoc(companyId, uid))
      .then((s) => setMuted(s.exists() ? s.data().muted || [] : []))
      .catch(() => setMuted([]));
  }, [companyId, uid]);
  const setOn = async (type, on) => {
    const next = on ? (muted || []).filter((t) => t !== type) : [...new Set([...(muted || []), type])];
    setMuted(next);
    await setDoc(prefsDoc(companyId, uid), { muted: next }, { merge: true });
  };
  return [muted, setOn];
}
