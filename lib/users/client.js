// Change someone's office login (role, name, email, username) through the
// server (15 Nov 2026) — the browser may not write a role. Used by User
// Management and the branch page. → { changed, role } or throws with a message.
import { auth } from "@/lib/firebase";

export async function saveLogin(uid, changes) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch("/api/users/update", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
    body: JSON.stringify({ uid, changes }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || "Couldn't save the change.");
  return out;
}

/** The words for what happened. */
export const savedText = (out) => (out?.role ? "Role changed. They sign in again to use it." : out?.changed ? "Saved" : "Nothing to change");
