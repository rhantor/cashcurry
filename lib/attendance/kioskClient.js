"use client";
// The kiosk tablet's side (lib/server/kiosk.js does the rest): its token, the
// last staff list it saw (so it opens without internet), and the punches it
// keeps while offline until they can be sent.
const TOKEN = "cc.kiosk.token";
const BRANCH = "cc.kiosk.branch"; // { companyId, branchId } it was set up for
const STATE = "cc.kiosk.state";
const QUEUE = "cc.kiosk.queue";
const DROPPED = "cc.kiosk.dropped";

const read = (k, fallback) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const write = (k, v) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
};

export const kioskToken = () => read(TOKEN, null);
export const kioskBranch = () => read(BRANCH, null);
export function setKiosk(token, branch) {
  write(TOKEN, token);
  write(BRANCH, branch);
}
export function clearKiosk() {
  for (const k of [TOKEN, BRANCH, STATE, QUEUE, DROPPED]) write(k, null);
}

export const cachedState = () => read(STATE, null);
export const queued = () => read(QUEUE, []);
export const dropped = () => read(DROPPED, []);
export const clearDropped = () => write(DROPPED, null);

export const tabletZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};

export const punchId = () => {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
};

const headers = () => ({ "Content-Type": "application/json", "x-kiosk-token": kioskToken() || "" });

/** The staff list and branch (kept for offline). Throws { offline } when it can't be reached, { notSetUp } when the tablet was removed. */
export async function loadState() {
  let res;
  try {
    res = await fetch(`/api/kiosk/state?tz=${encodeURIComponent(tabletZone() || "")}`, { headers: headers(), cache: "no-store" });
  } catch {
    throw Object.assign(new Error("offline"), { offline: true });
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw Object.assign(new Error(data.error || "Not set up"), { notSetUp: true });
  if (!res.ok) throw Object.assign(new Error(data.error || "Couldn't load"), { offline: res.status >= 500 });
  write(STATE, data);
  return data;
}

/** Send one punch. → the server's answer, or { offline: true } when it couldn't be reached. */
export async function sendPunch(p) {
  try {
    const res = await fetch("/api/kiosk/punch", { method: "POST", headers: headers(), body: JSON.stringify({ ...p, timeZone: tabletZone() }) });
    if (res.status >= 500) return { offline: true };
    return await res.json();
  } catch {
    return { offline: true };
  }
}

/** Keep a punch to send later (at the tablet's time). */
export function keep(p) {
  const list = queued();
  list.push({ ...p, offline: true, at: p.at || new Date().toISOString() });
  return write(QUEUE, list);
}

/**
 * Send what was kept, oldest first. Refused ones (a wrong PIN typed offline,
 * a double punch) are set aside for the manager to see. → { sent, refused, left }
 */
export async function sendKept() {
  const list = queued();
  let sent = 0;
  let refused = 0;
  while (list.length) {
    const p = list[0];
    const r = await sendPunch(p);
    if (r.offline) break;
    list.shift();
    if (r.ok) sent++;
    else {
      refused++;
      const d = dropped();
      d.push({ name: p.name, at: p.at, why: r.error || "Refused" });
      write(DROPPED, d.slice(-30));
    }
    write(QUEUE, list);
  }
  return { sent, refused, left: list.length };
}

/** A small photo from the camera's video (about 320 px wide, JPEG). */
export function snapshot(video, width = 320) {
  if (!video?.videoWidth) return null;
  const h = Math.round((video.videoHeight / video.videoWidth) * width);
  const c = document.createElement("canvas");
  c.width = width;
  c.height = h;
  const g = c.getContext("2d");
  g.translate(width, 0);
  g.scale(-1, 1); // as in a mirror, the way they saw themselves
  g.drawImage(video, 0, 0, width, h);
  return c.toDataURL("image/jpeg", 0.7);
}
