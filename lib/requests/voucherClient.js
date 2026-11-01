// lib/requests/voucherClient.js — completing an advance's or staff loan's
// voucher (owner, 1 Nov): when the money is handed over, the staff member
// signs for it ("Received by") and it takes the branch's next number for its
// kind (counters/advanceVouchers, counters/loanVouchers) — in one go with
// marking it paid. Then it is drawn as a picture onto the record.
"use client";
import { doc, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { saveVoucherImage } from "@/lib/costs/voucherImage";
import { REQUEST_TYPES, toRequest } from "./model";
import { requestSheet } from "./voucher";

const SERIES = { advance: "advanceVouchers", staffLoan: "loanVouchers" };
const recordRef = (companyId, branchId, type, id) => doc(db, "companies", companyId, "branches", branchId, REQUEST_TYPES[type].collection, id);

/**
 * Number the voucher and record who received it — with `paidOut` when this is
 * the hand-over (Mark paid), or alone for one given on the spot (already
 * paid as it was saved). Returns the record as it now is.
 */
export async function completeVoucher({ companyId, branchId, type, id, received, paidOut = null }) {
  const ref = recordRef(companyId, branchId, type, id);
  const counter = doc(db, "companies", companyId, "branches", branchId, "counters", SERIES[type]);
  return runTransaction(db, async (tx) => {
    const [snap, num] = [await tx.get(ref), await tx.get(counter)];
    if (!snap.exists()) throw new Error("This record no longer exists");
    const data = snap.data();
    if (paidOut && data.paidOut) throw new Error("It has already been paid out");
    const no = data.voucher?.no || (num.exists() ? Number(num.data().last) || 0 : 0) + 1;
    const voucher = { no, ...(received ? { received } : {}) };
    tx.update(ref, { voucher, ...(paidOut ? { paidOut, paidFromOffice: paidOut.from } : {}), updatedAt: serverTimestamp() });
    if (!data.voucher?.no) tx.set(counter, { last: no, ref: id });
    return { id, ...data, voucher, ...(paidOut ? { paidOut, paidFromOffice: paidOut.from } : {}) };
  });
}

/** Draw the completed voucher and put its picture on the record (`uid`: whose folder it goes in). */
export async function attachRequestVoucher({ companyId, branchId, type, record, branch, currency, money, uid }) {
  const sheet = requestSheet(toRequest(type, record), { branch, currency, money });
  const url = await saveVoucherImage({ companyId, sheet, path: `payouts/${companyId}/${branchId}/${uid}/voucher_${type}_${record.id}_${Date.now()}.png` });
  await updateDoc(recordRef(companyId, branchId, type, record.id), { "voucher.image": url, updatedAt: serverTimestamp() });
  return url;
}
