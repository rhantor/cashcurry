// @vitest-environment node
// The local autosave must never swap in, or start from, an export that is
// empty, zeroed or cut short (12 Nov 2026: a power cut left files of zeros).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkFirestoreExport, checkLogFile, crc32c, ensurePrev, findGoodCopies, fsyncTree,
  installExport, maskCrc, prevDirFor, restoreCopy,
} from "../../scripts/local/exportSafety.mjs";

const PROJECT = "demo-cashcurry";
const BLOCK = 32 * 1024;

/** A LevelDB log, written the way the Firestore emulator writes its export files. */
function logFile(payloads) {
  const parts = [];
  let pos = 0;
  const push = (b) => { parts.push(b); pos += b.length; };
  for (const data of payloads) {
    let rest = Buffer.from(data);
    let first = true;
    do {
      const left = BLOCK - (pos % BLOCK);
      if (left < 7) { push(Buffer.alloc(left)); continue; }
      const take = Math.min(rest.length, left - 7);
      const last = take === rest.length;
      const type = first && last ? 1 : first ? 2 : last ? 4 : 3;
      const chunk = rest.subarray(0, take);
      const header = Buffer.alloc(7);
      header.writeUInt32LE(maskCrc(crc32c(Buffer.concat([Buffer.from([type]), chunk]))), 0);
      header.writeUInt16LE(take, 4);
      header[6] = type;
      push(header);
      push(chunk);
      rest = rest.subarray(take);
      first = false;
      if (last) break;
    } while (true); // eslint-disable-line no-constant-condition
  }
  return Buffer.concat(parts);
}

const docs = (n, size = 900) =>
  Array.from({ length: n }, (_, i) => `projects/${PROJECT}/databases/(default)/documents/companies/demo/items/${i}:` + "x".repeat(size));

function writeExport(dir, { output = logFile(docs(60)), meta = logFile(["meta", "all_namespaces/all_kinds"]) } = {}) {
  const kinds = path.join(dir, "all_namespaces", "all_kinds");
  fs.mkdirSync(kinds, { recursive: true });
  fs.writeFileSync(path.join(dir, "firestore_export.overall_export_metadata"), meta);
  fs.writeFileSync(path.join(kinds, "all_namespaces_all_kinds.export_metadata"), Buffer.from("\n$\n\x10firestore_export"));
  fs.writeFileSync(path.join(kinds, "output-0"), output);
  return dir;
}
const outputOf = (dir) => fs.readFileSync(path.join(dir, "all_namespaces", "all_kinds", "output-0"));

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cc-export-")); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe("export file check", () => {
  it("computes CRC32C like LevelDB", () => {
    expect(crc32c(Buffer.from("123456789"))).toBe(0xe3069283);
  });

  it("accepts a whole file, records crossing 32 KB blocks too", () => {
    const r = checkLogFile(logFile(docs(100, 2000)));
    expect(r).toMatchObject({ ok: true, records: 100 });
  });

  it("refuses empty, all-zero, zero-tailed, damaged and cut-short files", () => {
    const good = logFile(docs(60));
    expect(checkLogFile(Buffer.alloc(0)).reason).toBe("empty file");
    expect(checkLogFile(Buffer.alloc(good.length)).reason).toBe("only zero bytes");
    expect(checkLogFile(Buffer.concat([good.subarray(0, 20_000), Buffer.alloc(good.length - 20_000)])).reason).toMatch(/zero bytes from byte|damaged record|cut short/);
    const damaged = Buffer.from(good);
    damaged[5000] ^= 0xff;
    expect(checkLogFile(damaged).reason).toMatch(/damaged record/);
    expect(checkLogFile(good.subarray(0, good.length - 10)).reason).toMatch(/cut short/);
  });

  it("checks the whole export folder, also when the folder is renamed", () => {
    const dir = writeExport(path.join(tmp, "firestore_export.prev"));
    expect(checkFirestoreExport(dir, PROJECT)).toMatchObject({ ok: true, records: 60 });
    expect(checkFirestoreExport(dir, "demo-other").ok).toBe(false);
    expect(checkFirestoreExport(path.join(tmp, "nope"), PROJECT).reason).toBe("missing");
  });

  it("refuses the 12 Nov case: right sizes, only zeros", () => {
    const good = writeExport(path.join(tmp, "good"));
    const zero = writeExport(path.join(tmp, "zeroed"), {
      output: Buffer.alloc(outputOf(good).length),
      meta: Buffer.alloc(97),
    });
    const r = checkFirestoreExport(zero, PROJECT);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/only zero bytes/);
  });

  it("flushes every file it finds", () => {
    const dir = writeExport(path.join(tmp, "x"));
    expect(fsyncTree(dir)).toBe(3);
  });
});

