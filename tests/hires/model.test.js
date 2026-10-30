import { describe, expect, it } from "vitest";
import { cleanDetails, detailProblems, docKinds, documentsFrom, fileProblem, isSignature, linkExpiry, linkState, missingDocs, staffFormFrom } from "@/lib/hires/model";
import { RULES } from "@/app/staff-management/lib/validation";

const NOW = new Date("2026-10-30T10:00:00Z");

describe("the documents asked for", () => {
  it("IC both sides and a photo are needed; bank card and health certificate are not", () => {
    const kinds = docKinds({ nationality: "malaysian" });
    expect(kinds.filter((d) => d.required).map((d) => d.kind)).toEqual(["idFront", "idBack", "photo"]);
    expect(kinds.find((d) => d.kind === "idFront").label).toBe("IC — front");
    expect(docKinds({ nationality: "bangladeshi" }).find((d) => d.kind === "idFront").label).toBe("Passport — photo page");
  });
  it("what is still missing — by path on the server, by name on the phone", () => {
    expect(missingDocs({}, {})).toEqual(["idFront", "idBack", "photo"]);
    expect(missingDocs({ idFront: { path: "a" }, idBack: { name: "b.jpg" }, photo: null, health: [] }, {})).toEqual(["photo"]);
  });
  it("a file: a photo or a PDF (the photo must be a photo), up to 10 MB", () => {
    expect(fileProblem("idFront", { contentType: "image/jpeg", size: 2e6 })).toBe(null);
    expect(fileProblem("bank", { contentType: "application/pdf", size: 2e6 })).toBe(null);
    expect(fileProblem("photo", { contentType: "application/pdf", size: 2e6 })).toMatch(/photo/);
    expect(fileProblem("idFront", { contentType: "text/html", size: 10 })).toMatch(/photo or a PDF/);
    expect(fileProblem("idFront", { contentType: "image/png", size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
    expect(fileProblem("payslip", { contentType: "image/png", size: 10 })).toMatch(/Unknown/);
  });
});

describe("what they fill in", () => {
  const good = {
    firstName: "Faiz", lastName: "Rahman", gender: "male", dob: "1996-08-12", nationality: "malaysian", icNumber: "960812-14-5567",
    phone: "012-345 6789", addressLine1: "No. 45 Jalan Setia", emergencyContactName: "Aminah", emergencyContactPhone: "013-222 3333",
  };
  it("checked as the staff form checks it", () => {
    expect(detailProblems(good, RULES)).toEqual({});
    expect(detailProblems({ ...good, icNumber: "" }, RULES)).toHaveProperty("icNumber");
    expect(detailProblems({ ...good, nationality: "bangladeshi", icNumber: "" }, RULES)).toHaveProperty("passportNumber");
    expect(detailProblems({ ...good, phone: "12" }, RULES)).toHaveProperty("phone");
    expect(detailProblems({ ...good, emergencyContactName: " " }, RULES)).toEqual({ emergencyContactName: "Needed" });
  });
  it("only their own fields are kept — not pay, job or a kiosk PIN", () => {
    const d = cleanDetails({ ...good, basicSalary: 9999, role: "manager", pinCode: "1234", firstName: "  Faiz " });
    expect(d.firstName).toBe("Faiz");
    expect(d).not.toHaveProperty("basicSalary");
    expect(d).not.toHaveProperty("role");
    expect(d).not.toHaveProperty("pinCode");
  });
  it("a signature is a PNG data URL", () => {
    expect(isSignature("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
    expect(isSignature("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(isSignature("https://x/sig.png")).toBe(false);
  });
});

describe("the link", () => {
  const hire = { status: "sent" };
  const link = { expiresAt: linkExpiry(NOW) };
  it("works for 7 days, once, until cancelled or accepted", () => {
    expect(linkExpiry(NOW)).toBe("2026-11-06T10:00:00.000Z");
    expect(linkState(hire, link, NOW)).toBe("open");
    expect(linkState(hire, link, new Date("2026-11-06T10:00:01Z"))).toBe("expired");
    expect(linkState(hire, { ...link, usedAt: "2026-10-31" }, NOW)).toBe("used");
    expect(linkState({ status: "submitted" }, link, NOW)).toBe("used");
    expect(linkState({ status: "cancelled" }, link, NOW)).toBe("closed");
    expect(linkState(hire, null, NOW)).toBe("closed");
  });
});

describe("accepting", () => {
  const hire = {
    firstName: "Faiz", phone: "011", role: "cook", department: "Kitchen", startDate: "2026-11-01", basicSalary: 2200,
    details: { firstName: "Muhammad Faiz", lastName: "Rahman", phone: "012-345 6789", email: "", nationality: "malaysian" },
    files: { idFront: { path: "p/1.jpg", name: "ic.jpg", contentType: "image/jpeg" }, health: [{ path: "p/2.pdf", name: "typhoid.pdf", contentType: "application/pdf" }], bank: null },
  };
  it("the staff form is filled in from what they gave and the job and pay set for them", () => {
    expect(staffFormFrom(hire)).toEqual({ firstName: "Muhammad Faiz", lastName: "Rahman", phone: "012-345 6789", nationality: "malaysian", role: "cook", department: "Kitchen", startDate: "2026-11-01", basicSalary: 2200 });
  });
  it("their documents go on their record with what each one is", () => {
    expect(documentsFrom(hire)).toEqual([
      { kind: "idFront", label: "IC — front", path: "p/1.jpg", name: "ic.jpg", contentType: "image/jpeg" },
      { kind: "health", label: "Health certificate", path: "p/2.pdf", name: "typhoid.pdf", contentType: "application/pdf" },
    ]);
  });
});
