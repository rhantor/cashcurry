// `npm run dev:local` — run the app against the local emulators.
// Starts Firestore/Auth/Storage/Functions emulators with the seeded data, waits
// for them, then starts `next dev` pointed at them. Ctrl+C stops both and
// saves any changes you made back to .local/emulator-data.
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { ROOT, LOCAL_DIR, LOCAL_PROJECT_ID, EMULATOR_DATA_DIR, NEXT_LOCAL_ENV } from "./config.mjs";

if (!fs.existsSync(EMULATOR_DATA_DIR)) {
  console.error("No local data yet. Run `npm run local:seed` first.");
  process.exit(1);
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

// The Functions emulator gives the code 10 s to load by default — too short
// while Next.js compiles at the same time on this machine.
run("firebase", [
  "emulators:start",
  "--project", LOCAL_PROJECT_ID,
  "--import", `"${EMULATOR_DATA_DIR}"`,
  "--export-on-exit", `"${EMULATOR_DATA_DIR}"`,
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
const AUTOSAVE_MS = 5 * 60 * 1000;
let saving = false;
setInterval(() => {
  if (saving || stopping) return;
  saving = true;
  const child = spawn(
    "firebase",
    ["emulators:export", `"${EMULATOR_DATA_DIR}"`, "--force", "--project", LOCAL_PROJECT_ID],
    { cwd: ROOT, stdio: "ignore", shell: true }
  );
  child.on("exit", (code) => {
    saving = false;
    if (code === 0) console.log(`  [local data saved ${new Date().toLocaleTimeString()}]`);
  });
}, AUTOSAVE_MS).unref();

console.log("\n  Local data ready — emulator dashboard: http://127.0.0.1:4000\n");
run("npx", ["next", "dev"], { ...NEXT_LOCAL_ENV, ...localLoginEnv() });
