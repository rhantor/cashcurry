// The sign-in globe: as it turns, every city comes round to the front — and
// "closes its day" in the ledger — exactly once per turn.
import { describe, it, expect } from "vitest";
import { CITIES, R, TURN_SECONDS, isFront, project } from "@/app/components/auth/BrandPanel";

describe("sign-in globe", () => {
  it("keeps every city on the sphere", () => {
    for (const c of CITIES) {
      for (const spin of [0, 1, 2.5, -3]) {
        const p = project(c.lat, c.lon, spin);
        expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(R, 6);
      }
    }
  });

  it("lights a city only on the side facing us", () => {
    for (const c of CITIES) {
      for (let spin = 0; spin > -2 * Math.PI; spin -= 0.05) {
        if (isFront(c, spin)) expect(project(c.lat, c.lon, spin).z).toBeGreaterThan(0);
      }
    }
  });

  it("brings each city to the front once per turn, never twice in a turn", () => {
    const frames = TURN_SECONDS * 60; // one turn at 60 fps
    const step = (2 * Math.PI) / frames;
    const facing = new Set();
    const at = Object.fromEntries(CITIES.map((c) => [c.city, []])); // spin at each close
    let spin = 0;
    for (let f = 0; f < frames * 3; f++) {
      spin -= step;
      for (const c of CITIES) {
        if (isFront(c, spin) && !facing.has(c.city)) {
          facing.add(c.city);
          at[c.city].push(spin);
        } else if (Math.cos((c.lon * Math.PI) / 180 + spin) < 0.5) facing.delete(c.city);
      }
    }
    for (const c of CITIES) {
      const spins = at[c.city];
      expect([c.city, spins.length >= 2]).toEqual([c.city, true]); // three turns: every city closes
      for (let i = 1; i < spins.length; i++) {
        // a whole turn between two closes of the same city
        expect(Math.abs(spins[i] - spins[i - 1])).toBeGreaterThan(2 * Math.PI * 0.95);
      }
    }
  });
});
