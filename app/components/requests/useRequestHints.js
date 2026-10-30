"use client";
// What the approver should know before deciding (30 Oct, Ops design): for
// leave, who else is off on those days; for an advance or a staff loan, what
// the person already owes. Only for the branch being viewed (its staff list,
// leave and records are the ones read).
import { useCallback, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { useGetStaffListQuery } from "@/lib/redux/api/staffApiSlice";
import { useGetAdvanceEntriesQuery } from "@/lib/redux/api/AdvanceApiSlice";
import { useGetStaffLoansQuery } from "@/lib/redux/api/staffLoanApiSlice";
import { useApprovedLeaves } from "@/lib/tasks/client";
import { awayByStaff } from "@/lib/tasks/model";
import { alsoAway, owedBy } from "@/lib/ops/model";
import { formatMoney } from "@/lib/region/currency";

const NONE = [];
const day = (d) => format(parseISO(d), "EEE d MMM");

/** → (req) => [{ tone: "warning" | "neutral", text }] for requests at `branchId`. */
export default function useRequestHints({ companyId, branchId, requests = [], currency }) {
  const here = requests.filter((r) => r.branchId === branchId || !r.branchId);
  const leave = here.some((r) => r.type === "leave");
  const money = here.some((r) => r.type !== "leave");
  const where_ = { companyId, branchId };
  const off = !companyId || !branchId;
  const { data: staff } = useGetStaffListQuery(where_, { skip: off || !leave });
  const leaves = useApprovedLeaves(companyId, branchId, !off && leave);
  const { data: advances } = useGetAdvanceEntriesQuery({ ...where_, status: "approved" }, { skip: off || !money });
  const { data: loans } = useGetStaffLoansQuery({ ...where_, status: "approved" }, { skip: off || !money });
  const away = useMemo(() => awayByStaff({ staff: staff || NONE, leaves }), [staff, leaves]);

  return useCallback(
    (r) => {
      if (r.branchId && r.branchId !== branchId) return NONE;
      if (r.type === "leave") {
        const others = alsoAway(r, staff || NONE, away);
        if (!others.length) return NONE;
        const named = others.slice(0, 3).map((o) => `${o.name} (${o.days.length === 1 ? `${day(o.days[0])}, ${o.reason.toLowerCase()}` : `${o.days.length} of the days`})`);
        const more = others.length > 3 ? ` and ${others.length - 3} more` : "";
        return [{ tone: "warning", text: `Also off then: ${named.join(", ")}${more}` }];
      }
      const owes = owedBy(r.staffId, { advances: advances || NONE, loans: loans || NONE });
      if (!owes.total) return NONE;
      const parts = [owes.advance && `advance ${formatMoney(owes.advance, currency)}`, owes.loan && `loan ${formatMoney(owes.loan, currency)}`].filter(Boolean);
      return [{ tone: "warning", text: `Already owes ${formatMoney(owes.total, currency)}${parts.length > 1 ? ` (${parts.join(" · ")})` : ` (${parts[0]})`}` }];
    },
    [branchId, staff, away, advances, loans, currency]
  );
}
