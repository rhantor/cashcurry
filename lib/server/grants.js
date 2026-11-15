// A company's extra rights (Settings → Roles, 15 Nov 2026), read on the server
// so its checks agree with the screens and the database rules.
import { adminDb } from "@/lib/server/firebaseAdmin";
import { cleanGrants } from "@/lib/authz/permissions";

const cache = new Map(); // companyId → { at, grants }; a minute is plenty for a switch
export async function companyGrants(companyId) {
  if (!companyId || !adminDb) return {};
  const hit = cache.get(companyId);
  if (hit && Date.now() - hit.at < 60000) return hit.grants;
  const snap = await adminDb.doc(`companies/${companyId}/settings/roles`).get().catch(() => null);
  const grants = cleanGrants(snap?.exists ? snap.data().grants : null);
  cache.set(companyId, { at: Date.now(), grants });
  return grants;
}
