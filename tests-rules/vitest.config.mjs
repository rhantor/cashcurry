import { defineConfig } from "vitest/config";

// Security-rules tests: need the Firestore emulator (npm run test:rules).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests-rules/**/*.test.js"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
