"use client";
// Chat for the office (roadmap 4.4) — the staff portal has the same at /chat.
import useSession from "@/app/hooks/useSession";
import { useGetBranchesBasicQuery } from "@/lib/redux/api/branchApiSlice";
import { isCompanyRole } from "@/lib/authz/permissions";
import { Skeleton } from "@/app/components/ui";
import ChatApp from "@/app/components/chat/ChatApp";

export default function ChatPage() {
  const { user } = useSession();
  const company = isCompanyRole(user?.role);
  const { data: branches = [] } = useGetBranchesBasicQuery(user?.companyId, { skip: !user?.companyId });
  // a branch user's own branch; company roles every branch
  const mine = company ? branches : branches.filter((b) => b.id === user?.branchId);
  if (!user?.uid) return <Skeleton className="m-4 h-[70vh]" rounded="rounded-2xl" />;
  return (
    <div className="mx-auto max-w-6xl md:px-6 md:py-5">
      <ChatApp user={user} branches={mine} className="h-[calc(100dvh-8.75rem)] md:h-[calc(100dvh-7.5rem)]" />
    </div>
  );
}
