"use client";
// Chat in the staff portal (roadmap 4.4): the company chat, their branch's
// chat, groups they are in and personal chats.
import useSession from "@/app/hooks/useSession";
import { useGetBranchesBasicQuery } from "@/lib/redux/api/branchApiSlice";
import { Skeleton } from "@/app/components/ui";
import ChatApp from "@/app/components/chat/ChatApp";

export default function StaffChatPage() {
  const { user } = useSession();
  const { data: branches = [] } = useGetBranchesBasicQuery(user?.companyId, { skip: !user?.companyId });
  if (!user?.uid) return <Skeleton className="m-4 h-[70vh]" rounded="rounded-2xl" />;
  return <ChatApp user={user} branches={branches.filter((b) => b.id === user.branchId)} className="h-[calc(100dvh-8.5rem)] md:h-[calc(100dvh-4rem)]" />;
}
