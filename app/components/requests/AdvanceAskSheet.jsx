"use client";
// A staff member asks for a salary advance for themselves. It goes to the
// branch's approvers; no money
// moves until it is approved and paid out.
import { useState } from "react";
import { useAddAdvanceEntryMutation } from "@/lib/redux/api/AdvanceApiSlice";
import { useAddNotificationMutation } from "@/lib/redux/api/notificationApiSlice";
import { newRequestFields } from "@/lib/requests/model";
import { personName } from "@/lib/people";
import { formatMoney } from "@/lib/region/currency";
import { businessToday } from "@/lib/region";
import useCurrency from "@/app/hooks/useCurrency";
import { Button, Field, Sheet, Textarea, toast } from "@/app/components/ui";
import MoneyInput from "@/app/components/entry/MoneyInput";

export default function AdvanceAskSheet({ open, onClose, companyId, branchId, user }) {
  const currency = useCurrency();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [addAdvance, { isLoading }] = useAddAdvanceEntryMutation();
  const [notify] = useAddNotificationMutation();

  const save = async () => {
    const value = Number(amount) || 0;
    if (!user?.staffId) return toast.error("Your login isn't linked to a staff record yet", { description: "Ask a manager to link it in Staff management." });
    if (!(value > 0)) return toast.error("Enter the amount");
    if (!reason.trim()) return toast.error("Say what it is for");
    const name = personName(user) || "Staff";
    try {
      await addAdvance({
        companyId, branchId,
        data: {
          staffId: user.staffId,
          staffName: name,
          amount: value,
          advanceType: "salary",
          reason: reason.trim(),
          date: businessToday(),
          repaymentInstallments: 1,
          ...newRequestFields({ type: "advance", amount: value }, user),
          createdBy: { uid: user.uid, name, role: user.role || "staff" },
        },
      }).unwrap();
      // the approvers' bell (push notifications come with roadmap 4.3)
      notify({ companyId, notification: { title: "New advance request", message: `${name} asked for ${formatMoney(value, currency)}: ${reason.trim()}`, branchId, actionUrl: "/requested-panel" } }).catch(() => {});
      toast.success("Request sent", { description: `${formatMoney(value, currency)} · waiting for approval` });
      setAmount(""); setReason("");
      onClose?.();
    } catch (e) {
      toast.error("Couldn't send the request", { description: e?.message });
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Ask for an advance" description="Taken back from your next salary." footer={<Button onClick={save} loading={isLoading}>Send request</Button>}>
      <div className="space-y-4">
        <Field label="Amount">{() => <MoneyInput value={amount} onValueChange={setAmount} currency={currency} />}</Field>
        <Field label="What is it for">{({ id }) => <Textarea id={id} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. rent, medicine" />}</Field>
      </div>
    </Sheet>
  );
}
