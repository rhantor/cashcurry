// The read-invoice route (16 Nov 2026), with Firebase and Claude stubbed.
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { users: {}, used: 0, reply: null, calls: [] };

vi.mock("@/lib/server/firebaseAdmin", () => {
  const adminDb = {
    collection: () => ({ doc: (uid) => ({ get: async () => ({ exists: !!state.users[uid], data: () => state.users[uid] }) }) }),
    doc: () => ({}),
    runTransaction: async (fn) => fn({ get: async () => ({ exists: true, data: () => ({ invoiceReads: state.used }) }), set: () => { state.used += 1; } }),
  };
  return {
    adminDb,
    adminAuth: { verifyIdToken: async (t) => ({ uid: t }) },
    admin: { firestore: { FieldValue: { increment: (n) => n, serverTimestamp: () => 0 } } },
  };
});
vi.mock("@/lib/server/grants", () => ({ companyGrants: async () => ({}) }));
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {}
  class Anthropic {
    constructor() {
      this.beta = { messages: { create: async (params) => (state.calls.push(params), state.reply) } };
    }
  }
  Object.assign(Anthropic, { APIError, RateLimitError: class extends APIError {}, BadRequestError: class extends APIError {}, AuthenticationError: class extends APIError {} });
  return { default: Anthropic };
});

const { GET, POST } = await import("@/app/api/purchases/read-invoice/route.js");

const ask = (uid, body = {}) =>
  POST(new Request("http://x/api/purchases/read-invoice", {
    method: "POST",
    headers: { authorization: `Bearer ${uid}`, "content-type": "application/json" },
    body: JSON.stringify({ companyId: "co", branchId: "kl", file: { data: "aGVsbG8=", type: "image/jpeg" }, items: [{ id: "onion", name: "Onion", unit: "kg" }], ...body }),
  }));
const answer = (json, stop = "end_turn") => ({ stop_reason: stop, content: [{ type: "text", text: JSON.stringify(json) }] });
const GOOD = { readable: true, problem: "", supplierName: "Fresh", invoiceNo: "A1", invoiceDate: "2026-11-16", currency: "MYR", lines: [{ text: "ONION", itemId: "onion", qty: 2, unit: "kg", unitPrice: 4, amount: 8, sure: true }], discount: 0, total: 8 };

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test";
  state.users = {
    kitchen: { companyId: "co", branchId: "kl", role: "kitchenLead" },
    cashier: { companyId: "co", branchId: "kl", role: "cashier" },
    other: { companyId: "co", branchId: "pj", role: "kitchenLead" },
  };
  state.used = 0;
  state.calls = [];
  state.reply = answer(GOOD);
});

describe("read-invoice", () => {
  it("says whether reading is set up, so the button shows only then", async () => {
    expect(await (await GET()).json()).toEqual({ ready: true });
    delete process.env.ANTHROPIC_API_KEY;
    expect(await (await GET()).json()).toEqual({ ready: false });
  });

  it("reads the photo for someone who takes goods in", async () => {
    const res = await ask("kitchen");
    expect(res.status).toBe(200);
    const { reading } = await res.json();
    expect(reading.lines[0]).toMatchObject({ itemId: "onion", qty: 2, unitPrice: 4 });
    const sent = state.calls[0];
    expect(sent.model).toBe("claude-opus-5-5");
    expect(sent.output_config.format.type).toBe("json_schema");
    expect(sent.messages[0].content[0]).toMatchObject({ type: "image", source: { media_type: "image/jpeg" } });
  });

  it("a PDF goes as a document", async () => {
    await ask("kitchen", { file: { data: "aGVsbG8=", type: "application/pdf" } });
    expect(state.calls[0].messages[0].content[0].type).toBe("document");
  });

  it("not for those who can't add bills, or at another branch", async () => {
    expect((await ask("cashier")).status).toBe(403);
    expect((await ask("other")).status).toBe(403);
    expect(state.calls).toHaveLength(0);
  });

  it("says so when it isn't set up, the file is wrong, or the day's reads are used", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect((await ask("kitchen")).status).toBe(503);
    process.env.ANTHROPIC_API_KEY = "test";
    expect((await ask("kitchen", { file: { data: "x", type: "text/html" } })).status).toBe(400);
    state.used = 150;
    expect((await ask("kitchen")).status).toBe(429);
  });

  it("a picture that isn't an invoice, or a refusal, comes back as a message", async () => {
    state.reply = answer({ ...GOOD, readable: false, problem: "a menu", lines: [] });
    const res = await ask("kitchen");
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain("a menu");
    state.reply = answer(GOOD, "refusal");
    expect((await ask("kitchen")).status).toBe(422);
  });
});
