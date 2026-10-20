"use client";

import React, { useMemo, useState } from "react";
import { Banknote, Building2, Landmark, Send } from "lucide-react";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useAddRepaymentEntryMutation } from "@/lib/redux/api/loanApiSlice";
import { useGetBranchesBasicQuery } from "@/lib/redux/api/branchApiSlice";
import useCurrency from "@/app/hooks/useCurrency";
import useResolvedCompanyBranch from "@/app/hooks/useResolvedCompanyBranch";
import { formatMoney } from "@/lib/region/currency";
import { Button, Card, Field, Input, toast } from "@/app/components/ui";
import MoneyInput from "@/app/components/entry/MoneyInput";
import ProofUpload from "@/app/components/entry/ProofUpload";
import { Chip, ChoiceCards } from "@/app/components/entry/Choices";

import { stampOf } from "@/lib/people";
const METHODS = [
  { value: "cash", title: "Cash", note: "With a voucher", icon: Banknote, tone: "brand" },
  { value: "online", title: "Bank transfer", note: "Online, with the receipt", icon: Landmark, tone: "info" },
];

/** Pay back one branch: how much, how, the proof. Goes to that branch to approve. */
function PayCard({ otherId, outstanding, durationDays, lastActivity, nameOf, money, currency, companyId, branchId, user }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [voucherNo, setVoucherNo] = useState("");
  const [bankName, setBankName] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [addRepayment] = useAddRepaymentEntryMutation();

  const last = (() => {
    const d = lastActivity?.seconds ? new Date(lastActivity.seconds * 1000) : lastActivity ? new Date(lastActivity) : null;
    return d && !isNaN(d.getTime()) ? d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
  })();

  // the same path as before: loanRepayments/<company>/<payer>_to_<receiver>/<time>_<name>
  const upload = () => {
    const task = uploadBytesResumable(ref(storage, `loanRepayments/${companyId}/${branchId}_to_${otherId}/${Date.now()}_${file.name}`), file);
    return new Promise((resolve, reject) => {
      task.on("state_changed", (s) => setProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)), reject, async () => resolve(await getDownloadURL(task.snapshot.ref)));
    });
  };

  const pay = async () => {
    if (!companyId || !branchId || !user) return;
    const amt = Number(amount || 0);
    if (!(amt > 0)) return toast.warning("Enter how much you're paying");
    if (amt > Number(outstanding) + 0.0001) return toast.warning(`That's more than the ${money(outstanding)} owed`);
    if (method === "cash" && !voucherNo.trim()) return toast.warning("Enter the voucher number");
    if (method === "online" && (!bankName.trim() || !referenceNo.trim())) return toast.warning("Enter the bank and the reference number");
    if (!file) return toast.warning(method === "cash" ? "Add a photo of the voucher" : "Add the transfer receipt");
    setBusy(true);
    try {
      const proofUrl = await upload();
      await addRepayment({
        companyId,
        fromBranchId: branchId, // borrower (payer)
        toBranchId: otherId, // lender (receiver)
        amount: amt,
        note: note.trim(),
        requestedBy: stampOf(user),
        paymentMethod: method,
        proofUrl,
        proofMime: file.type || null,
        voucherNo: method === "cash" ? voucherNo.trim() : null,
        bankName: method === "online" ? bankName.trim() : null,
        referenceNo: method === "online" ? referenceNo.trim() : null,
        autoApprove: false, // the receiver approves
      }).unwrap();
      toast.success("Repayment sent", { description: `${money(amt)} to ${nameOf(otherId)} — waiting for them to approve` });
      setAmount("");
      setVoucherNo("");
      setBankName("");
      setReferenceNo("");
      setNote("");
      setFile(null);
      setPreview(null);
      setProgress(0);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't send the repayment", { description: "Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  const uploading = progress > 0 && progress < 100;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
          <Building2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Pay back</p>
          <p className="truncate text-base font-bold text-fg">{nameOf(otherId)}</p>
          <p className="text-[11px] text-subtle">
            {typeof durationDays === "number" ? `${durationDays} days` : ""}
            {last ? `${typeof durationDays === "number" ? " · " : ""}last ${last}` : ""}
          </p>
        </div>
        <span className="shrink-0 text-right">
          <span className="block text-[11px] text-subtle">Owed</span>
          <span className="block text-base font-bold tabular-nums text-warning">{money(outstanding)}</span>
        </span>
      </div>

      <div className="mt-4 space-y-4">
        <Field label="Paying now">
          {({ id }) => (
            <>
              <MoneyInput id={id} currency={currency} value={amount} onValueChange={setAmount} />
              <div className="mt-2 flex gap-1.5">
                <Chip on={Number(amount) === Number(outstanding)} onClick={() => setAmount(Number(outstanding).toFixed(2))}>
                  All of it
                </Chip>
                <Chip on={Number(amount) === Number((outstanding / 2).toFixed(2))} onClick={() => setAmount((Number(outstanding) / 2).toFixed(2))}>
                  Half
                </Chip>
              </div>
            </>
          )}
        </Field>

        <ChoiceCards options={METHODS} value={method} onChange={setMethod} />

        {method === "cash" ? (
          <Field label="Voucher number">{({ id }) => <Input id={id} size="lg" value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} />}</Field>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bank">{({ id }) => <Input id={id} size="lg" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Maybank" />}</Field>
            <Field label="Reference number">{({ id }) => <Input id={id} size="lg" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />}</Field>
          </div>
        )}

        <ProofUpload
          label={method === "cash" ? "Voucher photo" : "Transfer receipt"}
          pdf
          required
          pageDrop={false}
          file={file}
          preview={preview}
          progress={progress}
          onPick={(f, url) => (setFile(f), setPreview(url))}
          onRemove={() => (setFile(null), setPreview(null), setProgress(0))}
        />

        <Field label="Note" hint="Optional">
          {({ id }) => <Input id={id} size="lg" value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>

        <Button size="lg" icon={Send} className="w-full" loading={busy && !uploading} disabled={uploading} onClick={pay}>
          {uploading ? `Uploading… ${progress}%` : `Send ${amount ? money(amount) : "repayment"}`}
        </Button>
        <p className="text-center text-[11px] text-subtle">{nameOf(otherId)} approves it before it counts.</p>
      </div>
    </Card>
  );
}

/**
 * Paying back other branches: a card for each branch this one owes, with
 * the amount (all, half or any), cash with a voucher or a transfer with the
 * receipt, and the proof. The receiving branch approves it.
 */
export default function LoanPayCards({ summary = {} }) {
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);
  const { ready, companyId, branchId, user } = useResolvedCompanyBranch();
  const { data: branches = [] } = useGetBranchesBasicQuery(companyId, { skip: !companyId });
  const nameOf = (id) => branches.find((b) => b.id === id)?.name || id;

  const owed = useMemo(() => {
    if (!branchId || !summary?.[branchId]) return [];
    return Object.entries(summary[branchId].relations || {})
      .filter(([, rel]) => Number(rel.net) > 0.000001)
      .map(([otherId, rel]) => ({ otherId, ...rel }));
  }, [summary, branchId]);

  if (!ready || !branchId || !owed.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-fg">Pay back</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {owed.map(({ otherId, net, durationDays, lastActivity }) => (
          <PayCard
            key={otherId}
            otherId={otherId}
            outstanding={Number(net || 0)}
            durationDays={durationDays}
            lastActivity={lastActivity}
            nameOf={nameOf}
            money={money}
            currency={currency}
            companyId={companyId}
            branchId={branchId}
            user={user}
          />
        ))}
      </div>
    </section>
  );
}
