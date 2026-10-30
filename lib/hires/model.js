// New hires (30 Oct, decided with the owner): someone joining is first a
// "new hire" at a branch; a link (7 days, used once) lets them fill in their
// own details, add their documents and sign their appointment letter; whoever
// manages staff checks it and accepts — the Add staff form opens filled in.
// Pure — no Firebase; firestore.rules and the API routes (app/api/hires,
// app/api/join) enforce the same.
//
// companies/{c}/branches/{b}/newHires/{id}
//   firstName, lastName, phone, role (the job), department, startDate, basicSalary,
//   status: "draft" | "sent" | "submitted" | "accepted" | "cancelled",
//   link { expiresAt (ISO), sentAt, by } — the current link (its token is never stored),
//   letterReady — an appointment letter is saved for them (/letter/current),
//   details { …what they filled in, the staff form's fields },
//   files { idFront, idBack, photo, bank: { path, name, contentType, size } | null, health: [ … ] },
//   signed { at, name, signature (PNG data URL), userAgent } — the letter, signed on the link,
//   submittedAt, staffId / acceptedAt / acceptedBy (once accepted), createdBy, createdAt
// companies/{c}/branches/{b}/newHires/{id}/letter/current — the letter as the
//   appointment letter tool draws it (buildLetterPdf's inputs); their details go in when drawn
// joinLinks/{sha256(token)} — { companyId, branchId, hireId, expiresAt, usedAt }: server only

export const LINK_DAYS = 7;
export const MAX_FILE_MB = 10;
export const MAX_HEALTH_FILES = 3;

