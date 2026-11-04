import { describe, expect, it } from "vitest";
import { config } from "@/middleware";

// A role check on these sent staff to /unauthorized: their phones got no push
// worker, and chat stickers didn't load.
describe("files everyone must reach", () => {
  const checked = (p) => new RegExp(`^${config.matcher[0]}$`).test(p);

  it("skip the sign-in and role checks", () => {
    for (const p of ["/firebase-messaging-sw.js", "/logo/mark.svg", "/stickers/break.svg", "/icons/icon-192.png", "/_next/static/a.js"]) {
      expect(checked(p), p).toBe(false);
    }
  });

  it("pages still get them", () => {
    for (const p of ["/payouts", "/staff-portal", "/", "/logos"]) expect(checked(p), p).toBe(true);
  });
});
