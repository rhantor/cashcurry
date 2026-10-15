// What the Cloud Functions and Node scripts use from the finance engine.
// Bundled to functions/engine.cjs by scripts/build-functions-engine.mjs, so
// the server computes monthly totals with exactly the rules every screen uses.
export { summarizeMonth, loanCountsByMonth, monthBounds, monthOf, nextMonth, ENGINE_VERSION } from "./monthly";
export { COLLECTION, DATE_FIELD, dayKey, loanActivityDay } from "./rules";
