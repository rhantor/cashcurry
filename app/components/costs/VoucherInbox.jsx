"use client";
// Vouchers waiting (roadmap 4.9): costs saved without an invoice, for branch
// admin, manager or in-charge (and the company roles) to approve or send
// back. Nobody decides their own. The money already left when the cost was
// saved — this is the check that someone in charge saw it.
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { format, parseISO } from "date-fns";
import { Check, FileWarning, Undo2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { Badge, Button, EmptyState, Skeleton, toast } from "@/app/components/ui";
import { promptDialog } from "@/app/components/ui/notify";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { canDecideVoucher } from "@/lib/costs/vouchers";
import { approveVoucher, rejectVoucher } from "@/lib/costs/client";

/** Live: this branch's costs whose voucher waits. */
export function useWaitingVouchers(companyId, branchId) {
  const [list, setList] = useState(null);
  useEffect(() => {
    if (!companyId || !branchId) return;
    const q = query(collection(db, "companies", companyId, "branches", branchId, "costs"), where("voucher.status", "==", "pending"));
    return onSnapshot(
      q,
      (snap) => setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.date).localeCompare(String(b.date)))),
      () => setList([])
    );
  }, [companyId, branchId]);
  return { vouchers: list || [], loading: list === null };
}

export default function VoucherInbox({ companyId, branchId, user }) {
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);
  const { vouchers, loading } = useWaitingVouchers(companyId, branchId);
  const [busy, setBusy] = useState(null);

  const act = async (cost, approve) => {
    let note = "";
    if (!approve) {
      note = await promptDialog({ title: "Send it back", label: "What's missing?", placeholder: "e.g. Ask the stall for a written receipt" });
      if (note === null || note === undefined) return;
    }
    setBusy(cost.id);
    try {
      if (approve) await approveVoucher(companyId, branchId, cost.id, user);
      else await rejectVoucher(companyId, branchId, cost.id, user, note);
      toast.success(approve ? "Voucher approved" : "Sent back");
    } catch (e) {
      toast.error("Couldn't save", { description: e.message });
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-24" rounded="rounded-2xl" />)}</div>;
  if (!vouchers.length) return <EmptyState icon={FileWarning} title="No vouchers waiting" description="Costs saved without an invoice show up here for approval." />;

  return (
    <ul className="space-y-2">
      {vouchers.map((c) => {
        const mine = !canDecideVoucher(user, c);
        return (
          <li key={c.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="space-y-1.5 p-4">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="text-lg font-semibold leading-none text-fg">{money(c.amount)}</p>
                <Badge tone="warning">No invoice</Badge>
                {c.costKind === "notCost" && <Badge tone="neutral">Not a cost</Badge>}
              </div>
              <p className="text-sm font-medium text-fg">{c.category || "Cost"}{c.paidTo ? ` · ${c.paidTo}` : ""}</p>
              <p className="text-xs text-muted">
                {c.date ? format(parseISO(c.date), "EEE d MMM") : ""} · {c.paidFromOffice === "back" ? "bank" : "till"} · by {c.voucher?.by?.name || c.createdBy?.firstName || "someone"}
              </p>
              <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-fg">&ldquo;{c.voucher?.reason || "No reason given"}&rdquo;</p>
              {c.description && <p className="whitespace-pre-line text-xs text-muted">{c.description}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/40 px-4 py-3">
              {mine ? (
                <p className="text-xs text-subtle">Yours — someone else approves it.</p>
              ) : (
                <>
                  <Button size="sm" icon={Check} loading={busy === c.id} onClick={() => act(c, true)} className="min-w-28 flex-1 sm:flex-none">Approve</Button>
                  <Button size="sm" variant="ghost" icon={Undo2} disabled={busy === c.id} onClick={() => act(c, false)} className="flex-1 sm:ml-auto sm:flex-none">Send back</Button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
