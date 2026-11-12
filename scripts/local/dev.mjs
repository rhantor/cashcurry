// `npm run dev:local` — run the app against the local emulators.
// Starts Firestore/Auth/Storage/Functions emulators with the seeded data, waits
// for them, then starts `next dev` pointed at them. Ctrl+C stops both and
// saves any changes you made back to .local/emulator-data.
//
// `npm run dev:phone` (--lan) also lets phones on the same Wi-Fi open it: the
// emulators listen on the network too, and the address to open is printed.
// Only on a network you trust — anyone on it could read the local data.
//
// `npm run test:phone` (--lan --fast) is for testing, not changing code: the
// app is built once first (2–3 minutes) and then served as production serves
// it, so every page opens at once and nothing compiles while you click (31 Oct:
// `next dev` took 10–20 s a page and ran out of memory). A code change needs
// it run again; `--no-build` reuses the last build.
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { ROOT, LOCAL_DIR, LOCAL_PROJECT_ID, EMULATOR_DATA_DIR, NEXT_LOCAL_ENV } from "./config.mjs";
import { EXPORT_NAME, checkFirestoreExport, ensurePrev, findGoodCopies, fsyncTree, installExport, keptDirFor, savingDirFor } from "./exportSafety.mjs";

const KEEP_DIR = keptDirFor(EMULATOR_DATA_DIR);
const FIRESTORE_DIR = path.join(EMULATOR_DATA_DIR, EXPORT_NAME);

// Never start on a broken copy (12 Nov 2026: an export of only zero bytes).
// The emulators would load nothing, and the next save would write that over
// everything — so stop, and say which good copy to go back to.
{
  const goodCopies = () => findGoodCopies({ dataDir: EMULATOR_DATA_DIR, keepDir: KEEP_DIR, localDir: LOCAL_DIR, projectId: LOCAL_PROJECT_ID });
  if (!fs.existsSync(path.join(EMULATOR_DATA_DIR, "firebase-export-metadata.json"))) {
    const copies = goodCopies();
    if (!copies.length) {
      console.error("No local data yet. Run `npm run local:seed` first.");
    } else {
      console.error(`\n  The local data folder ${path.relative(ROOT, EMULATOR_DATA_DIR)} is missing or incomplete,`);
      console.error("  but good Firestore copies exist — don't re-seed before looking at them:");
      copies.forEach((c) => console.error(`    ${path.relative(ROOT, c.dir)}    (${c.label})`));
      console.error("  Logins and files (auth_export, storage_export) come only from a full data folder.\n");
    }
    process.exit(1);
  }
  const startCheck = checkFirestoreExport(FIRESTORE_DIR, LOCAL_PROJECT_ID);
  if (!startCheck.ok) {
    const copies = goodCopies();
    console.error(`\n  The saved local data is broken — ${path.relative(ROOT, FIRESTORE_DIR)}: ${startCheck.reason}.`);
    console.error("  The emulators were NOT started, and nothing was changed.");
    if (copies.length) {
      console.error("  Put a good copy back (the broken one is set aside, not deleted):");
      copies.forEach((c) => console.error(`    npm run local:restore-save -- "${path.relative(ROOT, c.dir)}"    (${c.label})`));
    } else {
      console.error("  No good copy found in .local/emulator-data-kept or .local/rescue-*.");
    }
    console.error("");
    process.exit(1);
  }
  try {
    if (ensurePrev({ dataDir: EMULATOR_DATA_DIR, keepDir: KEEP_DIR, projectId: LOCAL_PROJECT_ID })) {
      console.log(`  [a spare good copy of the local data is kept in ${path.relative(ROOT, KEEP_DIR)}]`);
    }
  } catch (e) {
    console.log(`  [could not keep a spare copy of the local data: ${e.message}]`);
  }
}

// ── phone mode ──
const lanArg = process.argv.find((a) => a === "--lan" || a.startsWith("--lan="));
const lanIp = lanArg ? lanArg.split("=")[1] || wifiAddress() : null;
if (lanArg && !lanIp) {
  console.error("No Wi-Fi/LAN address found. Pass it yourself: npm run dev:phone -- --lan=192.168.x.x");
  process.exit(1);
}

