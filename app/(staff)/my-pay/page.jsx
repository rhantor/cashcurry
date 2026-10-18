"use client";
// My pay (roadmap 4.6): this period so far, what's left to pay back, and every
// payslip since payroll started sharing them.
import { useState } from "react";
import { Landmark, Receipt, ScrollText } from "lucide-react";
import useSession from "@/app/hooks/useSession";
import useCurrency from "@/app/hooks/useCurrency";
import { EmptyState, Skeleton } from "@/app/components/ui";
import { useMyPayslips, useMyStaff, useMyWork } from "../useStaffApp";
import { Heading, MoneyTile, PayslipRow, PayslipSheet, PeriodCard } from "../parts";

export default function MyPayPage() {
  const { user } = useSession();
  const currency = useCurrency();
  const { staff, priv } = useMyStaff(user);
  const me = user ? { ...user, staffId: user.staffId || staff?.id } : null;
  const { period, stats, loading } = useMyWork(me, staff, priv);
  const { slips, loading: slipsLoading } = useMyPayslips(user, me?.staffId);
  const [open, setOpen] = useState(null);

  return (
    <div className="space-y-6 p-4 md:p-0">
      <h1 className="hidden text-2xl font-semibold tracking-tight md:block">My pay</h1>
      <PeriodCard staff={staff} period={period} stats={stats} loading={loading} currency={currency} />
      {!stats.isFixed && staff && (
        <p className="-mt-3 px-1 text-xs text-subtle">
          From your clock-ins at {Number(priv?.basicPerHour) || 0} an hour and {Number(priv?.OTPerHour) || 0} for overtime. Your payslip is the final word.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <MoneyTile icon={Receipt} label="Advance to pay back" amount={stats.advanceDebt} currency={currency} tone="warning" hint="Taken from your next pay" />
        <MoneyTile icon={Landmark} label="Loan left" amount={stats.loanDebt} currency={currency} hint="Paid back month by month" />
      </div>

      <section className="space-y-2">
        <Heading>Payslips</Heading>
        {slipsLoading ? (
          <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-16" rounded="rounded-2xl" />)}</div>
        ) : slips.length ? (
          <div className="space-y-2">{slips.map((s) => <PayslipRow key={s.id} slip={s} currency={currency} onOpen={setOpen} />)}</div>
        ) : (
          <EmptyState icon={ScrollText} title="No payslips yet" description="Your payslip shows up here once your manager finishes the month's payroll." />
        )}
      </section>

      <PayslipSheet slip={open} currency={currency} onClose={() => setOpen(null)} />
    </div>
  );
}
