"use client";
// One request of any type (lib/requests/model.js): who, what, how much or how
// many days, where it has got to (each approval step with who took it), and
// the buttons this person may use on it now.
import { format, isValid, parseISO } from "date-fns";
import { Ban, Check, Clock3, HandCoins, X } from "lucide-react";
import { Avatar, Badge, Button, Card, cn } from "@/app/components/ui";
import { formatMoney } from "@/lib/region/currency";
import { roleLabel } from "@/lib/authz/permissions";
import { REQUEST_TYPES, STAGES, leaveKindLabel, stageOf, stepsFor, waitingStep } from "@/lib/requests/model";

const TYPE_TONE = { advance: "brand", staffLoan: "info", leave: "warning" };
const STEP_LABEL = { branch: "Branch", owner: "Owner" };

export const showDay = (v, pattern = "d MMM yyyy") => {
  const d = typeof v === "string" ? parseISO(v) : null;
  return d && isValid(d) ? format(d, pattern) : v || "";
};

/** "12 – 14 Nov 2026 · 3 days" */
export function leaveSpan(r) {
  const days = `${r.days} day${r.days === 1 ? "" : "s"}`;
  if (!r.to || r.to === r.from) return `${showDay(r.from, "EEE, d MMM yyyy")} · ${days}`;
  return `${showDay(r.from, "d MMM")} – ${showDay(r.to)} · ${days}`;
}

/** The approval steps as a row: done (who), waiting, or where it was rejected. */
function Trail({ req, policy }) {
  const steps = stepsFor(req, policy);
  const done = Object.fromEntries((req.approvals || []).map((a) => [a.step, a]));
  // approved in one go before the trail existed
  const stage = stageOf(req);
  const legacy = !req.approvals?.length && ["approved", "paid", "closed"].includes(stage);
  return (
    <ol className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
      {steps.map((s) => {
        const a = done[s] || (legacy ? { name: s === "branch" ? req.approvedBy?.name : "" } : null);
        const rejectedHere = stage === "rejected" && (req.rejectedBy?.step || "branch") === s;
        const waiting = !a && !rejectedHere && stage === "waiting";
        return (
          <li
            key={s}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
              a ? "bg-success-soft text-success" : rejectedHere ? "bg-danger-soft text-danger" : waiting ? "bg-warning-soft text-warning" : "bg-surface-2 text-subtle"
            )}
          >
            {a ? <Check className="size-3" /> : rejectedHere ? <X className="size-3" /> : <Clock3 className="size-3" />}
            {STEP_LABEL[s]}
            {a?.name ? <span className="font-normal opacity-80">· {a.name}</span> : rejectedHere && req.rejectedBy?.name ? <span className="font-normal opacity-80">· {req.rejectedBy.name}</span> : null}
          </li>
        );
      })}
      {REQUEST_TYPES[req.type]?.money && stage !== "rejected" && stage !== "cancelled" && (
        <li className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", stage === "paid" || stage === "closed" ? "bg-brand-soft text-brand" : "bg-surface-2 text-subtle")}>
          <HandCoins className="size-3" /> Paid out{req.paidOut?.date ? <span className="font-normal opacity-80">· {showDay(req.paidOut.date, "d MMM")}</span> : null}
        </li>
      )}
    </ol>
  );
}

/**
 * req: a request from toRequest · actions: what may be done now (actionsFor)
 * · onAction(action, req) · busy · currency · policy · showWho (lists of
 * everyone's requests show the person; My requests too, for requests made for someone).
 */
export default function RequestItem({ req, actions = [], onAction, busy, currency, policy, showWho = true }) {
  const type = REQUEST_TYPES[req.type];
  const stage = stageOf(req);
  const st = STAGES[stage] || STAGES.waiting;
  const isLeave = req.type === "leave";
  const ownerWait = stage === "waiting" && req.awaiting === "owner";
  const facts = [
    isLeave ? { label: "When", value: leaveSpan(req) } : { label: "Date", value: showDay(req.date, "EEE, d MMM yyyy") },
    req.type === "staffLoan" && req.durationMonths ? { label: "Over", value: `${req.durationMonths} months` } : null,
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
              {ownerWait ? "Waiting for the owner" : st.label}
            </Badge>
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

      <Trail req={req} policy={policy} />
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
              {waitingStep(req, policy) === "branch" && stepsFor(req, policy).length > 1 ? "Approve — send to owner" : "Approve"}
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
