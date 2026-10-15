"use client";
import { useMemo } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { useGetLedgerStartQuery } from "@/lib/redux/api/summaryApiSlice";
import { fastStart, monthOf } from "@/lib/finance/monthly";

/**
 * Where a branch ledger's records come from.
 *
 * When the monthly summaries cover everything before the period's first month
 * (checked against server-side counts every time), only records from the 1st
 * of that month are downloaded and the earlier balance is carried in.
 * Otherwise — summaries missing, stale, or made by older rules — everything is
 * downloaded, exactly as before.
 *
 * No `fromKey` (e.g. a report over "all time") means the full download.
 *
 * @returns {{ ready: boolean, mode?: "fast"|"full", since?: string|null, carriedIn?: object|null }}
 *   Wait for `ready` before fetching records; pass `since` to the record
 *   queries and `carriedIn` to buildLedger.
 */
export default function useLedgerSource({ companyId, branchId, fromKey, settings, settingsReady, loanActivities, loansReady }) {
  const month = fromKey ? monthOf(fromKey) : null;
  const args = companyId && branchId && month ? { companyId, branchId, month } : skipToken;
  // Always re-check on arrival: a past month may have changed since.
  const { data: start, isFetching, isUninitialized } = useGetLedgerStartQuery(args, { refetchOnMountOrArgChange: true });
  const settled = month
    ? !isUninitialized && !isFetching && settingsReady && loansReady
    : !!(companyId && branchId && settingsReady && loansReady);

  return useMemo(() => {
    if (!settled) return { ready: false };
    const carriedIn = month && fastStart({ month, branchId, settings, start, loanActivities });
    return carriedIn
      ? { ready: true, mode: "fast", since: carriedIn.day, carriedIn }
      : { ready: true, mode: "full", since: null, carriedIn: null };
  }, [settled, month, branchId, settings, start, loanActivities]);
}
