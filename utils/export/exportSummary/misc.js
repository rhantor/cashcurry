// exportSummary: the misc part (moved from exportSummary.js unchanged).
 
import { format } from "date-fns";
import { exportSummaryToExcel } from "./excel";
import { tryFormatDate } from "./helpers";
import { exportSummaryToPDF } from "./pdf";

/* -------- Human-friendly filter text -------- */
export const makeFilterText = (filterType, dateRange = {}, selectedMonth = "") => {
  try {
    switch (filterType) {
      case "last7days":  return "Last 7 Days";
      case "thisMonth":
      case "monthly":    return "This Month";
      case "lastMonth":  return "Last Month";
      case "weekly":     return "This Week";
      case "range":
        if (dateRange?.from && dateRange?.to)
          return `${tryFormatDate(dateRange.from)} - ${tryFormatDate(dateRange.to)}`;
        return "Custom Range";
      case "month":
        if (selectedMonth) {
          const [y, m] = selectedMonth.split("-").map(Number);
          if (y && m) return format(new Date(y, m - 1, 1), "MMMM yyyy");
        }
        return "By Month";
      case "all": return "All Data";
      default:    return "All Data";
    }
  } catch {
    return "All Data";
  }
};

export default { exportSummaryToExcel, exportSummaryToPDF, makeFilterText };
