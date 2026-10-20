"use client";
import { useEffect, useMemo, useState } from "react";
import PayOutQueue from "@/app/components/requests/PayOutQueue";
import RequestInbox from "@/app/components/requests/RequestInbox";
import LeaveSheet from "@/app/components/requests/LeaveSheet";
import { useGetRequestsQuery } from "@/lib/redux/api/requestsApiSlice";
import { useGetStaffListQuery } from "@/lib/redux/api/staffApiSlice";
import { CalendarPlus } from "lucide-react";
import {
  useGetLoanEntriesQuery,
  useUpdateLoanEntryMutation,
  useApproveRepaymentWithAllocationMutation,
  useRejectRepaymentEntryMutation,
} from "@/lib/redux/api/loanApiSlice";
import {
  useGetOtRequestsQuery,
  useUpdateOtRequestMutation,
} from "@/lib/redux/api/attendanceApiSlice";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { useGetBranchesBasicQuery } from "@/lib/redux/api/branchApiSlice";
import { shiftsEnabled } from "@/lib/attendance/shifts";
import { serverTimestamp } from "firebase/firestore";
import LoanRequests from "./LoanRequests";
import VoucherInbox, { useWaitingVouchers } from "@/app/components/costs/VoucherInbox";
import BillInbox from "@/app/components/payouts/BillInbox";
import { useLivePayouts } from "@/lib/payouts/client";
import OtRequests from "./OtRequests";
import { confirmDialog, promptDialog } from "@/app/components/ui/notify";
import { Button, Skeleton, Tabs } from "@/app/components/ui";
import { CountBadge } from "@/app/components/shell/SideNav";

import { personName } from "@/lib/people";
import { can, isCompanyRole } from "@/lib/authz/permissions";
import useSession from "@/app/hooks/useSession";
// Rejecting can't be taken back from here, so it asks first.
const sureToReject = (what) => confirmDialog({ title: `Reject this ${what}?`, message: "The person who asked will see it as rejected.", confirmLabel: "Reject", danger: true });

/**
 * Requests waiting for a decision at this branch: advances, staff loans and
 * leave through the requests engine (with what's approved but not yet handed
 * over on top), loans asked by
 * other branches and repayments sent back, and early overtime from the kiosk.
 */
