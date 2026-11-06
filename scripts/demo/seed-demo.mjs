// `npm run demo:live -- --confirm` — the made-up demo company ("Demo Curry House
// Sdn Bhd", branches Demo KL and Demo PJ) inside the live app, to show the app to
// people (owner, 6 Nov 2026): the money demo, then the extras (Ops, tasks, issues,
// new hires, purchases). Never a client backup. Only companies/demo-company and
// demo logins (Auth uid demo-…, @demo.test) are written (scripts/local/target.mjs);
// usernames are checked first, so a demo login never takes a real person's.
// Logins: .local/LIVE_DEMO_ACCOUNTS.md, password .local/live-demo-password.txt.
// Seeding again starts the demo week from today. Remove it all: npm run demo:remove.
//
// `npm run demo:staging -- --confirm` puts it in the "staging" database instead
// (for preview deployments; needs that database, its rules and indexes first).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { ROOT, LOCAL_DIR } from "../local/config.mjs";
import { buildDemoCompany, writeBackupFolder, demoGuide } from "../local/demo/demoCompany.mjs";

const target = process.argv.includes("--staging") ? "staging" : "live";
if (!process.argv.includes("--confirm")) {
  console.error(`This writes the demo company into the ${target} database of the real project. Add --confirm.`);
  process.exit(1);
}
const keyFile = path.join(ROOT, "lib", "server", "serviceAccountKey.json");
if (!fs.existsSync(keyFile)) {
  console.error("No service account key at lib/server/serviceAccountKey.json.");
  process.exit(1);
}
const bucket = (fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/^NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=["']?([^"'\r\n]+)/m) || [])[1];

const demo = buildDemoCompany(new Date());

// a demo username must never take one a real person signs in with
const names = [...demo.root.usernames.map((u) => u.id), "sam", "nora"];
initializeApp({ projectId: "pos-system-448bc", credential: cert(JSON.parse(fs.readFileSync(keyFile, "utf8"))) });
const live = getFirestore();
const taken = [];
for (const n of names) {
  const s = await live.doc(`usernames/${n}`).get();
  if (s.exists && !String(s.data().uid || "").startsWith("demo-")) taken.push(n);
}
if (taken.length) {
  console.error(`These usernames belong to real people, so nothing was written: ${taken.join(", ")}`);
  process.exit(1);
}

const source = path.join(LOCAL_DIR, `${target}-demo-backup`);
writeBackupFolder(demo, source);
fs.writeFileSync(path.join(LOCAL_DIR, target === "live" ? "LIVE_DEMO_GUIDE.md" : "STAGING_GUIDE.md"), `# Demo company (${target})\n\nSeeded ${new Date().toLocaleString()}.\n\n${demoGuide(demo)}`);

const env = {
  ...process.env,
  CC_TARGET: target,
  CC_BACKUP_DIR: source,
  GOOGLE_APPLICATION_CREDENTIALS: keyFile,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: bucket || "",
};
for (const v of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"]) delete env[v];

spawnSync("node", ["scripts/build-functions-engine.mjs"], { cwd: ROOT, stdio: "inherit" });
for (const script of ["scripts/local/seed.mjs", "scripts/local/demo/demoExtras.mjs"]) {
  console.log(`\n── ${script} → ${target}`);
  const r = spawnSync("node", [script, "--confirm"], { cwd: ROOT, stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
console.log(`\nDemo company ready in the ${target} database. Logins: .local/${target === "live" ? "LIVE_DEMO_ACCOUNTS.md" : "STAGING_ACCOUNTS.md"}`);
process.exit(0);
