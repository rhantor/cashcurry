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

/** "Voucher · V-123" / "Discount" */
export const discountLabel = (d) => [d?.kind || "Discount", String(d?.note || "").trim()].filter(Boolean).join(" · ");
