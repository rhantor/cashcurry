"use client";
// One request of any type (lib/requests/model.js): who, what, how much or how
// many days, where it has got to (who approved it, and their role), and
// the buttons this person may use on it now.
import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { Ban, Check, Clock3, HandCoins, X } from "lucide-react";
import { Avatar, Badge, Button, Card, cn } from "@/app/components/ui";
import { formatMoney } from "@/lib/region/currency";
import { roleLabel } from "@/lib/authz/permissions";
import { REQUEST_TYPES, STAGES, leaveKindLabel, stageOf } from "@/lib/requests/model";

const TYPE_TONE = { advance: "brand", staffLoan: "info", leave: "warning" };

/** Under a money request: what is left in the till if it is given (`free`: CashInHand's figure). */
function AfterThis({ free, amount, currency }) {
  if (free == null || !(Number(amount) > 0)) return null;
  const left = free - Number(amount);
  return (
    <p className={cn("mt-2 rounded-lg px-2.5 py-1.5 text-xs font-medium", left < 0 ? "bg-danger-soft text-danger" : "bg-surface-2 text-muted")}>
      {left < 0 ? `Not enough cash — ${formatMoney(-left, currency)} short` : `After this: ${formatMoney(left, currency)} left in the till`}
    </p>
  );
}

export const showDay = (v, pattern = "d MMM yyyy") => {
  const d = typeof v === "string" ? parseISO(v) : null;
  return d && isValid(d) ? format(d, pattern) : v || "";
};

/** "3 hours" — how long it has waited (only when the time is known, not just the day). */
const since = (iso) => {
  const d = parseISO(String(iso));
  return isValid(d) && String(iso).length > 10 ? formatDistanceToNowStrict(d) : "";
};

/** "12 – 14 Nov 2026 · 3 days" */
export function leaveSpan(r) {
  const days = `${r.days} day${r.days === 1 ? "" : "s"}`;
  if (!r.to || r.to === r.from) return `${showDay(r.from, "EEE, d MMM yyyy")} · ${days}`;
  return `${showDay(r.from, "d MMM")} – ${showDay(r.to)} · ${days}`;
}

/** Where it has got to as a row: approved (by whom), rejected, waiting — then paid out. */
function Trail({ req }) {
  const stage = stageOf(req);
  // the latest approval; records approved before the trail existed have only approvedBy
  const a = req.approvals?.at(-1) || (["approved", "paid", "closed"].includes(stage) ? { name: req.approvedBy?.name, role: req.approvedBy?.role } : null);
  const rejected = stage === "rejected";
  const who = (x) => (x?.name ? <span className="font-normal opacity-80">· {x.name}{x.role ? ` (${roleLabel(x.role)})` : ""}</span> : null);
  if (stage === "cancelled") return null;
  return (
    <ol className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
      <li
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
          a ? "bg-success-soft text-success" : rejected ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"
        )}
      >
        {a ? <Check className="size-3" /> : rejected ? <X className="size-3" /> : <Clock3 className="size-3" />}
        {a ? "Approved" : rejected ? "Rejected" : "Waiting for approval"}
        {a ? who(a) : rejected ? who(req.rejectedBy) : null}
      </li>
      {REQUEST_TYPES[req.type]?.money && !rejected && (
        <li className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", stage === "paid" || stage === "closed" ? "bg-brand-soft text-brand" : "bg-surface-2 text-subtle")}>
          <HandCoins className="size-3" /> Paid out{req.paidOut?.date ? <span className="font-normal opacity-80">· {showDay(req.paidOut.date, "d MMM")}</span> : null}
        </li>
      )}
    </ol>
  );
}

/**
 * req: a request from toRequest · actions: what may be done now (actionsFor)
 * · onAction(action, req) · busy · currency · branchName (when the list
 * spans branches) · showWho (lists of
 * everyone's requests show the person; My requests too, for requests made for someone).
 */
export default function RequestItem({ req, actions = [], onAction, busy, currency, branchName, showWho = true, free = null, hints = [] }) {
  const type = REQUEST_TYPES[req.type];
  const stage = stageOf(req);
  const st = STAGES[stage] || STAGES.waiting;
  const isLeave = req.type === "leave";
  const facts = [
    isLeave ? { label: "When", value: leaveSpan(req) } : { label: "Date", value: showDay(req.date, "EEE, d MMM yyyy") },
    req.type === "staffLoan" && req.durationMonths ? { label: "Over", value: `${req.durationMonths} months` } : null,
    stage === "waiting" && req.askedAt ? { label: "Waiting", value: since(req.askedAt) } : null,
    { label: "Asked by", value: req.createdBy?.name && req.createdBy.name !== req.staffName ? `${req.createdBy.name}${req.createdBy.role ? ` (${roleLabel(req.createdBy.role)})` : ""}` : "" },
  ].filter((f) => f?.value);

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        {showWho && <Avatar name={req.staffName} />}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5">
            {showWho && <span className="truncate text-sm font-semibold text-fg">{req.staffName || "—"}</span>}
            <Badge tone={TYPE_TONE[req.type]} className="px-2 py-px text-[10px]">
              {isLeave ? leaveKindLabel(req.leaveKind) : type?.label}
            </Badge>
            <Badge tone={st.tone} className="px-2 py-px text-[10px]">
              {st.label}
            </Badge>
            {branchName && (
              <Badge tone="neutral" className="px-2 py-px text-[10px]">
                {branchName}
              </Badge>
            )}
          </p>
          <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
            {facts.map((f) => (
              <div key={f.label} className="flex gap-1">
                <dt className="text-subtle">{f.label}</dt>
                <dd className="text-muted">{f.value}</dd>
              </div>
            ))}
          </dl>
          {req.reason && <p className="mt-1 line-clamp-2 text-xs text-subtle">“{req.reason}”</p>}
        </div>
        {!isLeave && <span className="shrink-0 text-right text-base font-bold tabular-nums text-fg">{formatMoney(req.amount, currency)}</span>}
      </div>

      {/* what to know before deciding: who else is off then, what they already owe (useRequestHints) */}
      {hints.map((h) => (
        <p key={h.text} className={cn("mt-2 rounded-lg px-2.5 py-1.5 text-xs font-medium", h.tone === "warning" ? "bg-warning-soft text-warning" : "bg-surface-2 text-muted")}>
          {h.text}
        </p>
      ))}
      {/* the till after giving it, for whoever approves (Requested panel, cash roles) */}
      {!isLeave && actions.includes("approve") && <AfterThis free={free} amount={req.amount} currency={currency} />}
      <Trail req={req} />
      {stage === "rejected" && req.rejectReason && <p className="mt-2 text-xs text-danger">Why: {req.rejectReason}</p>}

      {actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.includes("reject") && (
            <Button variant="secondary" icon={X} className="flex-1 text-danger" disabled={busy} onClick={() => onAction?.("reject", req)}>
              Reject
            </Button>
          )}
          {actions.includes("approve") && (
            <Button icon={Check} className="flex-1" loading={busy} onClick={() => onAction?.("approve", req)}>
              Approve
            </Button>
          )}
          {actions.includes("cancel") && (
            <Button variant="secondary" icon={Ban} className="flex-1" loading={busy} onClick={() => onAction?.("cancel", req)}>
              Cancel request
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
