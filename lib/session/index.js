// The signed-in user and the branch they are working in — one source for the
// whole app.
//
//   status          "loading" | "signedIn" | "signedOut"
//   user            { uid, email, role, companyId, branchId, username, … }
//   activeBranchId  the branch screens show: a branch user's own branch; for
//                   owner / GM / super admin, the branch they last picked
//
// Truth is Firebase Auth plus the user's record in /users/{uid} — so a role or
// branch an admin changes takes effect on the next load. The copy in
// localStorage ("user") is only a cache for an instant first paint, and the
// cookies are only for middleware routing (see middleware.js).
//
// React: app/hooks/useSession.js. Elsewhere: getSessionUser(), getSession().
import Cookies from "js-cookie";
import { onAuthStateChanged, signOut as fbSignOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const CACHE_KEY = "user";
const COMPANY_WIDE = new Set(["owner", "gm", "superAdmin", "superadmin"]);
const COOKIE = () => ({
  path: "/",
  sameSite: "lax",
  // a year, renewed on every open: logged in until signing out, like WhatsApp (docs/STAFF_APP.md)
  expires: 365,
  secure: typeof window !== "undefined" && window.location.protocol === "https:",
});

export const isCompanyWideRole = (role) => COMPANY_WIDE.has(role);
const branchCookieKey = (companyId) => (companyId ? `activeBranch_${companyId}` : "activeBranch");

// ── store ────────────────────────────────────────────────────────────────────
const SERVER = Object.freeze({ status: "loading", user: null, activeBranchId: null });
let state = SERVER;
const listeners = new Set();

function set(next) {
  state = Object.freeze({ ...state, ...next });
  listeners.forEach((fn) => fn());
}

export function subscribeSession(fn) {
  init();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSession() {
  init();
  return state;
}
export const getServerSession = () => SERVER;

/** The signed-in user's profile, or null. Same shape the app always stored. */
export function getSessionUser() {
  return getSession().user;
}

// ── cache, cookies ───────────────────────────────────────────────────────────
function readCache() {
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_KEY) || "null");
  } catch {
    return null;
  }
}

function writeCache(user) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(user));
  } catch {
    /* private mode — the in-memory session still works */
  }
}

function writeRoutingCookies(user) {
  const opts = COOKIE();
  Cookies.set("isLoggedIn", "true", opts);
  Cookies.set("role", user.role ?? "", opts);
  Cookies.set("companyId", user.companyId ?? "", opts);
  if (user.branchId) Cookies.set("branchId", user.branchId, opts);
}

function clearAll() {
  try {
    window.localStorage.removeItem(CACHE_KEY);
    window.sessionStorage.removeItem("posWelcomedThisSession");
  } catch {
    /* ignore */
  }
  ["isLoggedIn", "role", "companyId", "branchId", "uid"].forEach((k) => Cookies.remove(k, { path: "/" }));
  Object.keys(Cookies.get()).forEach((k) => {
    if (k === "activeBranch" || k.startsWith("activeBranch_")) Cookies.remove(k, { path: "/" });
  });
}

// ── active branch ────────────────────────────────────────────────────────────
// Branch users always work in their own branch. Company-wide roles pick one:
// ?branch= in the URL, else the last one they chose, else their default.
function resolveActiveBranch(user) {
  if (!user) return null;
  if (!isCompanyWideRole(user.role)) return user.branchId || null;
  const fromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("branch") : null;
  return fromUrl || Cookies.get(branchCookieKey(user.companyId)) || user.branchId || user.defaultBranchId || null;
}

function rememberBranch(user, branchId) {
  if (!user || !branchId) return;
  Cookies.set(branchCookieKey(user.companyId), branchId, { path: "/" });
  Cookies.set("activeBranch", branchId, { path: "/" });
}

/** Switch the branch every screen shows (company-wide roles). */
export function setActiveBranch(branchId) {
  const { user } = getSession();
  if (!user || !branchId) return;
  if (!isCompanyWideRole(user.role) && branchId !== user.branchId) return;
  rememberBranch(user, branchId);
  set({ activeBranchId: branchId });
}

// ── sign in / out ────────────────────────────────────────────────────────────
function setUser(user) {
  const activeBranchId = resolveActiveBranch(user);
  rememberBranch(user, activeBranchId);
  writeCache(user);
  writeRoutingCookies(user);
  set({ status: "signedIn", user, activeBranchId });
}

/** Called by the login screen with the profile it just loaded. */
export function signedIn(user) {
  setUser(user);
}

/** After a screen saved a change to the user's own profile (e.g. default branch). */
export function updateSessionUser(patch) {
  const { user, activeBranchId } = getSession();
  if (!user) return;
  const next = { ...user, ...patch };
  writeCache(next);
  set({ user: next, activeBranchId });
}

export async function signOut() {
  await fbSignOut(auth);
  clearAll();
  set({ status: "signedOut", user: null, activeBranchId: null });
}

/** Re-read the profile from /users/{uid} (role, company, branch). */
async function refreshProfile(fbUser) {
  try {
    const snap = await getDoc(doc(db, "users", fbUser.uid));
    if (!snap.exists()) {
      // Signed in to Firebase but no profile yet: a sign-up waiting for its
      // email to be verified. Count it as signed out (the login and sign-up
      // screens work; everything else goes to sign-in) — it used to wait on
      // "Opening Cash Curry…" for ever. Firebase stays signed in, so the
      // verify screen can still finish the sign-up.
      if (getSession().user?.uid !== fbUser.uid) set({ status: "signedOut", user: null, activeBranchId: null });
      return;
    }
    const p = snap.data();
    const cached = getSession().user;
    const base = cached?.uid === fbUser.uid ? cached : {};
    setUser({
      ...base,
      ...p,
      uid: fbUser.uid,
      email: fbUser.email || p.email || base.email || "",
      username: p.userName ?? p.username ?? base.username ?? "",
      branchId: p.branchId ?? null,
      defaultBranchId: p.defaultBranchId ?? base.defaultBranchId ?? null,
    });
  } catch {
    /* offline etc. — keep the cached profile */
  }
}

let started = false;
function init() {
  if (started || typeof window === "undefined") return;
  started = true;

  // Instant first paint from the cache; Firebase confirms (or clears) it below.
  const cached = readCache();
  if (cached?.uid || cached?.role) {
    state = Object.freeze({ status: "loading", user: cached, activeBranchId: resolveActiveBranch(cached) });
  }

  onAuthStateChanged(auth, (fbUser) => {
    if (!fbUser) {
      clearAll();
      set({ status: "signedOut", user: null, activeBranchId: null });
      return;
    }
    const cachedUser = getSession().user;
    if (cachedUser?.uid === fbUser.uid) set({ status: "signedIn" });
    refreshProfile(fbUser);
  });

  // Another tab signed in or out.
  window.addEventListener("storage", (e) => {
    if (e.key !== CACHE_KEY) return;
    const user = readCache();
    set({ status: user ? "signedIn" : "signedOut", user, activeBranchId: resolveActiveBranch(user) });
  });
}
