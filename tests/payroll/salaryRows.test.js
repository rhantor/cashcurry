import { describe, expect, it } from "vitest";
import { salaryRows, salaryStaffName, staffRecordName } from "@/lib/payroll/salaryRows";

const pay = (staffId, net, extra = {}) => ({ id: `payroll_run4_${staffId}`, source: "payroll", payrollRunId: "run4", month: "2026-05", paymentDate: "2026-06-05", staffId, totalSalary: net, ...extra });

describe("salary report rows", () => {
  it("a payroll run is one line with its staff inside; hand entries stay as they are; the total is unchanged", () => {
    const entries = [
      { id: "m1", month: "2026-04", totalSalary: 38000 },
      pay("a", 1500, { staffName: "Ali" }),
      pay("b", 1200.5, { staffName: "Bina" }),
      pay("c", 900, { staffName: "" }),
    ];
    const rows = salaryRows(entries, { staffNames: new Map([["c", "Chan Wei"]]) });
    expect(rows).toHaveLength(2);
    const run = rows.find((r) => r.source === "payroll-run");
    expect(run).toMatchObject({ id: "run_run4", month: "2026-05", paymentDate: "2026-06-05", totalSalary: 3600.5, staffCount: 3, staffName: "Payroll · 3 staff" });
    expect(run.staff.map(salaryStaffName)).toEqual(["Ali", "Bina", "Chan Wei"]);
    expect(run.staffNames).toBe("Ali, Bina, Chan Wei");
    const sum = (l) => l.reduce((n, r) => n + r.totalSalary, 0);
    expect(sum(rows)).toBe(sum(entries));
  });
  it("a name missing from the entry: the staff list, else another month, else former staff", () => {
    const entries = [pay("x", 1, { staffName: "Xavier" }), pay("x", 1, { payrollRunId: "run5", month: "2026-06", staffName: "" }), pay("y", 1, { staffName: "", designation: "Cook" })];
    const rows = salaryRows(entries);
    const names = rows.flatMap((r) => r.staff.map(salaryStaffName)).sort();
    expect(names).toEqual(["Former staff · Cook", "Xavier", "Xavier"]);
    expect(staffRecordName({ firstName: "Nur", lastName: "Aini" })).toBe("Nur Aini");
  });
});
