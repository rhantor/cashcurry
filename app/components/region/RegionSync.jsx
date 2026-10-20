"use client";
// Loads the active branch's settings and publishes its region (time zone,
// day cut-off, currency) for the whole app — see lib/region.
import { useEffect } from "react";
import useResolvedCompanyBranch from "@/app/hooks/useResolvedCompanyBranch";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { regionOf, setActiveRegion } from "@/lib/region";

export default function RegionSync() {
  const { ready, companyId, branchId } = useResolvedCompanyBranch();
  const { data: settings } = useGetBranchSettingsQuery(
    { companyId, branchId },
    { skip: !ready || !companyId || !branchId }
  );

  useEffect(() => {
    if (settings && branchId) setActiveRegion({ ...regionOf(settings), branchId });
  }, [settings, branchId]);

  return null;
}
