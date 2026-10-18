"use client";
// Ask for leave — for yourself, or (an approver) record it for a staff
// member, which approves it at once.
import { useState } from "react";
import { useAddLeaveMutation } from "@/lib/redux/api/requestsApiSlice";
import { LEAVE_KINDS, leaveDays } from "@/lib/requests/model";
import { can } from "@/lib/authz/permissions";
import { personName } from "@/lib/people";
import { useBusinessToday } from "@/app/hooks/useRegion";
import { Button, DatePicker, Field, Sheet, Switch, Textarea, toast } from "@/app/components/ui";
import { Chip } from "@/app/components/entry/Choices";
import StaffPicker, { staffName } from "@/app/components/entry/StaffPicker";

export default function LeaveSheet({ open, onClose, companyId, branchId, user, staff = [], staffLoading }) {
  const today = useBusinessToday();
  const approver = can(user?.role, "advances.approve");
  // an approver picks who it is for; anyone else asks for themselves
  const forOthers = approver && staff.length > 0;
  const [staffId, setStaffId] = useState("");
  const [kind, setKind] = useState("annual");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState("");
  const [addLeave, { isLoading }] = useAddLeaveMutation();

  const end = to < from ? from : to;
  const days = leaveDays(from, end, halfDay);
  const person = staff.find((s) => s.id === staffId);

  const save = async () => {
    const me = forOthers ? null : user?.staffId;
    if (forOthers && !person) return toast.error("Who is the leave for?");
    if (!forOthers && !me) return toast.error("Your login isn't linked to a staff record yet", { description: "Ask a manager to link it in Staff management." });
    if (!reason.trim()) return toast.error("Say why");
    try {
      await addLeave({
        companyId, branchId, user,
        data: {
          staffId: forOthers ? person.id : me,
          staffName: forOthers ? staffName(person) : personName(user),
          createdByName: personName(user),
          leaveKind: kind, from, to: end, halfDay: halfDay && from === end, reason: reason.trim(),
        },
      }).unwrap();
      toast.success(approver ? "Leave recorded" : "Leave request sent", { description: `${days} day${days === 1 ? "" : "s"}${approver ? "" : " · waiting for approval"}` });
      setReason(""); setStaffId(""); setHalfDay(false);
      onClose?.();
    } catch (e) {
      toast.error("Couldn't save the leave", { description: e?.message });
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={forOthers ? "Record leave" : "Ask for leave"}
      description={forOthers ? "Recorded by an approver, it is approved at once." : "Your manager approves it."}
      footer={<Button onClick={save} loading={isLoading} disabled={!days}>{forOthers ? "Record leave" : "Send request"}{days ? ` · ${days} day${days === 1 ? "" : "s"}` : ""}</Button>}
    >
      <div className="space-y-4">
        {forOthers && (
          <Field label="For">{() => <StaffPicker staff={staff} value={staffId} onChange={setStaffId} loading={staffLoading} />}</Field>
        )}
        <Field label="Kind of leave">
          {() => (
            <div className="flex flex-wrap gap-2">
              {LEAVE_KINDS.map((k) => (
                <Chip key={k.value} on={kind === k.value} onClick={() => setKind(k.value)}>{k.label}</Chip>
              ))}
            </div>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">{() => <DatePicker value={from} onChange={(v) => { setFrom(v); if (to < v) setTo(v); }} />}</Field>
          <Field label="To">{() => <DatePicker value={end} onChange={setTo} invalid={to < from} />}</Field>
        </div>
        {from === end && <Switch checked={halfDay} onChange={setHalfDay} label="Half a day" />}
        <Field label="Why">{({ id }) => <Textarea id={id} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. family wedding, doctor's note" />}</Field>
      </div>
    </Sheet>
  );
}
