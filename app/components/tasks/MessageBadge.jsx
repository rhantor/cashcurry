"use client";
// How many questions and answers a task has, and whether any are new to you
// (roadmap 4.11): a quiet count, or a green "new" with a dot.
import { MessageCircle } from "lucide-react";
import { cn } from "@/app/components/ui";

export default function MessageBadge({ count = 0, unread = false, className }) {
  if (!count && !unread) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-px text-[10px] font-semibold",
        unread ? "bg-brand text-brand-fg" : "bg-surface-2 text-muted",
        className
      )}
      aria-label={unread ? `${count} messages, new ones unread` : `${count} messages`}
    >
      {unread && <span className="size-1.5 rounded-full bg-brand-fg" aria-hidden="true" />}
      <MessageCircle className="size-3" aria-hidden="true" />
      {unread ? "New" : count}
    </span>
  );
}
