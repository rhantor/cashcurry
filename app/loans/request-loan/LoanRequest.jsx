"use client";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Send } from "lucide-react";
import { serverTimestamp } from "firebase/firestore";
import { useAddLoanEntryMutation } from "@/lib/redux/api/loanApiSlice";
import { useGetBranchesBasicQuery } from "@/lib/redux/api/branchApiSlice";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { Button, CountUp, Field, Input, Skeleton, cn, toast } from "@/app/components/ui";
import MoneyInput from "@/app/components/entry/MoneyInput";
import { EntryLayout, EntrySection, SummaryLine } from "@/app/components/entry/EntryLayout";

/**
 * Ask another branch for a loan: which branch, how much, why. It reaches that
 * branch's Requested panel; once they approve and send it, it shows under
 * Loan updates and in the cash book.
 */
const LoanRequestForm = () => {
  const { ready, companyId, branchId, user } = useResolvedCompanyBranch();
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [errors, setErrors] = useState({});

  const { data: branches, isLoading: branchesLoading, isError: branchesError, refetch: refetchBranches } = useGetBranchesBasicQuery(companyId, {
    skip: !companyId,
    refetchOnMountOrArgChange: true,
  });
  const getBranchName = (id) => branches?.find((b) => b.id === id)?.name || id;
  const [addLoanEntry, { isLoading }] = useAddLoanEntryMutation();

  const fromBranchName = useMemo(() => branches?.find((x) => x.id === branchId)?.name ?? "", [branches, branchId]);
  const otherBranches = useMemo(() => (branches || []).filter((b) => b.id !== branchId), [branches, branchId]);

  const numericAmount = Number(amount);

  const handleSubmit = async () => {
    const e = {};
    if (!toBranchId || toBranchId === branchId) e.to = "Pick the branch to ask";
    if (!(Number.isFinite(numericAmount) && numericAmount > 0)) e.amount = "Enter how much";
    setErrors(e);
    if (Object.keys(e).length || !companyId || !branchId || !user) return;

    const who = { uid: user?.uid ?? null, username: user?.username ?? "", email: user?.email ?? "", role: user?.role ?? "" };
    const payload = {
      requestFromBranchId: branchId,
      requestedToBranchId: toBranchId,
      requestFrom: getBranchName(branchId),
      requestedTo: getBranchName(toBranchId),
      amount: numericAmount,
      reason: reason?.trim() || "",
      createdBy: who,
      requestedBy: who,
      status: "pending",
      createdAt: serverTimestamp(),
    };
    try {
      await addLoanEntry({ companyId, data: payload }).unwrap();
      toast.success("Loan request sent", { description: `${money(numericAmount)} from ${getBranchName(toBranchId)}` });
      setAmount("");
      setReason("");
      setToBranchId("");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't send the request", { description: err?.data?.message || "Check your connection and try again." });
    }
  };

  if (!ready) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;
  if (!companyId || !branchId) return <p className="p-6 text-sm text-muted">Sign in to a branch to ask for a loan.</p>;

  const target = toBranchId ? getBranchName(toBranchId) : "";
  const send = (
    <Button size="lg" icon={Send} className="w-full" loading={isLoading} onClick={handleSubmit}>
      Send request
    </Button>
  );

  return (
    <EntryLayout
      aside={
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Asking for</p>
            <CountUp value={numericAmount || 0} format={money} className="mt-1 block text-3xl font-bold tracking-tight text-fg" />
          </div>
          <div className="space-y-2 border-t border-line pt-3">
            <SummaryLine label="From" value={target || "Pick a branch"} muted={!target} />
            <SummaryLine label="To" value={fromBranchName || "This branch"} />
            <SummaryLine label="Asked by" value={user?.username || "—"} />
          </div>
          {send}
          <p className="text-[11px] text-muted">Nothing moves until {target || "that branch"} approves and sends it.</p>
        </div>
      }
      bar={
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Loan request</p>
            <CountUp value={numericAmount || 0} format={money} className="block truncate text-lg font-bold tracking-tight text-fg" />
          </div>
          <div className="w-40 shrink-0">{send}</div>
        </div>
      }
    >
      {/* who lends to whom */}
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info">
          <Building2 className="size-4" />
        </span>
        <ArrowRight className="size-4 shrink-0 text-subtle" />
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Building2 className="size-4" />
        </span>
        <p className="min-w-0 text-xs text-muted">
          Money from <b className="text-fg">{target || "another branch"}</b> to <b className="text-fg">{fromBranchName || "this branch"}</b>, paid back later. See how it stands in{" "}
          <Link href="/loans/loan-summary" className="font-semibold text-brand hover:underline">
            Loan summary
          </Link>
          .
        </p>
      </div>

      <EntrySection title="Which branch to ask">
        {branchesError ? (
          <p className="flex items-center gap-2 text-sm text-danger">
            Couldn&apos;t load the branches.
            <button type="button" onClick={refetchBranches} className="font-semibold underline">
              Try again
            </button>
          </p>
        ) : branchesLoading ? (
          <Skeleton className="h-14" rounded="rounded-2xl" />
        ) : otherBranches.length === 0 ? (
          <p className="text-sm text-muted">There&apos;s no other branch to ask.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {otherBranches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setToBranchId(b.id);
                  setErrors((x) => ({ ...x, to: undefined }));
                }}
                aria-pressed={toBranchId === b.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                  toBranchId === b.id ? "border-brand bg-brand-soft/60 ring-4 ring-[var(--cc-ring)]" : "border-line bg-surface hover:border-brand/40"
                )}
              >
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", toBranchId === b.id ? "bg-surface text-brand" : "bg-surface-2 text-muted")}>
                  <Building2 className="size-4" />
                </span>
                <span className="truncate text-sm font-semibold text-fg">{b.name}</span>
              </button>
            ))}
          </div>
        )}
        {errors.to && <p className="mt-2 text-xs font-medium text-danger">{errors.to}</p>}
      </EntrySection>

      <EntrySection title="How much, and why">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount" error={errors.amount}>
            {({ id, invalid }) => <MoneyInput id={id} currency={currency} value={amount} invalid={invalid} onValueChange={(v) => (setAmount(v), setErrors((x) => ({ ...x, amount: undefined })))} />}
          </Field>
          <Field label="Why" hint="Optional, but it helps them decide">
            {({ id }) => <Input id={id} size="lg" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Short for salaries this month" />}
          </Field>
        </div>
      </EntrySection>
    </EntryLayout>
  );
};

export default LoanRequestForm;
