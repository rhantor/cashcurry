import { format } from "date-fns";

const parseNumber = (val) => (val ? Number(val) : 0);

export const generateDateRange = (from, to) => {
  const days = (to - from) / (1000 * 60 * 60 * 24) + 1;
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    return format(d, "yyyy-MM-dd");
  });
};

export const calculateSummaryData = (
  sales,
  costs,
  advances,
  deposits,
  loans,
  dateRange
) => {
  const fromDateStr = format(dateRange.from, "yyyy-MM-dd");

  // running balance before the range
  let runningCash =
    sales
      .filter((s) => s.date < fromDateStr)
      .reduce((sum, s) => sum + parseNumber(s.cash), 0) -
    costs
      .filter((c) => c.date < fromDateStr)
      .reduce((sum, c) => sum + parseNumber(c.amount), 0) -
    advances
      .filter((a) => a.date < fromDateStr)
      .reduce((sum, a) => sum + parseNumber(a.amount), 0) -
    loans
      .filter((l) => l.date < fromDateStr && l.type === "given")
      .reduce((sum, l) => sum + parseNumber(l.amount), 0) +
    loans
      .filter((l) => l.date < fromDateStr && l.type === "received")
      .reduce((sum, l) => sum + parseNumber(l.amount), 0) -
    deposits
      .filter((d) => d.date < fromDateStr)
      .reduce((sum, d) => sum + parseNumber(d.amount), 0);

  const allDates = generateDateRange(dateRange.from, dateRange.to);

  const dailyRows = [];
  let totals = {
    cash: 0,
    card: 0,
    cheque: 0,
    online: 0,
    qr: 0,
    grab: 0,
    foodpanda: 0,
    promotion: 0,
    advance: 0,
    cost: 0,
    totalSales: 0,
  };

  allDates.forEach((d) => {
    const dailySales = sales.filter((s) => s.date === d);
    const dailyCosts = costs.filter((c) => c.date === d);
    const dailyAdvances = advances.filter((a) => a.date === d);
    const dailyDeposits = deposits.filter((dep) => dep.date === d);
    const dailyLoans = loans.filter((l) => l.date === d);

    const row = {
      date: d,
      cash: dailySales.reduce((sum, s) => sum + parseNumber(s.cash), 0),
      card: dailySales.reduce((sum, s) => sum + parseNumber(s.card), 0),
      cheque: dailySales.reduce((sum, s) => sum + parseNumber(s.cheque), 0),
      online: dailySales.reduce((sum, s) => sum + parseNumber(s.online), 0),
      qr: dailySales.reduce((sum, s) => sum + parseNumber(s.qr), 0),
      grab: dailySales.reduce((sum, s) => sum + parseNumber(s.grab), 0),
      foodpanda: dailySales.reduce(
        (sum, s) => sum + parseNumber(s.foodpanda),
        0
      ),
      promotion: dailySales.reduce(
        (sum, s) => sum + parseNumber(s.promotion),
        0
      ),
      advance: dailyAdvances.reduce((sum, a) => sum + parseNumber(a.amount), 0),
      cost: dailyCosts.reduce((sum, c) => sum + parseNumber(c.amount), 0),
      loanGiven: dailyLoans
        .filter((l) => l.type === "given")
        .reduce((sum, l) => sum + parseNumber(l.amount), 0),
      loanReceived: dailyLoans
        .filter((l) => l.type === "received")
        .reduce((sum, l) => sum + parseNumber(l.amount), 0),
      deposit: dailyDeposits.reduce((sum, d) => sum + parseNumber(d.amount), 0),
    };

    row.totalSales =
      row.cash +
      row.card +
      row.cheque +
      row.online +
      row.qr +
      row.grab +
      row.foodpanda +
      row.promotion;

    runningCash =
      runningCash +
      row.cash -
      row.cost -
      row.advance -
      row.loanGiven +
      row.loanReceived -
      row.deposit;
    row.runningCash = runningCash;

    // accumulate totals
    Object.keys(totals).forEach((k) => {
      totals[k] += row[k] || 0;
    });

    dailyRows.push(row);
  });

  return { dailyRows, totals, runningCash };
};
