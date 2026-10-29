// A staff loan paid back over n months: equal months, the last takes the rest.
// The month's amount is rounded up, unless that leaves the last month nothing
// or less (1,000 over 60: 17 × 59 is already 1,003) — then it is rounded down
// and the last month takes the bigger rest. One rule for the loan form, the
// saved instalments and a changed loan.
export function loanSplit(total, months) {
  const n = Math.max(1, Math.round(Number(months) || 1));
  const amount = Number(total) || 0;
  let emi = Math.ceil(amount / n);
  if (n > 1 && emi * (n - 1) >= amount) emi = Math.floor(amount / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? amount - emi * (n - 1) : emi));
}
