// lib/payouts/voucher.js — a pay-out's bill brought back with no paper, as a
// paper voucher (owner, 1 Nov): who took the money and what for, what was
// spent (in words too), why there's no bill; then "Prepared by" (who brought
// it back), "Received by" (who took the money — they signed when it was
// handed out) and "Approved by". It takes the next cost voucher number
// (DKL-V-…) when approved, and its picture goes onto the cost. Pure.
import { amountInWords, signBox, voucherNo } from "@/lib/costs/voucherPaper";
import { changeText } from "./model";

/**
 * `out`: the pay-out record (its `received` signature), `no`: the voucher
 * number, `approval`: { by: { uid, name }, at } or { stamp, by, at }.
 */
export function payoutSheet(settle, { branch, out = null, no = null, approval = null, currency = "MYR", money = (v) => String(v) } = {}) {
  const received = out?.received;
  const took = settle?.to?.name || out?.to?.name || "";
  return {
    title: "PAY-OUT VOUCHER",
    subtitle: "Bill with no paper",
    branchName: branch?.name || "",
    no: voucherNo(branch, no),
    date: settle?.date || "",
    rows: [
      { label: "Given to", value: took || "—" },
      { label: "For", value: [settle?.purpose, settle?.category].filter(Boolean).join(" · ") || "—" },
      { label: "Spent", value: money(settle?.billAmount), words: amountInWords(settle?.billAmount, currency) },
      { label: "Handed out", value: `${money(settle?.floatAmount)} from the till · ${changeText(settle?.floatAmount, settle?.billAmount, money)}` },
      { label: "Why no bill", value: settle?.voucherReason || "—" },
      ...(settle?.note ? [{ label: "Note", value: settle.note }] : []),
    ],
    boxes: [
      signBox("Prepared by", settle?.by, settle?.createdAt),
      received
        ? signBox("Received by", { name: received.name || took }, received.at, { sig: received.sig || null })
        : signBox("Received by", null, null, { waiting: took ? `${took} — not signed` : "—" }),
      approval ? signBox("Approved by", approval.by, approval.at, approval.stamp ? { stamp: approval.stamp } : {}) : signBox("Approved by", null, null, { waiting: "Waiting for approval" }),
    ],
  };
}
