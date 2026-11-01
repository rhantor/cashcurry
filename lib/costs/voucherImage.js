// lib/costs/voucherImage.js — a voucher drawn as a picture (owner, 1 Nov),
// laid out like the paper one (a sheet from lib/costs/voucherPaper.js). Made
// once it is complete — approved, or paid out and signed for — and put onto
// the record first among its files, so reports and the viewer show it.
"use client";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { format } from "date-fns";
import { storage } from "@/lib/firebase";
import { nameSignature, signaturesOf } from "@/lib/signatures/client";
import { voucherSheet } from "./voucherPaper";

const W = 1000;
const INK = "#111827";
const MUTED = "#6b7280";
const LINE = "#d1d5db";
const SANS = "'Inter', 'Segoe UI', Roboto, Arial, sans-serif";

const loadImage = (src) =>
  new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

/** Lines of `text` that fit in `width`. */
function wrap(ctx, text, width) {
  const out = [];
  for (const para of String(text || "").split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > width && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

const when = (d) => (d ? format(d, "d MMM yyyy, h:mm a") : "");

/** Draw one signature box: label, the signature (or a stamp), a line, the name and when. */
function drawBox(ctx, x, y, w, { label, img, name, at, stamp }) {
  ctx.fillStyle = MUTED;
  ctx.font = `600 20px ${SANS}`;
  ctx.fillText(label.toUpperCase(), x, y);
  const top = y + 16;
  const h = 120;
  if (stamp) {
    ctx.save();
    ctx.translate(x + w / 2, top + h / 2);
    ctx.rotate(-0.06);
    ctx.strokeStyle = "#15803d";
    ctx.lineWidth = 3;
    ctx.font = `700 ${w < 300 ? 17 : 22}px ${SANS}`;
    const tw = Math.min(w - 20, ctx.measureText(stamp.toUpperCase()).width + 36);
    ctx.strokeRect(-tw / 2, -30, tw, 60);
    ctx.fillStyle = "#15803d";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(stamp.toUpperCase(), 0, 0, tw - 20);
    ctx.restore();
  } else if (img) {
    const scale = Math.min((w - 20) / img.width, (h - 10) / img.height, 1.6);
    const iw = img.width * scale;
    const ih = img.height * scale;
    ctx.drawImage(img, x + 10, top + h - ih - 4, iw, ih);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, top + h + 6);
  ctx.lineTo(x + w - 10, top + h + 6);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `600 22px ${SANS}`;
  ctx.fillText(name || " ", x, top + h + 36, w - 10);
  ctx.fillStyle = MUTED;
  ctx.font = `18px ${SANS}`;
  ctx.fillText(when(at), x, top + h + 62, w - 10);
}

/**
 * The voucher as a PNG, from a sheet. `sigs`: { uid: signature data URL };
 * a box with its own `sig` (signed on the spot) uses that; anyone else, their
 * name in handwriting style.
 */
export async function drawVoucher(sheet, sigs = {}) {
  const boxes = sheet.boxes || [];
  const imgs = await Promise.all(
    boxes.map((b) => (b.waiting || b.stamp ? null : loadImage(b.sig || (b.uid && sigs[b.uid]) || nameSignature(b.name))))
  );
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  // height: measure the wrapped parts first
  ctx.font = `22px ${SANS}`;
  const valueX = 330;
  const valueW = W - valueX - 60;
  const lines = sheet.rows.map((r) => ({ ...r, lines: wrap(ctx, r.value, valueW), wordLines: r.words ? wrap(ctx, r.words, valueW) : [] }));
  const bodyH = lines.reduce((h, r) => h + (r.words ? 44 + r.wordLines.length * 30 + 14 : Math.max(1, r.lines.length) * 30 + 14), 0);
  const H = 226 + bodyH + 20 + 44 + 200 + 70;
  c.width = W;
  c.height = H;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, W - 48, H - 48);
  ctx.textBaseline = "alphabetic";

  // header
  ctx.fillStyle = INK;
  ctx.font = `700 34px ${SANS}`;
  ctx.fillText(sheet.branchName || "", 60, 90, W / 2);
  ctx.textAlign = "right";
  ctx.font = `800 28px ${SANS}`;
  ctx.fillText(sheet.title || "VOUCHER", W - 60, 88);
  if (sheet.subtitle) {
    ctx.font = `20px ${SANS}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(sheet.subtitle, W - 60, 116);
  }
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = `600 24px ${SANS}`;
  ctx.fillText(`No. ${sheet.no}`, 60, 150);
  ctx.textAlign = "right";
  ctx.fillText(`Date ${sheet.date ? format(new Date(`${sheet.date}T00:00:00`), "d MMM yyyy") : ""}`, W - 60, 150);
  ctx.textAlign = "left";
  const rule = (y) => {
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(48, y);
    ctx.lineTo(W - 48, y);
    ctx.stroke();
  };
  rule(178);

  // body
  let y = 226;
  for (const r of lines) {
    ctx.fillStyle = MUTED;
    ctx.font = `600 20px ${SANS}`;
    ctx.fillText(r.label.toUpperCase(), 60, y, valueX - 80);
    ctx.fillStyle = INK;
    if (r.words) {
      ctx.font = `800 34px ${SANS}`;
      ctx.fillText(r.value, valueX, y + 4);
      y += 40;
      ctx.font = `italic 22px ${SANS}`;
      for (const l of r.wordLines) {
        ctx.fillText(l, valueX, y);
        y += 30;
      }
      y += 18;
    } else {
      ctx.font = `22px ${SANS}`;
      for (const l of r.lines) {
        ctx.fillText(l, valueX, y);
        y += 30;
      }
      y += 14;
    }
  }
  y += 6;
  rule(y);

  // signatures, side by side
  y += 44;
  const n = Math.max(1, boxes.length);
  const colW = (W - 120) / n;
  boxes.forEach((b, i) => {
    const x = 60 + i * colW;
    if (i > 0) {
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 10, y - 26);
      ctx.lineTo(x - 10, y + 200);
      ctx.stroke();
    }
    drawBox(ctx, x + (i > 0 ? 10 : 0), y, colW - 30, { label: b.label, img: imgs[i], stamp: b.stamp, name: b.waiting ? "" : b.name, at: b.waiting ? null : b.at });
  });

  ctx.fillStyle = MUTED;
  ctx.font = `16px ${SANS}`;
  ctx.fillText("Signed in Cash Curry", 60, H - 40);
  return new Promise((resolve) => c.toBlob(resolve, "image/png"));
}

/** Draw the sheet with everyone's saved signatures and keep it at `path` in Storage; returns its address. */
export async function saveVoucherImage({ companyId, sheet, path }) {
  const sigs = await signaturesOf(companyId, (sheet.boxes || []).map((b) => b.uid));
  const blob = await drawVoucher(sheet, sigs);
  const r = ref(storage, path);
  await uploadBytes(r, blob, { contentType: "image/png" });
  return getDownloadURL(r);
}

/** A cost's voucher picture (approval: { by: { uid, name }, at } or { stamp, by, at }). */
export function makeVoucherImage({ companyId, branchId, branch, cost, currency, money, approval }) {
  const sheet = voucherSheet(cost, { branch, currency, money, approval });
  return saveVoucherImage({ companyId, sheet, path: `costs/${companyId}/${branchId}/vouchers/${cost.date || "undated"}_${cost.id}_${Date.now()}.png` });
}
