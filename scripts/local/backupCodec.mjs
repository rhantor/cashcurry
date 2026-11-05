// How a production backup keeps Firestore values and walks the database. Used
// by scripts/backup-production.mjs (reads production) and
// scripts/local/restore-backup.mjs (writes the emulators).
//
// Each document is one line of firestore.jsonl: { path, data }. The path is the
// document's real address, so a document with its own `id` field keeps both,
// and values keep their type (a Timestamp comes back as a Timestamp).

const TAG = "__backup";

export function encodeValue(v) {
  if (v === null || v === undefined) return v ?? null;
  if (Array.isArray(v)) return v.map(encodeValue);
  if (Buffer.isBuffer(v)) return { [TAG]: "bytes", base64: v.toString("base64") };
  if (typeof v !== "object") return v;
  const kind = v.constructor?.name;
  if (kind === "Timestamp") return { [TAG]: "timestamp", seconds: v.seconds, nanoseconds: v.nanoseconds };
  if (kind === "GeoPoint") return { [TAG]: "geopoint", latitude: v.latitude, longitude: v.longitude };
  if (kind === "DocumentReference") return { [TAG]: "ref", path: v.path };
  if (kind === "VectorValue") return { [TAG]: "vector", values: v.toArray() };
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encodeValue(x)]));
}

/** `types` comes from firebase-admin/firestore: { Timestamp, GeoPoint, FieldValue }. */
export function decodeValue(v, db, types) {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map((x) => decodeValue(x, db, types));
  switch (v[TAG]) {
    case "timestamp": return new types.Timestamp(v.seconds, v.nanoseconds);
    case "geopoint": return new types.GeoPoint(v.latitude, v.longitude);
    case "bytes": return Buffer.from(v.base64, "base64");
    case "ref": return db.doc(v.path);
    case "vector": return types.FieldValue.vector(v.values);
    default: return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decodeValue(x, db, types)]));
  }
}

/** The same text for the same value, whatever order its keys came in. */
export function stableText(v) {
  if (Array.isArray(v)) return `[${v.map(stableText).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableText(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

// A row in the older folder layout, which the finance tests read. Plain JSON,
// with the document id in `id` and a document's own `id` field kept beside it.
export function layoutRow(id, data) {
  const plain = (v) => {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(plain);
    if (v[TAG] === "timestamp") return new Date(v.seconds * 1000 + Math.floor(v.nanoseconds / 1e6)).toISOString();
    if (v[TAG] === "ref") return { __ref: v.path };
    if (v[TAG] === "geopoint") return { lat: v.latitude, lng: v.longitude };
    if (v[TAG]) return v;
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  };
  const row = plain(data);
  return "id" in row ? { ...row, __ownId: row.id, id } : { ...row, id };
}

// Push tokens identify real staff phones; a local copy must never hold them.
export const LOCAL_DROP_SUBCOLLECTIONS = new Set(["fcmTokens"]);
export const LOCAL_DROP_FIELDS = new Set(["fcmToken", "fcmTokens"]);

export function isDroppedLocally(docPath) {
  return docPath.split("/").some((part, i) => i % 2 === 0 && LOCAL_DROP_SUBCOLLECTIONS.has(part));
}

export function forLocalCopy(data) {
  return Object.fromEntries(Object.entries(data).filter(([k]) => !LOCAL_DROP_FIELDS.has(k)));
}

// Every document in the database, sub-collections included, also under parents
// that have no document of their own. Only ever reads.
export async function walkFirestore(db, onDoc, { concurrency = 12 } = {}) {
  const queue = await db.listCollections();
  let active = 0;
  await new Promise((resolve, reject) => {
    const next = () => {
      if (!queue.length && !active) return resolve();
      while (queue.length && active < concurrency) {
        active++;
        visit(queue.shift()).then(() => { active--; next(); }, reject);
      }
    };
    const visit = async (col) => {
      const [snap, refs] = await Promise.all([col.get(), col.listDocuments()]);
      for (const d of snap.docs) await onDoc(d);
      const subLists = await Promise.all(refs.map((r) => r.listCollections()));
      for (const subs of subLists) queue.push(...subs);
    };
    next();
  });
}
