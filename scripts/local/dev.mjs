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

if (!fs.existsSync(EMULATOR_DATA_DIR)) {
  console.error("No local data yet. Run `npm run local:seed` first.");
  process.exit(1);
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
    if (children.every((c) => c.exitCode !== null || c.signalCode !== null)) process.exit(code);
  }, 200);
  // Safety net: never leave emulators behind if they ignore the signal.
  setTimeout(() => { clearInterval(waitAll); children.forEach(stopChild); process.exit(code); }, 15_000).unref();
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
// emulator, into a fresh folder first, and swapped in only once that export
// is complete — so a failed save never leaves an empty copy behind. The CLI's
// whole-suite `emulators:export` is not used for this: on Windows it crashed
// the CLI mid-export (21 Oct 2026), taking every emulator down with it.
// Accounts and files are still saved on Ctrl+C (--export-on-exit).
const AUTOSAVE_MS = 5 * 60 * 1000;
let saving = false;
async function saveFirestore() {
  const tmp = path.join(LOCAL_DIR, "autosave-tmp");
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const res = await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${LOCAL_PROJECT_ID}:export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ database: `projects/${LOCAL_PROJECT_ID}/databases/(default)`, export_directory: tmp, export_name: "firestore_export" }),
  });
  if (!res.ok) throw new Error(`export ${res.status}`);
  const fresh = path.join(tmp, "firestore_export");
  if (!fs.existsSync(path.join(fresh, "firestore_export.overall_export_metadata"))) throw new Error("export left no metadata");
  const target = path.join(EMULATOR_DATA_DIR, "firestore_export");
  const old = path.join(LOCAL_DIR, "autosave-old");
  fs.rmSync(old, { recursive: true, force: true });
  if (fs.existsSync(target)) fs.renameSync(target, old);
  fs.renameSync(fresh, target);
  fs.rmSync(old, { recursive: true, force: true });
  fs.rmSync(tmp, { recursive: true, force: true });
}
setInterval(() => {
  if (saving || stopping) return;
  saving = true;
  saveFirestore()
    .then(() => console.log(`  [local data saved ${new Date().toLocaleTimeString()}]`))
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
