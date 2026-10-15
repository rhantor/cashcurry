// Currencies: how a branch's money is written.
//
// Branch settings store the currency as typed over the years — "MYR", "RM",
// "BDT", "৳"… — so look it up by code or symbol.

// `plain`: the sign in plain letters, for PDFs — their built-in fonts have no ৳ or ₹.
export const CURRENCIES = {
  MYR: { code: "MYR", symbol: "RM", plain: "RM", name: "Malaysian Ringgit", locale: "en-MY" },
  // en-IN groups by lakh and crore (1,00,000), as used in Bangladesh.
  BDT: { code: "BDT", symbol: "৳", plain: "Tk", name: "Bangladeshi Taka", locale: "en-IN" },
  SGD: { code: "SGD", symbol: "S$", plain: "S$", name: "Singapore Dollar", locale: "en-SG" },
  INR: { code: "INR", symbol: "₹", plain: "Rs", name: "Indian Rupee", locale: "en-IN" },
  USD: { code: "USD", symbol: "$", plain: "$", name: "US Dollar", locale: "en-US" },
};

const BY_SYMBOL = {
  RM: "MYR",
  "৳": "BDT",
  TK: "BDT",
  TAKA: "BDT",
  "S$": "SGD",
  "₹": "INR",
  $: "USD",
};

/** { code, symbol, name, locale } for a stored currency value. */
export function currencyInfo(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return CURRENCIES.MYR;
  const upper = raw.toUpperCase();
  const code = CURRENCIES[upper] ? upper : BY_SYMBOL[upper] || BY_SYMBOL[raw];
  if (code) return CURRENCIES[code];
  // Unknown: show it as typed.
  return { code: raw, symbol: raw, plain: raw, name: raw, locale: undefined };
}

/**
 * "RM 1,234.50", "৳ 1,23,456.00".
 * `plain: true` writes the sign in plain letters ("Tk 1,23,456.00") for PDFs.
 */
export function formatMoney(amount, currency, { decimals = 2, plain = false } = {}) {
  const info = currencyInfo(currency);
  const n = Number(amount || 0);
  return `${plain ? info.plain : info.symbol} ${n.toLocaleString(info.locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
