// Render the app's real finance hooks against the fake backend and return the
// figures each screen shows. The calling test file must mock the data layer
// (see finance.test.js).
import { renderHook, waitFor } from "@testing-library/react";
import { useSummaryReportLogic } from "@/hook/useSummaryReportLogic";
import useBranchData from "@/utils/dashboard/useBranchData";
import useCompanyData from "@/utils/dashboard/useCompanyData";
import { useDataset } from "./fakeBackend";

/** Round to cents; turns -0 into 0 so goldens don't flip on sign of zero. */
export const cents = (v) => {
  const r = Math.round((Number(v) || 0) * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
};
const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, cents(obj[k])]));

/** "2026-09" → the period the dashboards' "This Month" filter covers. */
export function monthFilter(month) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: new Date(y, m - 1, 1), to: new Date(y, m - 1, last, 23, 59, 59), preset: "month" };
}

export const SUMMARY_KEYS = [
  "handInCash", "bankBalance", "netTotal", "totalSales", "totalCashSales", "totalBankedSales",
  "foodDelivery", "totalCostFront", "totalCostBack", "totalAdvances", "totalLoanGiven",
  "periodDeposits", "periodWithdrawals",
];

export const BRANCH_DASHBOARD_KEYS = [
  "handInCash", "bankExpected", "totalSales", "totalCash", "bankedSales", "totalCosts",
  "totalCostsFront", "totalCostsBack", "totalSal", "totalAdv", "totalStaffLoanCash",
  "totalDep", "totalWdr", "deliveryTotal",
];

export const COMPANY_DASHBOARD_KEYS = [
  "estCashOnHand", "effectiveBankedAfterWithdrawals", "totalSales", "totalCash", "bankedSales",
  "totalCosts", "totalSal", "totalAdv", "totalDep", "totalWdr",
];

/** Summary report (reports page), "By Month" or "Date Range" filter. */
export function summary(dataset, branchId, filterState) {
  useDataset(dataset, branchId);
  const { result, unmount } = renderHook(() => useSummaryReportLogic(filterState, "all"));
  const kpis = result.current.computed.kpis;
  unmount();
  return pick(kpis, SUMMARY_KEYS);
}

export const summaryForMonth = (dataset, branchId, month) =>
  summary(dataset, branchId, { filterType: "month", selectedMonth: month, dateRange: {} });

/** Round every number in a structure to cents (for stable comparisons). */
export function centsDeep(v) {
  if (typeof v === "number") return cents(v);
  if (Array.isArray(v)) return v.map(centsDeep);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, centsDeep(x)]));
  return v;
}

/**
 * Everything the summary report screen and its PDF/Excel exports read:
 * the day rows (raw cost records reduced to their ids) and period totals.
 */
export function summaryDetail(dataset, branchId, filterState) {
  useDataset(dataset, branchId);
  const { result, unmount } = renderHook(() => useSummaryReportLogic(filterState, "all"));
  const c = result.current.computed;
  unmount();
  const rows = c.rows.map(({ costEntries, ...r }) => (costEntries ? { ...r, costEntryIds: costEntries.map((e) => e.id) } : r));
  return centsDeep({
    rows,
    kpis: c.kpis,
    periodTotals: c.periodTotals,
    periodTotalSales: c.periodTotalSales,
    periodDeposits: c.periodDeposits,
    periodWithdrawals: c.periodWithdrawals,
    periodRepaySums: c.periodRepaySums,
  });
}

const BRANCH_CHARTS = [
  "salesTrend", "compareSalesTrend", "salesBreakdown", "salesVsCosts", "cashVsCost",
  "bankedVsWdr", "bankedVsBackCost", "loanTimeline", "tenderKeys", "bankedTenderKeys",
];
const COMPANY_CHARTS = [
  "salesTrend", "salesBreakdown", "salesVsCosts", "cashVsCost", "bankedVsWdr", "loanTimeline",
  "tenderKeys", "branchPerf", "branchLoanBalances",
];

/** Chart series on the branch dashboard. */
export function branchCharts(dataset, branchId, filter) {
  useDataset(dataset, branchId);
  const { result, unmount } = renderHook(() => useBranchData(filter));
  const out = Object.fromEntries(BRANCH_CHARTS.map((k) => [k, result.current[k]]));
  unmount();
  return centsDeep(out);
}

/** Chart series on the company dashboard. */
export async function companyCharts(dataset, filter) {
  useDataset(dataset, null);
  const { result, unmount } = renderHook(() => useCompanyData(filter));
  await waitFor(() => {
    if (result.current.loading) throw new Error("still loading");
  });
  const out = Object.fromEntries(COMPANY_CHARTS.map((k) => [k, result.current[k]]));
  unmount();
  return centsDeep(out);
}

/** Which source the branch dashboard used ("fast" | "full"). */
export function branchDataSource(dataset, branchId, filter) {
  useDataset(dataset, branchId);
  const { result, unmount } = renderHook(() => useBranchData(filter));
  const out = result.current.dataSource;
  unmount();
  return out;
}

/** Branch dashboard KPIs for a dashboard filter ({ from, to, preset }). */
export function branchDashboard(dataset, branchId, filter) {
  useDataset(dataset, branchId);
  const { result, unmount } = renderHook(() => useBranchData(filter));
  const out = pick(result.current, BRANCH_DASHBOARD_KEYS);
  unmount();
  return out;
}

/** Company dashboard KPIs for a dashboard filter. Loads asynchronously. */
export async function companyDashboard(dataset, filter) {
  useDataset(dataset, null);
  const { result, unmount } = renderHook(() => useCompanyData(filter));
  await waitFor(() => {
    if (result.current.loading) throw new Error("still loading");
  });
  const out = pick(result.current, COMPANY_DASHBOARD_KEYS);
  unmount();
  return out;
}