export default function RequestedPanel() {
  // the branch being viewed: a branch user's own, or the one a company role picked
  const { user, companyId, branchId } = useSession();
  // in-charge sees only what they approve: vouchers (4.9)
  const canRequests = can(user?.role, "advances.approve");
  const canVouchers = can(user?.role, "costs.approve");
  const [activeTab, setActiveTab] = useState(canRequests ? "advance" : "vouchers");
  // a notification opens its own tab: /requested-panel?tab=bills
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (["advance", "loan", "ot", "bills", "vouchers"].includes(t)) setActiveTab(t);
  }, []);
  const { vouchers } = useWaitingVouchers(canVouchers ? companyId : null, branchId);
  const { waiting: bills, loading: billsLoading } = useLivePayouts(canVouchers ? companyId : null, branchId);

  // local action states
  const [loanWorkingId, setLoanWorkingId] = useState(null);
  const [loanErrorMsg, setLoanErrorMsg] = useState("");
  const [otWorkingId, setOtWorkingId] = useState(null);
  const [otErrorMsg, setOtErrorMsg] = useState("");


  // Branch directory
  const { data: branches } = useGetBranchesBasicQuery(companyId, {
    skip: !companyId,
  });
  const getBranchName = (id) => branches?.find((b) => b.id === id)?.name || id;

  // advances, staff loans and leave waiting — the inbox reads the same (cached) list
  // (company roles: across every branch, as the inbox shows them first)
  const allBranches = isCompanyRole(user?.role) && (branches?.length || 0) > 1 ? branches.map((b) => b.id) : null;
  const { data: waiting = [] } = useGetRequestsQuery(
    { companyId, branchId, branchIds: allBranches, status: "pending" },
    { skip: !canRequests || !companyId || (!branchId && !allBranches), pollingInterval: 15000 }
  );
  const [leaveOpen, setLeaveOpen] = useState(false);
  const { data: staff = [], isLoading: staffLoading } = useGetStaffListQuery({ companyId, branchId }, { skip: !companyId || !branchId || !leaveOpen });

  const {
    data: loans,
    isLoading: loanLoading,
    isError: loanError,
  } = useGetLoanEntriesQuery(
    { companyId, branchId, status: "pending" },
    { skip: !canRequests || !companyId || !branchId, pollingInterval: 5000 }
  );

  // Early-OT approvals only exist when the branch runs shift templates.
  const { data: branchSettings } = useGetBranchSettingsQuery(
    { companyId, branchId },
    { skip: !companyId || !branchId }
  );
  const otTabEnabled = shiftsEnabled(branchSettings?.attendance);

  const {
    data: otRequests,
    isLoading: otLoading,
    isError: otError,
    error: otErrorDetail,
  } = useGetOtRequestsQuery(
    { companyId, branchId, status: "pending" },
    { skip: !canRequests || !companyId || !branchId || !otTabEnabled, pollingInterval: 5000 }
  );

  const [updateOtRequest] = useUpdateOtRequestMutation();
  const [updateLoan] = useUpdateLoanEntryMutation();
  const [approveRepayment] = useApproveRepaymentWithAllocationMutation();
  const [rejectRepayment] = useRejectRepaymentEntryMutation();

  // Loans coming IN to this branch are already filtered by the API; just keep pending
  const pendingLoans = useMemo(
    () => (loans || []).filter((l) => l.status === "pending"),
    [loans]
  );

  const pendingOt = useMemo(
    () => (otRequests || []).filter((r) => r.status === "pending"),
    [otRequests]
  );

  // Permissions
  // approvers per the roles matrix — the accountant asks and pays out, but doesn't approve
  const canApproveLoans = can(user?.role, "advances.approve");

  const handleLoanAction = async (req, action) => {
    setLoanErrorMsg("");
    if (!["approved", "rejected"].includes(action)) return;
    setLoanWorkingId(req.id);

    try {
      if (req.type === "repayment") {
        if (action === "approved") {
          await approveRepayment({
            companyId,
            id: req.id,
            approvedBy: {
              id: user?.uid || "",
              name: personName(user) || "Unknown",
            username: user?.username || "",
              role: user?.role || "N/A",
            },
          }).unwrap();
        } else {
          // Ask whether to auto-create refund entry
          const needRefund = await confirmDialog({
            title: "Also create a refund?",
            message: "This repayment will be rejected. Create a pending refund entry back to the payer as well?",
            confirmLabel: "Create refund",
            cancelLabel: "No refund",
          });
          const reason = await promptDialog({ title: "Reason or note", label: "Optional", placeholder: "Why is it rejected?" });

          await rejectRepayment({
            companyId,
            id: req.id,
            requireRefund: !!needRefund,
            refundNote: reason || "",
            rejectedBy: {
              id: user?.uid || "",
              name: personName(user) || "Unknown",
            username: user?.username || "",
              role: user?.role || "N/A",
            },
          }).unwrap();
        }
      } else {
        if (action === "rejected" && !(await sureToReject("loan request"))) return;
        // loan approval/rejection path (unchanged)
        await updateLoan({
          companyId,
          branchId,
          id: req.id,
          user: user,
          data: {
            status: action,
            approvedBy: {
              id: user?.uid || "",
              name: personName(user) || "Unknown",
            username: user?.username || "",
              role: user?.role || "N/A",
              timestamp: serverTimestamp(),
            },
          },
        }).unwrap();
      }
    } catch (err) {
      console.error(err);
      setLoanErrorMsg("Failed to update loan/repayment. Please try again.");
    } finally {
      setLoanWorkingId(null);
    }
  };

  const handleOtAction = async (req, action) => {
    setOtErrorMsg("");
    if (!["approved", "rejected"].includes(action)) return;
    if (action === "rejected" && !(await sureToReject("early overtime"))) return;
    setOtWorkingId(req.id);
    try {
      await updateOtRequest({
        companyId,
        branchId,
        id: req.id,
        data: {
          status: action,
          approvedBy: {
            id: user?.uid || "",
            name: personName(user) || "Unknown",
            username: user?.username || "",
            role: user?.role || "N/A",
            timestamp: serverTimestamp(),
          },
        },
      }).unwrap();
    } catch (err) {
      console.error(err);
      setOtErrorMsg("Failed to update early-OT request. Please try again.");
    } finally {
      setOtWorkingId(null);
    }
  };

  // The OT tab disappears if shifts get turned off while it's open.
  const currentTab = activeTab === "ot" && !otTabEnabled ? "advance" : !canRequests && !["vouchers", "bills"].includes(activeTab) ? "vouchers" : activeTab;

  if (!companyId || !branchId) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;

  const tab = (label, count) => (
    <>
      {label}
      <CountBadge count={count} className="h-4 min-w-4 px-1 text-[10px]" />
    </>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Tabs
          value={currentTab}
          onChange={setActiveTab}
          tabs={[
            ...(canRequests ? [{ value: "advance", label: tab("Staff requests", waiting.length) }, { value: "loan", label: tab("Branch loans", pendingLoans.length) }] : []),
            ...(canRequests && otTabEnabled ? [{ value: "ot", label: tab("Early OT", pendingOt.length) }] : []),
            ...(canVouchers ? [{ value: "bills", label: tab("Bills", bills.length) }, { value: "vouchers", label: tab("Vouchers", vouchers.length) }] : []),
          ]}
        />
      </div>

      {/* Panels */}
      {currentTab === "advance" && <PayOutQueue companyId={companyId} branchId={branchId} user={user} />}
      {currentTab === "advance" && (
        <>
          <div className="flex justify-end">
            <Button variant="secondary" icon={CalendarPlus} onClick={() => setLeaveOpen(true)}>Record leave</Button>
          </div>
          <RequestInbox companyId={companyId} branchId={branchId} user={user} branches={branches || []} />
          <LeaveSheet open={leaveOpen} onClose={() => setLeaveOpen(false)} companyId={companyId} branchId={branchId} user={user} staff={staff} staffLoading={staffLoading} />
        </>
      )}
      {currentTab === "loan" && (
        <LoanRequests
          loading={loanLoading}
          error={loanError}
          errorMsg={loanErrorMsg}
          items={pendingLoans}
          workingId={loanWorkingId}
          onAction={handleLoanAction}
          canApprove={canApproveLoans}
          getBranchName={getBranchName}
        />
      )}
      {currentTab === "vouchers" && <VoucherInbox companyId={companyId} branchId={branchId} user={user} />}
      {currentTab === "bills" && <BillInbox companyId={companyId} branchId={branchId} user={user} bills={bills} loading={billsLoading} />}
      {currentTab === "ot" && (
        <OtRequests
          loading={otLoading}
          error={otError}
          errorMsg={otErrorMsg}
          errorDetail={otErrorDetail}
          items={pendingOt}
          workingId={otWorkingId}
          onAction={handleOtAction}
          canApprove={canApproveLoans}
        />
      )}
    </div>
  );
}
