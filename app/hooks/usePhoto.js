"use client";
// A person's photo anywhere in the app (owner, 12 Nov 2026): the staff record's
// photo — from the join link, or added in Staff management — found by their
// staff id or their login. One list for the company from /api/people/photos,
// kept a few minutes and shared by every <Avatar>.
import { useEffect, useSyncExternalStore } from "react";

const EMPTY = { byStaff: {}, byUid: {}, byName: {} };
const nameKey = (n) => String(n || "").trim().replace(/\s+/g, " ").toLowerCase();
const TTL = 5 * 60000;
let data = EMPTY;
let at = 0;
let loading = null;
const subs = new Set();
const subscribe = (f) => {
  subs.add(f);
  return () => subs.delete(f);
};

/** Load (or reuse) the company's photos. `fresh`: right after one changed. */
export function loadPhotos({ fresh = false } = {}) {
  if (loading) return loading;
  if (!fresh && at && Date.now() - at < TTL) return Promise.resolve(data);
  loading = (async () => {
    try {
      // Firebase is loaded only when a photo is wanted (keeps <Avatar> light)
      const { auth } = await import("@/lib/firebase");
      await auth?.authStateReady?.();
      const u = auth?.currentUser;
      if (!u) return data;
      const token = await u.getIdToken();
      const r = await fetch(`/api/people/photos${fresh ? "?fresh=1" : ""}`, { headers: { Authorization: `Bearer ${token}` } });
      const j = r.ok ? await r.json() : null;
      if (j?.byStaff && j?.byUid) {
        data = { byStaff: j.byStaff, byUid: j.byUid, byName: j.byName || {} };
        at = Date.now();
        subs.forEach((f) => f());
      }
    } catch {
      /* no photos then: initials */
    } finally {
      loading = null;
    }
    return data;
  })();
  return loading;
}

/** After a photo was added or changed. */
export const refreshPhotos = () => loadPhotos({ fresh: true });

/** Their photo link, or null. `name` only when nothing better is known (reports keep only the name). */
export default function usePhoto({ uid, staffId, name } = {}) {
  const want = !!(uid || staffId || name);
  const snap = useSyncExternalStore(subscribe, () => data, () => EMPTY);
  useEffect(() => {
    if (want) loadPhotos();
  }, [want]);
  if (!want) return null;
  return (staffId && snap.byStaff[staffId]) || (uid && snap.byUid[uid]) || (!staffId && !uid && name && snap.byName[nameKey(name)]) || null;
}
