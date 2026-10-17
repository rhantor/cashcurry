// A sign-up waiting for its email to be verified, kept on this device so the
// verify screen can be reopened (or reached from sign-in) after it was closed.
const KEY = "cc-pending-signup";

export function savePendingSignup(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode — the verify address still carries everything */
  }
}

export function readPendingSignup() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

export function clearPendingSignup() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
