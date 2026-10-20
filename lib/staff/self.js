// lib/staff/self.js — what staff change for themselves in the staff app's
// settings (docs/STAFF_APP.md, roadmap 4.6): their PIN, photo, contact number
// and emergency contact. firestore.rules / storage.rules let them write only
// these; everything they joined with stays with their manager.
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { auth, db, storage } from "@/lib/firebase";
import { shrinkPhoto } from "@/lib/chat/client";
import { isPin, loginKeys } from "@/lib/staff/login";

const branchDoc = (companyId, branchId, ...rest) => doc(db, "companies", companyId, "branches", branchId, ...rest);

/** Is this number already someone else's staff-app login? */
export async function phoneTakenByOther(phone, uid) {
  const [key] = await loginKeys({ phone });
  if (!key) return false;
  const snap = await getDoc(doc(db, "staffLogins", key));
  return snap.exists() && snap.data().uid !== uid;
}

/**
 * Save their contact number (also the number they sign in with) and their
 * emergency contact. Only what changed is written.
 */
export async function saveMyContact({ companyId, branchId, staffId, uid, before = {}, phone, emergencyContactName, emergencyContactPhone }) {
  const writes = [];
  const newPhone = String(phone || "").trim();
  if (newPhone !== String(before.phone || "").trim()) {
    if (await phoneTakenByOther(newPhone, uid)) throw new Error("That number is already used by someone else's login.");
    writes.push(updateDoc(branchDoc(companyId, branchId, "staff", staffId), { phone: newPhone, updatedAt: serverTimestamp() }));
  }
  const name = String(emergencyContactName || "").trim();
  const num = String(emergencyContactPhone || "").trim();
  if (name !== String(before.emergencyContactName || "") || num !== String(before.emergencyContactPhone || "")) {
    writes.push(
      setDoc(
        branchDoc(companyId, branchId, "staffPrivate", staffId),
        { emergencyContactName: name, emergencyContactPhone: num, updatedAt: serverTimestamp() },
        { merge: true }
      )
    );
  }
  await Promise.all(writes);
  return writes.length > 0;
}

/** Put up a new photo of themselves (made smaller first); the old one goes if it was theirs. */
export async function saveMyPhoto({ companyId, branchId, staffId, file, oldUrl }) {
  if (!file?.type?.startsWith("image/")) throw new Error("Choose a photo.");
  const small = await shrinkPhoto(file, 800, 0.85);
  if (small.size > 5 * 1024 * 1024) throw new Error("That photo is too big (over 5 MB).");
  const path = `staffPhotos/${companyId}/${branchId}/self/${staffId}/${Date.now()}.jpg`;
  const up = await uploadBytes(ref(storage, path), small, { contentType: small.type || "image/jpeg" });
  const url = await getDownloadURL(up.ref);
  await updateDoc(branchDoc(companyId, branchId, "staff", staffId), { photoUrl: url, updatedAt: serverTimestamp() });
  // Their own earlier uploads only; a photo the manager added stays (storage.rules).
  if (oldUrl && oldUrl.includes(encodeURIComponent(`/self/${staffId}/`))) deleteObject(ref(storage, oldUrl)).catch(() => {});
  return url;
}

/** Take their photo down. */
export async function removeMyPhoto({ companyId, branchId, staffId, oldUrl }) {
  await updateDoc(branchDoc(companyId, branchId, "staff", staffId), { photoUrl: null, updatedAt: serverTimestamp() });
  if (oldUrl && oldUrl.includes(encodeURIComponent(`/self/${staffId}/`))) deleteObject(ref(storage, oldUrl)).catch(() => {});
}

/** Friendly words for what Firebase says when changing the PIN. */
export function pinChangeError(e) {
  const code = e?.code || "";
  if (code.includes("wrong-password") || code.includes("invalid-credential") || code.includes("invalid-login")) return "Your current PIN is not right.";
  if (code.includes("too-many-requests")) return "Too many tries. Wait a few minutes and try again.";
  if (code.includes("network")) return "No connection. Try again when you're online.";
  return e?.message || "Couldn't change your PIN.";
}

/** Change their PIN: the current one first, then the new one (6 digits). */
export async function changeMyPin(currentPin, newPin) {
  if (!isPin(newPin)) throw new Error("The new PIN must be 6 digits.");
  if (currentPin === newPin) throw new Error("The new PIN is the same as the current one.");
  const user = auth.currentUser;
  if (!user?.email) throw new Error("Sign in again first.");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPin));
  await updatePassword(user, newPin);
}

/** Easy-to-guess PINs: all one digit, or counting up / down. */
export function weakPin(pin) {
  const s = String(pin || "");
  if (/^(\d)\1{5}$/.test(s)) return true;
  const up = "0123456789012";
  const down = "9876543210987";
  return up.includes(s) || down.includes(s);
}
