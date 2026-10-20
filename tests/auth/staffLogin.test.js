import { describe, expect, it } from "vitest";
import { isPin, keysForTyped, loginKeys, looksLikeStaffId, normalIc, normalPhone, randomPin } from "@/lib/staff/login";

describe("staff login numbers", () => {
  it("phones match however they're written (Malaysia and Bangladesh)", () => {
    const my = ["012-345 6789", "+60 12-345 6789", "60123456789", "0123456789"].map(normalPhone);
    expect(new Set(my).size).toBe(1);
    const bd = ["01712-345678", "+880 1712 345678", "8801712345678"].map(normalPhone);
    expect(new Set(bd).size).toBe(1);
    expect(normalPhone("12")).toBe("");
  });
  it("IC numbers without spaces or dashes, upper case", () => {
    expect(normalIc("900101-14-5678")).toBe("900101145678");
    expect(normalIc("a1234567")).toBe("A1234567");
    expect(normalIc("x")).toBe("");
  });
  it("a PIN is six digits", () => {
    expect(isPin("123456")).toBe(true);
    expect(isPin("12345")).toBe(false);
    expect(isPin("12345a")).toBe(false);
    expect(isPin(randomPin())).toBe(true);
  });
  it("keys are hashes — never the number itself — and match what is typed", async () => {
    const [phoneKey, icKey] = await loginKeys({ phone: "012-345 6789", ic: "900101-14-5678" });
    expect(phoneKey).toMatch(/^[0-9a-f]{64}$/);
    expect(phoneKey).not.toContain("123456789");
    expect(await keysForTyped("+60 12 345 6789")).toContain(phoneKey);
    expect(await keysForTyped("900101145678")).toContain(icKey);
  });
  it("tells a staff login from a username or email", () => {
    expect(looksLikeStaffId("012-345 6789")).toBe(true);
    expect(looksLikeStaffId("900101-14-5678")).toBe(true);
    expect(looksLikeStaffId("kl_manager")).toBe(false);
    expect(looksLikeStaffId("a@b.com")).toBe(false);
  });
});
