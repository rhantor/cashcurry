/* eslint-disable react/prop-types */
"use client";
// Approved advances and staff loans that have not been handed over yet.
// "Mark paid" records when and from where the money left (paidOut); only then
// does it count in cash in hand / the bank (lib/finance/rules.js paidOutOf).
import React, { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { useGetAdvanceEntriesQuery, usePayOutAdvanceMutation } from "@/lib/redux/api/AdvanceApiSlice";
import { useGetStaffLoansQuery, usePayOutStaffLoanMutation } from "@/lib/redux/api/staffLoanApiSlice";
import useCurrency from "@/app/hooks/useCurrency";
import { useBusinessToday } from "@/app/hooks/useRegion";
import { formatMoney } from "@/lib/region";
import { isLeaveRequest } from "@/lib/finance/rules";

// Roles allowed to hand over money. Cashiers join once the database rules
// are tightened (roadmap 2.1) — today they cannot write staff loans.
export const PAYER_ROLES = ["branchAdmin", "manager", "accountant", "supervisor", "owner", "gm", "superAdmin"];

const showDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? format(parseISO(d), "d MMM yyyy") : d || "-");

/** Approved and not yet paid: paidOut is explicitly null (older records have no field and count as paid). */
const waiting = (x) => x.status === "approved" && x.paidOut === null && !isLeaveRequest(x);

export default function PayOutQueue({ companyId, branchId, user, title = "Waiting to be paid" }) {
  const currency = useCurrency();
  const today = useBusinessToday();
  const args = { companyId, branchId };
  const skip = { skip: !companyId || !branchId };
  const { data: advances = [] } = useGetAdvanceEntriesQuery(args, skip);
  const { data: loans = [] } = useGetStaffLoansQuery(args, skip);
  const [payAdvance] = usePayOutAdvanceMutation();
  const [payLoan] = usePayOutStaffLoanMutation();

  const canPay = PAYER_ROLES.includes(user?.role);
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState({ date: "", from: "front" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const items = useMemo(
    () => [
      ...advances.filter(waiting).map((a) => ({ ...a, kind: "advance", label: "Advance" })),
      ...loans.filter((l) => waiting(l) && l.source !== "migration").map((l) => ({ ...l, kind: "staffLoan", label: "Staff loan" })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [advances, loans]
  );
  const total = items.reduce((s, x) => s + Number(x.amount || 0), 0);

  if (!items.length) return null;

  const open = (item) => {
    setError("");
    setOpenId(`${item.kind}-${item.id}`);
    setDraft({ date: today, from: item.paidFromOffice === "back" ? "back" : "front" });
  };

  const confirm = async (item) => {
    if (!draft.date) return setError("Pick the date the money was handed over.");
    setBusy(true);
    setError("");
    try {
      const pay = item.kind === "advance" ? payAdvance : payLoan;
      await pay({ companyId, branchId, id: item.id, date: draft.date, from: draft.from, user }).unwrap();
      setOpenId(null);
    } catch (e) {
      setError(e?.message || "Could not mark it paid. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold text-amber-900">{title}</h2>
        <span className="text-sm text-amber-800">
          {items.length} · {formatMoney(total, currency)}
        </span>
      </div>
      <p className="text-xs text-amber-800">
        Approved, but no money has left yet — these do not reduce cash in hand until marked paid.
      </p>

      <ul className="space-y-2">
        {items.map((item) => {
          const key = `${item.kind}-${item.id}`;
          const isOpen = openId === key;
          return (
            <li key={key} className="rounded-xl border border-amber-100 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">
                    {item.staffName || "—"}{" "}
                    <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{item.label}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Requested {showDate(item.date)}
                    {item.approvedBy?.name ? ` · approved by ${item.approvedBy.name}` : ""}
                    {item.reason ? ` · ${item.reason}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">{formatMoney(item.amount, currency)}</span>
                  {canPay && !isOpen && (
                    <button
                      type="button"
                      onClick={() => open(item)}
                      className="rounded-lg bg-mint-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-mint-700"
                    >
                      Mark paid
                    </button>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="mt-3 grid gap-3 border-t border-gray-100 pt-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-gray-700">Paid on</span>
                    <input
                      type="date"
                      value={draft.date}
                      max={today}
                      onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-gray-700">Paid from</span>
                    <select
                      value={draft.from}
                      onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    >
                      <option value="front">Till (cash)</option>
                      <option value="back">Bank (transfer)</option>
                    </select>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => confirm(item)}
                      className="rounded-lg bg-mint-600 px-4 py-2 text-sm font-semibold text-white hover:bg-mint-700 disabled:opacity-60"
                    >
                      {busy ? "Saving…" : `Confirm ${formatMoney(item.amount, currency)}`}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setOpenId(null)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                  {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!canPay && <p className="text-xs text-amber-800">Only a manager, accountant, supervisor or branch admin can mark these paid.</p>}
    </div>
  );
}
