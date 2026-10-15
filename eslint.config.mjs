//eslint.config.mjs
import js from "@eslint/js";
import globals from "globals";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
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
  {
    // Run in Node, not the browser.
    files: ["scripts/**", "lib/server/**", "functions/**", "tests/**", "tests-rules/**", "vitest.config.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    // Next.js inlines process.env.NEXT_PUBLIC_* into client code.
    files: ["**/*.{js,jsx}"],
    languageOptions: { globals: { process: "readonly" } },
  },
]);
