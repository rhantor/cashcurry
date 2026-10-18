"use client";
// Approve / reject / cancel for any request, with the questions each needs
// (a reason when rejecting, a check before cancelling) and a toast after.
import { useState } from "react";
import { useDecideRequestMutation } from "@/lib/redux/api/requestsApiSlice";
import { REQUEST_TYPES, sourceOf } from "@/lib/requests/model";
import { confirmDialog, promptDialog, toast } from "@/app/components/ui";

export default function useRequestActions({ companyId, branchId, user }) {
  const [decide] = useDecideRequestMutation();
  const [busyId, setBusyId] = useState(null);

  const run = async (action, req) => {
    const what = REQUEST_TYPES[req.type]?.label.toLowerCase() || "request";
    let reason = "";
    if (action === "reject") {
      reason = await promptDialog({ title: `Reject this ${what}?`, label: "Why (the person who asked sees this)", placeholder: "Optional", confirmLabel: "Reject", danger: true });
      if (reason === null) return;
    }
    if (action === "cancel" && !(await confirmDialog({ title: `Cancel this ${what}?`, message: "It is taken off the approver's list.", confirmLabel: "Cancel request", cancelLabel: "Keep it", danger: true }))) return;

    setBusyId(req.id);
    try {
      await decide({ companyId, branchId: req.branchId || branchId, type: sourceOf(req), id: req.id, action, user, reason }).unwrap();
      if (action === "approve") {
        toast.success("Approved", {
          description: REQUEST_TYPES[req.type]?.money ? "It now waits to be paid out." : undefined,
        });
      } else toast.success(action === "reject" ? "Rejected" : "Request cancelled");
    } catch (e) {
      toast.error("Couldn't save that", { description: e?.message || "Check your connection and try again." });
    } finally {
      setBusyId(null);
    }
  };

  return { run, busyId };
}
