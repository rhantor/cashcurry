"use client";
// Tasks, checklists, notes and performance (roadmap 4.11) — the office page.
// Company roles work in the branch they picked at the top.
import useSession from "@/app/hooks/useSession";
import { Skeleton } from "@/app/components/ui";
import TasksHome from "@/app/components/tasks/TasksHome";

export default function TasksPage() {
  const { user, branchId } = useSession();
  if (!user?.uid) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;
  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-fg">Tasks</h1>
        <p className="mt-0.5 text-sm text-muted">Your checklist for the day, the tasks you give, how everyone is doing, and your own notes.</p>
      </div>
      <TasksHome user={user} branchId={branchId || user.branchId} />
    </div>
  );
}