/** This machine's address on the local network (Wi-Fi first; VPN adapters skipped). */
function wifiAddress() {
  const isPrivate = (ip) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  const all = Object.entries(os.networkInterfaces()).flatMap(([name, addrs]) =>
    (addrs || []).filter((a) => a.family === "IPv4" && !a.internal && isPrivate(a.address)).map((a) => ({ name, ip: a.address }))
  );
  const usable = all.filter((a) => !/vpn|surfshark|wireguard|tap|tun|virtual|vethernet|wsl/i.test(a.name));
  return (usable.find((a) => /wi-?fi|wlan|wireless/i.test(a.name)) || usable.find((a) => a.ip.startsWith("192.168.")) || usable[0])?.ip;
}

/** A copy of firebase.json whose emulators listen on the network, not only this machine. */
function lanFirebaseConfig() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "firebase.json"), "utf8"));
  for (const [name, emu] of Object.entries(cfg.emulators || {})) {
    if (emu && typeof emu === "object" && name !== "singleProjectMode") emu.host = "0.0.0.0";
  }
  const file = path.join(ROOT, ".firebase.lan.json"); // next to firebase.json: rule paths stay valid
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
  return path.basename(file);
}

const children = [];
const run = (cmd, args, env) => {
  const child = spawn(cmd, args, { cwd: ROOT, stdio: "inherit", shell: true, env: { ...process.env, ...env } });
  children.push(child);
  child.on("exit", (code) => shutdown(code ?? 0));
  return child;
};

// Ctrl+C in the terminal already reaches every child (same console), and the
// emulators use it to save data before exiting — so on Ctrl+C we only wait.
// When one child dies on its own, stop the rest (whole process tree: with
// shell:true the direct child is only a shell wrapper).
const isWin = process.platform === "win32";
let stopping = false;
function stopChild(c) {
  if (c.exitCode !== null) return;
  if (isWin) spawnSync("taskkill", ["/PID", String(c.pid), "/T", "/F"], { stdio: "ignore" });
  else c.kill("SIGINT");
}
function shutdown(code, { fromSignal = false } = {}) {
  if (stopping) return;
  stopping = true;
  if (!fromSignal) children.forEach(stopChild);
  const waitAll = setInterval(() => {
    if (children.every((c) => c.exitCode !== null || c.signalCode !== null)) {
      clearInterval(waitAll);
      finish(code);
    }
  }, 200);
  // Safety net: never leave emulators behind if they ignore the signal.
  setTimeout(() => { clearInterval(waitAll); children.forEach(stopChild); finish(code); }, 15_000).unref();
}

// On exit the Firebase CLI has just written its own export (--export-on-exit)
// by deleting the data folder and renaming a new one in, without flushing it
// to disk. Flush it now, so a power cut right after Ctrl+C can't leave files
// of zeros, and check it.
let finished = false;
function finish(code) {
  if (finished) return;
  finished = true;
  try {
    let files = 0;
    for (const f of [EXPORT_NAME, "auth_export", "storage_export", "firebase-export-metadata.json"]) {
      files += fsyncTree(path.join(EMULATOR_DATA_DIR, f));
    }
    const check = checkFirestoreExport(FIRESTORE_DIR, LOCAL_PROJECT_ID);
    console.log(
      check.ok
        ? `  [local data written to disk and checked: ${check.records} records, ${files} files]`
        : `  [WARNING: the saved local data is not good (${check.reason}). The last good save is in ${path.relative(ROOT, KEEP_DIR)}.]`
    );
  } catch (e) {
    console.log(`  [could not flush the local data to disk: ${e.message}]`);
  }
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0, { fromSignal: true }));
process.on("SIGTERM", () => shutdown(0));

const portOpen = (port) =>
  new Promise((resolve) => {
    const s = net.connect(port, "127.0.0.1");
    s.once("connect", () => { s.end(); resolve(true); });
    s.once("error", () => resolve(false));
  });

// The Functions emulator loads the finance engine bundle; build it fresh.
spawnSync("node", ["scripts/build-functions-engine.mjs"], { cwd: ROOT, stdio: "inherit" });

// ── fast mode: build the app before anything else runs ──
const fast = process.argv.includes("--fast");
const NEXT_ENV = { ...NEXT_LOCAL_ENV, ...localLoginEnv(), ...(lanIp ? { CC_LAN_HOST: lanIp } : {}), ...(fast ? { NEXT_DIST_DIR: ".next-fast" } : {}) };
if (fast && !process.argv.includes("--no-build")) {
  console.log("\n  Building the app once — 2 to 3 minutes…\n");
  const built = spawnSync("npx", ["next", "build"], { cwd: ROOT, stdio: "inherit", shell: true, env: { ...process.env, ...NEXT_ENV } });
  if (built.status !== 0) {
    console.error("The build failed — see above.");
    process.exit(1);
  }
}

