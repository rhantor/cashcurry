/* eslint-disable no-unused-vars */
// utils/sanitize.js
export const sanitizeUpdates = (obj, { dropEmptyStrings = true } = {}) =>
  Object.fromEntries(
    Object.entries(obj || {}).filter(([_, v]) => {
      if (v === undefined) return false; // Firestore disallows undefined
      if (dropEmptyStrings && typeof v === "string" && v.trim() === "")
        return false;
      return true;
    })
  );

export const normalizeRole = (r) =>
  String(r || "")
    .trim()
    .toLowerCase();
