"use client";
import { Check, X } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, Skeleton, cn } from "@/app/components/ui";

/**
 * One request waiting for a decision: who, what, how much, the details as
 * label/value pairs, and Approve / Reject. Shared by every tab of the panel.
 *   who, kind ({ label, tone }), amount (node), facts [{ label, value }], note,
 *   children (extra, e.g. a proof link), busy, canApprove, onApprove, onReject
 */
export function RequestCard({ who, kind, amount, facts = [], note, children, busy, canApprove = true, onApprove, onReject }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Avatar name={who} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-fg">{who || "—"}</span>
            {kind && (
              <Badge tone={kind.tone} className="px-2 py-px text-[10px]">
                {kind.label}
              </Badge>
            )}
          </p>
          <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
            {facts
              .filter((f) => f.value)
              .map((f) => (
                <div key={f.label} className="flex gap-1">
                  <dt className="text-subtle">{f.label}</dt>
                  <dd className="text-muted">{f.value}</dd>
                </div>
              ))}
          </dl>
        </div>
        {amount && <span className="shrink-0 text-right text-base font-bold tabular-nums text-fg">{amount}</span>}
      </div>
      {children}
      {note && <p className="mt-3 text-xs text-subtle">{note}</p>}
      {canApprove ? (
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" icon={X} className="flex-1 text-danger" disabled={busy} onClick={onReject}>
            Reject
          </Button>
          <Button icon={Check} className="flex-1" loading={busy} onClick={onApprove}>
            Approve
          </Button>
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">You can see this request, but approving it is for a manager or above.</p>
      )}
    </Card>
  );
}

/** The list around the cards: loading, error, an all-clear when nothing waits. */
export function RequestList({ loading, error, errorMsg, empty, children, count }) {
  if (loading)
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-40" rounded="rounded-2xl" />
        ))}
      </div>
    );
  if (error) return <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">{typeof error === "string" ? error : "Couldn't load these requests."}</p>;
  return (
    <div className="space-y-3">
      {errorMsg && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{errorMsg}</p>}
      {count ? <div className={cn("grid gap-3", count > 1 && "lg:grid-cols-2")}>{children}</div> : <EmptyState title="All caught up" description={empty} />}
    </div>
  );
}
