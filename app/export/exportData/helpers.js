// exportData: the helpers part (moved from exportData.js unchanged).
/* eslint-disable no-prototype-builtins */
import { format, parseISO } from "date-fns";
import "jspdf-autotable";



/** ---------- Tender helpers ---------- */
export const DEFAULT_TENDERS = [
  { key: "cash", label: "Cash", includeInTotal: true, order: 1 },
  { key: "card", label: "Card", includeInTotal: true, order: 2 },
  { key: "qr", label: "QR", includeInTotal: true, order: 3 },
  { key: "grab", label: "Grab", includeInTotal: true, order: 4 },
  { key: "foodpanda", label: "Foodpanda", includeInTotal: true, order: 5 },
  { key: "online", label: "Online", includeInTotal: true, order: 6 },
  { key: "cheque", label: "Cheque", includeInTotal: true, order: 7 },
  { key: "promotion", label: "Promotion", includeInTotal: false, order: 8 },
];

export const normalizeTender = (t) => ({
  key: t.key,
  label: t.label ?? t.key,
  includeInTotal: t.includeInTotal !== false,
  order: t.order ?? 9999,
});

export const tendersFromSale = (sale) => {
  if (Array.isArray(sale?.tenderMeta) && sale.tenderMeta.length) {
    return [...sale.tenderMeta]
      .map(normalizeTender)
      .sort((a, b) => a.order - b.order);
  }
  // Infer from present fields using default order
  const present = DEFAULT_TENDERS.filter((t) => sale?.hasOwnProperty(t.key));
  return (present.length ? present : DEFAULT_TENDERS)
    .map(normalizeTender)
    .sort((a, b) => a.order - b.order);
};

export const tendersUnionFromSales = (sales, provided) => {
  if (provided?.length)
    return provided.map(normalizeTender).sort((a, b) => a.order - b.order);

  // Build union by order preference: prefer tenderMeta, else default order.
  const map = new Map();
  const push = (t) => {
    const k = t.key;
    if (!map.has(k)) map.set(k, normalizeTender(t));
  };

  for (const s of sales) {
    if (Array.isArray(s?.tenderMeta) && s.tenderMeta.length) {
      s.tenderMeta.forEach(push);
    } else {
      // fallback: infer from present fields against defaults
      DEFAULT_TENDERS.filter((t) => Object.hasOwn(s, t.key)).forEach(push);
    }
  }
  if (map.size === 0) DEFAULT_TENDERS.forEach(push);

  return Array.from(map.values()).sort((a, b) => a.order - b.order);
};

/** ---------- Format helpers ---------- */
export const fmt = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n.toFixed(2) : v ?? "0.00";
};

export const formatDate = (d) => {
  try {
    return format(new Date(d), "dd/MM/yyyy");
  } catch {
    try {
      return format(parseISO(d), "dd/MM/yyyy");
    } catch {
      return String(d ?? "");
    }
  }
};

export const renderCreatedAt = (createdAt) => {
  // Firestore Timestamp
  if (createdAt?.toDate) return createdAt.toDate().toLocaleString();
  if (typeof createdAt === "object" && typeof createdAt?.seconds === "number") {
    return new Date(createdAt.seconds * 1000).toLocaleString();
  }
  // ISO/string
  const d = new Date(createdAt);
  return Number.isNaN(d.getTime()) ? "Unknown" : d.toLocaleString();
};

// --- Helpers to fetch/convert images to a DataURL for jsPDF ---
export const blobToDataURL = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

/**
 * Fetch an image (zReportUrl) and convert to dataURL
 * Falls back to null on any error/CORS issues.
 */
export const fetchImageAsDataURL = async (url) => {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await blobToDataURL(blob);
    return dataUrl; // e.g. "data:image/jpeg;base64,..."
  } catch {
    return null;
  }
};

/**
 * Draw an image on the current page, scaling to fit width and paginating if needed.
 * Returns the new Y position after drawing.
 */
export const drawImageFitting = (
  doc,
  dataUrl,
  startY,
  left = 14,
  right = 14,
  top = 16,
  bottom = 16
) => {
  try {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const maxW = pageW - left - right;

    // jsPDF can auto-detect image type; we still need intrinsic ratio:
    // Create a temp <img> just to get width/height ratio (jsPDF has no direct reader)
    const img = new Image();
    img.src = dataUrl;

    // If not yet loaded, we can't block — assume portrait-ish 3:4 as a fallback.
    const naturalW = img.naturalWidth || 1200;
    const naturalH = img.naturalHeight || 1600;
    const ratio = naturalH / naturalW;

    const draw = (y) => {
      const h = maxW * ratio;
      const remaining = pageH - bottom - y;
      if (h > remaining) {
        doc.addPage();
        y = top;
      }
      doc.addImage(dataUrl, "JPEG", left, y, maxW, maxW * ratio);
      return y + h;
    };

    return draw(startY);
  } catch {
    return startY;
  }
};
