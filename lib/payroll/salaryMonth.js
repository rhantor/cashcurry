// What is already recorded as salary for a work month (Payroll or by hand),
// read from the database — so the same month's salaries are never counted
// twice by mistake. See splitSalaryMonth for the split itself.
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { splitSalaryMonth } from "./splitSalaryMonth";

export { splitSalaryMonth };

/** Reads the month's salary entries from the database and splits them. */
export async function salaryMonth(companyId, branchId, month) {
  const ref = collection(db, "companies", companyId, "branches", branchId, "salaries");
  const snap = await getDocs(query(ref, where("month", "==", month)));
  return splitSalaryMonth(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}
