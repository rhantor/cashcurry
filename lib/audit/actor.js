// Who made a change to a record, read from the record itself. Used by the
// audit trigger (functions/audit.cjs is built from this file) and by the audit
// page for entries written before the trigger knew the signed-in account.
import { personName } from "../people.js";

// Where records keep who did what, with the time beside it. An update is
// credited to the first of these that changed in it.
const STAMPS = [
  { who: ["updatedBy"], when: ["updatedAt"] },
  { who: ["voucher", "decidedBy"], when: ["voucher", "decidedAt"] },
  { who: ["voucher", "by"], when: ["voucher", "at"] },
  { who: ["approvedBy"], when: ["approvedAt"] },
  { who: ["rejectedBy"], when: ["rejectedAt"] },
  { who: ["paidBy"], when: ["paidAt"] },
  { who: ["receivedBy"], when: ["receivedAt"] },
  { who: ["editedBy"], when: ["editedAt"] },
  // a vendor bill approved or sent back (13 Nov)
  { who: ["approval", "by"], when: ["approval", "at"] },
];

// Written on a record just before it is deleted (lib/audit/stampDelete.js).
const DELETE_STAMP = ["deletedBy", "deletedAt"];

/** Who deleted it: { uid, name } (name may be "" — the trigger looks it up), or null. */
export function deleterOf(before) {
  const d = before?.deletedBy;
  return d && typeof d === "object" && (d.uid || d.name) ? { uid: d.uid || "", name: personName(d) || "" } : null;
}

/** An update that only stamps who is about to delete: not worth an entry of its own. */
export function onlyDeleteStamp(before, after) {
  if (!before || !after) return false;
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => !same(before[k], after[k]));
  return keys.length > 0 && keys.every((k) => DELETE_STAMP.includes(k));
}

const at = (obj, path) => path.reduce((v, k) => (v == null ? v : v[k]), obj);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** { uid, name } for a person stamp, or null. */
export function personOf(p) {
  if (!p || typeof p !== "object") return null;
  const name = personName(p);
  if (!name) return null;
  return { uid: p.uid || p.id || "", name };
}

/**
 * Who did this change: the creator for a new record, whoever's stamp changed
 * for an update. Null when the record doesn't say (deletes never do).
 */
export function actorFromChange({ action, before, after }) {
  if (action === "created") return personOf(after?.createdBy);
  if (action === "deleted") {
    const d = deleterOf(before);
    return d?.name ? d : null;
  }
  if (action !== "updated") return null;
  for (const s of STAMPS) {
    const who = at(after, s.who);
    if (!who) continue;
    if (!same(who, at(before, s.who)) || !same(at(after, s.when), at(before, s.when))) return personOf(who);
  }
  return null;
}
