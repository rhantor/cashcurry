"use client";
// Staff app home (roadmap 4.6): this period's pay so far, what they owe, the
// latest payslip, and the things staff do most — ask for an advance or leave,
// report a problem.
import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, HandCoins, Landmark, MessageCircle, Receipt, TriangleAlert } from "lucide-react";
import useSession from "@/app/hooks/useSession";
import useCurrency from "@/app/hooks/useCurrency";
import { Skeleton } from "@/app/components/ui";
import AdvanceAskSheet from "@/app/components/requests/AdvanceAskSheet";
import LeaveSheet from "@/app/components/requests/LeaveSheet";
import NewIssueSheet from "@/app/components/issues/NewIssueSheet";
import { useMyPayslips, useMyStaff, useMyWork } from "../useStaffApp";
import { Heading, MoneyTile, PayslipRow, PayslipSheet, PeriodCard } from "../parts";

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export default function StaffHome() {
  const { user } = useSession();
  const currency = useCurrency();
  const { staff, priv, loading } = useMyStaff(user);
  const me = user ? { ...user, staffId: user.staffId || staff?.id } : null;
  const { period, stats, loading: workLoading } = useMyWork(me, staff, priv);
  const { slips } = useMyPayslips(user, me?.staffId);
  const [sheet, setSheet] = useState(null); // "advance" | "leave" | "issue"
  const [open, setOpen] = useState(null);
  const where_ = { companyId: user?.companyId, branchId: user?.branchId };

  if (!user || (loading && !staff)) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-44" rounded="rounded-3xl" />
        <Skeleton className="h-24" rounded="rounded-2xl" />
      </div>
    );
  }

  const first = staff?.firstName || user.firstName || "";
  const actions = [
    { key: "advance", label: "Ask for an advance", icon: HandCoins },
    { key: "leave", label: "Ask for leave", icon: CalendarPlus },
    { key: "issue", label: "Report a problem", icon: TriangleAlert },
    { key: "chat", label: "Message", icon: MessageCircle, href: "/messages" },
  ];

  return (
    <div className="space-y-6 p-4 md:p-0">
      <div className="px-1 pt-1">
        <p className="text-sm text-muted">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{greeting()}{first ? `, ${first}` : ""}</h1>
      </div>

      {staff ? (
        <PeriodCard staff={staff} period={period} stats={stats} loading={workLoading} currency={currency} href="/my-pay" />
      ) : (
        <div className="rounded-2xl border border-dashed border-line p-5 text-sm text-muted">
          Your login is not linked to a staff record yet. Ask your manager to check Staff management.
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        {actions.map(({ key, label, icon: Icon, href }) => {
          const inner = (
            <>
              <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand transition group-active:scale-95">
                <Icon className="size-5" />
              </span>
              <span className="text-center text-[11px] font-medium leading-tight text-fg">{label}</span>
            </>
          );
          return href ? (
            <Link key={key} href={href} className="group flex flex-col items-center gap-1.5 rounded-2xl p-1.5">{inner}</Link>
          ) : (
            <button key={key} type="button" onClick={() => setSheet(key)} className="group flex flex-col items-center gap-1.5 rounded-2xl p-1.5">{inner}</button>
          );
        })}
      </div>

      {(stats.advanceDebt > 0 || stats.loanDebt > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <MoneyTile icon={Receipt} label="Advance to pay back" amount={stats.advanceDebt} currency={currency} tone="warning" href="/requests" />
          <MoneyTile icon={Landmark} label="Loan left" amount={stats.loanDebt} currency={currency} href="/requests" />
        </div>
      )}

      {slips.length > 0 && (
        <section className="space-y-2">
          <Heading href="/my-pay">Latest payslip</Heading>
          <PayslipRow slip={slips[0]} currency={currency} onOpen={setOpen} />
        </section>
      )}

      <section className="space-y-2">
        <Heading href="/my-issues" more="My issues">Something wrong at work?</Heading>
        <button type="button" onClick={() => setSheet("issue")} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-left text-sm text-muted hover:bg-surface-2">
          <TriangleAlert className="size-5 text-warning" />
          Broken equipment, stock running out, a safety problem… tell your manager here.
        </button>
      </section>

      <AdvanceAskSheet open={sheet === "advance"} onClose={() => setSheet(null)} {...where_} user={me} />
      <LeaveSheet open={sheet === "leave"} onClose={() => setSheet(null)} {...where_} user={me} />
      <NewIssueSheet open={sheet === "issue"} onClose={() => setSheet(null)} user={me} branchId={user.branchId} />
      <PayslipSheet slip={open} currency={currency} onClose={() => setOpen(null)} />
    </div>
  );
}
