"use client";
import { format } from "date-fns";
import { FileThumb } from "@/app/components/common/Files";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region";
import { RequestCard, RequestList } from "./RequestCard";

import { personName } from "@/lib/people";
const when = (v) => {
  const ms = v?.seconds ? v.seconds * 1000 : v ? Date.parse(v) : 0;
  return ms ? format(new Date(ms), "EEE, d MMM yyyy") : "";
};

/**
 * Loans asked of this branch by another one, and repayments sent back to it,
 * waiting for a decision. A repayment shows how it was paid and its proof.
 * props: loading, error, errorMsg, items, workingId, onAction(req, status), canApprove, getBranchName
 */
export default function LoanRequests({ loading, error, errorMsg, items = [], workingId, onAction, canApprove, getBranchName }) {
  const currency = useCurrency();
  return (
    <RequestList loading={loading} error={error && "Couldn't load the loan requests."} errorMsg={errorMsg} count={items.length} empty="No branch loans or repayments waiting for a decision.">
      {items.map((req) => {
        const repay = req.type === "repayment";
        const cash = req.paymentMethod === "cash";
        return (
          <RequestCard
            key={req.id}
            who={req.staffName || getBranchName(req.fromBranchId ?? req.requestFromBranchId)}
            kind={repay ? { label: "Repayment", tone: "info" } : { label: "Loan asked", tone: "warning" }}
            amount={formatMoney(req.amount, currency)}
            facts={[
              { label: "On", value: when(req.createdAt) },
              { label: repay ? "Note" : "Why", value: req.note || req.reason },
              { label: "Asked by", value: personName(req.requestedBy) || personName(req.createdBy) },
              { label: "Paid by", value: repay ? req.paymentMethod : "" },
              { label: cash ? "Voucher" : "Bank", value: repay ? (cash ? req.voucherNo : req.bankName) : "" },
              { label: "Reference", value: repay && !cash ? req.referenceNo : "" },
            ]}
            busy={workingId === req.id}
            canApprove={canApprove}
            onApprove={() => onAction(req, "approved")}
            onReject={() => onAction(req, "rejected")}
          >
            {repay && req.proofUrl && (
              <div className="mt-3">
                <FileThumb url={req.proofUrl} label="Repayment proof" className="size-16" />
              </div>
            )}
          </RequestCard>
        );
      })}
    </RequestList>
  );
}
