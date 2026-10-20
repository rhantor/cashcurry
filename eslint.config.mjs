//eslint.config.mjs
import js from "@eslint/js";
import globals from "globals";
import pluginReact from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // The Android app's generated native project (npx cap add android)
  // plus build output and the generated functions bundles (never edited by hand)
  { ignores: ["android/**", ".next/**", ".next-check/**", "out/**", "functions/engine.cjs", "functions/notify.cjs", "functions/audit.cjs", "functions/node_modules/**"] },
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
  },
  pluginReact.configs.flat.recommended,
  {
    // Same as .eslintrc.js (what `next build` uses): modern JSX needs no React
    // in scope, and this JavaScript app does not use PropTypes. `_name` marks
    // a deliberately unused argument or variable.
    settings: { react: { version: "detect" } },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
    },
  },
  // Next.js's own checks (links, images, scripts) — what next/core-web-vitals gave.
  nextPlugin.flatConfig.coreWebVitals,
  {
    // Hooks only at the top of a component or hook, never inside an if or loop.
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Pictures come from Storage links, phone photos and blobs: next/image can't help there.
      "@next/next/no-img-element": "off",
    },
  },
  {
    // The folder rules (docs/ARCHITECTURE.md): nobody imports the old folders.
    files: ["**/*.{js,mjs,cjs,jsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [
        { group: ["@/utils/*", "@/hook/*"], message: "Moved: see docs/ARCHITECTURE.md (lib/ for logic, app/hooks for hooks, app/export for downloads)." },
      ] }],
    },
  },
  {
    // lib/ is plain logic and data: it never reaches into the app (pages, components, toasts).
    files: ["lib/**", "functions/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [
        { group: ["@/utils/*", "@/hook/*"], message: "Moved: see docs/ARCHITECTURE.md." },
        { group: ["@/app/*", "**/app/*"], message: "lib/ must not import from app/ — move the shared piece into lib/, or pass it in." },
      ] }],
    },
  },
  {
    // Run in Node, not the browser.
    files: ["scripts/**", "lib/server/**", "functions/**", "tests/**", "tests-rules/**", "vitest.config.mjs", "next.config.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    // The push service worker runs as a service worker.
    files: ["public/*-sw.js"],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    // Next.js inlines process.env.NEXT_PUBLIC_* into client code.
    files: ["**/*.{js,jsx}"],
    languageOptions: { globals: { process: "readonly" } },
  },
]);
