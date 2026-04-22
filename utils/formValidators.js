/**
 * Tiny inline validators for the entry forms.
 *
 * Deliberately dependency-free (no Zod) — these forms are already in
 * production and we only want to add per-field error messages without
 * reshaping state. Each validator returns a string error message on
 * failure, or an empty string on success, so you can do:
 *
 *   const errors = {
 *     date:   vRequired(date, "Date"),
 *     amount: vPositive(amount, "Amount"),
 *   };
 *   if (hasErrors(errors)) { setErrors(errors); return; }
 */

// A sensible "earliest allowed" date — before this almost certainly means a typo.
export const MIN_DATE = "2000-01-01";

/** Returns true when the object has at least one non-empty error string. */
export const hasErrors = (errors) =>
  !!errors && Object.values(errors).some((v) => typeof v === "string" && v.length > 0);

/** Required string/number. Empty string, null, undefined all fail. */
export const vRequired = (value, label = "Field") => {
  if (value === null || value === undefined) return `${label} is required.`;
  if (typeof value === "string" && value.trim() === "") return `${label} is required.`;
  return "";
};

/** Required file (File object or truthy URL). */
export const vRequiredFile = (file, label = "File") =>
  file ? "" : `${label} is required.`;

/** Amount must parse to a finite positive number. */
export const vPositive = (value, label = "Amount") => {
  const base = vRequired(value, label);
  if (base) return base;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/,/g, ""));
  if (!Number.isFinite(n)) return `${label} must be a number.`;
  if (n <= 0) return `${label} must be greater than zero.`;
  return "";
};

/** Allow zero, disallow negative / NaN. Used for optional tender amounts. */
export const vNonNegative = (value, label = "Amount") => {
  if (value === "" || value === null || value === undefined) return "";
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/,/g, ""));
  if (!Number.isFinite(n)) return `${label} must be a number.`;
  if (n < 0) return `${label} cannot be negative.`;
  return "";
};

/**
 * Date sanity: required, parseable, not older than MIN_DATE, and not after
 * tomorrow (allowing one day of clock slack / timezone edge cases).
 */
export const vDate = (value, label = "Date") => {
  const base = vRequired(value, label);
  if (base) return base;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return `${label} is not a valid date.`;
  if (value < MIN_DATE) return `${label} looks too far in the past.`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);
  if (d > tomorrow) return `${label} cannot be in the future.`;
  return "";
};

/** YYYY-MM month string: required + well-formed + within [2000-01, +1 year]. */
export const vMonth = (value, label = "Month") => {
  const base = vRequired(value, label);
  if (base) return base;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return `${label} must be YYYY-MM.`;
  if (value < "2000-01") return `${label} looks too far in the past.`;
  const now = new Date();
  const max = `${now.getFullYear() + 1}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (value > max) return `${label} is too far in the future.`;
  return "";
};
