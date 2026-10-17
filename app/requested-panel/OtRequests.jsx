"use client";
import { format, isValid, parseISO } from "date-fns";
import { Clock } from "lucide-react";
import { RequestCard, RequestList } from "./RequestCard";

// Early-OT approvals. Raised automatically by the kiosk when someone punches in
// well before their shift starts (threshold in Settings → Attendance).
// Approved → the extra minutes are paid as OT. Rejected → the day is paid from
// the shift start, as if they had arrived on time.
const time = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
};
const day = (v) => {
  const d = v ? parseISO(v) : null;
  return d && isValid(d) ? format(d, "EEE, d MMM yyyy") : "";
};

export default function OtRequests({ loading, error, errorDetail, errorMsg, items, workingId, onAction, canApprove }) {
  if (error) {
    // Firestore's own message — the usual cause is that the otRequests
    // security rule hasn't been deployed yet.
    const detail = errorDetail?.message || errorDetail?.error || "";
    const isPermission = /permission|insufficient/i.test(detail);
    return (
      <div className="rounded-2xl bg-danger-soft p-4 text-sm text-danger">
        <p className="font-semibold">Couldn&apos;t load the early-OT requests.</p>
        {detail && <p className="mt-1 font-mono text-xs">{detail}</p>}
        {isPermission && (
          <p className="mt-2">
            The <code className="font-mono">otRequests</code> rule is in <code className="font-mono">firestore.rules</code> but hasn&apos;t been deployed:{" "}
            <code className="font-mono">firebase deploy --only firestore:rules</code>.
          </p>
        )}
      </div>
    );
  }
  return (
    <RequestList loading={loading} errorMsg={errorMsg} count={items.length} empty="Nobody is waiting on early overtime.">
      {items.map((req) => (
        <RequestCard
          key={req.id}
          who={req.staffName}
          kind={{ label: "Early OT", tone: "warning" }}
          amount={
            <span className="inline-flex items-center gap-1 text-warning">
              <Clock className="size-4" /> {req.earlyMinutes} min
            </span>
          }
          facts={[
            { label: "On", value: day(req.date) },
            { label: "Shift", value: req.shiftStart ? `${req.shiftStart} – ${req.shiftEnd || "?"}` : "" },
            { label: "In at", value: time(req.punchInAt) },
          ]}
          note={`Approve to pay the extra ${req.earlyMinutes} min as overtime. Reject to pay this day from the shift start.`}
          busy={workingId === req.id}
          canApprove={canApprove}
          onApprove={() => onAction(req, "approved")}
          onReject={() => onAction(req, "rejected")}
        />
      ))}
    </RequestList>
  );
}
