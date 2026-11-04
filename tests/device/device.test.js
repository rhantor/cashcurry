import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "@/middleware";
import { keepsCopy, PHONE_AGENTS } from "@/lib/device/model";

const worker = fs.readFileSync(path.resolve("public/firebase-messaging-sw.js"), "utf8");
const PHONE = "Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";
const PC = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const ORIGIN = "https://app.test";

describe("which devices keep a copy", () => {
  it("phones, tablets and the Android app do", () => {
    expect(keepsCopy(PHONE)).toBe(true);
    expect(keepsCopy("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe(true);
    expect(keepsCopy("Mozilla/5.0 (Linux) CashCurryStaffApp")).toBe(true);
    expect(keepsCopy("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", 5)).toBe(true);
  });

  it("computers don't", () => {
    expect(keepsCopy(PC)).toBe(false);
    expect(keepsCopy("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", 0)).toBe(false);
    expect(keepsCopy("")).toBe(false);
  });

  it("the service worker uses the same rule", () => {
    expect(worker).toContain(`const PHONE_AGENTS = ${PHONE_AGENTS};`);
  });
});

describe("files everyone must reach", () => {
  const passes = (p) => new RegExp(`^${config.matcher[0]}$`).test(p);

  it("skip the sign-in and role checks", () => {
    for (const p of ["/firebase-messaging-sw.js", "/logo/mark.svg", "/stickers/break.svg", "/icons/icon-192.png", "/_next/static/a.js"]) {
      expect(passes(p), p).toBe(false);
    }
  });

  it("pages still get them", () => {
    for (const p of ["/payouts", "/staff-portal", "/", "/logos"]) expect(passes(p), p).toBe(true);
  });
});

// The worker's fetch handling, run for real against small stand-ins.
function fakeCaches() {
  const stores = new Map();
  const keyOf = (k) => (typeof k === "string" ? new URL(k, ORIGIN).href : k.url);
  const open = async (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const s = stores.get(name);
    return {
      match: async (k) => s.get(keyOf(k))?.clone(),
      put: async (k, r) => void s.set(keyOf(k), r),
      keys: async () => [...s.keys()].map((url) => ({ url })),
      delete: async (k) => s.delete(keyOf(k)),
    };
  };
  return { open, keys: async () => [...stores.keys()], delete: async (n) => stores.delete(n), stores };
}

function loadWorker({ agent = PHONE, fetchImpl }) {
  const listeners = {};
  const caches = fakeCaches();
  const self = {
    location: new URL(`${ORIGIN}/firebase-messaging-sw.js`),
    navigator: { userAgent: agent },
    addEventListener: (t, fn) => (listeners[t] = fn),
    skipWaiting: () => {},
    clients: { claim: async () => {} },
    registration: {},
  };
  vm.runInNewContext(worker, {
    self,
    caches,
    fetch: fetchImpl,
    Response,
    URL,
    URLSearchParams,
    Promise,
    setTimeout,
    clients: self.clients,
    importScripts: () => {},
    firebase: {},
  });
  const send = async (url, { mode = "cors", method = "GET" } = {}) => {
    let answer;
    let handled = false;
    listeners.fetch({
      request: { url: new URL(url, ORIGIN).href, mode, method },
      respondWith: (p) => {
        handled = true;
        answer = p;
      },
      waitUntil: () => {},
    });
    return { handled, res: handled ? await answer : null };
  };
  return { send, caches };
}

const page = (body) => Object.defineProperty(new Response(body, { status: 200, headers: { "Content-Type": "text/html" } }), "type", { value: "basic" });
const redirected = () => ({ ok: false, status: 0, type: "opaqueredirect", clone() { return this; } });
const nav = { mode: "navigate" };

describe("the saved copy of the app", () => {
  beforeEach(() => vi.useRealTimers());

  it("leaves computers alone", async () => {
    const { send } = loadWorker({ agent: PC, fetchImpl: vi.fn() });
    expect((await send("/payouts", nav)).handled).toBe(false);
    expect((await send("/_next/static/a.js")).handled).toBe(false);
  });

  it("never touches data, other sites or anything but reading", async () => {
    const { send } = loadWorker({ fetchImpl: vi.fn() });
    expect((await send("/api/cash")).handled).toBe(false);
    expect((await send("https://firestore.googleapis.com/x")).handled).toBe(false);
    expect((await send("/payouts?_rsc=1")).handled).toBe(false);
    expect((await send("/payouts", { ...nav, method: "POST" })).handled).toBe(false);
  });

  it("asks the server once for code, then uses the saved file", async () => {
    const fetchImpl = vi.fn(async () => page("code"));
    const { send } = loadWorker({ fetchImpl });
    await send("/_next/static/a.js");
    const { res } = await send("/_next/static/a.js");
    expect(await res.text()).toBe("code");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("shows the newest page when the server answers", async () => {
    let body = "old";
    const { send } = loadWorker({ fetchImpl: async () => page(body) });
    await send("/payouts", nav);
    body = "new";
    expect(await (await send("/payouts", nav)).res.text()).toBe("new");
  });

  it("shows the saved page when there is no connection", async () => {
    let up = true;
    const { send } = loadWorker({ fetchImpl: async () => (up ? page("saved") : Promise.reject(new Error("offline"))) });
    await send("/payouts", nav);
    up = false;
    expect(await (await send("/payouts", nav)).res.text()).toBe("saved");
  });

  it("shows the saved page after 3 seconds on a slow connection", async () => {
    let slow = false;
    const { send } = loadWorker({ fetchImpl: () => (slow ? new Promise(() => {}) : Promise.resolve(page("saved"))) });
    await send("/payouts", nav);
    slow = true;
    const started = Date.now();
    expect(await (await send("/payouts", nav)).res.text()).toBe("saved");
    expect(Date.now() - started).toBeGreaterThanOrEqual(2900);
  });

  it("goes to the last saved page when this one was never saved", async () => {
    let up = true;
    const { send } = loadWorker({ fetchImpl: async () => (up ? page("home") : Promise.reject(new Error("offline"))) });
    await send("/staff-portal", nav);
    up = false;
    const { res } = await send("/login", nav);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/staff-portal`);
  });

  it("says no connection when nothing is saved", async () => {
    const { send } = loadWorker({ fetchImpl: async () => Promise.reject(new Error("offline")) });
    expect(await (await send("/staff-portal", nav)).res.text()).toContain("No connection");
  });

  it("doesn't save sign-in pages, join links or redirects", async () => {
    let answer = () => page("x");
    const { send, caches } = loadWorker({ fetchImpl: async () => answer() });
    await send("/login", nav);
    await send("/join/secret-token", nav);
    await send("/kiosk", nav);
    answer = redirected;
    await send("/payouts", nav);
    expect(caches.stores.get("cc-pages-v1").size).toBe(0);
  });
});
