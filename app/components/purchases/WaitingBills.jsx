"use client";
// New vendor bills from a supervisor or in-charge, waiting for approval (13 Nov 2026).
// decide: on Due Bills, for those who keep the books — Approve / Send back.
// mine: on New Vendor Bill, for the person who added them — waiting and sent back.

import { useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { CheckCircle2, Clock, Paperclip, Undo2 } from "lucide-react";
import { useDecideVendorBillMutation, useGetVendorBillsQuery } from "@/lib/redux/api/vendorBillsApiSlice";
import { REJECTED, WAITING, approvalLine, cleanReason } from "@/lib/purchases/billApproval";
import { formatMoney } from "@/lib/region/currency";
import { stampOf } from "@/lib/people";
import useCurrency from "@/app/hooks/useCurrency";
import { promptDialog, toast } from "@/app/components/ui/notify";

const day = (d) => {
  const t = d ? new Date(`${d}T00:00:00`) : null;
  return t && !Number.isNaN(t.getTime()) ? t.toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—";
};

export default function WaitingBills({ companyId, branchId, user, mode = "decide" }) {
  const currency = useCurrency();
  const money = (n) => formatMoney(Number(n) || 0, currency);
  const args = companyId && branchId ? { companyId, branchId } : null;
  const { data: waiting = [] } = useGetVendorBillsQuery(args ? { ...args, status: WAITING } : skipToken, { pollingInterval: 60000 });
  const { data: sentBack = [] } = useGetVendorBillsQuery(mode === "mine" && args ? { ...args, status: REJECTED } : skipToken);
  const [decide] = useDecideVendorBillMutation();
  const [busy, setBusy] = useState("");

  const mine = (b) => b.createdBy?.uid && b.createdBy.uid === user?.uid;
  const recent = (b) => String(b.approval?.at || "") >= new Date(Date.now() - 14 * 86400000).toISOString();
  const list = mode === "mine" ? [...waiting.filter(mine), ...sentBack.filter((b) => mine(b) && recent(b))] : waiting;
  if (!list.length) return null;

  const run = async (bill, approve) => {
    let reason = "";
    if (!approve) {
      const typed = await promptDialog({ title: "Send this bill back", label: "Why?", placeholder: "e.g. Wrong amount, check the invoice", confirmLabel: "Send back" });
      if (typed == null) return;
      const r = cleanReason(typed);
      if (r.error) return toast.error(r.error);
      reason = r.value;
    }
    setBusy(bill.id);
    try {
      await decide({ companyId, branchId, billId: bill.id, approve, reason, by: stampOf(user || {}) }).unwrap();
      toast.success(approve ? `Approved: ${bill.vendorName || "the bill"} is now owed ${money(bill.total)}` : "Sent back");
    } catch (e) {
      toast.error(e?.message || e?.data?.message || "Could not save.");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="mb-5 rounded-2xl border border-warning/30 bg-warning-soft p-3 sm:p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-fg">
        <Clock className="h-4 w-4 text-warning" />
        {mode === "mine" ? "Your bills for approval" : `Waiting for approval (${list.length})`}
      </h2>
      {mode === "decide" && (
        <p className="mb-3 text-xs text-muted">Added by a supervisor or in-charge. They count as owed once approved.</p>
      )}
      <ul className="space-y-2">
        {list.map((b) => (
          <li key={b.id} className="rounded-xl border border-line bg-surface p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-fg">{b.vendorName || "Vendor"}</p>
                <p className="text-xs text-muted">
                  {b.invoiceNo ? `${b.invoiceNo} · ` : ""}dated {day(b.invoiceDate)} · due {day(b.dueDate)}
                </p>
                <p className={`mt-1 text-xs font-medium ${b.status === REJECTED ? "text-danger" : "text-warning"}`}>{approvalLine(b)}</p>
                {b.notes ? <p className="mt-1 text-xs text-muted">Note: {b.notes}</p> : null}
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-fg">{money(b.total)}</p>
                {b.attachments?.[0] ? (
                  <a href={b.attachments[0]} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                    <Paperclip className="h-3.5 w-3.5" /> Invoice
                  </a>
                ) : null}
              </div>
            </div>
            {mode === "decide" && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => run(b, true)}
                  disabled={busy === b.id}
                  className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-success/30 bg-success-soft px-3 text-sm font-semibold text-success disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </button>
                <button
                  onClick={() => run(b, false)}
                  disabled={busy === b.id}
                  className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-surface-2 px-3 text-sm font-semibold text-fg disabled:opacity-50"
                >
                  <Undo2 className="h-4 w-4" /> Send back
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
