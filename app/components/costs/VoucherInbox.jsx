"use client";
// Vouchers waiting (roadmap 4.9): costs saved without an invoice, for someone
// senior to whoever saved it to approve or send back (owner, 31 Oct). Nobody
// decides their own. The money already left when the cost was
// saved — this is the check that someone in charge saw it.
// Each is laid out like the paper voucher (owner, 1 Nov), "Approved by" empty;
// approving signs it and puts its picture onto the cost.
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Check, FileWarning, Undo2 } from "lucide-react";
import { skipToken } from "@reduxjs/toolkit/query";
import { db } from "@/lib/firebase";
import { Badge, Button, EmptyState, Skeleton, toast } from "@/app/components/ui";
import { promptDialog } from "@/app/components/ui/notify";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { canDecideVoucher, voucherWaitsFor } from "@/lib/costs/vouchers";
import { approveVoucherWithImage, rejectVoucher, useRoleOf } from "@/lib/costs/client";
import { voucherSheet } from "@/lib/costs/voucherPaper";
import { makeVoucherImage } from "@/lib/costs/voucherImage";
import { nameSignature, signaturesOf } from "@/lib/signatures/client";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { personName } from "@/lib/people";
import VoucherPaper from "./VoucherPaper";

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
  const { data: branch } = useGetSingleBranchQuery(companyId && branchId ? { companyId, branchId } : skipToken);
  const roleOf = useRoleOf(companyId); // older vouchers carry no role
  const [busy, setBusy] = useState(null);

  // "Prepared by": each maker's own signature, else their name in handwriting
  const makers = useMemo(() => [...new Set(vouchers.map((c) => c.voucher?.by?.uid).filter(Boolean))].sort().join(","), [vouchers]);
  const [sigs, setSigs] = useState({});
  useEffect(() => {
    if (!companyId || !makers) return;
    let live = true;
    signaturesOf(companyId, makers.split(",")).then((s) => live && setSigs(s)).catch(() => {});
    return () => {
      live = false;
    };
  }, [companyId, makers]);

  const act = async (cost, approve) => {
    let note = "";
    if (!approve) {
      note = await promptDialog({ title: "Send it back", label: "What's missing?", placeholder: "e.g. Ask the stall for a written receipt" });
      if (note === null || note === undefined) return;
    }
    setBusy(cost.id);
    try {
      if (approve) {
        // signed with your signature (My signature), then onto the cost as a picture
        const me = { uid: user?.uid, name: personName(user) || user?.username || user?.email || "" };
        const url = await makeVoucherImage({ companyId, branchId, branch, cost, currency, money, approval: { by: me, at: new Date() } });
        await approveVoucherWithImage(companyId, branchId, cost, user, url);
      } else await rejectVoucher(companyId, branchId, cost.id, user, note);
      toast.success(approve ? "Voucher approved" : "Sent back", approve ? { description: "Signed and added to the cost." } : undefined);
    } catch (e) {
      toast.error("Couldn't save", { description: e.message });
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-24" rounded="rounded-2xl" />)}</div>;
  if (!vouchers.length) return <EmptyState icon={FileWarning} title="No vouchers waiting" description="Costs saved without an invoice show up here for approval." />;

  return (
    <ul className="space-y-4">
      {vouchers.map((c) => {
        const mine = !canDecideVoucher(user, c, roleOf);
        const maker = c.voucher?.by || {};
        return (
          <li key={c.id} className="space-y-2">
            {c.costKind === "notCost" && <Badge tone="neutral">Not a cost</Badge>}
            <VoucherPaper sheet={voucherSheet(c, { branch, currency, money })} preparedSig={sigs[maker.uid] || (maker.name ? nameSignature(maker.name) : null)} />
            <div className="flex flex-wrap items-center gap-2">
              {mine ? (
                <p className="text-xs text-subtle">{voucherWaitsFor(user, c, roleOf)}</p>
              ) : (
                <>
                  <Button size="sm" icon={Check} loading={busy === c.id} onClick={() => act(c, true)} className="min-w-28 flex-1 sm:flex-none">Approve and sign</Button>
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
