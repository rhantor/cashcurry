// lib/payouts/model.js — pay-outs and their bills (roadmap 4.10; replaces
// bills sent on WhatsApp). Pure: no Firebase, used by the money engine, the
// screens and the tests.
//
// Two kinds of record in companies/{c}/branches/{b}/payouts, each dated by
// its own `date` (the money engine dates every record by one field, so the
// monthly summaries can query it):
//
//   kind "out"    — money handed out from the till ("RM 100 to Ali for gas").
//                   The till goes down by `amount` that day.
//   kind "settle" — the bill came back, on its own day: the float comes back
//                   to the till (+floatAmount) and the bill leaves it
//                   (−billAmount); so the till moves by the change returned
//                   (or the extra paid if the bill was more).
//                   Once someone in charge approves it, the bill becomes a
//                   cost (costs/{id}, meta.type "payout", same day and
//                   amount) and the settle record stops counting the bill —
//                   the cost does. Nothing is counted twice.
//
// Open pay-outs (handed out, no bill yet) are money still out of the till;
// they show by person and age and count in the daily cash check.

/** Hours a pay-out may stay open before it shows as late (a day or two is normal — owner, 19 Oct). */
export const LATE_AFTER_HOURS = 48;

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (v) => Math.round(v * 100) / 100;

/** What a payouts record does to cash in the till (negative = out). */
export function payoutCash(doc) {
  if (!doc) return 0;
  if (doc.kind === "out") return -n(doc.amount);
  if (doc.kind === "settle") return n(doc.floatAmount) - (doc.status === "approved" ? 0 : n(doc.billAmount));
  return 0;
}

/** + money given back to the till, − money the till paid on top. */
export const changeOf = (floatAmount, billAmount) => round2(n(floatAmount) - n(billAmount));

/** Words for the difference when a bill comes back. */
export function changeText(floatAmount, billAmount, money = (v) => v.toFixed(2)) {
  const c = changeOf(floatAmount, billAmount);
  if (c > 0) return `${money(c)} change goes back in the till`;
  if (c < 0) return `${money(-c)} more paid from the till`;
  return "Exact — nothing comes back";
}

