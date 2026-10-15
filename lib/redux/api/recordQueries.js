import { getDocs, query, where } from "firebase/firestore";

// Shared query shapes for the branch record lists (sales, costs, advances…),
// so screens ask the database for what they show instead of downloading the
// whole history and filtering it in the browser.

const merged = async (queries) => {
  const byId = new Map();
  for (const snap of await Promise.all(queries.map(getDocs))) {
    for (const d of snap.docs) byId.set(d.id, { id: d.id, ...d.data() });
  }
  return [...byId.values()];
};

/**
 * The records a ledger needs from `since` ("yyyy-MM-dd") on: everything dated
 * since then on `field` — and with `paidOut`, also what was paid out since then
 * (an advance requested last month and paid this month moves this month's cash).
 * Earlier months come from the monthly summaries (lib/finance/monthly.js).
 */
export function getDocsSince(ref, field, since, { paidOut = false } = {}) {
  const queries = [query(ref, where(field, ">=", since))];
  if (paidOut) queries.push(query(ref, where("paidOut.date", ">=", since)));
  return merged(queries);
}

/**
 * A staff member's own advances or loans: the ones they asked for, and the
 * ones entered for their staff record. The security rules only let staff run
 * exactly these two queries (isOwnRequest in firestore.rules).
 */
export function getOwnDocs(ref, { uid, staffId }) {
  const queries = [query(ref, where("createdBy.uid", "==", uid))];
  if (staffId) queries.push(query(ref, where("staffId", "==", staffId)));
  return merged(queries);
}

/**
 * Filters for request lists: `status` ("pending", or a list such as
 * ["approved", "closed"]) and `unpaid` (approved but not yet handed over).
 * Equality filters only, so no extra database index is needed.
 */
export function requestFilters({ status, unpaid } = {}) {
  const out = [];
  if (Array.isArray(status)) out.push(where("status", "in", status));
  else if (status) out.push(where("status", "==", status));
  if (unpaid) out.push(where("paidOut", "==", null));
  return out;
}
