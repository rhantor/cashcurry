// lib/requests/voucher.js — an advance or staff loan as a paper voucher (owner,
// 1 Nov): who it is for, how much (and in words), what for and how it is paid
// back, then "Requested by", "Approved by" and "Received by" — the staff
// member signs for the money when it is handed over. Its number (DKL-A-0001
// advances, DKL-L-0001 staff loans) is given then too. Pure.
import { amountInWords, signBox, voucherNo } from "@/lib/costs/voucherPaper";

const KIND = {
  advance: { title: "ADVANCE VOUCHER", subtitle: "Salary advance", letter: "A" },
  staffLoan: { title: "STAFF LOAN VOUCHER", subtitle: "Staff loan", letter: "L" },
};
export const voucherLetter = (type) => KIND[type]?.letter || "V";

/** How it is paid back, in words. */
export function repaymentText(req, money = (v) => String(v)) {
  const list = Array.isArray(req?.installments) ? req.installments : [];
  const n = Number(req?.repaymentInstallments || req?.durationMonths || list.length) || 0;
  const per = Number(req?.repaymentPerInstallment || req?.emi || list[0]?.amount) || 0;
  if (!n || !per) return "";
  const from = req?.deductionMonth || req?.repaymentStartDate || list[0]?.month || list[0]?.date || "";
  return `${n === 1 ? "Once" : `${n} months`}: ${money(per)}${n === 1 ? "" : " a month"} from pay${from ? `, from ${String(from).slice(0, 7)}` : ""}`;
}

const fromText = (paidOut) => (!paidOut ? "—" : paidOut.from === "back" ? "Bank (transfer)" : "Till (cash)");

/**
 * The voucher for an advance or staff loan (a request from
 * lib/requests/model.js toRequest). Boxes not yet signed wait: approval until
 * approved, "Received by" until the money is handed over and signed for.
 */
export function requestSheet(req, { branch, currency = "MYR", money = (v) => String(v) } = {}) {
  const k = KIND[req?.type] || KIND.advance;
  const v = req?.voucher || {};
  const approved = req?.approvedBy?.name ? { uid: req.approvedBy.id || req.approvedBy.uid || null, name: req.approvedBy.name } : null;
  const repay = repaymentText(req, money);
  return {
    title: k.title,
    subtitle: k.subtitle,
    branchName: branch?.name || "",
    no: voucherNo(branch, v.no, k.letter),
    date: req?.paidOut?.date || req?.date || "",
    rows: [
      { label: "Paid to", value: req?.staffName || "—" },
      { label: "For", value: req?.reason || req?.purpose || "—" },
      { label: "Amount", value: money(req?.amount), words: amountInWords(req?.amount, currency) },
      ...(repay ? [{ label: "Paid back", value: repay }] : []),
      { label: "Paid from", value: fromText(req?.paidOut) },
      ...(req?.paidOut?.by?.name ? [{ label: "Handed over by", value: req.paidOut.by.name }] : []),
    ],
    boxes: [
      signBox("Requested by", req?.createdBy?.uid || req?.createdBy?.name ? { uid: req.createdBy.uid, name: req.createdBy.name || req.createdBy.username || req.staffName } : { name: req?.staffName }, req?.askedAt || req?.createdAt),
      approved ? signBox("Approved by", approved, req.approvedBy.timestamp) : signBox("Approved by", null, null, { waiting: "Waiting for approval" }),
      v.received
        ? signBox("Received by", { name: v.received.name }, v.received.at, { sig: v.received.sig || null })
        : signBox("Received by", null, null, { waiting: req?.paidOut ? (req.paidOut.from === "back" ? "Paid by bank transfer" : "Paid — not signed") : "Signs when paid" }),
    ],
  };
}

/** What a voucher's `received` holds: the name, when, the drawn signature. */
export const receivedStamp = (name, sig, at = new Date().toISOString()) => ({ name: String(name || "").trim(), sig: sig || null, at });
