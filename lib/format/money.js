// "RM 1,234.50" / "৳ 1,23,456.00" — the branch currency's sign and number
// grouping (see lib/region/currency.js). Accepts a code ("MYR") or sign ("RM").
export { formatMoney } from "@/lib/region/currency";
