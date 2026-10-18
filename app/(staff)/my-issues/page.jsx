"use client";
// Issues in the staff portal (roadmap 4.5): report a problem, and follow the
// ones you reported or were given to fix.
import useSession from "@/app/hooks/useSession";
import { Skeleton } from "@/app/components/ui";
import IssuesBoard from "@/app/components/issues/IssuesBoard";

export default function MyIssuesPage() {
  const { user } = useSession();
  if (!user?.uid) return <Skeleton className="m-4 h-64" rounded="rounded-2xl" />;
  return (
    <div className="p-4 sm:p-6">
      <IssuesBoard user={user} branchId={user.branchId} />
    </div>
  );
}
