// A warranty brought back with a pay-out's bill, once the bill is approved. The
// approval stands either way, so a failure is only told.
import { toast } from "@/app/components/ui";
import { addWarrantyFromBill } from "@/lib/warranties/client";

export default async function keepBillWarranty(companyId, branchId, settle, costId, user) {
  try {
    await addWarrantyFromBill(companyId, branchId, settle, costId, user);
  } catch (e) {
    console.error("[warranty from bill]", e);
    toast.warning("The bill is approved, but its warranty wasn't saved", { description: "Add it in Purchases → Warranties." });
  }
}
