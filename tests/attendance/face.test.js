import { describe, expect, it } from "vitest";
import { DESCRIPTOR_LENGTH, LOOKALIKE_DISTANCE, MATCH_DISTANCE, bestMatch, cleanDescriptor, cleanSamples, distance, isTheirs, lookalike, packSamples, unpackSamples } from "@/lib/attendance/face";
import { cleanPunch } from "@/lib/attendance/kiosk";

// made-up faces: 1024 numbers each; `toward(a, b, t)` slides a toward b (t = 0 → a, 1 → b)
const face = (seed) => {
  let x = seed * 9973;
  const r = () => ((x = (x * 16807) % 2147483647) / 2147483647) * 2 - 1;
  return Array.from({ length: DESCRIPTOR_LENGTH }, () => r());
};
const toward = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t);
const noise = (a, seed, t) => toward(a, face(seed), t);
const ali = face(11);
const kumar = face(22);

describe("comparing two faces", () => {
  it("is 0 for the same picture and well apart for different people", () => {
    expect(distance(ali, ali)).toBeCloseTo(0, 6);
    expect(distance(ali, kumar)).toBeGreaterThan(MATCH_DISTANCE + 0.1);
    expect(distance(ali, noise(ali, 5, 0.1))).toBeLessThan(MATCH_DISTANCE);
  });
});

describe("who is in front of the camera", () => {
  const faces = [
    { staffId: "ali", samples: [ali, noise(ali, 1, 0.1)] },
    { staffId: "kumar", samples: [kumar] },
  ];
  it("finds the person whose face is close", () => {
    expect(bestMatch(noise(ali, 7, 0.2), faces)).toMatchObject({ staffId: "ali" });
    expect(bestMatch(kumar, faces)).toMatchObject({ staffId: "kumar" });
  });
  it("says no one when nobody is close enough", () => {
    expect(bestMatch(face(99), faces)).toBeNull();
    expect(bestMatch(toward(ali, kumar, 0.5), faces)).toBeNull();
  });
  it("says no one when two people are too close to call — the PIN, never the wrong name", () => {
    const alike = [{ staffId: "a", samples: [ali] }, { staffId: "b", samples: [noise(ali, 3, 0.15)] }];
    expect(bestMatch(noise(ali, 4, 0.1), alike)).toBeNull();
  });
  it("checks a face punch against that person only", () => {
    expect(isTheirs(noise(ali, 8, 0.2), faces[0].samples)).toBe(true);
    expect(isTheirs(kumar, faces[0].samples)).toBe(false);
  });
});

describe("taking a face", () => {
  it("drops the odd blurred picture and keeps the rest", () => {
    const r = cleanSamples([ali, noise(ali, 1, 0.1), noise(ali, 2, 0.1), noise(ali, 3, 0.1), kumar]);
    expect(r.samples).toHaveLength(4);
    expect(r.samples.some((s) => s === kumar)).toBe(false);
  });
  it("needs a few pictures of one person", () => {
    expect(cleanSamples([ali, noise(ali, 1, 0.1)]).error).toBeTruthy();
    expect(cleanSamples([ali, kumar, face(5), face(6)]).error).toBeTruthy();
  });
  it("refuses a face someone else already has — judged on all the pictures, not one", () => {
    const faces = [{ staffId: "ali", samples: [ali] }];
    expect(lookalike([noise(ali, 1, 0.1), noise(ali, 2, 0.1)], faces, "kumar")).toBe("ali");
    expect(lookalike([noise(ali, 1, 0.1)], faces, "ali")).toBeNull();
    // one picture near Ali, the rest clearly someone else: not refused
    const mostlyKumar = [noise(ali, 1, 0.12), kumar, noise(kumar, 2, 0.1), noise(kumar, 3, 0.1)];
    expect(lookalike(mostlyKumar, faces, "kumar")).toBeNull();
    expect(LOOKALIKE_DISTANCE).toBeLessThan(MATCH_DISTANCE);
  });
  it("only takes sensible numbers of the right length", () => {
    expect(cleanDescriptor(ali)).toHaveLength(DESCRIPTOR_LENGTH);
    expect(cleanDescriptor(ali.slice(1))).toBeNull();
    expect(cleanDescriptor(Array(128).fill(0.1))).toBeNull(); // the old model's faces
    expect(cleanDescriptor([...ali.slice(1), "x"])).toBeNull();
    expect(cleanDescriptor(Array(DESCRIPTOR_LENGTH).fill(0))).toBeNull();
  });
  it("is kept in a shape Firestore can hold, and read back the same", () => {
    const packed = packSamples([ali, kumar]);
    expect(Object.keys(packed)).toEqual(["s0", "s1"]);
    expect(unpackSamples(packed)).toEqual([ali, kumar]);
  });
  it("a face punch carries the face, a PIN punch doesn't", () => {
    expect(cleanPunch({ id: "abcdefgh12", staffId: "a", method: "face", descriptor: ali })).toMatchObject({ method: "face", descriptor: ali });
    expect(cleanPunch({ id: "abcdefgh12", staffId: "a", pin: "1234", descriptor: ali }).descriptor).toBeNull();
  });
});
