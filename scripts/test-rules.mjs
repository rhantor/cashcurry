// `npm run test:rules` — test firestore.rules and storage.rules.
// Starts its own Firestore + Storage emulators on separate ports
// (firebase.test-rules.json), so it never touches `npm run dev:local` data and
// can run while the app is running. Storage rules look users up in Firestore,
// which only works when both emulators belong to the test project.
import { spawnSync } from "node:child_process";

const vitest = "npx vitest run --config tests-rules/vitest.config.mjs";
const r = spawnSync(
  `firebase emulators:exec --config firebase.test-rules.json --only firestore,storage --project demo-rules-test "${vitest}"`,
  {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, FIRESTORE_EMULATOR_PORT: "8280", STORAGE_EMULATOR_PORT: "9399" },
  }
);
if (r.error?.code === "ENOENT") console.error("Firebase CLI not found. Install it with: npm install -g firebase-tools");
process.exit(r.status ?? 1);
