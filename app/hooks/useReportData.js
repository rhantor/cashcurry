import { useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { skipToken } from "@reduxjs/toolkit/query";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";

export default function useReportData() {
  const { ready, companyId, branchId } = useResolvedCompanyBranch();
  
  const today = new Date();
  const [fetchArgs, setFetchArgs] = useState({
    startDate: format(startOfMonth(today), "yyyy-MM-dd"),
    endDate: format(endOfMonth(today), "yyyy-MM-dd"),
  });

  const args =
    ready && companyId && branchId
      ? { companyId, branchId, ...fetchArgs }
      : skipToken;

  const { data: branchData = {} } = useGetSingleBranchQuery(args);

  return {
    ready,
    args,
    setFetchArgs,
    branchData,
    companyId,
    branchId
  };
}
