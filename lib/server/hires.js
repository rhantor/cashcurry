// Server side of new hires (30 Oct, lib/hires/model.js): the join link's
// token (only its SHA-256 is stored, in joinLinks/{hash} — never readable
// from the app), opening a link, keeping their files, and telling whoever
// manages staff that someone has filled theirs in.
import crypto from "node:crypto";
import admin from "firebase-admin";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { linkState } from "@/lib/hires/model";
import { branchPeople, recipientsFor, withoutMuted } from "@/lib/notify/model";

export const hashToken = (token) => crypto.createHash("sha256").update(String(token || "")).digest("hex");
export const newToken = () => crypto.randomBytes(24).toString("base64url");

export const hireRef = (companyId, branchId, hireId) =>
  adminDb.collection("companies").doc(companyId).collection("branches").doc(branchId).collection("newHires").doc(hireId);

/** The bucket new hires' files go to. */
const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const bucket = () => admin.storage().bucket(BUCKET);

// Under dev:local the Storage emulator's JSON API (what the admin SDK uses)
// crashed the whole emulator suite on an upload (31 Oct), so there the
// files go through its Firebase API instead, as the admin ("Bearer owner").
const EMULATOR = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
const emulatorObject = (path) => `http://${EMULATOR}/v0/b/${BUCKET}/o${path ? `/${encodeURIComponent(path)}` : ""}`;

/** Keep a file at `path` in storage. */
export async function putFile(path, buffer, contentType) {
  if (!EMULATOR) return bucket().file(path).save(buffer, { contentType, resumable: false });
  const res = await fetch(`${emulatorObject()}?name=${encodeURIComponent(path)}`, {
    method: "POST",
    headers: { Authorization: "Bearer owner", "Content-Type": contentType },
    body: buffer,
  });
  if (!res.ok) throw new Error(`storage emulator: ${res.status}`);
}

/** Take a file away (gone already is fine). */
export async function removeFile(path) {
  if (!EMULATOR) return bucket().file(path).delete().catch(() => {});
  await fetch(emulatorObject(path), { method: "DELETE", headers: { Authorization: "Bearer owner" } }).catch(() => {});
}

/**
 * A join link by its token: { state, link, hire, ref } — state "open",
 * "expired", "used" or "closed"; "missing" when there is no such link.
 */
export async function openLink(token) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(String(token || ""))) return { state: "missing" };
  const linkSnap = await adminDb.collection("joinLinks").doc(hashToken(token)).get();
  if (!linkSnap.exists) return { state: "missing" };
  const link = linkSnap.data();
  const ref = hireRef(link.companyId, link.branchId, link.hireId);
  const hireSnap = await ref.get();
  const hire = hireSnap.exists ? { id: hireSnap.id, ...hireSnap.data() } : null;
  // a newer link replaced this one
  if (!hire || hire.linkHash !== linkSnap.id) return { state: "closed", link, hire };
  return { state: linkState(hire, link), link, linkRef: linkSnap.ref, hire, ref };
}

/** Tell whoever gets "New hires" at the branch (and whoever added them): the bell, and a push outside the emulators. */
export async function tellHireSubmitted({ companyId, branchId, hire, name }) {
  const [users, config] = await Promise.all([
    adminDb.collection("users").where("companyId", "==", companyId).get(),
    adminDb.doc(`companies/${companyId}/branches/${branchId}/settings/notifications`).get(),
  ]);
  const people = branchPeople(users.docs.map((d) => ({ uid: d.id, ...d.data() })), branchId);
  const chosen = recipientsFor("hires.submitted", { config: config.exists ? config.data() : {}, people });
  const uids = [...new Set([...chosen, hire.createdBy?.uid].filter(Boolean))];
  const prefs = Object.fromEntries(
    await Promise.all(uids.map(async (u) => [u, (await adminDb.doc(`companies/${companyId}/users/${u}/prefs/notifications`).get()).data() || {}]))
  );
  const to = withoutMuted(uids, "hires.submitted", prefs);
  if (!to.length) return 0;
  const message = { title: `${name} filled in their joining form`, body: "Check their details and documents, then accept them as staff." };
  const link = `/staff-management?hire=${hire.id}`;
  const batch = adminDb.batch();
  for (const uid of to) {
    batch.set(adminDb.collection(`companies/${companyId}/users/${uid}/inbox`).doc(), {
      type: "hires.submitted", title: message.title, body: message.body, link, branchId,
      ref: `newHires/${hire.id}`, createdAt: admin.firestore.FieldValue.serverTimestamp(), readAt: null,
    });
  }
  await batch.commit();
  if (process.env.FIRESTORE_EMULATOR_HOST) return to.length; // no push service locally
  const tokens = (await Promise.all(to.map((u) => adminDb.collection(`companies/${companyId}/users/${u}/fcmTokens`).get()))).flatMap((s) => s.docs.map((d) => d.id));
  if (tokens.length) {
    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: message,
      data: { link, companyId, type: "hires.submitted" },
      webpush: { fcmOptions: { link } },
      android: { priority: "high" },
    }).catch((e) => console.warn("[hires] push failed:", e?.message));
  }
  return to.length;
}