describe("autosave swap", () => {
  const dataDir = () => path.join(tmp, "emulator-data");
  const keepDir = () => path.join(tmp, "emulator-data-kept");
  const target = () => path.join(dataDir(), "firestore_export");

  it("keeps the replaced good copy as .prev, outside the data folder", () => {
    writeExport(target(), { output: logFile(docs(10)) });
    const fresh = writeExport(path.join(keepDir(), "saving", "firestore_export"), { output: logFile(docs(20)) });
    const r = installExport({ fresh, dataDir: dataDir(), keepDir: keepDir(), projectId: PROJECT });
    expect(r).toMatchObject({ ok: true, records: 20 });
    expect(checkFirestoreExport(target(), PROJECT).records).toBe(20);
    expect(checkFirestoreExport(prevDirFor(keepDir()), PROJECT).records).toBe(10);
    expect(fs.existsSync(fresh)).toBe(false);
  });

  it("never swaps in a broken export — current copy and .prev stay", () => {
    writeExport(target(), { output: logFile(docs(10)) });
    writeExport(prevDirFor(keepDir()), { output: logFile(docs(5)) });
    const fresh = writeExport(path.join(keepDir(), "saving", "firestore_export"), { output: Buffer.alloc(5000) });
    expect(() => installExport({ fresh, dataDir: dataDir(), keepDir: keepDir(), projectId: PROJECT })).toThrow(/not good/);
    expect(checkFirestoreExport(target(), PROJECT).records).toBe(10);
    expect(checkFirestoreExport(prevDirFor(keepDir()), PROJECT).records).toBe(5);
  });

  it("sets a broken current copy aside instead of making it .prev", () => {
    writeExport(target(), { output: Buffer.alloc(5000) });
    writeExport(prevDirFor(keepDir()), { output: logFile(docs(5)) });
    const fresh = writeExport(path.join(keepDir(), "saving", "firestore_export"), { output: logFile(docs(20)) });
    installExport({ fresh, dataDir: dataDir(), keepDir: keepDir(), projectId: PROJECT, now: new Date(2026, 10, 12, 15, 31) });
    expect(checkFirestoreExport(prevDirFor(keepDir()), PROJECT).records).toBe(5);
    expect(fs.existsSync(path.join(keepDir(), "firestore_export.BAD-20261112-153100"))).toBe(true);
    expect(checkFirestoreExport(target(), PROJECT).records).toBe(20);
  });

  it("makes a spare copy when there is none, and leaves a good one alone", () => {
    writeExport(target(), { output: logFile(docs(10)) });
    expect(ensurePrev({ dataDir: dataDir(), keepDir: keepDir(), projectId: PROJECT })).toBe(true);
    expect(checkFirestoreExport(prevDirFor(keepDir()), PROJECT).records).toBe(10);
    expect(ensurePrev({ dataDir: dataDir(), keepDir: keepDir(), projectId: PROJECT })).toBe(false);
  });
});

describe("going back to a good copy", () => {
  it("lists .prev first, then the newest good rescue (skipping broken ones)", () => {
    const dataDir = path.join(tmp, "emulator-data");
    const keepDir = path.join(tmp, "emulator-data-kept");
    writeExport(prevDirFor(keepDir));
    const older = writeExport(path.join(tmp, "rescue-a", "firestore_export"));
    const newest = writeExport(path.join(tmp, "rescue-b", "firestore_export"), { output: Buffer.alloc(4000) });
    const t = Date.now() / 1000;
    fs.utimesSync(path.join(older, "all_namespaces", "all_kinds", "output-0"), t - 100, t - 100);
    fs.utimesSync(path.join(newest, "all_namespaces", "all_kinds", "output-0"), t, t);
    const copies = findGoodCopies({ dataDir, keepDir, localDir: tmp, projectId: PROJECT });
    expect(copies.map((c) => c.dir)).toEqual([prevDirFor(keepDir), older]);
  });

  it("restores a good copy and keeps the broken one aside", () => {
    const dataDir = path.join(tmp, "emulator-data");
    const keepDir = path.join(tmp, "emulator-data-kept");
    writeExport(path.join(dataDir, "firestore_export"), { output: Buffer.alloc(4000) });
    const from = writeExport(path.join(tmp, "rescue-a", "firestore_export"), { output: logFile(docs(7)) });
    const r = restoreCopy({ from, dataDir, keepDir, projectId: PROJECT });
    expect(r).toMatchObject({ ok: true, records: 7 });
    expect(fs.existsSync(r.setAside)).toBe(true);
    expect(checkFirestoreExport(from, PROJECT).ok).toBe(true); // the source stays
  });

  it("refuses to restore from a broken copy", () => {
    const dataDir = path.join(tmp, "emulator-data");
    writeExport(path.join(dataDir, "firestore_export"));
    const from = writeExport(path.join(tmp, "bad"), { output: Buffer.alloc(100) });
    expect(() => restoreCopy({ from, dataDir, projectId: PROJECT })).toThrow(/not a good export/);
    expect(checkFirestoreExport(path.join(dataDir, "firestore_export"), PROJECT).ok).toBe(true);
  });
});
