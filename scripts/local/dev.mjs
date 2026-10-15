// `npm run dev:local` — run the app against the local emulators.
// Starts Firestore/Auth/Storage/Functions emulators with the seeded data, waits
// for them, then starts `next dev` pointed at them. Ctrl+C stops both and
// saves any changes you made back to .local/emulator-data.
import fs from "node:fs";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { ROOT, LOCAL_PROJECT_ID, EMULATOR_DATA_DIR, NEXT_LOCAL_ENV } from "./config.mjs";

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

run("firebase", [
  "emulators:start",
  "--project", LOCAL_PROJECT_ID,
  "--import", `"${EMULATOR_DATA_DIR}"`,
  "--export-on-exit", `"${EMULATOR_DATA_DIR}"`,
]);

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

console.log("\n  Local data ready — emulator dashboard: http://127.0.0.1:4000\n");
run("npx", ["next", "dev"], NEXT_LOCAL_ENV);
