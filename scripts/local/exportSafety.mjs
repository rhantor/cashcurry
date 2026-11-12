// Keeping the local Firestore copy safe on disk.
//
// 12 Nov 2026: the laptop stopped right after an autosave. The export had been
// renamed into place but Windows had not written its contents yet, so
// output-0 and the metadata came back as files full of zero bytes. The good
// copy had to come from a rescue folder.
//
// So now: every file of a fresh export is flushed to disk (fsync) before it is
// swapped in, the export is checked record by record, the previous good copy
// is kept as `.local/emulator-data-kept/firestore_export.prev`, and the
// emulators refuse to start on a broken copy.
import fs from "node:fs";
import path from "node:path";

export const EXPORT_NAME = "firestore_export";

// ── CRC32C (Castagnoli). Export files are LevelDB logs: each record carries a
// masked CRC32C of its type byte and data. ──
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0x82f63b78 : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32c(buf, start = 0, end = buf.length) {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
const MASK_DELTA = 0xa282ead8;
export const maskCrc = (crc) => ((((crc >>> 15) | (crc << 17)) >>> 0) + MASK_DELTA) >>> 0;

const BLOCK = 32 * 1024;
const HEADER = 7;

const allZero = (buf) => {
  for (let i = 0; i < buf.length; i++) if (buf[i] !== 0) return false;
  return true;
};

/**
 * Checks a LevelDB log file (an export's output-N and overall metadata):
 * not empty, not zeros, every record whole with the right checksum.
 * → { ok, records, reason }
 */
export function checkLogFile(buf) {
  if (buf.length === 0) return { ok: false, records: 0, reason: "empty file" };
  if (allZero(buf)) return { ok: false, records: 0, reason: "only zero bytes" };
  let pos = 0;
  let records = 0;
  while (pos < buf.length) {
    const leftInBlock = BLOCK - (pos % BLOCK);
    if (leftInBlock < HEADER) { pos += leftInBlock; continue; } // block trailer
    if (pos + HEADER > buf.length) return { ok: false, records, reason: `cut short at byte ${pos}` };
    const masked = buf.readUInt32LE(pos);
    const len = buf.readUInt16LE(pos + 4);
    const type = buf[pos + 6];
    if (masked === 0 && len === 0 && type === 0) return { ok: false, records, reason: `zero bytes from byte ${pos}` };
    if (type < 1 || type > 4) return { ok: false, records, reason: `bad record at byte ${pos}` };
    if (HEADER + len > leftInBlock || pos + HEADER + len > buf.length) {
      return { ok: false, records, reason: `cut short at byte ${pos}` };
    }
    if (maskCrc(crc32c(buf, pos + 6, pos + HEADER + len)) !== masked) {
      return { ok: false, records, reason: `damaged record at byte ${pos}` };
    }
    if (type === 1 || type === 4) records++; // FULL or LAST ends a record
    pos += HEADER + len;
  }
  return { ok: true, records, reason: null };
}

/**
 * Checks a Firestore export folder (the one holding
 * firestore_export.overall_export_metadata). → { ok, reason, records, bytes }
 */
export function checkFirestoreExport(dir, projectId) {
  const bad = (reason) => ({ ok: false, reason, records: 0, bytes: 0 });
  if (!fs.existsSync(dir)) return bad("missing");
  // The name inside stays `firestore_export` even when the folder is renamed
  // (.prev, rescue copies) — and the emulators load only that name.
  const overall = path.join(dir, `${EXPORT_NAME}.overall_export_metadata`);
  if (!fs.existsSync(overall)) return bad(`no ${path.basename(overall)}`);
  const meta = checkLogFile(fs.readFileSync(overall));
  if (!meta.ok) return bad(`${path.basename(overall)}: ${meta.reason}`);

  const kinds = path.join(dir, "all_namespaces", "all_kinds");
  if (!fs.existsSync(kinds)) return bad("no all_namespaces/all_kinds");
  const files = fs.readdirSync(kinds);
  const kindMeta = files.find((f) => f.endsWith(".export_metadata"));
  if (!kindMeta) return bad("no all_kinds export_metadata");
  const km = fs.readFileSync(path.join(kinds, kindMeta));
  if (km.length === 0 || allZero(km)) return bad(`${kindMeta}: empty or only zero bytes`);

  const outputs = files.filter((f) => /^output-\d+$/.test(f));
  if (!outputs.length) return bad("no output-0");
  const needle = Buffer.from(projectId);
  let records = 0;
  let bytes = 0;
  let hasProject = false;
  for (const f of outputs) {
    const buf = fs.readFileSync(path.join(kinds, f));
    const r = checkLogFile(buf);
    if (!r.ok) return bad(`${f}: ${r.reason}`);
    records += r.records;
    bytes += buf.length;
    if (!hasProject && buf.includes(needle)) hasProject = true;
  }
  if (!hasProject) return bad(`no "${projectId}" documents in the export`);
  return { ok: true, reason: null, records, bytes };
}

/** Flushes every file (and, where the system allows, folder) under `target` to disk. */
export function fsyncTree(target) {
  if (!fs.existsSync(target)) return 0;
  let count = 0;
  const walk = (p) => {
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const e of fs.readdirSync(p)) walk(path.join(p, e));
      fsyncDir(p);
    } else if (st.isFile()) {
      // "r+" so Windows grants the write access FlushFileBuffers needs; nothing is written.
      const fd = fs.openSync(p, "r+");
      try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      count++;
    }
  };
  walk(target);
  return count;
}

/** Folder fsync makes renames durable on Linux/macOS. Windows can't open folders; NTFS journals renames itself. */
export function fsyncDir(dir) {
  if (process.platform === "win32") return;
  try {
    const fd = fs.openSync(dir, "r");
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  } catch {
    // some file systems refuse folder fsync — the file data is already flushed
  }
}

