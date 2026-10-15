// Stand-ins for the app's data layer, so finance hooks run unchanged against an
// in-memory dataset (see dataset.js).
//
// - `rtk`: the RTK Query hooks the summary report and branch dashboard call.
//   Each returns { data, isLoading } like the real hook, with the same shaping
//   the real query applies where that shaping affects the numbers.
// - `firestore`: the handful of firebase/firestore calls useCompanyData makes.
// - `since`: getDocsSince (records from a day on), as Firestore would answer it.
// - monthly summaries: computed with the engine for every earlier month, as
//   the Cloud Functions keep them, so the dashboards take their fast path.
//   `setLedgerMode("full")` serves none (the full download).
//
// Point them at a dataset with `useDataset(dataset, branchId)` before rendering.
import { summarizeMonth, monthOf, nextMonth } from "@/lib/finance/monthly";
import { COLLECTION, DATE_FIELD } from "@/lib/finance/rules";

const current = { dataset: null, branchId: null };
const cache = new Map();
let ledgerMode = "fast";

export function useDataset(dataset, branchId = null) {
  current.dataset = dataset;
  current.branchId = branchId;
  cache.clear();
}

/** "fast": monthly summaries available (default); "full": none, download everything. */
export function setLedgerMode(mode) {
  ledgerMode = mode;
  cache.clear();
}

/** Records handed out by the record queries since the last reset. */
export const fetched = { records: 0, reset() { this.records = 0; } };

export const currentBranchId = () => current.branchId;
export const currentCompanyId = () => current.dataset?.companyId ?? null;

const branch = (branchId) => current.dataset.branches.find((b) => b.id === branchId);

// Same array instance for the same request, like RTK's cache — keeps the
// hooks' useMemo dependencies stable across renders.
const cached = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

const skipped = (args) => args == null || typeof args === "symbol";
const result = (data) => ({ data, isLoading: false, isFetching: false, isUninitialized: false, error: undefined });
const skippedResult = { data: undefined, isLoading: false, isFetching: false, isUninitialized: true, error: undefined };

// Firestore collection name → the engine's name (loans → staffLoans, …).
const KIND = Object.fromEntries(Object.entries(COLLECTION).map(([kind, col]) => [col, kind]));
const PAID_OUT = new Set(["advances", "staffLoans"]);
// A range query on a string field only ever matches strings.
const atLeast = (v, day) => typeof v === "string" && v >= day;

/** What `where(field, ">=", since)` (plus paidOut.date for advances and staff loans) returns. */
function rowsSince(rows, col, field, since, paidOut) {
  return rows.filter((r) => atLeast(r[field], since) || (paidOut && atLeast(r.paidOut?.date, since)));
}

const branchCollection = (name) => (args) => {
  if (skipped(args)) return skippedResult;
  const rows = cached(`${args.branchId}/${name}/${args.since || ""}`, () => {
    const all = branch(args.branchId)?.cols[name] ?? [];
    const kind = KIND[name];
    const out = args.since ? rowsSince(all, name, DATE_FIELD[kind], args.since, PAID_OUT.has(kind)) : all;
    fetched.records += out.length;
    return out;
  });
  return result(rows);
};

/** lib/redux/api/since.js */
export const since = {
  getDocsSince: async (ref, field, day, { paidOut = false } = {}) => {
    const rows = rowsSince(rowsAt(ref.path), null, field, day, paidOut);
    fetched.records += rows.length;
    return rows.map((r) => ({ ...r }));
  },
};

/** Summaries of every month before `month` and the counts the server would return. */
function ledgerStart({ branchId, month }) {
  if (ledgerMode === "full") return null;
  return cached(`start/${branchId}/${month}`, () => {
    const b = branch(branchId);
    const records = Object.fromEntries(Object.entries(COLLECTION).map(([kind, col]) => [kind, b?.cols[col] ?? []]));
    records.loanActivities = (current.dataset.companyCols.loans || []).filter((l) => l.status === "approved");
    const day = `${month}-01`;
    const seen = [];
    for (const [kind, rows] of Object.entries(records)) {
      if (kind === "loanActivities") continue;
      for (const r of rows) seen.push(monthOf(r[DATE_FIELD[kind]]), monthOf(r.paidOut?.date));
    }
    const months = seen.filter((m) => m && m < month).sort();
    const summaries = [];
    for (let m = months[0]; m && m < month; m = nextMonth(m)) {
      summaries.push(summarizeMonth({ branchId, settings: b?.settings, records, month: m }));
    }
    const countsBefore = Object.fromEntries(
      Object.keys(COLLECTION).map((kind) => [kind, records[kind].filter((r) => typeof r[DATE_FIELD[kind]] === "string" && r[DATE_FIELD[kind]] < day).length])
    );
    return { month, summaries, countsBefore };
  });
}

