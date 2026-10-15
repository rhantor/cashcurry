# Tests

```bash
npm test                    # run everything once
npm run test:watch          # re-run on save
npm run test:golden:update  # re-record finance goldens (see below — rarely)
```

## Finance safety net (`tests/finance/`)

The money figures are the most important thing this app produces, so they are
locked down before anything else changes. The tests run the app's **real**
calculation hooks — summary report, branch dashboard, company dashboard — with
Firebase swapped for in-memory data (`fakeBackend.js`).

| Test | What it proves | Needs the backup |
|---|---|---|
| Cash rules (hand-made example) | Every cash/bank rule on a tiny branch, worked out by hand in the test comments | No |
| Golden figures | 13 summary KPIs + 14 branch-dashboard KPIs for every branch × month, and the company dashboard per month, equal the recorded values | Yes |
| Anchors | A few figures verified by hand still come out the same | Yes |
| Dashboard = summary | Branch dashboard "This Month" cash equals the summary report for every branch × month | Yes |
| Company = Σ branches | Company cash on hand equals the sum of branch summaries | Yes |
| Known bugs (`it.fails`) | Documents a bug that is not fixed yet; flips to a normal test when it is | Yes |

The backup is read from `../backup_saffron_empire`, or `CC_BACKUP_DIR`. Without
it, the backup tests are skipped and only the hand-made example runs.

### Real client data stays out of git

The repository is public. Golden figures and anchors are real client money
figures, so they live in `tests/finance/__golden__/`, which is git-ignored.
Keep them next to the backup they came from.

### When a golden test fails

It means a change moved real money figures. Either:

- **It was not meant to** → it's a bug; fix the code.
- **It was meant to** (a roadmap task that changes a rule) → run
  `npm run test:golden:update`, check the diff of the golden file makes sense,
  and say in the commit which figures changed and why.

Anchors (`*.anchors.json`) are never rewritten by the update command — change
them only after re-verifying the figure by hand.
