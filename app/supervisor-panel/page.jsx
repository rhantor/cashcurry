"use client";
// My requests (office roles who ask but don't approve): the advances, staff
// loans and leave this person raised, and where each has got to.
import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import useSession from "@/app/hooks/useSession";
import useApprovalPolicy from "@/lib/requests/useApprovalPolicy";
import { Button } from "@/app/components/ui";
import MyRequests from "@/app/components/requests/MyRequests";
import LeaveSheet from "@/app/components/requests/LeaveSheet";

export default function SupervisorPanel() {
  const { user, companyId, branchId } = useSession();
  const policy = useApprovalPolicy(companyId, branchId);
  const [leaveOpen, setLeaveOpen] = useState(false);
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
      {user?.staffId && (
        <div className="flex justify-end">
          <Button variant="secondary" icon={CalendarPlus} onClick={() => setLeaveOpen(true)}>Ask for leave</Button>
        </div>
      )}
      <MyRequests companyId={companyId} branchId={branchId} user={user} policy={policy} />
      <LeaveSheet open={leaveOpen} onClose={() => setLeaveOpen(false)} companyId={companyId} branchId={branchId} user={user} policy={policy} />
    </div>
  );
}
