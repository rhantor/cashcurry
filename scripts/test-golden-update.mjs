// `npm run test:golden:update` — re-record the finance golden figures.
// Only run this when a change to the money figures is intended; say why in
// the commit that updates tests/finance/__golden__/.
import { spawnSync } from "node:child_process";

const r = spawnSync("npx", ["vitest", "run", "tests/finance"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, CC_UPDATE_GOLDEN: "1" },
});
process.exit(r.status ?? 1);
