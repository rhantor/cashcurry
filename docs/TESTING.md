# Tests

```bash
npm test                    # run everything once
npm run test:watch          # re-run on save
npm run test:golden:update  # re-record finance goldens (see below — rarely)
```

## Where the money rules live

All cash and bank figures come from one engine:

- `lib/finance/rules.js` — the rules: which day a record belongs to, cash vs
  bank, payment types, loans between branches.
- `lib/finance/ledger.js` — `buildLedger()`: a branch's cash book for a
  period (balance brought forward, each day, running cash and bank, totals).

The summary report, branch dashboard, company dashboard (sum of branch
ledgers), cash tracker and yearly statement all read from it. Change a rule
there and the tests below show every figure that moves.

## Finance safety net (`tests/finance/`)

The money figures are the most important thing this app produces, so they are
locked down before anything else changes. The tests run the app's **real**
calculation hooks — summary report, branch dashboard, company dashboard — with
Firebase swapped for in-memory data (`fakeBackend.js`).

| Test | What it proves | Needs the backup |
|---|---|---|
| Cash rules (hand-made example) | Every cash/bank rule on a tiny branch, worked out by hand in the test comments | No |
| Ledger engine (`ledger.test.js`) | The engine alone reproduces the demo company's hand-worked walkthrough, day by day | No |
| Demo company | Every screen shows exactly what `.local/DEMO_GUIDE.md` promises | No |
| Golden figures | 13 summary KPIs + 14 branch-dashboard KPIs for every branch × month, and the company dashboard per month, equal the recorded values | Yes |
| Golden detail | Every summary report row (what the screen and PDF/Excel print) and every dashboard chart series | Yes |
| Anchors | A few figures verified by hand still come out the same | Yes |
| Dashboard = summary | Branch dashboard "This Month" cash equals the summary report for every branch × month | Yes |
| Company = Σ branches | Company cash and bank equal the sum of branch summaries | Yes |
| Known bugs (`it.fails`) | Documents a bug that is not fixed yet; flips to a normal test when it is | Yes |

The backup is read from `../backup_saffron_empire`, or `CC_BACKUP_DIR`. Without
it, the backup tests are skipped and only the hand-made example runs.

### Real client data stays out of git

The repository is public. Golden figures and anchors are real client money
figures, so they live in `tests/finance/__golden__/`, which is git-ignored.
Keep them next to the backup they came from.

### When a golden test fails

The failure lists every figure that moved, one per line
(`branches › <branch> › <month> › … › bankedSales: 5435.7 → 5365.7`), and
writes the full new output next to the golden as `*.actual.json`.

It means a change moved real money figures. Either:

- **It was not meant to** → it's a bug; fix the code.
- **It was meant to** (a roadmap task that changes a rule) → run
  `npm run test:golden:update`, check the diff of the golden file makes sense,
  and say in the commit which figures changed and why.

Anchors (`*.anchors.json`) are never rewritten by the update command — change
them only after re-verifying the figure by hand.
