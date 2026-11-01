// lib/costs/voucherImage.js — the voucher drawn as a picture (owner, 1 Nov),
// laid out like the paper one (lib/costs/voucherPaper.js voucherSheet). Made
// when it is approved — or saved, when it needs no one — and put onto the
// cost first among its files, so the Cost Report and its viewer show it.
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
function signBox(ctx, x, y, w, { label, img, name, at, stamp }) {
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
    ctx.font = `700 22px ${SANS}`;
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
 * The voucher as a PNG. `sheet` from voucherSheet; `prepared` / `approved`:
 * { img: data URL of the signature } (approved may instead carry a stamp).
 */
export async function drawVoucher(sheet, { preparedSig = null, approvedSig = null } = {}) {
  const [pImg, aImg] = await Promise.all([loadImage(preparedSig), loadImage(approvedSig)]);
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  const rows = [
    ["Paid to", sheet.paidTo],
    ["For", sheet.category],
    ["Paid from", sheet.paidFrom],
  ];
  // height: measure the wrapped parts first
  ctx.font = `22px ${SANS}`;
  const valueW = W - 330 - 60;
  const reasonLines = wrap(ctx, sheet.reason, valueW);
  const noteLines = sheet.note ? wrap(ctx, sheet.note, valueW) : [];
  const wordsLines = wrap(ctx, sheet.words, valueW);
  const H = 470 + rows.length * 44 + (wordsLines.length + reasonLines.length + noteLines.length) * 30 + (noteLines.length ? 20 : 0) + 190;
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
  ctx.fillText("PAYMENT VOUCHER", W - 60, 88);
  ctx.font = `20px ${SANS}`;
  ctx.fillStyle = MUTED;
  ctx.fillText("Cost with no invoice", W - 60, 116);
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
  const label = (t) => {
    ctx.fillStyle = MUTED;
    ctx.font = `600 20px ${SANS}`;
    ctx.fillText(t.toUpperCase(), 60, y);
  };
  for (const [k, v] of rows) {
    label(k);
    ctx.fillStyle = INK;
    ctx.font = `24px ${SANS}`;
    ctx.fillText(v, 330, y, valueW);
    y += 44;
  }
  label("Amount");
  ctx.fillStyle = INK;
  ctx.font = `800 34px ${SANS}`;
  ctx.fillText(sheet.amount, 330, y + 4);
  y += 40;
  ctx.font = `italic 22px ${SANS}`;
  for (const l of wordsLines) {
    ctx.fillText(l, 330, y);
    y += 30;
  }
  y += 14;
  label("Why no invoice");
  ctx.fillStyle = INK;
  ctx.font = `22px ${SANS}`;
  for (const l of reasonLines) {
    ctx.fillText(l, 330, y);
    y += 30;
  }
  if (noteLines.length) {
    y += 14;
    label("Note");
    ctx.fillStyle = INK;
    ctx.font = `22px ${SANS}`;
    for (const l of noteLines) {
      ctx.fillText(l, 330, y);
      y += 30;
    }
  }
  y += 10;
  rule(y);

  // signatures
  y += 44;
  const half = (W - 120) / 2;
  signBox(ctx, 60, y, half - 20, { label: "Prepared by", img: pImg, name: sheet.prepared?.name, at: sheet.prepared?.at });
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(60 + half, y - 26);
  ctx.lineTo(60 + half, y + 200);
  ctx.stroke();
  const a = sheet.approval;
  signBox(ctx, 80 + half, y, half - 20, a ? { label: "Approved by", img: a.stamp ? null : aImg, stamp: a.stamp, name: a.by, at: a.at } : { label: "Approved by" });

  ctx.fillStyle = MUTED;
  ctx.font = `16px ${SANS}`;
  ctx.fillText("Signed in Cash Curry", 60, H - 40);
  return new Promise((resolve) => c.toBlob(resolve, "image/png"));
}

/**
 * Draw the voucher for this cost and keep it with the cost's files. `approval`:
 * { by: { uid, name }, at } once approved, or { stamp, by, at } when it needed
 * no one. Signatures come from each person's own (My signature); without one,
 * their name in handwriting style. Returns the picture's address.
 */
export async function makeVoucherImage({ companyId, branchId, branch, cost, currency, money, approval }) {
  const maker = cost.voucher?.by || {};
  const approver = approval?.by || {};
  const sigs = await signaturesOf(companyId, [maker.uid, approver.uid]);
  const sheet = voucherSheet(cost, { branch, currency, money, approval: approval && { stamp: approval.stamp, by: approver.name, at: approval.at } });
  const blob = await drawVoucher(sheet, {
    preparedSig: sigs[maker.uid] || nameSignature(maker.name),
    approvedSig: approval && !approval.stamp ? sigs[approver.uid] || nameSignature(approver.name) : null,
  });
  const path = `costs/${companyId}/${branchId}/vouchers/${cost.date || "undated"}_${cost.id}_${Date.now()}.png`;
  const r = ref(storage, path);
  await uploadBytes(r, blob, { contentType: "image/png" });
  return getDownloadURL(r);
}
