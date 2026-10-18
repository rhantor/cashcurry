"use client";
// Issues (roadmap 4.5): the office board — what's wrong at the branch, who
// has it and where it stands. Owner, super admin and gm see every branch.
import useSession from "@/app/hooks/useSession";
import { useBranchList } from "@/app/components/chat/useChat";
import { Skeleton } from "@/app/components/ui";
import IssuesBoard from "@/app/components/issues/IssuesBoard";

export default function IssuesPage() {
  const { user, branchId } = useSession();
  const branches = useBranchList(user?.companyId);
  if (!user?.uid) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;
  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-6">
      <IssuesBoard user={user} branchId={branchId || user.branchId} branches={branches} />
    </div>
  );
}
