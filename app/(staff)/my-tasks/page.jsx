"use client";
// Tasks in the staff app (roadmap 4.11): today's checklist, how you're doing
// this month (and your manager's rating), and your own notes.
import useSession from "@/app/hooks/useSession";
import { Skeleton } from "@/app/components/ui";
import TasksHome from "@/app/components/tasks/TasksHome";

export default function MyTasksPage() {
  const { user } = useSession();
  if (!user?.uid) return <Skeleton className="m-4 h-64" rounded="rounded-2xl" />;
  return (
    <div className="p-4 sm:p-6">
      <TasksHome user={user} branchId={user.branchId} />
    </div>
  );
}
