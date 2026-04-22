import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";

export default function useCurrency() {
  const { ready, companyId, branchId } = useResolvedCompanyBranch();
  const { data: settings } = useGetBranchSettingsQuery(
    { companyId, branchId },
    { skip: !ready || !companyId || !branchId }
  );

  return settings?.financeSales?.currency || "RM";
}
