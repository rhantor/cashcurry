"use client";
// Me (30 Oct): an office login's own pay, payslips and attendance — the same
// screens staff have in the staff app (app/(staff)/my-pay, my-attendance) —
// once their login is linked to the staff record that pays them (Staff
// management → Link an office login). Hourly people see their hours; those
// on a fixed salary see the month. Their tasks are under Tasks → My tasks.
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ListChecks, UserRoundX } from "lucide-react";
import useSession from "@/app/hooks/useSession";
import { EmptyState, Skeleton, Tabs } from "@/app/components/ui";
import { personName } from "@/lib/people";
import { roleLabel } from "@/lib/authz/permissions";
import MyPayPage from "@/app/(staff)/my-pay/page";
import MyAttendancePage from "@/app/(staff)/my-attendance/page";

export default function MePage() {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-64" rounded="rounded-2xl" />}>
      <Me />
    </Suspense>
  );
}

function Me() {
  const { user } = useSession();
  const router = useRouter();
  // the tab is in the address, so "My attendance" on the Pay tab (/me?tab=attendance) opens it
  const tab = useSearchParams().get("tab") === "attendance" ? "attendance" : "pay";
  const setTab = (t) => router.replace(t === "attendance" ? "/me?tab=attendance" : "/me", { scroll: false });
  if (!user?.uid) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;
  // their staff record is at the branch it was linked in (a company role has no branch of its own)
  const who = { ...user, branchId: user.staffBranchId || user.branchId };

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">My pay & attendance</h1>
        <p className="mt-0.5 text-sm text-muted">
          {personName(user)} · {roleLabel(user.role)}
        </p>
      </div>
      {!user.staffId ? (
        <EmptyState
          icon={UserRoundX}
          title="Your login isn't linked to a staff record yet"
          description="Ask the branch admin or manager: Staff management → your name → Link an office login. Then your pay, payslips and attendance show here."
        />
      ) : (
        <>
          <Tabs
            tabs={[
              { value: "pay", label: "Pay" },
              { value: "attendance", label: "Attendance" },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === "pay" ? <MyPayPage who={who} attendanceHref="/me?tab=attendance" /> : <MyAttendancePage who={who} payHref="/me" />}
          <Link href="/tasks" className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-sm transition hover:bg-surface-2">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <ListChecks className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-fg">My tasks</span>
              <span className="block text-xs text-muted">Under Tasks → My tasks, with how you are doing</span>
            </span>
          </Link>
        </>
      )}
    </div>
  );
}
