"use client";
import { format, isValid, parseISO } from "date-fns";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region";
import { RequestCard, RequestList } from "./RequestCard";

import { personName } from "@/lib/people";
// Pending advance and staff-loan requests (and leave asked for the same way).
// Approving does not pay anything out: approved requests move to "Waiting to
// be paid" (PayOutQueue) until someone hands the money over.
const KIND = {
  advance: { label: "Advance", tone: "brand" },
  staffLoan: { label: "Staff loan", tone: "info" },
};
const LEAVE = { medical: "Medical leave", annual: "Annual leave" };
const day = (v) => {
  const d = typeof v === "string" ? parseISO(v) : null;
  return d && isValid(d) ? format(d, "EEE, d MMM yyyy") : v || "";
};

export default function AdvanceRequests({ loading, error, errorMsg, items, workingId, onAction }) {
  const currency = useCurrency();
  return (
    <RequestList loading={loading} error={error && "Couldn't load the advance requests."} errorMsg={errorMsg} count={items.length} empty="No advances, staff loans or leave waiting for a decision.">
      {items.map((req) => {
        const leave = LEAVE[req.advanceType];
        return (
          <RequestCard
            key={`${req.kind}-${req.id}`}
            who={req.staffName}
            kind={leave ? { label: leave, tone: "warning" } : KIND[req.kind] || KIND.advance}
            amount={leave ? null : formatMoney(req.amount, currency)}
            facts={[
              { label: "For", value: day(req.date) },
              { label: "Over", value: req.kind === "staffLoan" && req.durationMonths ? `${req.durationMonths} months` : "" },
              { label: "Why", value: req.reason },
              { label: "Asked by", value: personName(req.createdBy) },
            ]}
            note={leave ? null : "Approving doesn't pay it out — it then waits under “Waiting to be paid” until the money is handed over."}
            busy={workingId === req.id}
            onApprove={() => onAction(req, "approved")}
            onReject={() => onAction(req, "rejected")}
          />
        );
      })}
    </RequestList>
  );
}
