# Roles and permissions (roadmap 4.1)

**Status: agreed by the owner and enforced (18 Oct 2026).** The matrix in part 3
lives in `lib/authz/permissions.js`. The menu (`app/components/shell/navigation.js`),
the page guard (`middleware.js`) and the checks inside pages read it;
`firestore.rules` has one function per capability, and
`tests-rules/matrix.test.js` tries every capability as every role against the real
rules and fails if they disagree with the matrix. `tests/authz/permissions.test.js`
holds the owner's decisions as tests and checks the menu never offers a page the
guard refuses.

**Release:** deploy the new `firestore.rules` and run `npm run staff:private` (moves
pay, IC, bank and personal details into `staffPrivate`) in the same release — see
the release checklist in `docs/ROADMAP.md`.

Parts 2 and 4 below describe how things stood **before** the change.

Today the same rule lives in up to four places that disagree: the menu
(`app/components/shell/navigation.js`), the page guard (`middleware.js`), the
database rules (`firestore.rules`) and checks inside pages. Part 2 lists where
they disagree, found by reading them and by signing in as every demo role on
the local emulators and opening every page (part 4).

## 1. The roles

| Role | Who | Scope |
|---|---|---|
| `owner` | Owns the company; signed up | Every branch |
| `superAdmin` | The owner's right hand (often does the setup for them) | Every branch |
| `gm` | General manager over all branches | Every branch |
| `branchAdmin` | Runs one branch | One branch |
| `manager` | Branch manager | One branch |
| `inCharge` *(new — decided 16 Oct)* | Runs the outlet or shift when the manager is away | One branch |
| `accountant` | Keeps the branch's books | One branch |
| `supervisor` | Floor / shift supervisor | One branch |
| `cashier` | Till | One branch |
| `staff` | Everyone else; uses the staff app for their own things | Own records |

Also in the data, to be cleaned up: `superadmin` and `branchadmin` (old lowercase
spellings, accepted everywhere), `platformAdmin` (Cash Curry staff, not a company role).

## 2. What is wrong today

### Pages anyone signed in can open by address
`middleware.js` only guards the pages it lists; every other page is open to every
signed-in role, **staff included**: all of Purchases, Payroll and Payroll history,
Staff management, Branch management, the branch Audit log, the Daily cash
tracker, Tools, Profile. The menu hides them, but typing the address works
(seen as `kl_cashier`: Payroll, Staff management and every Purchases page open).

### Data a role can read that it should not
The database rule `canRead` lets **every branch role except staff read everything
in the branch** — salaries, payroll runs and payslips, staff records (IC numbers,
bank accounts, pay), every report's data. So a cashier or supervisor can read
everyone's pay with the browser's tools, whatever the menu shows.

### Things the screen offers but the database refuses (they fail when used)
| Who | What | Why it fails |
|---|---|---|
| `cashier` | Salaries entry (in their menu) | salaries need `canWrite`, which has no cashier |
| `gm`, `superAdmin` | Purchases: add a vendor or item, pay a bill (vendor totals) | vendors / items rules leave out gm and superAdmin |
| `gm`, `superAdmin` | Branch-to-branch loans (in their menu) | company loans rule leaves out gm and superAdmin |
| `gm`, `owner`, `superAdmin` | Run payroll | payroll rules allow only branchAdmin / manager (the screen says so too) |
| `accountant` | Approve in the Requested panel (screen allows it) | approvers are branchAdmin / manager / company roles only |
| `accountant` | Opening balances in Branch settings (screen allows it) | only owner / superAdmin / branchAdmin may change money settings |