// The Functions emulator gives the code 10 s to load by default — too short
// while Next.js compiles at the same time on this machine.
run("firebase", [
  "emulators:start",
  "--project", LOCAL_PROJECT_ID,
  "--import", `"${EMULATOR_DATA_DIR}"`,
  "--export-on-exit", `"${EMULATOR_DATA_DIR}"`,
  ...(lanIp ? ["--config", lanFirebaseConfig()] : []),
], { FUNCTIONS_DISCOVERY_TIMEOUT: "60" });

// Firestore is the last of the core emulators to come up.
const started = Date.now();
while (!(await portOpen(8080))) {
  if (stopping) process.exit(1);
  if (Date.now() - started > 90_000) {
    console.error("Emulators did not start within 90s.");
    shutdown(1);
  }
  await new Promise((r) => setTimeout(r, 500));
}

// One-click logins on the login page: the seeded accounts (from the table the
// seed writes) and their shared local password.
function localLoginEnv() {
  try {
    const password = fs.readFileSync(path.join(LOCAL_DIR, "dev-password.txt"), "utf8").trim();
    const accounts = fs
      .readFileSync(path.join(LOCAL_DIR, "DEV_ACCOUNTS.md"), "utf8")
      .split("\n")
      .map((line) => line.split("|").map((c) => c.trim()))
      .filter((c) => c.length === 6 && c[1] && c[1] !== "Role" && !c[1].startsWith("-"))
      .map(([, role, login, , branch]) => ({ role, login, branch }));
    return { NEXT_PUBLIC_LOCAL_PASSWORD: password, NEXT_PUBLIC_LOCAL_ACCOUNTS: JSON.stringify(accounts) };
  } catch {
    return {};
  }
}

// Auto-save every 5 minutes. Data is otherwise saved only on a clean Ctrl+C;
// if the emulators crash or the window is closed, everything since the last
// save would be lost.
//
// Firestore (where nearly all changes are) is saved straight from its own
// emulator into .local/emulator-data-kept/saving, flushed to disk, checked
// record by record, and only then swapped in; the copy it replaces becomes
// firestore_export.prev there (see exportSafety.mjs). A failed or broken save
// never touches the current copy. The CLI's whole-suite `emulators:export`
// is not used for this: on Windows it crashed the CLI mid-export (21 Oct
// 2026), taking every emulator down with it. Accounts and files are still
// saved on Ctrl+C (--export-on-exit).
const AUTOSAVE_MS = 5 * 60 * 1000;
let saving = false;
async function saveFirestore() {
  const tmp = savingDirFor(KEEP_DIR);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const res = await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${LOCAL_PROJECT_ID}:export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ database: `projects/${LOCAL_PROJECT_ID}/databases/(default)`, export_directory: tmp, export_name: EXPORT_NAME }),
  });
  if (!res.ok) throw new Error(`export ${res.status}`);
  if (stopping) throw new Error("stopping"); // the CLI's exit export owns the folder now
  const saved = installExport({ fresh: path.join(tmp, EXPORT_NAME), dataDir: EMULATOR_DATA_DIR, keepDir: KEEP_DIR, projectId: LOCAL_PROJECT_ID });
  fs.rmSync(tmp, { recursive: true, force: true });
  return saved;
}
setInterval(() => {
  if (saving || stopping) return;
  saving = true;
  saveFirestore()
    .then((s) => console.log(`  [local data saved ${new Date().toLocaleTimeString()} — ${s.records} records, checked]`))
    .catch((e) => console.log(`  [local data NOT saved: ${e.message} — the last save is kept]`))
    .finally(() => {
      saving = false;
    });
}, AUTOSAVE_MS).unref();

console.log("\n  Local data ready — emulator dashboard: http://127.0.0.1:4000\n");
if (lanIp) {
  console.log(`  📱 On your phone (same Wi-Fi), open:  http://${lanIp}:3000`);
  console.log("     If it doesn't load: allow Node.js and Java through Windows Firewall (Private networks),");
  console.log("     and let your VPN allow local-network access (or pause it).\n");
}
run("npx", fast ? ["next", "start", "-p", "3000"] : ["next", "dev"], NEXT_ENV);
