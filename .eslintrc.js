/* eslint-disable no-undef */
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ["next/core-web-vitals"],
  settings: {
    react: { version: "detect" },
  },
  rules: {
    // React 17+ / Next 12+ doesn't need React in scope for JSX
    "react/react-in-jsx-scope": "off",
    // You're not using PropTypes (JS project); turn off to avoid hundreds of errors
    "react/prop-types": "off",
    // Keep unused-vars as warning so deploys don't fail
    "no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      },
      
    ],
  },
};