const who = (u) => ({ uid: u?.uid || null, name: [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.username || u?.email || "", role: u?.role || "" });

/** A bill's delivery / transport charge, or null when there is none. */
export function deliveryOf(settle) {
  const amount = round2(n(settle?.delivery?.amount));
  return amount > 0 ? { ...settle.delivery, amount } : null;
}

/** What the bill spent on the things themselves: everything less the delivery. */
export const goodsOf = (settle) => round2(n(settle?.billAmount) - (deliveryOf(settle)?.amount || 0));

/**
 * The delivery's own cost when a bill with a delivery charge is approved
 * (both kinds — a shop bill and a supplier's), or null. Same day, from the
 * till; its receipt goes with it.
 */
export function deliveryCost(settle, user, now = new Date()) {
  const d = deliveryOf(settle);
  if (!d) return null;
  return {
    date: settle.date,
    amount: d.amount,
    ...pickFields(d),
    category: d.category || "Transport & delivery",
    description: ["Delivery / transport", settle.supplier?.vendorName || settle.purpose, settle.to?.name ? `Pay-out to ${settle.to.name}` : ""].filter(Boolean).join(" · "),
    attachments: d.receipts || [],
    receipts: d.receipts || [],
    fileURL: d.receipts?.[0] || null,
    paidFromOffice: "front",
    paidMethod: "cash",
    isFrontOffice: true,
    isBackOffice: false,
    meta: { type: "payout", part: "delivery", payoutId: settle.payoutId, settleId: settle.id },
    createdBy: settle.by,
    approvedBy: who(user),
    createdAt: now,
  };
}

/** A new pay-out. `to` = { name, staffId? }. */
export function newPayout({ date, amount, to, purpose, forVendor = null, forBills = [], forPo = null }, user, now = new Date()) {
  return {
    kind: "out",
    date,
    amount: round2(n(amount)),
    to: { name: String(to?.name || "").trim(), ...(to?.staffId ? { staffId: to.staffId } : {}) },
    purpose: String(purpose || "").trim(),
    // money sent to pay a supplier's bills (lib/payouts/supplier.js): which supplier, which bills
    ...(forVendor?.vendorId ? { forVendor: { vendorId: forVendor.vendorId, vendorName: forVendor.vendorName || "" }, forBills: forBills.map((b) => ({ billId: b.billId || b.id, invoiceNo: b.invoiceNo || "", balance: round2(n(b.balance)) })) } : {}),
    // money sent to collect a purchase order (paid on delivery / at the supplier)
    ...(forPo?.poId ? { forPo: { poId: forPo.poId, poNo: forPo.poNo || "", totalEst: round2(n(forPo.totalEst)) } } : {}),
    status: "open", // open → billed → approved (or the bill is sent back: still billed)
    by: who(user),
    createdBy: who(user),
    createdAt: now,
  };
}

/**
 * The bill for a pay-out. `fields` = the category snapshot
 * (lib/costs/categories.js categoryFields); `files` = the bill (photos or
 * PDFs); `receipts` = a separate payment receipt, if the shop gave one;
 * `voucherReason` when there is no bill paper. `delivery` = a delivery or
 * transport charge paid on top ({ amount, fields, receipts }): `billAmount` is
 * everything spent, delivery included, and approving makes the delivery a
 * cost of its own, in its own category.
 */
export function newSettle(payout, { date, billAmount, fields, files = [], receipts = [], voucherReason = "", note = "", supplier = null, delivery = null }, user, now = new Date()) {
  const d = deliveryOf({ delivery });
  return {
    kind: "settle",
    payoutId: payout.id,
    date,
    floatAmount: round2(n(payout.amount)),
    billAmount: round2(n(billAmount)),
    change: changeOf(payout.amount, billAmount),
    to: payout.to || null,
    purpose: payout.purpose || "",
    payoutBy: payout.by || null, // who handed it out — they don't approve it either
    ...(fields || {}),
    attachments: files.filter(Boolean),
    receipts: receipts.filter(Boolean),
    ...(voucherReason ? { voucherReason: String(voucherReason).trim() } : {}),
    note: String(note || "").trim(),
    // spent at a supplier: approving writes it into Purchases (lib/payouts/supplier.js)
    ...(supplier ? { supplier } : {}),
    delivery: d ? { amount: d.amount, ...(delivery.fields || {}), receipts: (delivery.receipts || []).filter(Boolean) } : null,
    status: "pending",
    by: who(user),
    createdBy: who(user),
    createdAt: now,
  };
}

/** May this person approve or send back this bill? Not one they handed out or brought back. */
export function canReviewBill(user, settle, can) {
  if (!user?.uid || !settle || settle.status !== "pending") return false;
  if (!can(user.role, "costs.approve")) return false;
  return settle.by?.uid !== user.uid && settle.payoutBy?.uid !== user.uid;
}

/**
 * Approving, possibly corrected (amount and/or category). The originals are
 * kept on the bill. Returns { settle: patch, cost: the new cost record,
 * deliveryCost: the delivery's own cost or null }. A corrected amount is
 * everything spent, delivery included; the delivery is never more than it.
 */
export function approveBill(settle, { billAmount, fields } = {}, user, now = new Date()) {
  const corrected = billAmount != null && round2(n(billAmount)) !== round2(n(settle.billAmount));
  const recategorised = fields && fields.categoryId && fields.categoryId !== settle.categoryId;
  const finalAmount = corrected ? round2(n(billAmount)) : round2(n(settle.billAmount));
  const delivery = deliveryOf(settle)?.amount || 0;
  if (delivery > finalAmount) throw new Error("The amount can't be less than the delivery charge.");
  const finalFields = recategorised ? fields : pickFields(settle);
  const review = { by: who(user), at: now, ...(corrected || recategorised ? { original: { billAmount: settle.billAmount, ...pickFields(settle) } } : {}) };
  const settlePatch = {
    status: "approved",
    billAmount: finalAmount,
    change: changeOf(settle.floatAmount, finalAmount),
    ...finalFields,
    review,
  };
  const cost = {
    date: settle.date,
    amount: round2(finalAmount - delivery),
    ...finalFields,
    description: [settle.purpose, settle.to?.name ? `Pay-out to ${settle.to.name}` : "", settle.note].filter(Boolean).join(" · "),
    // the bill first, then any payment receipt (receipts also listed apart)
    attachments: [...(settle.attachments || []), ...(settle.receipts || [])],
    receipts: settle.receipts || [],
    fileURL: settle.attachments?.[0] || settle.receipts?.[0] || null,
    paidFromOffice: "front",
    paidMethod: "cash",
    isFrontOffice: true,
    isBackOffice: false,
    ...(settle.voucherReason ? { voucher: { status: "approved", reason: settle.voucherReason, by: settle.by, at: settle.createdAt || now, decidedBy: who(user), decidedAt: now } } : {}),
    meta: { type: "payout", payoutId: settle.payoutId, settleId: settle.id },
    createdBy: settle.by,
    approvedBy: who(user),
    createdAt: now,
  };
  return { settle: settlePatch, cost, deliveryCost: deliveryCost(settle, user, now) };
}

function pickFields(x) {
  const out = {};
  for (const k of ["categoryId", "category", "costGroupId", "costGroup", "costKind"]) if (x?.[k] !== undefined) out[k] = x[k];
  return out;
}

export function rejectBill(note, user, now = new Date()) {
  return { status: "rejected", review: { by: who(user), at: now, note: String(note || "").trim() } };
}

/** Hours since a pay-out went out. */
export function ageHours(payout, now = new Date()) {
  const t = payout?.createdAt?.toDate ? payout.createdAt.toDate() : payout?.createdAt ? new Date(payout.createdAt) : payout?.date ? new Date(`${payout.date}T12:00:00`) : null;
  return t && !isNaN(t) ? Math.max(0, (now - t) / 3600000) : 0;
}

/** Open pay-outs grouped by person, oldest first, with totals and whether any is late. */
export function openByPerson(payouts, now = new Date()) {
  const open = payouts.filter((p) => p.kind === "out" && p.status === "open");
  const map = new Map();
  for (const p of open) {
    const key = p.to?.staffId || String(p.to?.name || "—").toLowerCase();
    const row = map.get(key) || { key, name: p.to?.name || "—", total: 0, items: [], late: false };
    const age = ageHours(p, now);
    row.items.push({ ...p, ageHours: age, late: age > LATE_AFTER_HOURS });
    row.total = round2(row.total + n(p.amount));
    row.late = row.late || age > LATE_AFTER_HOURS;
    map.set(key, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, items: r.items.sort((a, b) => b.ageHours - a.ageHours) }))
    .sort((a, b) => b.items[0].ageHours - a.items[0].ageHours);
}

/** "3 h", "2 days" */
export function ageText(hours) {
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.floor(hours)} h`;
  const d = Math.floor(hours / 24);
  return `${d} day${d > 1 ? "s" : ""}`;
}
