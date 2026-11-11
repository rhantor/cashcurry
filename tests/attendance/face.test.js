import { describe, expect, it } from "vitest";
import { MATCH_DISTANCE, bestMatch, cleanDescriptor, cleanSamples, isTheirs, lookalike, packSamples, unpackSamples } from "@/lib/attendance/face";
import { cleanPunch } from "@/lib/attendance/kiosk";

// a made-up face: 128 numbers; `near` moves it a little, `far` a lot
const face = (seed) => {
  let x = seed * 9973;
  const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647) * 2 - 1;
  return Array.from({ length: 128 }, () => rnd() * 0.15);
};
const shift = (d, by) => d.map((x, i) => x + (i % 2 ? by : -by) / Math.sqrt(128));
const ali = face(1);
const kumar = face(2);

describe("who is in front of the camera", () => {
  const faces = [
    { staffId: "ali", samples: [ali, shift(ali, 0.1)] },
    { staffId: "kumar", samples: [kumar] },
  ];
  it("finds the person whose face is close", () => {
    expect(bestMatch(shift(ali, 0.2), faces)).toMatchObject({ staffId: "ali" });
    expect(bestMatch(kumar, faces)).toMatchObject({ staffId: "kumar", distance: 0 });
  });
  it("says no one when nobody is close enough", () => {
    expect(bestMatch(face(9), faces)).toBeNull();
    expect(bestMatch(shift(ali, MATCH_DISTANCE + 0.2), faces)).toBeNull();
  });
  it("says no one when two people are too close to call", () => {
    const twins = [{ staffId: "a", samples: [ali] }, { staffId: "b", samples: [shift(ali, 0.04)] }];
    expect(bestMatch(shift(ali, 0.02), twins)).toBeNull();
  });
  it("checks a face punch against that person only", () => {
    expect(isTheirs(shift(ali, 0.2), faces[0].samples)).toBe(true);
    expect(isTheirs(kumar, faces[0].samples)).toBe(false);
  });
});

describe("taking a face", () => {
  it("needs a few pictures of one person", () => {
    expect(cleanSamples([ali]).error).toBeTruthy();
    expect(cleanSamples([ali, kumar]).error).toMatch(/one person/);
    expect(cleanSamples([ali, shift(ali, 0.1), shift(ali, -0.1)]).samples).toHaveLength(3);
  });
  it("refuses a face someone else already has", () => {
    const faces = [{ staffId: "ali", samples: [ali] }];
    expect(lookalike([shift(ali, 0.1)], faces, "kumar")).toBe("ali");
    expect(lookalike([shift(ali, 0.1)], faces, "ali")).toBeNull();
    expect(lookalike([kumar], faces, "kumar")).toBeNull();
  });
  it("only takes 128 sensible numbers", () => {
    expect(cleanDescriptor(ali)).toHaveLength(128);
    expect(cleanDescriptor(ali.slice(1))).toBeNull();
    expect(cleanDescriptor([...ali.slice(1), "x"])).toBeNull();
    expect(cleanDescriptor([...ali.slice(1), 1e9])).toBeNull();
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
