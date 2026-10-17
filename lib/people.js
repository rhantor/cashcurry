// People are shown by their name ("Ali Hassan"), not their sign-in username
// ("ali_kl2"). Records keep who did something as a small object — createdBy,
// approvedBy, requestedBy… — usually the session user with `name` and
// `username`; older ones may only have the username, which is then shown.

/** The name to show for a person object (a user, or a createdBy-style stamp). */
export function personName(p, fallback = "") {
  if (!p) return fallback;
  if (typeof p === "string") return p;
  const full = [p.firstName, p.lastName].filter(Boolean).join(" ");
  return p.name || p.fullName || p.displayName || full || p.username || p.userName || p.email || fallback;
}

/** Who did it, to save on a record: name for people, username and uid to find them. */
export function stampOf(u = {}) {
  return {
    uid: u.uid || u.id || "",
    name: personName(u),
    username: u.username || u.userName || "",
    role: u.role || "",
    email: u.email || "",
  };
}
