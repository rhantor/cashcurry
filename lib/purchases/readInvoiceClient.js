// Browser side of reading an invoice photo (16 Nov 2026): shrink the photo so
// it travels fast on a phone, send it with the items it could be, and get the
// reading back (lib/purchases/invoiceRead.js). Throws with a message to show.
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { MAX_INVOICE_BYTES } from "@/lib/purchases/invoiceRead";

const LONG_SIDE = 2000; // enough to read small print; most phone photos are 4000+

const asBase64 = (blob) =>
  new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] || "");
    r.onerror = () => no(new Error("Couldn't open the file."));
    r.readAsDataURL(blob);
  });

/** A photo as a JPEG no longer than LONG_SIDE; a PDF as it is. → { data, type } */
export async function invoicePayload(file) {
  if (!file) throw new Error("Take a photo of the invoice first.");
  if (file.type === "application/pdf") {
    if (file.size > MAX_INVOICE_BYTES) throw new Error("This PDF is too big to read. Fill the bill in by hand.");
    return { data: await asBase64(file), type: "application/pdf" };
  }
  if (!String(file.type).startsWith("image/")) throw new Error("Send a photo or a PDF.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return { data: await asBase64(file), type: file.type };
  const scale = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
  return { data: await asBase64(blob), type: "image/jpeg" };
}

// Asked once per page load: is reading set up on the server (an API key)? Until it
// is, the "Read the invoice for me" button stays hidden (owner, 17 Nov 2026).
let readyOnce = null;
export function useInvoiceReading() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    readyOnce = readyOnce || fetch("/api/purchases/read-invoice").then((r) => r.json()).then((j) => !!j.ready).catch(() => false);
    readyOnce.then((v) => live && setReady(v));
    return () => {
      live = false;
    };
  }, []);
  return ready;
}

/** Read it. items: [{ id, name, unit }] it could be. → reading */
export async function readInvoice({ companyId, branchId, file, vendorName = "", items = [] }) {
  const payload = await invoicePayload(file);
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch("/api/purchases/read-invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
    body: JSON.stringify({ companyId, branchId, vendorName, items: items.map((i) => ({ id: i.id, name: i.name || "", unit: i.unit || "" })), file: payload }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || "Couldn't read the invoice.");
  return out.reading;
}
