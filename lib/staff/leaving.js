// Staff who have left the job (owner, 12 Nov 2026). They are kept, switched
// off: { active: false, leftOn: "YYYY-MM-DD", leftReason, leftNote }. They
// leave the kiosk, the Attendance Log's lists, rotas, tasks, requests and
// advances, their face goes and their staff app login stops; payroll keeps
// them up to the month they left so the last salary can be paid, and old
// records (reports, payslips) stay as they were. "Bring back" undoes it.
// Pure rules here; app/api/staff/leaving does the change.

export const LEAVING_REASONS = [
  { value: "resigned", label: "Resigned" },
  { value: "terminated", label: "Terminated" },
  { value: "contract_end", label: "Contract ended" },
  { value: "absconded", label: "Stopped coming" },
  { value: "other", label: "Other" },
];

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Still working here. */
export const isCurrent = (s) => !!s && s.active !== false;

/** Only those still working here. */
export const currentStaff = (list) => (Array.isArray(list) ? list.filter(isCurrent) : []);

/** Working here on that day ("YYYY-MM-DD"): still here, or left on or after it. */
export const hereOn = (s, date) => isCurrent(s) || (!!s?.leftOn && String(date || "") <= s.leftOn);

/** On the salary sheet for that month ("YYYY-MM"): still here, or left in or after it. */
export const paidFor = (s, period) => isCurrent(s) || (!!s?.leftOn && s.leftOn.slice(0, 7) >= String(period || ""));

export const reasonLabel = (v) => LEAVING_REASONS.find((r) => r.value === v)?.label || "";

/** "12 Nov 2026" from "2026-11-12". */
export function niceDay(d) {
  if (!DAY.test(String(d || ""))) return "";
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${MONTHS[m - 1]} ${y}`;
}

/** "Left 12 Nov 2026 · Resigned" — or "" for someone still here. */
export function leftLine(s) {
  if (isCurrent(s)) return "";
  return [s.leftOn ? `Left ${niceDay(s.leftOn)}` : "Left", reasonLabel(s.leftReason)].filter(Boolean).join(" · ");
}

/** A real calendar day? (2026-02-30 is not.) */
function realDay(d) {
  if (!DAY.test(d)) return false;
  const [y, m, day] = d.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, day));
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === day;
}

/**
 * What was entered when someone leaves. `latest`: the last day allowed
 * ("YYYY-MM-DD", today or a day after for time zones) — a last day still to
 * come is set on that day, not before, or they would vanish from the kiosk now.
 * → { value: { leftOn, leftReason, leftNote } } or { error }.
 */
export function cleanLeaving(body = {}, latest) {
  const leftOn = String(body.leftOn || "").trim();
  if (!realDay(leftOn)) return { error: "Pick their last working day." };
  if (latest && leftOn > latest) return { error: "Their last day is still to come. Mark them on that day, so they can clock in until then." };
  if (leftOn < "2000-01-01") return { error: "Pick their last working day." };
  const leftReason = String(body.reason || "");
  if (!LEAVING_REASONS.some((r) => r.value === leftReason)) return { error: "Why did they leave?" };
  const leftNote = String(body.note || "").trim().slice(0, 300);
  if (leftReason === "other" && !leftNote) return { error: "Write a line on why they left." };
  return { value: { leftOn, leftReason, leftNote } };
}

/** Tomorrow in UTC: the latest last day the server takes (a branch ahead of UTC is already there). */
export function latestLastDay(now = new Date()) {
  return new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
}
