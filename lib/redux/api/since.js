import { getDocs, query, where } from "firebase/firestore";

/**
 * The records a ledger needs from `since` ("yyyy-MM-dd") on: everything dated
 * since then on `field` — and with `paidOut`, also what was paid out since then
 * (an advance requested last month and paid this month moves this month's cash).
 * Earlier months come from the monthly summaries (lib/finance/monthly.js).
 */
export async function getDocsSince(ref, field, since, { paidOut = false } = {}) {
  const queries = [query(ref, where(field, ">=", since))];
  if (paidOut) queries.push(query(ref, where("paidOut.date", ">=", since)));
  const byId = new Map();
  for (const snap of await Promise.all(queries.map(getDocs))) {
    for (const d of snap.docs) byId.set(d.id, { id: d.id, ...d.data() });
  }
  return [...byId.values()];
}
