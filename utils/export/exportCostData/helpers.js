// exportCostData: the helpers part (moved from exportCostData.js unchanged).
 
// /utils/export/exportCostData.js
import { format } from "date-fns";
import { categoryLabel } from "@/app/entry-data/cost-entry/logic/constants";



/* ----------------------------- Helpers ----------------------------- */

// Robust Firestore timestamp → Date (supports {seconds,nanoseconds}, ISO strings, Date)
export const toDate = (ts) => {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === "string") {
    const d = new Date(ts);
    return isNaN(d) ? null : d;
  }
  if (typeof ts === "object" && ts.seconds !== undefined) {
    return new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1_000_000);
  }
  return null;
};

export const safe = (v, fallback = "-") =>
  v === undefined || v === null || v === "" ? fallback : v;

export const normCategory = (c) => categoryLabel((c && String(c).trim()) || "Uncategorized");

// Legacy-safe derivations for new payment fields
export const derivePaidFrom = (entry) => {
  if (entry?.paidFromOffice === "front" || entry?.paidFromOffice === "back") {
    return entry.paidFromOffice;
  }
  // heuristic: if method is non-cash, assume back office; else front/cash
  if (entry?.paidMethod && entry.paidMethod !== "cash") return "back";
  return "front";
};

export const derivePaidMethod = (entry) => {
  if (entry?.paidMethod) return entry.paidMethod;
  return derivePaidFrom(entry) === "front" ? "cash" : "";
};

export const paidFromLabel = (from) =>
  from === "back" ? "Back Office" : "Front Office (Cash)";

export const methodLabel = (m) => {
  if (m === "cash") return "Cash";
  if (m === "card") return "Card";
  if (m === "qr") return "QR";
  if (m === "online") return "Online";
  if (m === "bank_transfer") return "Bank Transfer";
  return m || "-";
};

export const fmtDate = (dLike, fmt = "dd/MM/yyyy") => {
  const d = toDate(dLike) || new Date(dLike);
  return d ? format(d, fmt) : "-";
};

export const createdAtToStr = (createdAt) => {
  const d = toDate(createdAt);
  return d ? d.toLocaleString() : "-";
};
