"use client";
// Approved advances and staff loans that have not been handed over yet.
// "Mark paid" records when and from where the money left (paidOut); only then
// does it count in cash in hand / the bank (lib/finance/rules.js paidOutOf).
// The staff member signs for it there ("Received by" — required for cash),
// the voucher takes its number, and its picture goes onto the record (1 Nov).
import React, { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { useGetAdvanceEntriesQuery, usePayOutAdvanceMutation } from "@/lib/redux/api/AdvanceApiSlice";
import { useGetStaffLoansQuery, usePayOutStaffLoanMutation } from "@/lib/redux/api/staffLoanApiSlice";
import useCurrency from "@/app/hooks/useCurrency";
import { useBusinessToday } from "@/app/hooks/useRegion";
import { formatMoney } from "@/lib/region";
import { isLeaveRequest } from "@/lib/finance/rules";
import { AnimatePresence, motion } from "framer-motion";
import { Clock3 } from "lucide-react";
import { Avatar, Badge, Button, Card, DatePicker, Field, toast } from "@/app/components/ui";
import { Chip } from "@/app/components/entry/Choices";
import SignPad from "@/app/components/common/SignPad";
import { skipToken } from "@reduxjs/toolkit/query";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { receivedStamp } from "@/lib/requests/voucher";
import { attachRequestVoucher } from "@/lib/requests/voucherClient";

// Roles allowed to hand over money — the same list the database rules
// enforce (firestore.rules: isPayer).
export const PAYER_ROLES = ["branchAdmin", "manager", "accountant", "supervisor", "cashier", "owner", "gm", "superAdmin"];

const showDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? format(parseISO(d), "d MMM yyyy") : d || "-");

/** Approved and not yet paid: paidOut is explicitly null (older records have no field and count as paid). */
const waiting = (x) => x.status === "approved" && x.paidOut === null && !isLeaveRequest(x);

export default function PayOutQueue({ companyId, branchId, user, title = "Waiting to be paid" }) {
  const currency = useCurrency();
  const today = useBusinessToday();
  // Only approved and not yet handed over — not the whole history.
  const args = { companyId, branchId, status: "approved", unpaid: true };
  const skip = { skip: !companyId || !branchId };
  const { data: advances = [] } = useGetAdvanceEntriesQuery(args, skip);
  const { data: loans = [] } = useGetStaffLoansQuery(args, skip);
  const [payAdvance] = usePayOutAdvanceMutation();
  const [payLoan] = usePayOutStaffLoanMutation();

  const canPay = PAYER_ROLES.includes(user?.role);
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState({ date: "", from: "front", sig: null });
  const { data: branch } = useGetSingleBranchQuery(companyId && branchId ? { companyId, branchId } : skipToken);
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
    setDraft({ date: today, from: item.paidFromOffice === "back" ? "back" : "front", sig: null });
  };

  const confirm = async (item) => {
    if (!draft.date) return setError("Pick the date the money was handed over.");
    if (draft.from === "front" && !draft.sig) return setError(`${item.staffName || "They"} sign${item.staffName ? "s" : ""} for the cash first.`);
    setBusy(true);
    setError("");
    try {
      const pay = item.kind === "advance" ? payAdvance : payLoan;
      const received = draft.sig || draft.from === "back" ? receivedStamp(item.staffName, draft.sig) : null;
      const { record } = await pay({ companyId, branchId, id: item.id, date: draft.date, from: draft.from, user, received }).unwrap();
      setOpenId(null);
      // the signed voucher's picture, onto the record (the payment is already saved)
      attachRequestVoucher({ companyId, branchId, type: item.kind, record, branch, currency, money: (v) => formatMoney(v, currency), uid: user?.uid }).catch((e) =>
        toast.warning("The voucher's picture wasn't made", { description: e.message })
      );
    } catch (e) {
      setError(e?.message || "Could not mark it paid. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="overflow-hidden border-warning/30 p-0">
      <div className="flex items-center gap-3 bg-warning-soft/70 px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-warning shadow-card">
          <Clock3 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          <p className="text-xs text-muted">Approved, but not handed over — cash in hand moves only when marked paid.</p>
        </div>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-bold tabular-nums text-fg">{formatMoney(total, currency)}</span>
          <span className="block text-[11px] text-muted">{items.length} waiting</span>
        </span>
      </div>

      <ul className="divide-y divide-line">
        {items.map((item) => {
          const key = `${item.kind}-${item.id}`;
          const isOpen = openId === key;
          return (
            <li key={key} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar name={item.staffName} staffId={item.staffId} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-fg">
                    <span className="truncate">{item.staffName || "—"}</span>
                    <Badge tone={item.kind === "advance" ? "brand" : "info"} className="shrink-0 whitespace-nowrap px-2 py-px text-[10px]">
                      {item.label}
                    </Badge>
                  </p>
                  <p className="line-clamp-2 text-xs text-muted">
                    {showDate(item.date)}
                    {item.approvedBy?.name ? ` · approved by ${item.approvedBy.name}` : ""}
                    {item.reason ? ` · ${item.reason}` : ""}
                  </p>
                </div>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-sm font-bold tabular-nums text-fg">{formatMoney(item.amount, currency)}</span>
                  {canPay && !isOpen && (
                    <Button size="sm" onClick={() => open(item)}>
                      Mark paid
                    </Button>
                  )}
                </span>
              </div>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-3 space-y-3 rounded-2xl bg-surface-2/60 p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Handed over on">{() => <DatePicker value={draft.date} max={today} onChange={(d) => setDraft((x) => ({ ...x, date: d }))} />}</Field>
                        <div>
                          <p className="mb-1.5 text-xs font-semibold text-muted">From</p>
                          <div className="flex gap-2">
                            <Chip on={draft.from === "front"} onClick={() => setDraft((x) => ({ ...x, from: "front" }))}>
                              Till (cash)
                            </Chip>
                            <Chip on={draft.from === "back"} onClick={() => setDraft((x) => ({ ...x, from: "back" }))}>
                              Bank (transfer)
                            </Chip>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl bg-surface p-3">
                        <p className="mb-2 text-xs font-semibold text-muted">
                          Received by {item.staffName || "them"} {draft.from === "back" ? "(optional for a transfer)" : "— hand them the phone to sign"}
                        </p>
                        <SignPad value={draft.sig} onChange={(sig) => setDraft((x) => ({ ...x, sig }))} />
                      </div>
                      {error && <p className="text-xs font-medium text-danger">{error}</p>}
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => setOpenId(null)}>
                          Cancel
                        </Button>
                        <Button size="sm" loading={busy} onClick={() => confirm(item)}>
                          Paid {formatMoney(item.amount, currency)}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
      {!canPay && <p className="border-t border-line px-4 py-2.5 text-xs text-muted">Only a cashier, supervisor, accountant, manager or branch admin can mark these paid.</p>}
    </Card>
  );
}
