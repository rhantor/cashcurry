import { describe, expect, it } from "vitest";
import { QUALITIES, estimateMb } from "@/app/components/common/ScanToPdf";

describe("scanning pages into one PDF — the size guess", () => {
  it("grows with the pages and the quality, black & white is lighter", () => {
    expect(estimateMb(0, "medium", "color")).toBe(0);
    expect(estimateMb(20, "small", "color")).toBeLessThan(estimateMb(20, "medium", "color"));
    expect(estimateMb(20, "medium", "color")).toBeLessThan(estimateMb(20, "high", "color"));
    expect(estimateMb(20, "medium", "bw")).toBeLessThan(estimateMb(20, "medium", "color"));
  });
  it("a 20-page grocery bill fits the 10 MB a pay-out bill takes, at Small and Medium", () => {
    expect(estimateMb(20, "small", "color")).toBeLessThan(10);
    expect(estimateMb(20, "medium", "color")).toBeLessThan(10);
  });
  it("an unknown quality counts as Medium", () => {
    expect(estimateMb(10, "huge", "color")).toBe(estimateMb(10, "medium", "color"));
    expect(Object.keys(QUALITIES)).toEqual(["small", "medium", "high"]);
  });
});
