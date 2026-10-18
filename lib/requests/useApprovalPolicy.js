"use client";
// The branch's approval policy for requests (lib/requests/model.js
// approvalPolicy), read from its settings.
import { useMemo } from "react";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { approvalPolicy } from "./model";

export default function useApprovalPolicy(companyId, branchId) {
  const { data } = useGetBranchSettingsQuery({ companyId, branchId }, { skip: !companyId || !branchId });
  return useMemo(() => approvalPolicy(data), [data]);
}