### Menu and page guard disagree
| Page | Menu shows it to | Page guard lets in |
|---|---|---|
| Branch dashboard | accountant, manager, branchAdmin | + supervisor, cashier |
| Reports | manager, accountant, branchAdmin | + supervisor |
| Daily cash tracker | company roles + branchAdmin, manager, accountant | everyone (no guard) |
| Staff management, Payroll, Branch settings | branchAdmin, manager | Staff mgmt / Payroll: everyone; Branch settings: branchAdmin, manager (owner can't, yet rules let the owner change settings) |

### Missing for the owner (noted 16 Oct)
The owner's menu has User management but **no Staff management, Payroll or
Branch settings**, though the database lets the owner change staff and settings.

### Too open in the database
- `requisitions` (purchase orders) and `counters`: any branch member may write — staff included.
- `notifications`: anyone in the company may write any notification.
- `chat_messages`, `wall_posts`: any branch member (fine for chat; to be redone in 4.4).

## 3. Proposed matrix — to confirm

`—` none · `V` view · `E` enter / edit own work · `A` approve / pay out · `M` manage (settings, people, delete)

| Area | owner | superAdmin | gm | branchAdmin | manager | inCharge | accountant | supervisor | cashier | staff |
|---|---|---|---|---|---|---|---|---|---|---|
| Company dashboard | V | V | V | — | — | — | — | — | — | — |
| Branch dashboard | V | V | V | V | V | V (today) | V | — | — | — |
| Sales entry | E | E | E | E | E | E | E | E | E | — |
| Cost entry | E | E | E | E | E | E | E | — | — | — |
| Pay-outs & bills (4.10) | A | A | A | A | A | A | E | E | E | — |
| Cash ↔ bank | E | E | E | E | E | — | E | — | — | — |
| Advances & staff loans | A | A | A | A | A | — | E (request, pay out) | E (request, pay out) | E (request, pay out) | own requests |
| Salaries entry | E | E | E | E | E | — | E | — | — | — |
| Payroll | M | M | M | M | M | — | V | — | — | own payslips |
| Reports (money) | V | V | V | V | V | V (today) | V | — | — | — |
| Purchases: order guides, POs, receive goods | E | E | E | E | E | E | E | E | — | — |
| Purchases: approve POs | A | A | A | A | A | A | — | — | — | — |
| Purchases: bills, pay bills, payments | A | A | A | A | A | — | A | — | — | — |
| Vendors & items catalog | M | M | M | M | M | V | M | V | — | — |
| Staff records | M | M | M | M | M | V (names only) | — | — | — | own profile |
| Staff pay & bank details | V | V | V | V | V | — | V | — | — | own |
| Attendance log | M | M | M | M | M | V | — | V | — | own |
| Kiosk | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | punch |
| Branch settings (non-money) | M | M | M | M | M | — | — | — | — | — |
| Money settings (opening balances, currency, time zone, day end) | M | M | — | M | — | — | — | — | — | — |
| Company settings, branches, users | M | M | V | — | — | — | — | — | — | — |
| Cost categories (4.9) | M | M | M | — | — | — | — | — | — | — |
| Audit log | V | V | V | V (branch) | V (branch) | — | — | — | — | — |
| Tools (invoice, appointment letter) | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — | — |
| Chat / issues (4.4, 4.5) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Settled while building it:
- **Salary payments** (the `salaries` entries — "paid Ali RM 1,800 on 30 Sep") are
  part of the cash book, so everyone who sees the reports reads them: the till and
  bank figures can't be right without them. What stays private is the pay
  structure — basic, allowances, OT rate, bank, IC (`staffPrivate`) — and payslips
  (`payrollRuns`).
- **Editing and deleting saved records:** `records.edit` (company roles, branchAdmin,
  manager, inCharge, accountant, supervisor) and `records.delete` (company roles,
  branchAdmin, manager — also enforced in the database).
- **Receiving goods** (supervisor and up) may only raise what a vendor is owed and
  record what the branch paid for an item; changing vendors and items otherwise
  is `catalog.manage`.
- **Approving a purchase order** (approve, reject, re-open) is `purchases.approve`;
  sending an approved order or editing it (which clears the approval) is not.
- Inside a page, a role that may see but not change gets a read-only page
  (vendors, items, attendance log, payroll history for the accountant).

Rules that go with it:
1. **Nobody approves their own** request, pay-out or voucher (decided 16 Oct).
2. Company roles act in the branch they have picked; branch roles only in their own branch.
3. Changes to money settings, deletes and approvals go to the audit log.
4. A role that can't see pay can't see the pages that show it (payroll, salaries, staff detail).

## 4. Evidence

### The database rules, tried for each role (rules emulator, 18 Oct)
A throw-away test asked the real `firestore.rules` what each role may do in branch `kl`:

| Can… | owner | superAdmin | gm | branchAdmin | manager | accountant | supervisor | cashier | staff |
|---|---|---|---|---|---|---|---|---|---|
| read salaries | yes | yes | yes | yes | yes | yes | **yes** | **yes** | no |
| read payslips | yes | yes | yes | yes | yes | yes | **yes** | **yes** | no |
| read a staff record (pay, IC, bank) | yes | yes | yes | yes | yes | yes | **yes** | **yes** | no |
| save a salary entry | yes | yes | yes | yes | yes | yes | yes | **no** (in their menu) | no |
| update a vendor (paying a bill does) | yes | **no** | **no** | yes | yes | yes | yes | no | no |
| add to the items catalog | yes | **no** | **no** | yes | yes | yes | yes | yes | no |
| record a branch-to-branch loan | yes | **no** | **no** | yes | yes | yes | yes | no | no |
| run payroll | **no** | **no** | **no** | yes | yes | no | no | no | no |
| write a purchase order | yes | yes | yes | yes | yes | yes | yes | yes | **yes** |
| write a company notification | yes | yes | yes | yes | yes | yes | yes | yes | **yes** |

(Approving advances and changing opening balances are already covered by
`tests-rules/rules.test.js`: only branchAdmin / manager / company roles approve;
only owner, superAdmin and branchAdmin change money settings.)

### Pages, signed in as the cashier (local app, 18 Oct)
Opened by address although not in the cashier's menu: Branch dashboard, Daily cash
tracker, every Purchases page, Payroll, Payroll history, Staff management, Branch
management, the branch Audit log, Tools, Profile. Refused (→ `/unauthorized`):
sales / cost / cash-bank entry, every report, Requested panel, Loans, Attendance,
Kiosk, Settings, Branch settings, the staff portal. Signing in as every other role
the same way overloaded the local machine; part 2 is from reading the menu, page
guard and rules side by side, and the table above.

## 5. Questions for the owner

1. **inCharge:** is the column in part 3 right (sales and cost entry, approve pay-outs and POs, see today's figures, no payroll / settings / staff detail)?
2. **Accountant:** may they approve purchase bills and pay vendors? See payroll (read-only)? Approve advances (today the screen offers it but it fails)?
3. **Supervisor and cashier:** should they see *any* reports or the dashboard? (Proposed: no — they enter, they don't see the books.)
4. **GM:** may a GM change money settings (opening balances, currency)? Proposed: no — owner, superAdmin and branchAdmin only.
5. **Cashier:** keep Salaries entry (today it is in their menu but always fails), or remove it?
6. **Owner:** add Staff management, Payroll and Branch settings to the owner's menu (for the branch they pick)?
