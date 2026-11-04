// In-memory company data for finance tests, in the shape the app reads from
// Firestore. Built either from a backup folder or from a small hand-made
// scenario.
//
//   {
//     companyId, company,
//     companyCols: { loans: [...] },                      // companies/{c}/<col>
//     branches: [{ id, doc, settings, cols: { sales: [...], ... } }],
//   }
import fs from "node:fs";
import path from "node:path";
import { findBackupDir } from "../../scripts/local/backupDir.mjs";

export function backupDir() {
  return findBackupDir(process.cwd());
}

export function hasBackup(dir = backupDir()) {
  return !!dir && fs.existsSync(path.join(dir, "company", "company.json"));
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

/** Load a backup made by the export script that sits in the backup folder. */
export function loadBackup(dir = backupDir()) {
  const company = readJson(path.join(dir, "company", "company.json"));
  const companyCols = {};
  for (const f of fs.readdirSync(path.join(dir, "company"))) {
    if (!f.endsWith(".json") || f === "company.json" || f.startsWith("root_")) continue;
    companyCols[f.replace(/\.json$/, "")] = readJson(path.join(dir, "company", f));
  }

  const branches = [];
  for (const folder of fs.readdirSync(path.join(dir, "branches")).sort()) {
    const base = path.join(dir, "branches", folder);
    const doc = readJson(path.join(base, "branch.json"));
    const cols = {};
    const dataDir = path.join(base, "data");
    if (fs.existsSync(dataDir)) {
      for (const f of fs.readdirSync(dataDir)) {
        if (f.endsWith(".json")) cols[f.replace(/\.json$/, "")] = readJson(path.join(dataDir, f));
      }
    }
    const settings = (cols.settings || []).find((s) => s.id === "settings") || null;
    branches.push({ id: doc.id, doc, settings, cols });
  }

  return { companyId: company.id, company, companyCols, branches };
}

/** Every month (YYYY-MM) between the first and last dated record, inclusive. */
export function monthsCovered(dataset) {
  const dates = [];
  for (const b of dataset.branches) {
    for (const rows of Object.values(b.cols)) {
      for (const r of rows) if (typeof r?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) dates.push(r.date);
    }
  }
  if (!dates.length) return [];
  dates.sort();
  const months = [];
  let [y, m] = dates[0].slice(0, 7).split("-").map(Number);
  const last = dates.at(-1).slice(0, 7);
  for (;;) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    months.push(key);
    if (key >= last) break;
    m === 12 ? ((y += 1), (m = 1)) : (m += 1);
  }
  return months;
}