export const STATUSES = {
  draft: { label: "Not sent yet", tone: "neutral" },
  sent: { label: "Link sent", tone: "info" },
  submitted: { label: "Filled in — check it", tone: "warning" },
  accepted: { label: "Joined", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const isMalaysian = (details) => String(details?.nationality || "").toLowerCase() === "malaysian";

/**
 * The documents, in the order asked for. IC (both sides) or passport, and a
 * photo, are needed; a bank card or statement and a health certificate
 * (typhoid / food handler) are optional. Labels follow their nationality.
 */
export function docKinds(details = {}) {
  const ic = isMalaysian(details) || !details?.nationality;
  return [
    { kind: "idFront", label: ic ? "IC — front" : "Passport — photo page", required: true },
    { kind: "idBack", label: ic ? "IC — back" : "Passport — visa or permit page", required: true },
    { kind: "photo", label: "Your photo", hint: "A clear photo of your face, like a passport photo", required: true, image: true },
    { kind: "bank", label: "Bank card or statement", hint: "The page with your name and account number", required: false },
    { kind: "health", label: "Health certificate", hint: "Typhoid vaccine or food handler training", required: false, many: true },
  ];
}
export const DOC_KIND_KEYS = ["idFront", "idBack", "photo", "bank", "health"];

/** A file they may send: an image, or a PDF (not for the photo), up to MAX_FILE_MB. */
export function fileProblem(kind, { contentType = "", size = 0 } = {}) {
  if (!DOC_KIND_KEYS.includes(kind)) return "Unknown document";
  const image = /^image\/(jpeg|png|webp|heic|heif)$/i.test(contentType);
  const pdf = contentType === "application/pdf";
  if (!(image || (pdf && kind !== "photo"))) return kind === "photo" ? "Use a photo (JPG or PNG)" : "Use a photo or a PDF";
  if (!(size > 0)) return "The file is empty";
  if (size > MAX_FILE_MB * 1024 * 1024) return `Up to ${MAX_FILE_MB} MB`;
  return null;
}

/** Which required documents are still missing: [kind]. (The join page knows a file by its name, the server by its path.) */
export const missingDocs = (files = {}, details = {}) =>
  docKinds(details)
    .filter((d) => d.required && !(d.many ? (files?.[d.kind] || []).length : files?.[d.kind]?.path || files?.[d.kind]?.name))
    .map((d) => d.kind);

/** The fields they fill in (the staff form's names). Pay, job and kiosk stay with the manager. */
export const DETAIL_FIELDS = [
  "firstName", "lastName", "gender", "dob", "nationality", "icNumber", "passportNumber",
  "phone", "email", "addressLine1", "addressLine2", "city", "state", "postalCode", "country",
  "emergencyContactName", "emergencyContactPhone", "bankName", "bankAccountNumber", "bankAccountHolderName",
];

/** Only their own fields, trimmed strings (anything else sent is dropped). */
export function cleanDetails(raw = {}) {
  const out = {};
  for (const k of DETAIL_FIELDS) out[k] = String(raw?.[k] ?? "").trim().slice(0, 200);
  return out;
}

/** When a link sent now runs out (ISO). */
export const linkExpiry = (now = new Date()) => new Date(now.getTime() + LINK_DAYS * 86400000).toISOString();

/** Can the link still be used? "open" | "expired" | "used" | "closed" (cancelled, accepted) */
export function linkState(hire, link, now = new Date()) {
  if (!hire || !link) return "closed";
  if (["cancelled", "accepted"].includes(hire.status)) return "closed";
  if (link.usedAt || hire.status === "submitted") return "used";
  if (new Date(link.expiresAt) <= now) return "expired";
  return "open";
}

/** The staff form filled in from a new hire: what they gave, and the job and pay the manager set. */
export function staffFormFrom(hire = {}) {
  const d = hire.details || {};
  return {
    ...Object.fromEntries(Object.entries(d).filter(([, v]) => v !== "")),
    firstName: d.firstName || hire.firstName || "",
    lastName: d.lastName || hire.lastName || "",
    phone: d.phone || hire.phone || "",
    role: hire.role || "",
    department: hire.department || "",
    startDate: hire.startDate || "",
    basicSalary: hire.basicSalary ?? "",
  };
}

/** Their documents as kept on the staff record (staffPrivate.documents): [{ kind, label, path, name, contentType }]. */
export function documentsFrom(hire = {}) {
  const labels = Object.fromEntries(docKinds(hire.details).map((d) => [d.kind, d.label]));
  const out = [];
  for (const kind of DOC_KIND_KEYS) {
    const v = hire.files?.[kind];
    for (const f of Array.isArray(v) ? v : v ? [v] : []) {
      if (f?.path) out.push({ kind, label: labels[kind], path: f.path, name: f.name || "", contentType: f.contentType || "" });
    }
  }
  return out;
}

/** "Faiz Rahman" */
export const hireName = (h = {}) => [h.details?.firstName || h.firstName, h.details?.lastName || h.lastName].filter(Boolean).join(" ") || "New hire";

/** The WhatsApp message that carries the link. */
export const linkMessage = ({ name, company, url, expiresAt }) =>
  `Hi ${name || "there"}, welcome to ${company || "the team"}! Please fill in your details, add your documents and sign your appointment letter here: ${url}\n(The link works for ${LINK_DAYS} days${expiresAt ? `, until ${new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}.)`;

/** What they must fill in (the bank is up to them). */
export const REQUIRED_DETAILS = ["firstName", "lastName", "gender", "dob", "nationality", "phone", "addressLine1", "emergencyContactName", "emergencyContactPhone"];

/**
 * What is wrong with what they filled in: { field: message }. `rules` are the
 * staff form's own checks (app/staff-management/lib/validation.js RULES:
 * phone, email, IC or passport by nationality), so both agree.
 */
export function detailProblems(details = {}, rules = {}) {
  const out = {};
  for (const k of REQUIRED_DETAILS) if (!String(details[k] || "").trim()) out[k] = "Needed";
  for (const k of ["firstName", "lastName", "phone", "email", "icNumber", "passportNumber"]) {
    const msg = rules[k]?.(details[k], details);
    if (msg && !out[k]) out[k] = msg;
  }
  return out;
}

/** A drawn signature as sent: a PNG data URL, not too big. */
export const isSignature = (s) => typeof s === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s) && s.length < 300000;
