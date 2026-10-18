"use client";
// The issues board (roadmap 4.5): what's open — urgent and overdue first —
// and what's been resolved; "Given to me" for whoever has to fix things.
// Owner, super admin and gm see every branch at once. Staff see the ones they
// raised or were given. ?i=<branchId>/<issueId> opens one (notifications link there).
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { Flag, ImageIcon, MessageSquare, Plus, Wrench } from "lucide-react";
import { Avatar, Badge, Button, EmptyState, Skeleton, cn } from "@/app/components/ui";
import { Chip } from "@/app/components/entry/Choices";
import { isCompanyRole } from "@/lib/authz/permissions";
import { CATEGORIES, STATUSES, boardOrder, categoryOf, isOverdue } from "@/lib/issues/model";
import { timeOf } from "@/lib/chat/model";
import { useBusinessToday } from "@/app/hooks/useRegion";
import { useChatPeople } from "@/app/components/chat/useChat";
import { useIssues } from "./useIssues";
import NewIssueSheet from "./NewIssueSheet";
import IssueSheet from "./IssueSheet";

function IssueCard({ issue, today, branchName, onOpen }) {
  const cat = categoryOf(issue.category);
  const st = STATUSES[issue.status] || STATUSES.open;
  const overdue = isOverdue(issue, today);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full gap-3 rounded-2xl border bg-surface p-3.5 text-left shadow-sm transition hover:-translate-y-px hover:shadow-md",
        issue.priority === "urgent" && issue.status !== "resolved" ? "border-danger/40" : "border-line"
      )}
    >
      {issue.photos?.[0] ? (
        <img src={issue.photos[0].url} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-2xl">{cat.emoji}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span className="flex-1 truncate text-sm font-semibold text-fg">{issue.title}</span>
          {issue.priority === "urgent" && issue.status !== "resolved" && <Flag className="mt-0.5 size-3.5 shrink-0 text-danger" />}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">
          {cat.label}
          {branchName ? ` · ${branchName}` : ""} · {issue.reportedBy?.name} · {formatDistanceToNowStrict(new Date(timeOf(issue.createdAt) || Date.now()), { addSuffix: true })}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone={st.tone} className="px-2 py-px text-[10px]">
            {st.label}
          </Badge>
          {overdue && (
            <Badge tone="danger" className="px-2 py-px text-[10px]">
              Overdue
            </Badge>
          )}
          {issue.dueDate && !overdue && issue.status !== "resolved" && (
            <Badge tone="neutral" className="px-2 py-px text-[10px]">
              Due {issue.dueDate}
            </Badge>
          )}
          {issue.photos?.length > 1 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-subtle">
              <ImageIcon className="size-3" />
              {issue.photos.length}
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted">
            {issue.assignedTo ? (
              <>
                <Avatar name={issue.assignedTo.name} size="sm" />
                {issue.assignedTo.name.split(" ")[0]}
              </>
            ) : (
              <span className="italic text-subtle">No one yet</span>
            )}
          </span>
        </span>
      </span>
    </button>
  );
}

export default function IssuesBoard({ user, branchId, branches = [] }) {
  const router = useRouter();
  const params = useSearchParams();
  const today = useBusinessToday();
  const company = isCompanyRole(user?.role);
  const [scope, setScope] = useState("all"); // company roles: every branch, or the one picked
  const branchIds = useMemo(() => (company && scope === "all" && branches.length ? branches.map((b) => b.id) : branchId ? [branchId] : []), [company, scope, branches, branchId]);
  const { issues, ready } = useIssues(user, branchIds);
  const people = useChatPeople(user?.companyId);
  const nameOf = useMemo(() => Object.fromEntries(branches.map((b) => [b.id, b.name])), [branches]);
  const [tab, setTab] = useState("open");
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [openKey, setOpenKey] = useState(params.get("i"));
  useEffect(() => setOpenKey(params.get("i")), [params]);

  const openIssue = (i) => {
    const p = new URLSearchParams(params.toString());
    if (i) p.set("i", `${i.branchId}/${i.id}`);
    else p.delete("i");
    router.replace(`?${p.toString()}`, { scroll: false });
  };

  const counts = useMemo(
    () => ({
      open: issues.filter((i) => i.status !== "resolved").length,
      resolved: issues.filter((i) => i.status === "resolved").length,
      mine: issues.filter((i) => i.assigneeUid === user?.uid && i.status !== "resolved").length,
    }),
    [issues, user?.uid]
  );
  const shown = issues
    .filter((i) => (tab === "open" ? i.status !== "resolved" : i.status === "resolved"))
    .filter((i) => filter === "all" || (filter === "mine" ? i.assigneeUid === user?.uid : filter === "urgent" ? i.priority === "urgent" : filter === "raised" ? i.reporterUid === user?.uid : i.category === filter))
    .sort((a, b) => (tab === "open" ? boardOrder(a, b, today) : b.lastAt - a.lastAt));
  const active = openKey ? issues.find((i) => `${i.branchId}/${i.id}` === openKey) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl bg-surface-2 p-0.5 text-sm font-semibold">
          {[
            ["open", `Open · ${counts.open}`],
            ["resolved", `Resolved · ${counts.resolved}`],
          ].map(([v, label]) => (
            <button key={v} type="button" onClick={() => setTab(v)} className={cn("rounded-lg px-3.5 py-1.5 transition-colors", tab === v ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg")}>
              {label}
            </button>
          ))}
        </div>
        {company && branches.length > 1 && (
          <div className="inline-flex rounded-xl bg-surface-2 p-0.5 text-xs font-semibold">
            {[
              ["all", "All branches"],
              ["this", nameOf[branchId] || "This branch"],
            ].map(([v, label]) => (
              <button key={v} type="button" onClick={() => setScope(v)} className={cn("rounded-lg px-3 py-1.5 transition-colors", scope === v ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg")}>
                {label}
              </button>
            ))}
          </div>
        )}
        <Button icon={Plus} className="ml-auto" onClick={() => setCreating(true)}>
          Report an issue
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip on={filter === "all"} onClick={() => setFilter("all")}>
          All
        </Chip>
        {counts.mine > 0 && (
          <Chip on={filter === "mine"} onClick={() => setFilter("mine")}>
            <Wrench className="mr-1 inline size-3" /> Given to me <span className="ml-1 tabular-nums opacity-70">{counts.mine}</span>
          </Chip>
        )}
        <Chip on={filter === "raised"} onClick={() => setFilter("raised")}>
          I reported
        </Chip>
        <Chip on={filter === "urgent"} onClick={() => setFilter("urgent")}>
          <Flag className="mr-1 inline size-3" /> Urgent
        </Chip>
        {CATEGORIES.filter((c) => issues.some((i) => i.category === c.value)).map((c) => (
          <Chip key={c.value} on={filter === c.value} onClick={() => setFilter(c.value)}>
            <span className="mr-1">{c.emoji}</span>
            {c.label}
          </Chip>
        ))}
      </div>

      {!ready ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" rounded="rounded-2xl" />
          ))}
        </div>
      ) : shown.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((i) => (
            <IssueCard key={`${i.branchId}/${i.id}`} issue={i} today={today} branchName={branchIds.length > 1 ? nameOf[i.branchId] : null} onOpen={() => openIssue(i)} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={tab === "open" ? MessageSquare : Wrench}
          title={tab === "open" ? "Nothing open" : "Nothing resolved yet"}
          description={tab === "open" ? "No problems reported — or they're all fixed. Something wrong? Report it." : "Resolved issues show up here."}
        />
      )}

      <NewIssueSheet
        open={creating}
        onClose={() => setCreating(false)}
        user={user}
        branchId={branchId || branches[0]?.id}
        branches={company ? branches : []}
        people={people}
        onCreated={(i) => openIssue(i)}
      />
      <IssueSheet issue={active} onClose={() => openIssue(null)} user={user} people={people} branchName={nameOf[active?.branchId]} />
    </div>
  );
}
