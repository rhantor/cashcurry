// lib/session: who is signed in and which branch every screen shows.
import { describe, it, expect, vi, beforeEach } from "vitest";
import Cookies from "js-cookie";

// Firebase stand-ins: we fire the auth callback ourselves and serve /users/{uid}.
const fb = vi.hoisted(() => ({ onAuth: null, profiles: {}, signOut: null }));
vi.mock("@/lib/firebase", () => ({ auth: {}, db: {} }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth, cb) => {
    fb.onAuth = cb;
    return () => {};
  },
  signOut: async () => fb.onAuth?.(null),
}));
vi.mock("firebase/firestore", () => ({
  doc: (_db, ...path) => ({ path: path.join("/") }),
  getDoc: async (ref) => {
    const p = fb.profiles[ref.path];
    return { exists: () => !!p, data: () => p };
  },
}));

const flush = () => new Promise((r) => setTimeout(r, 0));
const clearCookies = () => Object.keys(Cookies.get()).forEach((k) => Cookies.remove(k, { path: "/" }));

async function freshSession({ cached = null, profile = null, url = "/" } = {}) {
  vi.resetModules();
  localStorage.clear();
  window.history.replaceState({}, "", url);
  if (cached) localStorage.setItem("user", JSON.stringify(cached));
  fb.profiles = profile ? { [`users/${profile.uid}`]: profile } : {};
  const session = await import("@/lib/session");
  session.getSession(); // starts listening
  return session;
}

const signIn = async (uid) => {
  fb.onAuth({ uid, email: `${uid}@t.test` });
  await flush();
};

beforeEach(() => clearCookies());

describe("session", () => {
  it("shows the cached user instantly, then confirms with Firebase", async () => {
    const s = await freshSession({ cached: { uid: "u1", role: "manager", companyId: "co", branchId: "kl" }, profile: { uid: "u1", role: "manager", companyId: "co", branchId: "kl" } });
    expect(s.getSession()).toMatchObject({ status: "loading", user: { uid: "u1" }, activeBranchId: "kl" });
    await signIn("u1");
    expect(s.getSession().status).toBe("signedIn");
  });

  it("takes role and branch from the database, not the stale cache", async () => {
    const s = await freshSession({
      cached: { uid: "u1", role: "manager", companyId: "co", branchId: "kl" },
      profile: { uid: "u1", role: "cashier", companyId: "co", branchId: "pj", userName: "ali" },
    });
    await signIn("u1");
    expect(s.getSessionUser()).toMatchObject({ role: "cashier", branchId: "pj", username: "ali" });
    expect(s.getSession().activeBranchId).toBe("pj");
    expect(Cookies.get("role")).toBe("cashier");
    expect(JSON.parse(localStorage.getItem("user")).role).toBe("cashier");
  });

  it("a branch user always works in their own branch, whatever a cookie says", async () => {
    Cookies.set("activeBranch_co", "pj", { path: "/" });
    const s = await freshSession({ profile: { uid: "u1", role: "manager", companyId: "co", branchId: "kl" } });
    await signIn("u1");
    expect(s.getSession().activeBranchId).toBe("kl");
    s.setActiveBranch("pj");
    expect(s.getSession().activeBranchId).toBe("kl");
  });

  it("owner: the branch they picked last, ?branch= in the link, or their default", async () => {
    const owner = { uid: "o1", role: "owner", companyId: "co", defaultBranchId: "kl" };
    let s = await freshSession({ profile: owner });
    await signIn("o1");
    expect(s.getSession().activeBranchId).toBe("kl");

    s.setActiveBranch("pj");
    expect(s.getSession().activeBranchId).toBe("pj");
    expect(Cookies.get("activeBranch_co")).toBe("pj");

    s = await freshSession({ profile: owner });
    await signIn("o1");
    expect(s.getSession().activeBranchId).toBe("pj"); // remembered

    s = await freshSession({ profile: owner, url: "/dashboard?branch=dhaka" });
    await signIn("o1");
    expect(s.getSession().activeBranchId).toBe("dhaka");
  });

  it("everyone sees a branch switch at once", async () => {
    const s = await freshSession({ profile: { uid: "o1", role: "owner", companyId: "co", defaultBranchId: "kl" } });
    await signIn("o1");
    const seen = [];
    s.subscribeSession(() => seen.push(s.getSession().activeBranchId));
    s.setActiveBranch("pj");
    expect(seen).toEqual(["pj"]);
  });

  it("signing out clears the cached profile and routing cookies", async () => {
    const s = await freshSession({ profile: { uid: "u1", role: "manager", companyId: "co", branchId: "kl" } });
    await signIn("u1");
    expect(Cookies.get("isLoggedIn")).toBe("true");
    await s.signOut();
    expect(s.getSession()).toMatchObject({ status: "signedOut", user: null });
    expect(localStorage.getItem("user")).toBeNull();
    expect(Cookies.get("isLoggedIn")).toBeUndefined();
    expect(Cookies.get("activeBranch_co")).toBeUndefined();
  });
});
