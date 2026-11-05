import { describe, expect, it } from "vitest";
import { FieldValue, GeoPoint, Timestamp } from "firebase-admin/firestore";
import {
  decodeValue, encodeValue, forLocalCopy, isDroppedLocally, layoutRow, stableText,
} from "../../scripts/local/backupCodec.mjs";

const db = { doc: (p) => ({ constructor: { name: "DocumentReference" }, path: p }) };
const types = { Timestamp, GeoPoint, FieldValue };

describe("backup values", () => {
  it("keeps a Timestamp, nested too, down to the nanosecond", () => {
    const t = new Timestamp(1790000000, 123456789);
    const back = decodeValue(JSON.parse(JSON.stringify(encodeValue({ a: { at: [t] } }))), db, types);
    expect(back.a.at[0]).toBeInstanceOf(Timestamp);
    expect(back.a.at[0].isEqual(t)).toBe(true);
  });

  it("keeps a GeoPoint, bytes, a reference, null and zero", () => {
    const value = {
      where: new GeoPoint(3.1, 101.6),
      raw: Buffer.from("abc"),
      link: db.doc("companies/c1"),
      none: null,
      zero: 0,
    };
    const back = decodeValue(JSON.parse(JSON.stringify(encodeValue(value))), db, types);
    expect(back.where.isEqual(value.where)).toBe(true);
    expect(back.raw.toString()).toBe("abc");
    expect(back.link.path).toBe("companies/c1");
    expect(back.none).toBeNull();
    expect(back.zero).toBe(0);
  });

  it("compares the same whatever order the keys came in", () => {
    expect(stableText({ a: 1, b: { c: [1, 2], d: null } })).toBe(stableText({ b: { d: null, c: [1, 2] }, a: 1 }));
    expect(stableText({ a: [1, 2] })).not.toBe(stableText({ a: [2, 1] }));
  });
});

describe("the older folder layout", () => {
  it("never loses the document id to a document's own id field", () => {
    // Why the old export lost 42 salary entries: { id: doc.id, ...data }
    const row = layoutRow("payroll_run1_s1", { id: "s1", net: 100 });
    expect(row.id).toBe("payroll_run1_s1");
    expect(row.__ownId).toBe("s1");
    expect(row.net).toBe(100);
  });

  it("gives times as text, as the finance tests expect", () => {
    const row = layoutRow("d1", encodeValue({ createdAt: new Timestamp(1790000000, 500000000) }));
    expect(row.createdAt).toBe(new Date(1790000000500).toISOString());
  });
});

describe("a local copy", () => {
  it("leaves out push tokens", () => {
    expect(isDroppedLocally("companies/c/users/u/fcmTokens/t1")).toBe(true);
    expect(isDroppedLocally("companies/c/fcmTokens")).toBe(false); // a document, not the collection
    expect(isDroppedLocally("companies/c/branches/b/sales/s1")).toBe(false);
    expect(forLocalCopy({ fcmToken: "x", fcmTokens: ["y"], name: "A" })).toEqual({ name: "A" });
  });
});
