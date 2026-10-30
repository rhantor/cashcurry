"use client";
// Ops (30 Oct): today, on the phone, for everyone in the office — one app,
// the role decides what shows (docs/ROADMAP.md "Ops on the phone"). A branch
// role sees its branch; the owner, super admin and GM start on every branch
// at a glance (?view=all) and tap one for its own Ops (?view=branch).
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { skipToken } from "@reduxjs/toolkit/query";
import useSession from "@/app/hooks/useSession";
import { useBusinessToday } from "@/app/hooks/useRegion";
import { useGetBranchesQuery, useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { isCompanyRole, roleLabel } from "@/lib/authz/permissions";
import { Chip } from "@/app/components/entry/Choices";
import { Skeleton } from "@/app/components/ui";
import BranchToday from "./BranchToday";
import AllBranches from "./AllBranches";

const NONE = [];

export default function OpsHome() {
  const { user, role, companyId, branchId, setActiveBranch } = useSession();
  const today = useBusinessToday();
  const router = useRouter();
  const params = useSearchParams();
  const company = isCompanyRole(role);
  const { data: branchList } = useGetBranchesQuery(company && companyId ? companyId : skipToken);
  const branches = branchList || NONE;
  const { data: myBranch } = useGetSingleBranchQuery(!company && companyId && branchId ? { companyId, branchId } : skipToken);

  // company roles with more than one branch: every branch first, until they pick one
  const many = company && branches.length > 1;
  const view = many && params.get("view") !== "branch" ? "all" : "branch";
  const here = company ? branches.find((b) => b.id === branchId) : myBranch;
  const open = (b) => {
    if (b.id !== branchId) setActiveBranch(b.id);
    router.replace("/ops?view=branch", { scroll: false });
  };

  if (!user?.uid || !today) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">{format(parseISO(today), "EEEE, d MMMM")}</p>
          <h1 className="truncate text-2xl font-bold tracking-tight text-fg">{view === "all" ? "All branches today" : `${here?.name || "The branch"} today`}</h1>
        </div>
        <span className="shrink-0 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-muted">{roleLabel(role)}</span>
      </div>

      {many && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip on={view === "all"} onClick={() => router.replace("/ops?view=all", { scroll: false })}>
            All branches
          </Chip>
          {branches.map((b) => (
            <Chip key={b.id} on={view === "branch" && b.id === branchId} onClick={() => open(b)}>
              {b.name || "Branch"}
            </Chip>
          ))}
        </div>
      )}

      {view === "all" ? (
        <AllBranches user={user} branches={branches} today={today} onOpen={open} />
      ) : branchId ? (
        <BranchToday key={branchId} user={user} companyId={companyId} branchId={branchId} today={today} />
      ) : (
        <p className="rounded-2xl bg-surface-2 p-6 text-sm text-muted">Pick a branch at the top to see its day.</p>
      )}
    </div>
  );
}
