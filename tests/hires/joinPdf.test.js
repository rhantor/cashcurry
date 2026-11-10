import { Blob as NodeBlob } from "node:buffer";
import { describe, expect, it, vi } from "vitest";
import jsPDF from "jspdf";
import { PDFDocument } from "pdf-lib";
import { dayLabel, detailLines, joinFileName } from "@/lib/hires/model";

vi.mock("@/lib/firebase", () => ({ storage: {} }));
vi.mock("firebase/storage", () => ({ ref: () => ({}), getBlob: () => Promise.reject(new Error("no storage here")) }));
vi.mock("@/lib/hires/client", () => ({ fileUrl: async (path) => `http://files/${path}` }));

// jsdom's Blob can't give its bytes back; browsers' and Node's can
globalThis.Blob = NodeBlob;
const { joinPdf } = await import("@/lib/hires/joinPdf");

const pdfOf = (pages, text = "x") => {
  const d = new jsPDF();
  d.text(text, 10, 10);
  for (let i = 1; i < pages; i++) d.addPage();
  return d.output("arraybuffer");
};

const hire = {
  id: "h1",
  firstName: "Faiz",
  role: "cook",
  startDate: "2026-11-15",
  submittedAt: "2026-11-09T05:00:00.000Z",
  signed: { at: "2026-11-09T05:00:00.000Z" },
  details: { firstName: "Faiz", lastName: "Rahman", nationality: "Malaysian", icNumber: "900101-14-1234", phone: "0123456789", dob: "1990-01-01", addressLine1: "1 Jalan Ampang", city: "Kuala Lumpur", bankName: "Maybank", bankAccountNumber: "1234" },
  files: {
    idFront: { path: "newHires/h1/front.jpg", contentType: "image/jpeg" },
    bank: { path: "newHires/h1/bank.pdf", contentType: "application/pdf" },
  },
};

describe("what they filled in", () => {
  it("reads as label and value lines, empty ones left out", () => {
    const lines = detailLines(hire.details);
    expect(lines).toContainEqual(["Name", "Faiz Rahman"]);
    expect(lines).toContainEqual(["Date of birth", "1 Jan 1990"]);
    expect(lines).toContainEqual(["Address", "1 Jalan Ampang, Kuala Lumpur"]);
    expect(lines.map(([l]) => l)).not.toContain("Email");
  });
  it("names days and the file", () => {
    expect(dayLabel("2026-11-09T05:00:00.000Z")).toBe("9 Nov 2026");
    expect(dayLabel("")).toBe("");
    expect(joinFileName(hire)).toBe("Joining-Faiz-Rahman.pdf");
    expect(joinFileName({})).toBe("Joining-New-hire.pdf");
  });
});

describe("the joining PDF", () => {
  it("puts the details first, then the signed letter and their PDFs; says what it couldn't add", async () => {
    globalThis.fetch = vi.fn(async (url) => {
      const u = decodeURIComponent(String(url));
      const reply = (body, type) => ({ ok: true, blob: async () => new Blob([body], { type }) });
      if (u.includes("bank.pdf")) return reply(pdfOf(2, "bank"), "application/pdf");
      // a photo this browser can't draw (jsdom has no createImageBitmap)
      return reply("not really a jpeg", "image/jpeg");
    });
    const r = await joinPdf(hire, { company: "Demo Curry House", letter: pdfOf(3, "letter"), role: "Cook" });
    expect(r.fileName).toBe("Joining-Faiz-Rahman.pdf");
    expect(r.missed).toEqual(["IC — front"]);
    const out = await PDFDocument.load(new Uint8Array(await r.blob.arrayBuffer()));
    // 1 details page + 3 letter pages + 2 bank pages (the photo couldn't be drawn, so no photo page)
    expect(out.getPageCount()).toBe(6);
    expect(globalThis.fetch.mock.calls[0][0]).toMatch(/^\/api\/proxy-image\?url=/);
  });
});
