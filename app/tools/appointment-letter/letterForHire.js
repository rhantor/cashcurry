// A new hire's appointment letter as a PDF (30 Oct): the letter saved for them
// (newHires/{id}/letter/current — the tool's own inputs) with what they filled
// in on their join link — name, IC or passport, address — and, once signed,
// their signature and the day. The same drawing as the Appointment Letter tool.
import { format, parseISO } from "date-fns";
import { formatMoney } from "@/lib/region/currency";
import { buildLetterPdf } from "./buildLetterPdf";

/** The letter's inputs, saved for a new hire (what buildLetterPdf takes, less the functions). */
export const LETTER_KEYS = ["templateType", "logo", "stamp", "companyDetails", "letterMeta", "employeeDetails", "jobTerms", "allowances", "signatory", "clauses", "signatorySignature", "stylingOptions"];

/**
 * → { pdf, fileName, blob } for `letter` (saved inputs), with `details` (what
 * they filled in) and `signed` ({ signature, at }) when there is one.
 */
export function letterForHire(letter, { details = {}, signed = null, currency = "RM" } = {}) {
  const name = [details.firstName, details.lastName].filter(Boolean).join(" ");
  const city = [details.postalCode, details.city, details.state].filter(Boolean).join(" ");
  const employeeDetails = {
    ...(letter.employeeDetails || {}),
    ...(name ? { name } : {}),
    ...(details.icNumber || details.passportNumber ? { icPassport: details.icNumber || details.passportNumber } : {}),
    ...(details.addressLine1 ? { addressLine1: details.addressLine1, addressLine2: [details.addressLine2, city].filter(Boolean).join(", ") } : {}),
  };
  const formatCurrency = (amount) => {
    const parsed = parseFloat(amount);
    const text = formatMoney(isNaN(parsed) ? 0 : parsed, currency, { plain: true });
    return letter.templateType === "partTime" ? `${text}/hour` : text;
  };
  const { pdf, fileName } = buildLetterPdf({
    ...letter,
    allowances: letter.allowances || [],
    employeeDetails,
    employeeSignature: signed?.signature || null,
    employeeSignedOn: signed?.at ? format(parseISO(signed.at), "d MMM yyyy") : null,
    formatCurrency,
  });
  return { pdf, fileName, blob: pdf.output("blob") };
}
