// lib/device/client.js
// The copy a phone keeps (lib/device/model.js): starting it, and forgetting it.
// A phone can pass to someone else, so what one person saw never stays for the
// next: signing out clears it, and so does a different person signing in.
import { clearIndexedDbPersistence, terminate } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { workerUrl } from "@/lib/notify/worker";
import { deviceKeepsCopy } from "./model";

const OWNER_KEY = "cc-device-owner";

const readOwner = () => {
  try {
    return window.localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
};
const writeOwner = (uid) => {
  try {
    if (uid) window.localStorage.setItem(OWNER_KEY, uid);
    else window.localStorage.removeItem(OWNER_KEY);
  } catch {
    /* private mode: Firestore keeps nothing there either */
  }
};

/** Saved pages go; the app's code stays, because it holds nobody's data. */
async function dropSavedPages() {
  if (typeof caches === "undefined") return;
  const names = await caches.keys();
  await Promise.all(names.filter((n) => n.startsWith("cc-pages")).map((n) => caches.delete(n)));
}

let forgetting = null;
/**
 * Clears this person's saved data. Firestore can't be used again after this, so
 * the caller must load a new page. Returns false when the device keeps no copy.
 * Another open tab can refuse the clearing; that tab clears it when it signs out.
 */
export function forgetDeviceCopy() {
  if (!deviceKeepsCopy()) return Promise.resolve(false);
  forgetting ||= (async () => {
    try {
      await terminate(db);
      await clearIndexedDbPersistence(db);
    } catch (e) {
      console.warn("saved data not cleared:", e?.message);
    }
    writeOwner(null);
    await dropSavedPages().catch(() => {});
    return true;
  })();
  return forgetting;
}

/** Someone signed in. True when another person's copy had to be cleared first. */
export async function deviceOwnerIs(uid) {
  if (!deviceKeepsCopy()) return false;
  const owner = readOwner();
  if (owner === uid) return false;
  if (!owner) {
    writeOwner(uid);
    return false;
  }
  await forgetDeviceCopy();
  writeOwner(uid);
  return true;
}

/** Signed out without this device being told (or in another tab). */
export const deviceHasOwner = () => deviceKeepsCopy() && !!readOwner();

/** Starts the saved copy of the app's pages. Plain http has no service workers. */
export async function startPageCopy() {
  if (!deviceKeepsCopy() || !("serviceWorker" in navigator) || !window.isSecureContext) return;
  try {
    await navigator.serviceWorker.register(workerUrl());
  } catch (e) {
    console.warn("page copy not started:", e?.message);
  }
}
