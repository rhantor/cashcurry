import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Finance figures depend on the local calendar day. The live branches are in
// Malaysia, so tests run in that zone whatever the developer's machine uses.
// CC_TEST_TZ=UTC runs them as the Cloud Functions server would.
process.env.TZ = process.env.CC_TEST_TZ || "Asia/Kuala_Lumpur";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": root },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{js,jsx}"],
    // Running the real hooks over a full company backup takes a few seconds.
    testTimeout: 60_000,
  },
});
