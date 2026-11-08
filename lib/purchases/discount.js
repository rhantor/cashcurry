// lib/purchases/discount.js — a discount or voucher on a supplier's bill (8 Nov).
// Pure. Often known only when the invoice comes, so it is one amount off the
// whole bill: item prices stay as charged (the next order starts from them),
// and the bill's `total` is what is really owed. Stored beside it:
//   subtotal: the items before the discount
//   discount: { amount, kind: "Discount" | "Voucher", note }
export const DISCOUNT_KINDS = ["Discount", "Voucher"];
export const NO_DISCOUNT = { amount: "", kind: "Discount", note: "" };

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** The amount off; 0 when there is none. */
export const discountAmount = (d) => Math.max(0, r2(d?.amount));

/** What is owed once the discount is off, to the sen. */
export const afterDiscount = (subtotal, d) => r2(r2(subtotal) - discountAmount(d));

/** What's wrong with it against this bill; "" when fine. */
export const discountProblem = (subtotal, d) => {
  const off = discountAmount(d);
  return off > 0 && off >= r2(subtotal) ? "The discount can't be the whole bill or more." : "";
};

/** What goes on the bill; null when there is no discount. */
export const discountToSave = (d) => {
  const amount = discountAmount(d);
  if (!(amount > 0)) return null;
  return { amount, kind: d.kind === "Voucher" ? "Voucher" : "Discount", note: String(d.note || "").trim() };
};

/** To the nearest 0.05: 1024.32 → 1024.30, 1024.33 → 1024.35. */
export const round5 = (n) => r2(Math.round(r2(n) * 20) / 20);

/** What rounding adds to an amount (below zero when it comes down); 0 when off. */
export const roundingOf = (n, on = true) => (on ? r2(round5(n) - r2(n)) : 0);

/** A bill from its items: the discount comes off first, then the total is rounded. */
export function billTotals(subtotal, d, on = true) {
  const net = afterDiscount(subtotal, d);
  const rounding = roundingOf(net, on);
  return { subtotal: r2(subtotal), net, rounding, total: r2(net + rounding) };
}

/** What goes on the bill beside its total; {} for a plain bill. */
export function billExtras(subtotal, d, on = true) {
  const { subtotal: before, rounding } = billTotals(subtotal, d, on);
  const discount = discountToSave(d);
  return {
    ...(discount || rounding ? { subtotal: before } : {}),
    ...(discount ? { discount } : {}),
    ...(rounding ? { rounding } : {}),
    ...(on ? {} : { roundingOff: true }), // Edit Bill keeps it off
  };
}

/** "− RM 0.02" / "+ RM 0.02" */
export const signedMoney = (n, money) => `${Number(n) < 0 ? "−" : "+"} ${money(Math.abs(Number(n) || 0))}`;

/** "Voucher · V-123" / "Discount" */
export const discountLabel = (d) => [d?.kind || "Discount", String(d?.note || "").trim()].filter(Boolean).join(" · ");
