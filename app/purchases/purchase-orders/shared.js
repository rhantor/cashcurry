

export const lineTotal = (row, qtyKey = "requestedQty", priceKey = "estPrice") =>
  Number(row?.[qtyKey] || 0) * Number(row?.[priceKey] || 0);
