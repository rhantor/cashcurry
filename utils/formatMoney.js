export const formatMoney = (amount, currencyCode = "RM") => {
  return `${currencyCode} ${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};
