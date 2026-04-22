/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
"use client";

import React, { useMemo, useState } from "react";
import {
  useGetApprovedLoanSummaryQuery,
  useGetLoanActivitiesQuery,
} from "@/lib/redux/api/loanApiSlice";
import { useGetBranchesBasicQuery } from "@/lib/redux/api/branchApiSlice";
import LoanPayCards from "./LoanPayCards";
import { skipToken } from "@reduxjs/toolkit/query";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import { aggregateLoanMovements } from "@/utils/finance/loanAgg";
import useCurrency from "@/app/hooks/useCurrency";

export default function LoanSummarySimple() {
  const currency = useCurrency();
  // -------- state --------
  const [tab, setTab] = useState("owe"); // "owe" | "owed"
  const [expanded, setExpanded] = useState({}); // { [otherId]: boolean }
  const [showSettled, setShowSettled] = useState(false);
  const SETTLED_WINDOW_DAYS = 365;
  const EPS = 0.000001;

  // -------- init user --------
  const { ready, companyId, branchId } = useResolvedCompanyBranch();
  const args = ready && companyId && branchId ? { companyId, branchId } : null;

  // -------- data hooks --------
  // If your API expects { companyId }, adjust accordingly.
  const {
    data: summary = {},
    isLoading,
    error,
  } = useGetApprovedLoanSummaryQuery(companyId || skipToken);

  const { data: branches = [] } = useGetBranchesBasicQuery(companyId || skipToken);

  // ✅ FIX: flatten args for activities
  const { data: pendingOutRep = [] } = useGetLoanActivitiesQuery(
    args
      ? { ...args, direction: "outgoing", status: "pending", type: "repayment" }
      : skipToken,
    { skip: !args, pollingInterval: 5000 }
  );
  const { data: approvedOutRep = [] } = useGetLoanActivitiesQuery(
    args
      ? {
          ...args,
          direction: "outgoing",
          status: "approved",
          type: "repayment",
        }
      : skipToken,
    { skip: !args }
  );
  const { data: pendingInRep = [] } = useGetLoanActivitiesQuery(
    args
      ? { ...args, direction: "incoming", status: "pending", type: "repayment" }
      : skipToken,
    { skip: !args, pollingInterval: 5000 }
  );
  const { data: approvedInRep = [] } = useGetLoanActivitiesQuery(
    args
      ? {
          ...args,
          direction: "incoming",
          status: "approved",
          type: "repayment",
        }
      : skipToken,
    { skip: !args }
  );

  // -------- helpers --------
  const nameOf = (id) => branches.find((b) => b.id === id)?.name || id || "-";

  const tsToMs = (v) => {
    if (!v) return null;
    if (typeof v === "number") return v;
    if (v?.seconds) return v.seconds * 1000;
    const ms = Date.parse(v);
    return Number.isNaN(ms) ? null : ms;
  };
  const txTimeMs = (r) => tsToMs(r?.approvedAt || r?.updatedAt || r?.createdAt);

  const fmtDateTime = (v) => {
    const ms = tsToMs(v);
    if (!ms) return "-";
    const d = new Date(ms);
    if (isNaN(d)) return "-";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const userName = (u) =>
    u?.name || u?.username || u?.email || u?.userName || "-";

  const groupBy = (arr, key) =>
    (arr || []).reduce((acc, r) => {
      const k = r[key];
      if (!k) return acc;
      (acc[k] ||= []).push(r);
      return acc;
    }, {});

  // Outgoing grouped by receiver; Incoming grouped by payer
  const pendingOutMap = useMemo(
    () =>
      groupBy(
        pendingOutRep.map((r) => ({ ...r, _to: r._toBranchId })),
        "_to"
      ),
    [pendingOutRep]
  );
  const approvedOutMap = useMemo(
    () =>
      groupBy(
        approvedOutRep.map((r) => ({ ...r, _to: r._toBranchId })),
        "_to"
      ),
    [approvedOutRep]
  );
  const pendingInMap = useMemo(
    () =>
      groupBy(
        pendingInRep.map((r) => ({ ...r, _from: r._fromBranchId })),
        "_from"
      ),
    [pendingInRep]
  );
  const approvedInMap = useMemo(
    () =>
      groupBy(
        approvedInRep.map((r) => ({ ...r, _from: r._fromBranchId })),
        "_from"
      ),
    [approvedInRep]
  );

  // -------- summary shaping --------
  const me = summary?.[branchId] || {
    relations: {},
    provided: 0,
    taken: 0,
    net: 0,
  };

  // I Owe (what I borrowed); Owed to Me (what I lent)
  const oweList = useMemo(
    () =>
      Object.entries(me.relations || {})
        .map(([otherId, rel]) => ({ otherId, amount: Number(rel?.taken || 0) }))
        .filter((x) => x.amount > EPS)
        .sort((a, b) => b.amount - a.amount),
    [me.relations]
  );
  const owedList = useMemo(
    () =>
      Object.entries(me.relations || {})
        .map(([otherId, rel]) => ({
          otherId,
          amount: Number(rel?.provided || 0),
        }))
        .filter((x) => x.amount > EPS)
        .sort((a, b) => b.amount - a.amount),
    [me.relations]
  );

  const totalOwe = useMemo(
    () => oweList.reduce((s, r) => s + r.amount, 0),
    [oweList]
  );
  const totalOwed = useMemo(
    () => owedList.reduce((s, r) => s + r.amount, 0),
    [owedList]
  );
  const net = totalOwed - totalOwe;

  // cards data for quick-pay (we only pass what we owe)
  const cardsData = useMemo(() => {
    const rels = Object.fromEntries(
      oweList.map(({ otherId, amount }) => [otherId, { net: amount }])
    );
    return branchId ? { [branchId]: { relations: rels } } : {};
  }, [branchId, oweList]);

  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  // Loan rows from summary
  const loansForOwe = (otherId) =>
    (me.relations?.[otherId]?.takenLoans || []).filter(
      (row) => Number(row?.outstanding ?? row?.amount ?? 0) > EPS
    );
  const loansForOwed = (otherId) =>
    (me.relations?.[otherId]?.providedLoans || []).filter(
      (row) => Number(row?.outstanding ?? row?.amount ?? 0) > EPS
    );

  const sumAmounts = (arr) =>
    (arr || []).reduce((s, r) => s + Number(r?.amount || 0), 0);

  // Ageing buckets
  const bucketizeLoans = (rows) => {
    const now = Date.now();
    const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    (rows || []).forEach((row) => {
      const tMs = tsToMs(row.approvedAt ?? row.createdAt);
      if (!Number.isFinite(tMs)) return;
      const days = Math.max(0, Math.floor((now - tMs) / 86400000));
      const val = Number(row?.outstanding ?? row?.amount ?? 0);
      if (val <= 0) return;
      if (days <= 30) buckets["0-30"] += val;
      else if (days <= 60) buckets["31-60"] += val;
      else if (days <= 90) buckets["61-90"] += val;
      else buckets["90+"] += val;
    });
    return buckets;
  };

  const myAllOweLoans = useMemo(
    () => Object.values(me.relations || {}).flatMap((r) => r.takenLoans || []),
    [me.relations]
  );
  const myAllOwedLoans = useMemo(
    () =>
      Object.values(me.relations || {}).flatMap((r) => r.providedLoans || []),
    [me.relations]
  );

  const ageingOwe = useMemo(
    () => bucketizeLoans(myAllOweLoans),
    [myAllOweLoans]
  );
  const ageingOwed = useMemo(
    () => bucketizeLoans(myAllOwedLoans),
    [myAllOwedLoans]
  );

  // Settled lists (amount ≈ 0 but recent)
  const settledCutoffMs = useMemo(
    () => Date.now() - SETTLED_WINDOW_DAYS * 86400000,
    [SETTLED_WINDOW_DAYS]
  );

  const settledOweList = useMemo(() => {
    const rels = me.relations || {};
    return Object.entries(rels)
      .filter(([_, rel]) => {
        const amt = Number(rel?.taken || 0);
        const last = Number(rel?.lastActivity || 0);
        const hasHistory =
          (rel?.takenLoans?.length || rel?.providedLoans?.length) > 0;
        return amt <= EPS && (last >= settledCutoffMs || hasHistory);
      })
      .map(([otherId, rel]) => ({
        otherId,
        lastActivity: rel?.lastActivity || null,
        loans: rel?.takenLoans || [],
      }))
      .sort(
        (a, b) => Number(b.lastActivity || 0) - Number(a.lastActivity || 0)
      );
  }, [me.relations, settledCutoffMs]);

  const settledOwedList = useMemo(() => {
    const rels = me.relations || {};
    return Object.entries(rels)
      .filter(([_, rel]) => {
        const amt = Number(rel?.provided || 0);
        const last = Number(rel?.lastActivity || 0);
        const hasHistory =
          (rel?.takenLoans?.length || rel?.providedLoans?.length) > 0;
        return amt <= EPS && (last >= settledCutoffMs || hasHistory);
      })
      .map(([otherId, rel]) => ({
        otherId,
        lastActivity: rel?.lastActivity || null,
        loans: rel?.providedLoans || [],
      }))
      .sort(
        (a, b) => Number(b.lastActivity || 0) - Number(a.lastActivity || 0)
      );
  }, [me.relations, settledCutoffMs]);

  // -------- small UI pieces --------
  const AmountCell = ({ row }) => {
    const outstanding = Number(row?.outstanding ?? row?.amount ?? 0);
    const original = Number(row?.amount ?? 0);
    const showOriginal = Math.abs(original - outstanding) > EPS;
    return (
      <div className="text-right">
        <div className="font-semibold">{currency} {outstanding.toFixed(2)}</div>
        {showOriginal && (
          <div className="text-[11px] text-gray-500">
            of {currency} {original.toFixed(2)}
          </div>
        )}
      </div>
    );
  };

  const MetaRow = ({ row }) => (
    <div className="text-[11px] text-gray-600">
      Requested by: <b>{userName(row.requestedBy)}</b>
      {" • "}Approved by: <b>{userName(row.approvedBy)}</b>
      {" • "}Requested: {fmtDateTime(row.createdAt)}
      {" • "}Approved: {fmtDateTime(row.approvedAt)}
      {" • "}Dur: {row.durationDays ?? 0}d
    </div>
  );

  const RepaymentRow = ({ r, side }) => {
    const when =
      r?.status === "approved"
        ? fmtDateTime(r?.approvedAt || r?.updatedAt || r?.createdAt)
        : fmtDateTime(r?.createdAt);
    const statusLabel = r?.status === "approved" ? "Approved" : "Pending";

    return (
      <li className="flex justify-between items-start border rounded px-2 py-2">
        <div className="pr-3 text-sm">
          <div>
            {side === "out" ? "Paid" : "Received"}:{" "}
            <b>{currency} {Number(r?.amount || 0).toFixed(2)}</b>
          </div>
          <div className="text-[11px] text-gray-600">
            {statusLabel} • {when}
            {r?.paymentMethod ? ` • ${r.paymentMethod}` : ""}
            {r?.paymentMethod === "cash" && r?.voucherNo
              ? ` • Vch: ${r.voucherNo}`
              : ""}
            {r?.paymentMethod === "online" && r?.bankName
              ? ` • ${r.bankName}`
              : ""}
            {r?.paymentMethod === "online" && r?.referenceNo
              ? ` • Ref: ${r.referenceNo}`
              : ""}
            {r?.proofUrl && (
              <>
                {" • "}
                <a
                  href={r.proofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline"
                >
                  Proof
                </a>
              </>
            )}
          </div>
        </div>
        <div className="text-right text-[11px] text-gray-600">
          {side === "out" ? "to" : "from"}{" "}
          <b>{nameOf(side === "out" ? r?._toBranchId : r?._fromBranchId)}</b>
        </div>
      </li>
    );
  };

  const AgeChips = ({ buckets }) => (
    <div className="flex gap-2 text-xs">
      {Object.entries(buckets).map(([k, v]) => (
        <span key={k} className="px-2 py-1 rounded-full bg-gray-100">
          {k}: <b>{currency} {Number(v || 0).toFixed(2)}</b>
        </span>
      ))}
    </div>
  );

  const getBranchName = (id) => branches?.find((b) => b.id === id)?.name || id;

  // -------- guards --------
  if (!ready) return <p className="p-4 text-gray-500 animate-pulse">Syncing session...</p>;
  if (!companyId || !branchId) return <p className="p-4 text-gray-500">Preparing dashboard…</p>;
  
  if (isLoading) return (
    <div className="p-8 flex flex-col items-center justify-center space-y-4">
      <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 font-medium">Loading loan summary…</p>
    </div>
  );

  if (error) {
    return (
      <div className="p-6">
        <div className="p-4 text-red-600 bg-red-50 border border-red-100 rounded-xl space-y-2">
          <p className="font-bold">⚠️ Failed to load summary.</p>
          <p className="text-sm opacity-90">
            {error?.message || (typeof error === 'string' ? error : "An unknown error occurred while fetching the summary.")}
          </p>
          {error?.status === 403 && (
            <p className="text-xs mt-2 italic text-red-500">
              Check your permissions or ensure you are assigned to a valid company.
            </p>
          )}
        </div>
      </div>
    );
  }

  // -------- render --------
  return (
    <div className="p-6 bg-white rounded-2xl shadow space-y-6">
      <h2 className="text-xl font-bold capitalize">
        {getBranchName(branchId)} Loans Overview
      </h2>

      {/* KPIs */}
      <div className="grid md:grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl border p-3">
          <div className="text-gray-500">Outstanding We Owe</div>
          <div className="text-2xl font-bold text-mint-600">
            {currency} {totalOwe.toFixed(2)}
          </div>
          <div className="mt-2">
            <AgeChips buckets={ageingOwe} />
          </div>
        </div>
        <div className="rounded-xl border p-3">
          <div className="text-gray-500">Outstanding Owed To Us</div>
          <div className="text-2xl font-bold text-emerald-600">
            {currency} {totalOwed.toFixed(2)}
          </div>
          <div className="mt-2">
            <AgeChips buckets={ageingOwed} />
          </div>
        </div>
        <div className="rounded-xl border p-3">
          <div className="text-gray-500">Net Position</div>
          <div
            className={`text-2xl font-bold ${
              net >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {currency} {net.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Tabs + toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab("owe")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === "owe" ? "bg-black text-white" : "bg-gray-100 text-gray-800"
          }`}
        >
          We Owe
        </button>
        <button
          onClick={() => setTab("owed")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === "owed" ? "bg-black text-white" : "bg-gray-100 text-gray-800"
          }`}
        >
          Owed To Us
        </button>

        <div className="flex-1" />
        <div className="ml-auto flex items-center gap-2">
          <input
            id="show-settled"
            type="checkbox"
            checked={showSettled}
            onChange={(e) => setShowSettled(e.target.checked)}
          />
          <label htmlFor="show-settled" className="text-sm text-gray-700">
            Show settled (last {SETTLED_WINDOW_DAYS} days)
          </label>
        </div>
      </div>

      {/* Tab content */}
      {tab === "owe" ? (
        <>
          {/* Quick pay cards */}
          <LoanPayCards summary={cardsData} />

          {/* Counterparty list with details */}
          <div className="mt-4">
            <div className="text-sm font-semibold mb-2">Who we owe</div>
            {oweList.length === 0 ? (
              <div className="text-sm text-gray-500">
                Nothing outstanding 🎉
              </div>
            ) : (
              <ul className="space-y-2">
                {oweList.map(({ otherId, amount }) => {
                  const isOpen = !!expanded[otherId];
                  const loanRows = loansForOwe(otherId);

                  // earliest approval among CURRENT open loans
                  const cycleStartMs = loanRows.length
                    ? (() => {
                        const vals = loanRows
                          .map((row) => tsToMs(row.approvedAt ?? row.createdAt))
                          .filter((x) => Number.isFinite(x));
                        return vals.length ? Math.min(...vals) : null;
                      })()
                    : null;

                  const allPending = pendingOutMap[otherId] || [];
                  const allApproved = approvedOutMap[otherId] || [];

                  const pendingRep = allPending.filter((r) =>
                    cycleStartMs ? txTimeMs(r) >= cycleStartMs : true
                  );
                  const approvedRep = allApproved.filter((r) =>
                    cycleStartMs ? txTimeMs(r) >= cycleStartMs : true
                  );
                  const prevApprovedRep = allApproved.filter((r) =>
                    cycleStartMs ? txTimeMs(r) < cycleStartMs : false
                  );

                  return (
                    <li key={otherId} className="border rounded-lg">
                      <button
                        onClick={() => toggle(otherId)}
                        className="w-full px-3 py-2 flex justify-between items-center"
                      >
                        <span className="text-left">
                          {nameOf(otherId)}
                          <span className="ml-2 text-xs text-gray-500">
                            {loanRows.length} loan
                            {loanRows.length !== 1 ? "s" : ""} •{" "}
                            {pendingRep.length} pending repayments
                          </span>
                        </span>
                        <span className="font-semibold">
                          {currency} {amount.toFixed(2)}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="px-3 pb-3 space-y-3">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">
                              Borrower: <b>{nameOf(branchId)}</b> • Lender:{" "}
                              <b>{nameOf(otherId)}</b>
                            </div>
                            <ul className="space-y-2">
                              {loanRows.map((row) => (
                                <li
                                  key={row.loanId}
                                  className="flex justify-between rounded border px-2 py-2"
                                >
                                  <div className="pr-3">
                                    <div className="text-sm">
                                      Loan #{String(row.loanId).slice(0, 6)}…
                                    </div>
                                    <MetaRow row={row} />
                                  </div>
                                  <AmountCell row={row} />
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <div className="text-sm font-semibold mb-1">
                              Pending repayments from us
                            </div>
                            {pendingRep.length === 0 ? (
                              <div className="text-xs text-gray-500">None</div>
                            ) : (
                              <ul className="space-y-2">
                                {pendingRep.map((r) => (
                                  <RepaymentRow key={r.id} r={r} side="out" />
                                ))}
                              </ul>
                            )}
                          </div>

                          <div>
                            <div className="text-sm font-semibold mb-1">
                              Approved repayments from us
                            </div>
                            {approvedRep.length === 0 ? (
                              <div className="text-xs text-gray-500">None</div>
                            ) : (
                              <ul className="space-y-2">
                                {approvedRep.map((r) => (
                                  <RepaymentRow key={r.id} r={r} side="out" />
                                ))}
                              </ul>
                            )}
                          </div>

                          {prevApprovedRep.length > 0 && (
                            <div>
                              <div className="text-sm font-semibold mb-1">
                                Previous cycle repayments
                              </div>
                              <ul className="space-y-2">
                                {prevApprovedRep.map((r) => (
                                  <RepaymentRow key={r.id} r={r} side="out" />
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Settled recently (We Owe) */}
          {showSettled && (
            <SettledBlock
              title="Settled recently (We Owe)"
              list={settledOweList}
              txMap={approvedOutMap}
              nameOf={nameOf}
              branchId={branchId}
              direction="out"
              fmtDateTime={fmtDateTime}
              sumAmounts={sumAmounts}
            />
          )}
        </>
      ) : (
        <div>
          <div className="text-sm font-semibold mb-2">Who owes us</div>
          {owedList.length === 0 ? (
            <div className="text-sm text-gray-500">
              No one owes you right now.
            </div>
          ) : (
            <ul className="space-y-2">
              {owedList.map(({ otherId, amount }) => {
                const isOpen = !!expanded[otherId];
                const loanRows = loansForOwed(otherId);

                const cycleStartMs = loanRows.length
                  ? (() => {
                      const vals = loanRows
                        .map((row) => tsToMs(row.approvedAt ?? row.createdAt))
                        .filter((x) => Number.isFinite(x));
                      return vals.length ? Math.min(...vals) : null;
                    })()
                  : null;

                const allPending = pendingInMap[otherId] || [];
                const allApproved = approvedInMap[otherId] || [];

                const pendingRep = allPending.filter((r) =>
                  cycleStartMs ? txTimeMs(r) >= cycleStartMs : true
                );
                const approvedRep = allApproved.filter((r) =>
                  cycleStartMs ? txTimeMs(r) >= cycleStartMs : true
                );
                const prevApprovedRep = allApproved.filter((r) =>
                  cycleStartMs ? txTimeMs(r) < cycleStartMs : false
                );

                return (
                  <li key={otherId} className="border rounded-lg">
                    <button
                      onClick={() => toggle(otherId)}
                      className="w-full px-3 py-2 flex justify-between items-center"
                    >
                      <span className="text-left">
                        {nameOf(otherId)}
                        <span className="ml-2 text-xs text-gray-500">
                          {loanRows.length} loan
                          {loanRows.length !== 1 ? "s" : ""} •{" "}
                          {pendingRep.length} pending repayments
                        </span>
                      </span>
                      <span className="font-semibold">
                        {currency} {amount.toFixed(2)}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="px-3 pb-3 space-y-3">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">
                            Lender: <b>{nameOf(branchId)}</b> • Borrower:{" "}
                            <b>{nameOf(otherId)}</b>
                          </div>
                          <ul className="space-y-2">
                            {loanRows.map((row) => (
                              <li
                                key={row.loanId}
                                className="flex justify-between rounded border px-2 py-2"
                              >
                                <div className="pr-3">
                                  <div className="text-sm">
                                    Loan #{String(row.loanId).slice(0, 6)}…
                                  </div>
                                  <MetaRow row={row} />
                                </div>
                                <AmountCell row={row} />
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <div className="text-sm font-semibold mb-1">
                            Pending repayments to us
                          </div>
                          {pendingRep.length === 0 ? (
                            <div className="text-xs text-gray-500">None</div>
                          ) : (
                            <ul className="space-y-2">
                              {pendingRep.map((r) => (
                                <RepaymentRow key={r.id} r={r} side="in" />
                              ))}
                            </ul>
                          )}
                          <div className="mt-1 text-xs text-gray-500">
                            Approve these in <b>Requested Panel</b>.
                          </div>
                        </div>

                        <div>
                          <div className="text-sm font-semibold mb-1">
                            Approved repayments to us
                          </div>
                          {approvedRep.length === 0 ? (
                            <div className="text-xs text-gray-500">None</div>
                          ) : (
                            <ul className="space-y-2">
                              {approvedRep.map((r) => (
                                <RepaymentRow key={r.id} r={r} side="in" />
                              ))}
                            </ul>
                          )}
                        </div>

                        {prevApprovedRep.length > 0 && (
                          <div>
                            <div className="text-sm font-semibold mb-1">
                              Previous cycle repayments
                            </div>
                            <ul className="space-y-2">
                              {prevApprovedRep.map((r) => (
                                <RepaymentRow key={r.id} r={r} side="in" />
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Settled recently (Owed to Us) */}
          {showSettled && (
            <SettledBlock
              title="Settled recently (Owed To Us)"
              list={settledOwedList}
              txMap={approvedInMap}
              nameOf={nameOf}
              branchId={branchId}
              direction="in"
              fmtDateTime={fmtDateTime}
              sumAmounts={sumAmounts}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** ---------- tiny subcomponent to render settled blocks ---------- */
function SettledBlock({
  title,
  list,
  txMap,
  nameOf,
  branchId,
  direction,
  fmtDateTime,
  sumAmounts,
}) {
  return (
    <div className="mt-6">
      <div className="text-sm font-semibold mb-2">{title}</div>
      {list.length === 0 ? (
        <div className="text-xs text-gray-500">
          No settled counterparties in the selected window.
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map(({ otherId, lastActivity, loans }) => {
            const txs = txMap[otherId] || [];
            const total = sumAmounts(txs);
            const whoIs =
              direction === "out"
                ? { a: "Borrower", b: "Lender" }
                : { a: "Lender", b: "Borrower" };

            return (
              <li key={otherId} className="border rounded-lg bg-gray-50">
                <div className="px-3 py-2 flex justify-between items-center">
                  <div className="text-sm">
                    {nameOf(otherId)}
                    <span className="ml-2 text-xs text-gray-500">
                      (settled)
                    </span>
                  </div>
                  <div className="text-right text-xs text-gray-600">
                    <div>Last activity: {fmtDateTime(lastActivity)}</div>
                    <div className="mt-0.5">
                      Settled via <b>{txs.length}</b> payment
                      {txs.length !== 1 ? "s" : ""} • Total{" "}
                      <b>{currency} {total.toFixed(2)}</b>
                    </div>
                  </div>
                </div>

                {loans?.length ? (
                  <div className="px-3">
                    <div className="text-xs text-gray-500 mb-1">
                      {whoIs.a}: <b>{nameOf(branchId)}</b> • {whoIs.b}:{" "}
                      <b>{nameOf(otherId)}</b>
                    </div>
                    <ul className="space-y-1">
                      {loans.map((row) => (
                        <li
                          key={row.loanId}
                          className="flex justify-between rounded border px-2 py-2 bg-white"
                        >
                          <div className="pr-3">
                            <div className="text-sm">
                              Loan #{String(row.loanId).slice(0, 6)}…
                            </div>
                            <div className="text-[11px] text-gray-600">
                              Requested: {fmtDateTime(row.createdAt)} •
                              Approved: {fmtDateTime(row.approvedAt)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{currency} 0.00</div>
                            <div className="text-[11px] text-gray-500">
                              settled
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="px-3 pb-3 mt-2">
                  <div className="text-sm font-semibold mb-1">
                    Repayment history (
                    {direction === "out" ? "from us" : "to us"})
                  </div>
                  {txs.length === 0 ? (
                    <div className="text-xs text-gray-500">No records</div>
                  ) : (
                    <ul className="space-y-2">
                      {txs.map((r) => (
                        <li
                          key={r.id}
                          className="flex justify-between items-start border rounded px-2 py-2"
                        >
                          <div className="pr-3 text-sm">
                            <div>
                              {direction === "out" ? "Paid" : "Received"}:{" "}
                              <b>{currency} {Number(r?.amount || 0).toFixed(2)}</b>
                            </div>
                            <div className="text-[11px] text-gray-600">
                              Approved •{" "}
                              {fmtDateTime(
                                r?.approvedAt || r?.updatedAt || r?.createdAt
                              )}
                            </div>
                          </div>
                          <div className="text-right text-[11px] text-gray-600">
                            {direction === "out" ? "to" : "from"}{" "}
                            <b>
                              {nameOf(
                                direction === "out"
                                  ? r?._toBranchId
                                  : r?._fromBranchId
                              )}
                            </b>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
