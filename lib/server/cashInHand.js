// Cash in hand for the Requested panel, worked out on the server (30 Oct) —
// for roles that hand money out of the till (the cashier) but may not read
// the books it is made from (costs, cash to bank, salaries, summaries). The
// same engine and the same record set as the dashboard (useBranchData +
// useLedgerSource), so the figure matches Home; only the number leaves here.
import { adminDb } from "@/lib/server/firebaseAdmin";
import { buildLedger } from "@/lib/finance/ledger";
import { fastStart, monthOf } from "@/lib/finance/monthly";
import { COLLECTION, DATE_FIELD } from "@/lib/finance/rules";

const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/** Everything dated since `since` on `field` (and, with `paidOut`, paid out since then); all of it without `since`. */
async function since(ref, field, day, { paidOut = false } = {}) {
  if (!day) return rows(await ref.get());
  const snaps = await Promise.all([ref.where(field, ">=", day).get(), ...(paidOut ? [ref.where("paidOut.date", ">=", day).get()] : [])]);
  const byId = new Map();
  for (const s of snaps) for (const x of rows(s)) byId.set(x.id, x);
  return [...byId.values()];
}

/** The earlier months' summaries and the record counts before `month` (as fetchLedgerStart reads them). */
async function ledgerStart(branch, month) {
  try {
    const day = `${month}-01`;
    const kinds = Object.keys(COLLECTION);
    const [snap, ...counts] = await Promise.all([
      branch.collection("summaries").where("period", "<", month).get(),
      ...kinds.map((k) => branch.collection(COLLECTION[k]).where(DATE_FIELD[k], "<", day).count().get()),
    ]);
    const summaries = snap.docs.map((d) => {
      const { period, engineVersion, cashChange, bankChange, counts } = d.data();
      return { period, engineVersion, cashChange, bankChange, counts };
    });
    return { month, summaries, countsBefore: Object.fromEntries(kinds.map((k, i) => [k, counts[i].data().count])) };
  } catch (error) {
    console.warn("[cashInHand] ledger start:", error.message);
    return null;
  }
}

/** The till's cash at the end of `today` ("yyyy-MM-dd"). */
export async function cashInHand({ companyId, branchId, today }) {
  const company = adminDb.collection("companies").doc(companyId);
  const branch = company.collection("branches").doc(branchId);
  const month = monthOf(today);
  const [settingsSnap, loanSnap, start] = await Promise.all([
    branch.collection("settings").doc("settings").get(),
    company.collection("loans").get(),
    ledgerStart(branch, month),
  ]);
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const loanActivities = rows(loanSnap).filter((e) => e.status === "approved");

  const carriedIn = fastStart({ month, branchId, settings, start, loanActivities });
  const day = carriedIn ? carriedIn.day : null;
  const col = (k) => branch.collection(COLLECTION[k]);
  const [sales, costs, advances, staffLoans, deposits, withdrawals, salaries, payouts] = await Promise.all([
    since(col("sales"), DATE_FIELD.sales, day),
    since(col("costs"), DATE_FIELD.costs, day),
    since(col("advances"), DATE_FIELD.advances, day, { paidOut: true }),
    since(col("staffLoans"), DATE_FIELD.staffLoans, day, { paidOut: true }),
    since(col("deposits"), DATE_FIELD.deposits, day),
    since(col("withdrawals"), DATE_FIELD.withdrawals, day),
    since(col("salaries"), DATE_FIELD.salaries, day),
    since(col("payouts"), DATE_FIELD.payouts, day),
  ]);

  const ledger = buildLedger({
    branchId,
    settings,
    records: { sales, costs, advances, staffLoans, deposits, salaries, withdrawals, loanActivities, payouts },
    from: `${month}-01`,
    to: today,
    carriedIn,
  });
  return { cash: ledger.closing.cash, mode: carriedIn ? "fast" : "full" };
}
