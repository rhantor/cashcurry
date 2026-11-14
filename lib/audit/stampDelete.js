// Before a record the audit log watches is deleted, write who is deleting it
// on the record (14 Nov 2026). A delete carries no name of its own, so the
// audit entry used to say "System"; the trigger now reads `deletedBy` from the
// record as it was. Best effort: if the stamp can't be written (an old,
// locked record), the delete still goes ahead.
import { updateDoc } from "firebase/firestore";
import { auth } from "@/lib/firebase";

export async function stampDelete(ref) {
  const u = auth.currentUser;
  if (!u) return;
  try {
    await updateDoc(ref, { deletedBy: { uid: u.uid, name: u.displayName || "" }, deletedAt: new Date().toISOString() });
  } catch {
    /* the delete is what matters */
  }
}