// Mirrors loanApiSlice.getLoanActivities: newest first, at most `pageLimit`
// records (0 = all), then adds _fromBranchId/_toBranchId and filters by
// direction/status/type.
const createdMs = (e) => (e.createdAt?.seconds ? e.createdAt.seconds * 1000 : Date.parse(e.createdAt) || 0);
function loanActivities(args) {
  const { branchId, direction = "all", status = "all", type = "all", pageLimit = 100 } = args;
  const newestFirst = [...(current.dataset.companyCols.loans || [])].sort((a, b) => createdMs(b) - createdMs(a));
  return (pageLimit ? newestFirst.slice(0, pageLimit) : newestFirst)
    .map((e) => ({
      ...e,
      _fromBranchId: e.requestFromBranchId ?? e.fromBranchId ?? null,
      _toBranchId: e.requestedToBranchId ?? e.toBranchId ?? null,
    }))
    .filter((r) => {
      if (!branchId || direction === "all") return true;
      if (direction === "incoming") return r._toBranchId === branchId;
      if (direction === "outgoing") return r._fromBranchId === branchId;
      return true;
    })
    .filter((r) => status === "all" || r.status === status)
    .filter((r) => type === "all" || r.type === type);
}

export const rtk = {
  useGetSalesEntriesQuery: branchCollection("sales"),
  useGetCostEntriesQuery: branchCollection("costs"),
  useGetAdvanceEntriesQuery: branchCollection("advances"),
  useGetStaffLoansQuery: branchCollection("loans"),
  useGetDepositEntryQuery: branchCollection("deposits"),
  useGetSalaryEntriesQuery: branchCollection("salaries"),
  useGetWithdrawEntriesQuery: branchCollection("cashWithdrawals"),
  useGetBranchSettingsQuery: (args) =>
    skipped(args) ? result(undefined) : result(branch(args.branchId)?.settings ?? undefined),
  useGetSingleBranchQuery: (args) =>
    skipped(args) ? result(undefined) : result(branch(args.branchId)?.doc),
  useGetBranchesBasicQuery: (companyId) =>
    skipped(companyId)
      ? result(undefined)
      : result(cached("branches", () => current.dataset.branches.map((b) => ({ id: b.id, name: b.doc.name })))),
  useGetCompanyDetailsQuery: (companyId) =>
    skipped(companyId) ? result(undefined) : result(current.dataset.company),
  useGetLoanActivitiesQuery: (args) =>
    skipped(args) ? result(undefined) : result(cached(`loans/${JSON.stringify(args)}`, () => loanActivities(args))),
  // summaryApiSlice
  useGetLedgerStartQuery: (args) => (skipped(args) ? skippedResult : result(ledgerStart(args))),
  fetchLedgerStart: async (args) => ledgerStart(args),
};

// ── firebase/firestore ───────────────────────────────────────────────────────
const joinPath = (segments) => segments.join("/").replace(/\/+/g, "/");

function rowsAt(colPath) {
  const ds = current.dataset;
  const parts = colPath.split("/");
  // companies/{c}/branches
  if (parts.length === 3 && parts[2] === "branches") return ds.branches.map((b) => b.doc);
  // companies/{c}/{col}
  if (parts.length === 3) return ds.companyCols[parts[2]] ?? [];
  // companies/{c}/branches/{b}/{col}
  if (parts.length === 5 && parts[2] === "branches") {
    const b = branch(parts[3]);
    if (parts[4] === "settings" && !b?.cols.settings) return b?.settings ? [b.settings] : [];
    return b?.cols[parts[4]] ?? [];
  }
  throw new Error(`fakeBackend: unsupported collection path ${colPath}`);
}

const snapOf = (row) => {
  const { id, ...data } = row;
  return { id, exists: () => true, data: () => ({ ...data }) };
};

export const firestore = {
  collection: (_db, ...segments) => ({ path: joinPath(segments) }),
  doc: (_db, ...segments) => ({ path: joinPath(segments) }),
  getDocs: async (ref) => {
    const rows = rowsAt(ref.path);
    if (/\/branches\/[^/]+\/[^/]+$/.test(ref.path)) fetched.records += rows.length;
    return { docs: rows.map(snapOf), size: rows.length, empty: rows.length === 0 };
  },
  getDoc: async (ref) => {
    const parts = ref.path.split("/");
    const id = parts.pop();
    const row = rowsAt(parts.join("/")).find((r) => r.id === id);
    return row ? snapOf(row) : { id, exists: () => false, data: () => undefined };
  },
};
