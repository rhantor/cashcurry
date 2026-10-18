"use client";
// Chat's own workspace (roadmap 4.4): away from the finance menus, for the
// office and staff alike. Back returns to the app you came from.
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import useSession from "@/app/hooks/useSession";
import { useGetBranchesBasicQuery } from "@/lib/redux/api/branchApiSlice";
import { isCompanyRole } from "@/lib/authz/permissions";
import { personName } from "@/lib/people";
import { Avatar, LogoMark, Skeleton } from "@/app/components/ui";
import NotificationBell from "@/app/components/notifications/NotificationBell";
import ChatApp from "@/app/components/chat/ChatApp";

export default function MessagesPage() {
  const { user } = useSession();
  const company = isCompanyRole(user?.role);
  const { data: branches = [] } = useGetBranchesBasicQuery(user?.companyId, { skip: !user?.companyId });
  // company roles: every branch's chat; everyone else: their own branch's
  const mine = company ? branches : branches.filter((b) => b.id === user?.branchId);
  const home = user?.role === "staff" ? "/staff-portal" : "/";

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 sm:px-4">
        <Link href={home} className="flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-3 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-fg">
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Back to Cash Curry</span>
        </Link>
        <span className="h-6 w-px bg-line" />
        <LogoMark size={28} />
        <h1 className="flex-1 text-base font-bold tracking-tight text-fg">Messages</h1>
        <NotificationBell />
        {user && <Avatar name={personName(user)} size="md" />}
      </header>
      {user?.uid ? <ChatApp user={user} branches={mine} className="min-h-0 flex-1" /> : <Skeleton className="m-4 flex-1" rounded="rounded-2xl" />}
    </div>
  );
}
