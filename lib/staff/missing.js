// Staff added in a hurry (owner, 6 Nov 2026): a name and pay is enough to start
// them on payroll and attendance; what is still missing is shown until it is in,
// filled in by hand or sent for on a link (the new-hire join link, aimed at their
// record: newHires.forStaffId). Pure.

/** What a staff record still needs: [{ key, label }]. */
export function missingDetails(s = {}) {
  const out = [];
  if (!String(s.phone || "").trim()) out.push({ key: "phone", label: "Phone" });
  if (!String(s.icNumber || s.passportNumber || "").trim()) out.push({ key: "id", label: "IC or passport number" });
  const docs = Array.isArray(s.documents) ? s.documents : [];
  if (!docs.some((d) => d.kind === "idFront")) out.push({ key: "idPhoto", label: "IC or passport photo" });
  if (!String(s.addressLine1 || "").trim()) out.push({ key: "address", label: "Address" });
  if (!String(s.emergencyContactName || "").trim() || !String(s.emergencyContactPhone || "").trim()) out.push({ key: "emergency", label: "Emergency contact" });
  if (!String(s.dob || "").trim()) out.push({ key: "dob", label: "Date of birth" });
  return out;
}

/** The open details link for a staff record, if any: the newest not accepted or cancelled. */
export const detailsRequestFor = (staffId, hires = []) =>
  hires
    .filter((h) => h.forStaffId === staffId && !["accepted", "cancelled"].includes(h.status))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0] || null;

/**
 * The staff record from a quick add: name, job, pay, start day. `pay` is
 * "monthly" (basic, by the hour against the month's hours), "fixed" (a fixed
 * monthly salary) or "hourly" (part-time: so much an hour, every hour worked).
 */
export function quickStaff({ firstName, lastName = "", role = "", department = "", startDate, pay = "monthly", amount, hours, pinCode = "" }) {
  const name = String(firstName || "").trim();
  if (!name) throw new Error("Enter their name");
  // the full staff form needs these too, so the record can be edited later without stopping on them
  if (!String(lastName).trim()) throw new Error("Enter their last name");
  if (!/^\d{4}$/.test(String(pinCode))) throw new Error("No kiosk PIN");
  const value = Number(amount);
  if (!(value > 0)) throw new Error(pay === "hourly" ? "Enter the pay an hour" : "Enter the basic");
  const base = { firstName: name, lastName: String(lastName).trim(), role: role || "staff", department: String(department).trim(), startDate: startDate || "", pinCode: String(pinCode), quickAdded: true };
  const r2 = (n) => Math.round(n * 100) / 100;
  if (pay === "hourly") return { ...base, employmentType: "part-time", salaryMode: "hours", basicSalary: 0, basicPerHour: r2(value), OTPerHour: r2(value) };
  if (pay === "fixed") return { ...base, employmentType: "full-time", salaryMode: "hours", basicSalary: r2(value), fixedSalaryNoAttendance: true };
  const perHour = hours > 0 ? r2(value / hours) : null;
  return { ...base, employmentType: "full-time", salaryMode: "hours", basicSalary: r2(value), ...(perHour ? { basicPerHour: perHour, OTPerHour: perHour, standardHours: hours } : {}) };
}

/** A kiosk PIN nobody at the branch has: 4 digits. */
export function freePin(taken = [], random = Math.random) {
  const used = new Set(taken.map(String));
  for (let i = 0; i < 200; i++) {
    const pin = String(Math.floor(1000 + random() * 9000));
    if (!used.has(pin)) return pin;
  }
  throw new Error("No free kiosk PIN");
}
