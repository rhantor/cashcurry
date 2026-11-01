// lib/signatures/client.js — each person's own signature (owner, 1 Nov), for
// vouchers: "Prepared by" and "Approved by". Kept on their entry in the
// company's people list (companies/{c}/users/{uid}.signature, a small PNG data
// URL), which everyone in the company can read and only they change.
"use client";
import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const personDoc = (companyId, uid) => doc(db, "companies", companyId, "users", uid);

/** Live: this person's signature (a data URL), or null; undefined while loading. */
export function useSignature(companyId, uid) {
  const [sig, setSig] = useState(undefined);
  useEffect(() => {
    if (!companyId || !uid) return;
    return onSnapshot(
      personDoc(companyId, uid),
      (s) => setSig((s.exists() && s.data().signature) || null),
      () => setSig(null)
    );
  }, [companyId, uid]);
  return sig;
}

/** Save (or with null, remove) your own signature. */
export const saveSignature = (companyId, uid, dataUrl) =>
  setDoc(personDoc(companyId, uid), { signature: dataUrl || null, signatureAt: serverTimestamp() }, { merge: true });

/** Signatures of these people, once: { uid: dataUrl | null }. */
export async function signaturesOf(companyId, uids = []) {
  const list = [...new Set(uids.filter(Boolean))];
  const snaps = await Promise.all(list.map((u) => getDoc(personDoc(companyId, u)).catch(() => null)));
  return Object.fromEntries(list.map((u, i) => [u, (snaps[i]?.exists() && snaps[i].data().signature) || null]));
}

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/**
 * A signature made tidy for keeping: cropped to the ink, at most 600×200,
 * transparent PNG (white paper behind a photo of a signature turns clear).
 */
export async function tidySignature(src) {
  const img = await loadImage(src);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // near-white counts as paper: made clear
      if (px[i] > 225 && px[i + 1] > 225 && px[i + 2] > 225) px[i + 3] = 0;
      if (px[i + 3] > 20) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null; // nothing drawn
  ctx.putImageData(data, 0, 0);
  const pad = 6;
  const cw = Math.min(w, x1 - x0 + 1 + pad * 2);
  const ch = Math.min(h, y1 - y0 + 1 + pad * 2);
  const scale = Math.min(1, 600 / cw, 200 / ch);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(cw * scale));
  out.height = Math.max(1, Math.round(ch * scale));
  out.getContext("2d").drawImage(c, Math.max(0, x0 - pad), Math.max(0, y0 - pad), cw, ch, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

/** For someone with no signature: their name, as if written by hand. */
export function nameSignature(name) {
  const text = String(name || "").trim() || "—";
  const c = document.createElement("canvas");
  const font = "italic 54px 'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', 'Apple Chancery', cursive";
  const ctx = c.getContext("2d");
  ctx.font = font;
  c.width = Math.min(600, Math.ceil(ctx.measureText(text).width) + 24);
  c.height = 90;
  ctx.font = font;
  ctx.fillStyle = "#1d3a8a";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 12, 46, c.width - 24);
  return c.toDataURL("image/png");
}
