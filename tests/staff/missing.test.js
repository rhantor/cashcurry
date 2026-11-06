import { describe, expect, it } from "vitest";
import { detailsRequestFor, freePin, missingDetails, quickStaff } from "@/lib/staff/missing";
import { calcPayroll } from "@/lib/payroll/calculations";

describe("what a quickly added staff member still needs", () => {
  it("name and pay only: six things to get", () => {
    expect(missingDetails({ firstName: "Rahim", basicSalary: 1800 }).map((m) => m.key)).toEqual(["phone", "id", "idPhoto", "address", "emergency", "dob"]);
  });
  it("nothing once they are all in (passport will do for IC)", () => {
    const full = { phone: "012", passportNumber: "A1", documents: [{ kind: "idFront", path: "x" }], addressLine1: "1 Jalan", emergencyContactName: "Ma", emergencyContactPhone: "013", dob: "2000-01-01" };
    expect(missingDetails(full)).toEqual([]);
    expect(missingDetails({ ...full, emergencyContactPhone: "" }).map((m) => m.key)).toEqual(["emergency"]);
  });
  it("finds the open details link for a record", () => {
    const hires = [
      { id: "a", forStaffId: "s1", status: "accepted", createdAt: { seconds: 3 } },
      { id: "b", forStaffId: "s1", status: "sent", createdAt: { seconds: 2 } },
      { id: "c", status: "sent" },
    ];
    expect(detailsRequestFor("s1", hires).id).toBe("b");
    expect(detailsRequestFor("s2", hires)).toBeNull();
  });
});

describe("a quick add", () => {
  it("monthly: basic ÷ the month's hours, OT at the same rate", () => {
    expect(quickStaff({ firstName: " Rahim ", lastName: "Ali", pinCode: "1234", pay: "monthly", amount: 1800, hours: 312, startDate: "2026-11-06" })).toMatchObject({
      firstName: "Rahim", salaryMode: "hours", basicSalary: 1800, basicPerHour: 5.77, OTPerHour: 5.77, standardHours: 312, quickAdded: true, startDate: "2026-11-06" });
  });
  it("fixed monthly salary", () => {
    expect(quickStaff({ firstName: "Lina", lastName: "B", pinCode: "2345", pay: "fixed", amount: 1000 })).toMatchObject({ basicSalary: 1000, fixedSalaryNoAttendance: true });
  });
  it("part-time: so much an hour, paid for every hour worked", () => {
    const s = quickStaff({ firstName: "Amir", lastName: "C", pinCode: "3456", pay: "hourly", amount: 8 });
    expect(s).toMatchObject({ employmentType: "part-time", basicSalary: 0, basicPerHour: 8, OTPerHour: 8 });
    expect(calcPayroll({ ...s, standardHours: 312 }, { workedHours: 40 }).basePay).toBe(320);
    expect(calcPayroll({ ...s, standardHours: 312 }, { workedHours: 400 }).basePay).toBe(3200);
  });
  it("needs a name and an amount", () => {
    expect(() => quickStaff({ amount: 1 })).toThrow(/name/);
    expect(() => quickStaff({ firstName: "A", lastName: "B", pinCode: "1111", pay: "hourly" })).toThrow(/an hour/);
    expect(() => quickStaff({ firstName: "A", pinCode: "1111", amount: 5 })).toThrow(/last name/);
  });
  it("a job and a kiosk PIN, so the full form opens without stopping", () => {
    expect(quickStaff({ firstName: "A", lastName: "B", pinCode: "4321", amount: 1500 })).toMatchObject({ role: "staff", pinCode: "4321" });
    // 0 gives 1000, taken; the next try is free
    const seq = [0, 0.5];
    let i = 0;
    expect(freePin(["1000"], () => seq[i++])).toBe("5500");
  });
});
