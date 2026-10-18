# Roles and permissions (roadmap 4.1)

**Status: draft for the owner to confirm (18 Oct 2026).** Nothing here is enforced yet. Once the
matrix in part 3 is agreed, one file (`lib/authz/permissions.js`) will hold it and
the menu, the page guard (`middleware.js`) and the database rules
(`firestore.rules`) will all be checked against it, with tests.

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