const stamp = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

// Kept copies live NEXT TO the data folder, not inside it: on Ctrl+C the
// Firebase CLI deletes the whole data folder and moves its new export in
// (firebase-tools hubExport: rmSync + moveSync, no fsync).
export const keptDirFor = (dataDir) => `${dataDir}-kept`;
export const prevDirFor = (keepDir) => path.join(keepDir, `${EXPORT_NAME}.prev`);
export const savingDirFor = (keepDir) => path.join(keepDir, "saving");

/** Copies a checked export to `to` through a staging folder, flushed and checked again. */
function copyChecked(from, to, projectId) {
  const staging = `${to}.copying`;
  fs.rmSync(staging, { recursive: true, force: true });
  fs.cpSync(from, staging, { recursive: true });
  fsyncTree(staging);
  const check = checkFirestoreExport(staging, projectId);
  if (!check.ok) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw new Error(`the copy did not come out whole (${check.reason})`);
  }
  fs.rmSync(to, { recursive: true, force: true });
  fs.renameSync(staging, to);
  fsyncDir(path.dirname(to));
  return check;
}

/**
 * Swaps a finished export into `dataDir/firestore_export`:
 *  1. flush every file of the fresh export to disk and check it;
 *  2. only then the current copy, if good, becomes `keepDir/firestore_export.prev`
 *     (replacing the older one); a broken current copy is set aside as
 *     `keepDir/firestore_export.BAD-<time>`, never deleted;
 *  3. the fresh export is renamed in and checked again.
 * Throws (leaving the current copy alone) when the fresh export is not good.
 * `fresh` must be on the same drive as `dataDir` (renames).
 */
export function installExport({ fresh, dataDir, keepDir = keptDirFor(dataDir), projectId, now = new Date() }) {
  const files = fsyncTree(fresh);
  const check = checkFirestoreExport(fresh, projectId);
  if (!check.ok) throw new Error(`new export is not good (${check.reason})`);

  fs.mkdirSync(keepDir, { recursive: true });
  const target = path.join(dataDir, EXPORT_NAME);
  const prev = prevDirFor(keepDir);
  if (fs.existsSync(target)) {
    if (checkFirestoreExport(target, projectId).ok) {
      fs.rmSync(prev, { recursive: true, force: true });
      fs.renameSync(target, prev);
    } else {
      fs.renameSync(target, path.join(keepDir, `${EXPORT_NAME}.BAD-${stamp(now)}`));
    }
    fsyncDir(keepDir);
  }
  fs.renameSync(fresh, target);
  fsyncDir(dataDir);
  const after = checkFirestoreExport(target, projectId);
  if (!after.ok) throw new Error(`export broke while moving (${after.reason})`);
  return { ...after, files };
}

/** Makes sure a good `.prev` exists — a copy of the current one when there is none yet. */
export function ensurePrev({ dataDir, keepDir = keptDirFor(dataDir), projectId }) {
  const prev = prevDirFor(keepDir);
  if (checkFirestoreExport(prev, projectId).ok) return false;
  fs.mkdirSync(keepDir, { recursive: true });
  copyChecked(path.join(dataDir, EXPORT_NAME), prev, projectId);
  return true;
}

/**
 * Good copies to start from when the current one is broken, best first:
 * an autosave that stopped before its swap, `firestore_export.prev`, then
 * the newest good `.local/rescue-*` export. → [{ dir, label }]
 */
export function findGoodCopies({ dataDir, keepDir = keptDirFor(dataDir), localDir, projectId, maxRescues = 1 }) {
  const out = [];
  const saving = path.join(savingDirFor(keepDir), EXPORT_NAME);
  if (checkFirestoreExport(saving, projectId).ok) out.push({ dir: saving, label: "autosave that stopped just before its swap (newest)" });
  const prev = prevDirFor(keepDir);
  if (checkFirestoreExport(prev, projectId).ok) out.push({ dir: prev, label: "previous good save" });

  let rescues = [];
  try {
    rescues = fs
      .readdirSync(localDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith("rescue-"))
      .map((e) => path.join(localDir, e.name, EXPORT_NAME))
      .map((dir) => {
        try {
          return { dir, time: fs.statSync(path.join(dir, "all_namespaces", "all_kinds", "output-0")).mtimeMs };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.time - a.time);
  } catch {
    // no .local folder
  }
  let found = 0;
  for (const r of rescues) {
    if (found >= maxRescues) break;
    if (checkFirestoreExport(r.dir, projectId).ok) {
      out.push({ dir: r.dir, label: `rescue copy from ${new Date(r.time).toLocaleString()}` });
      found++;
    }
  }
  return out;
}

/**
 * Puts a good copy back as `dataDir/firestore_export`. A broken current one
 * is set aside as `keepDir/firestore_export.BAD-<time>` (never deleted).
 */
export function restoreCopy({ from, dataDir, keepDir = keptDirFor(dataDir), projectId, now = new Date() }) {
  const check = checkFirestoreExport(from, projectId);
  if (!check.ok) throw new Error(`${from} is not a good export (${check.reason})`);
  const target = path.join(dataDir, EXPORT_NAME);
  const staging = path.join(keepDir, "restoring");
  fs.mkdirSync(keepDir, { recursive: true });
  copyChecked(from, staging, projectId);
  let setAside = null;
  if (fs.existsSync(target)) {
    setAside = path.join(keepDir, `${EXPORT_NAME}.BAD-${stamp(now)}`);
    fs.renameSync(target, setAside);
  }
  fs.renameSync(staging, target);
  fsyncDir(dataDir);
  return { ...checkFirestoreExport(target, projectId), setAside };
}
