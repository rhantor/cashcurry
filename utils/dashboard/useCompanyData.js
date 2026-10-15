"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { format } from "date-fns";
import { buildLedger } from "@/lib/finance/ledger";
import { fastStart, monthOf } from "@/lib/finance/monthly";
import { fetchLedgerStart } from "@/lib/redux/api/summaryApiSlice";
import { getDocsSince } from "@/lib/redux/api/recordQueries";
import { currencyInfo } from "@/lib/region";
import {
  saleDay, costDay, advanceDay, depositDay, withdrawalDay, salaryDay, staffLoanDay,
  isCashCost, isMigratedStaffLoan, paidOutOf, loanActivityDay, COLLECTION, DATE_FIELD,
} from "@/lib/finance/rules";
import { getSessionUser } from "@/lib/session";

// ====== chart helpers (money rules live in lib/finance) ======
const toDate = (ts) => {
  if (!ts) return null;
  if (typeof ts === "string") return new Date(ts);
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return new Date(ts);
};
const num = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);
const byDateKey = (d) => {
  const dt = toDate(d);
  if (!dt) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const sortByDateKey = (arr) =>
  [...arr].sort((a, b) => +new Date(a.date) - +new Date(b.date));

const DEFAULT_TENDERS = [
  { key: "cash", label: "Cash", order: 1, includeInTotal: true },
  { key: "card", label: "Card", order: 2, includeInTotal: true },
  { key: "qr", label: "QR", order: 3, includeInTotal: true },
  { key: "grab", label: "Grab", order: 4, includeInTotal: true },
  { key: "foodpanda", label: "Foodpanda", order: 5, includeInTotal: true },
  { key: "online", label: "Online", order: 6, includeInTotal: true },
  { key: "cheque", label: "Cheque", order: 7, includeInTotal: true },
  { key: "promotion", label: "Promotion", order: 8, includeInTotal: false },
];
const DEFAULT_DEF_MAP = new Map(DEFAULT_TENDERS.map((t) => [t.key, t]));
const META_KEYS = new Set([
  "id",
  "date",
  "createdAt",
  "createdBy",
  "notes",
  "zReportUrl",
  "tenderMeta",
  "companyId",
  "branchId",
  "total",
  "__typename",
]);

const titleCase = (str = "") =>
  str
    .replace(/[_-]+/g, " ")
    .replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

const normalizeTenderDef = (key, cand = {}) => {
  const def = DEFAULT_DEF_MAP.get(key);
  return {
    key,
    label: cand.label ?? def?.label ?? (key === "qr" ? "QR" : titleCase(key)),
    order: Number.isFinite(cand.order) ? cand.order : def?.order ?? 9999,
    includeInTotal: cand.includeInTotal !== false,
  };
};
const tenderDefsFromSales = (fSales) => {
  const defs = new Map();
  for (const s of fSales) {
    if (Array.isArray(s?.tenderMeta) && s.tenderMeta.length) {
      for (const t of s.tenderMeta) {
        if (!t?.key) continue;
        if (!defs.has(t.key)) defs.set(t.key, normalizeTenderDef(t.key, t));
      }
    } else {
      for (const k of Object.keys(s || {})) {
        if (META_KEYS.has(k)) continue;
        const val = parseFloat(s[k]);
        if (!Number.isFinite(val)) continue;
        if (!defs.has(k)) defs.set(k, normalizeTenderDef(k));
      }
    }
  }
  if (defs.size === 0)
    DEFAULT_TENDERS.forEach((t) =>
      defs.set(t.key, normalizeTenderDef(t.key, t))
    );
  const ordered = Array.from(defs.values()).sort((a, b) => a.order - b.order);
  return {
    tenderKeys: ordered.map((d) => d.key),
    tenderLabelsByKey: ordered.reduce(
      (acc, d) => ((acc[d.key] = d.label), acc),
      {}
    ),
  };
};

// ====== main hook ======
export default function useCompanyData(filter) {
  const [companyId, setCompanyId] = useState(null);
  const [loading, setLoading] = useState(true);

  // raw docs across ALL branches
  const [sales, setSales] = useState([]);
  const [costs, setCosts] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [salaries, setSalaries] = useState([]);
  // Inter-branch loans live at company level (companies/{id}/loans), NOT per branch
  const [loanActivities, setLoanActivities] = useState([]);
  // Staff loans (branch-level /loans collection — cash disbursed to staff from register)
  const [allStaffLoans, setAllStaffLoans] = useState([]);
  // Sum of each branch's configured opening cash float (from branch settings)
  const [totalOpeningCash, setTotalOpeningCash] = useState(0);
  // Each branch's settings: payment types and opening balances for its ledger
  const [settingsByBranch, setSettingsByBranch] = useState({});
  // Balance carried into each branch's first loaded day (null = full history)
  const [carriedByBranch, setCarriedByBranch] = useState({});

  useEffect(() => {
    const raw = getSessionUser();
    if (!raw) return;
    const u = raw;
    setCompanyId(u.companyId);
  }, []);

  // Whole calendar days, like the branch dashboard and the summary report.
  const fromKey = format(filter.from, "yyyy-MM-dd");
  const toKey = format(filter.to, "yyyy-MM-dd");
  const inPeriod = (day) => !!day && day >= fromKey && day <= toKey;
  // Records are loaded from the 1st of this month where the monthly summaries
  // cover everything earlier (per branch, checked every load); else in full.
  const month = monthOf(fromKey);

  useEffect(() => {
    let alive = true;
    async function loadAll() {
      if (!companyId) return;
      setLoading(true);

      const bCol = collection(db, `companies/${companyId}/branches`);
      const bSnap = await getDocs(bCol);
      const branchIds = bSnap.docs.map((d) => d.id);

      // Settings (payment types, opening balances) and the company-level loans
      // between branches come first: they decide where each ledger starts.
      const [settingsSnaps, loansSnap, starts] = await Promise.all([
        Promise.all(
          branchIds.map((bid) => getDoc(doc(db, "companies", companyId, "branches", bid, "settings", "settings")))
        ),
        getDocs(collection(db, `companies/${companyId}/loans`)),
        Promise.all(branchIds.map((bid) => fetchLedgerStart({ companyId, branchId: bid, month }))),
      ]);
      const settingsOf = Object.fromEntries(
        branchIds.map((bid, i) => [bid, settingsSnaps[i].exists() ? settingsSnaps[i].data() : null])
      );
      const loanAll = loansSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const approvedLoans = loanAll.filter((l) => l.status === "approved");
      const carried = Object.fromEntries(
        branchIds.map((bid, i) => [
          bid,
          fastStart({ month, branchId: bid, settings: settingsOf[bid], start: starts[i], loanActivities: approvedLoans }),
        ])
      );

      // Each branch's records: from its start day, or all of them.
      const fetchColl = async (kind) => {
        const chunks = await Promise.all(
          branchIds.map(async (bid) => {
            const ref = collection(db, `companies/${companyId}/branches/${bid}/${COLLECTION[kind]}`);
            const since = carried[bid]?.day;
            const rows = since
              ? await getDocsSince(ref, DATE_FIELD[kind], since, { paidOut: kind === "advances" || kind === "staffLoans" })
              : (await getDocs(ref)).docs.map((d) => ({ id: d.id, ...d.data() }));
            return rows.map((r) => ({ ...r, branchId: bid }));
          })
        );
        return chunks.flat();
      };

      const [salesAll, costsAll, advAll, depAll, wdrAll, salAll, staffLoansAll] = await Promise.all([
        fetchColl("sales"),
        fetchColl("costs"),
        fetchColl("advances"),
        fetchColl("deposits"),
        fetchColl("withdrawals"),
        fetchColl("salaries"),
        fetchColl("staffLoans"),
      ]);

      // Sum opening cash float across all branches
      const openingCashSum = Object.values(settingsOf).reduce((sum, s) => {
        if (!s) return sum;
        const v = parseFloat(s?.initialCash) || parseFloat(s?.financeSales?.openingBalance) || 0;
        return sum + v;
      }, 0);

      if (!alive) return;
      setSales(salesAll);
      setCosts(costsAll);
      setAdvances(advAll);
      setDeposits(depAll);
      setWithdrawals(wdrAll);
      setSalaries(salAll);
      setLoanActivities(loanAll);
      setAllStaffLoans(staffLoansAll);
      setTotalOpeningCash(openingCashSum);
      setSettingsByBranch(settingsOf);
      setCarriedByBranch(carried);
      setLoading(false);
    }
    loadAll();
    return () => {
      alive = false;
    };
  }, [companyId, month]);

  // ── the period's records, all branches (charts and lists) ──
  const fSales = useMemo(() => sales.filter((s) => inPeriod(saleDay(s))), [sales, fromKey, toKey]);
  const fCosts = useMemo(() => costs.filter((x) => inPeriod(costDay(x))), [costs, fromKey, toKey]);
  // Advances and staff loans count once paid out, on the day they were paid.
  const fAdv = useMemo(() => advances.filter((x) => inPeriod(paidOutOf(x, advanceDay)?.day)), [advances, fromKey, toKey]);
  const fDep = useMemo(() => deposits.filter((x) => inPeriod(depositDay(x))), [deposits, fromKey, toKey]);
  const fWdr = useMemo(() => withdrawals.filter((x) => inPeriod(withdrawalDay(x))), [withdrawals, fromKey, toKey]);
  const fSal = useMemo(() => salaries.filter((x) => inPeriod(salaryDay(x))), [salaries, fromKey, toKey]);
  const fLoan = useMemo(
    () => loanActivities.filter((x) => inPeriod(loanActivityDay(x))),
    [loanActivities, fromKey, toKey]
  );
  // Staff loans paid out of a till in this period.
  const fStaffLoans = useMemo(
    () => allStaffLoans.filter((x) => !isMigratedStaffLoan(x) && paidOutOf(x, staffLoanDay)?.fromTill && inPeriod(paidOutOf(x, staffLoanDay).day)),
    [allStaffLoans, fromKey, toKey]
  );

  // ── money: one ledger per branch from the shared finance engine ──
  // The company figures are the sum of the branch ledgers, so they always
  // equal the branch reports added up. Loans between branches cancel out.
  const ledgers = useMemo(() => {
    const ofBranch = (list, bid) => list.filter((x) => x.branchId === bid);
    // Same loans the branch reports use (approved only).
    const approvedLoans = loanActivities.filter((l) => l.status === "approved");
    return Object.keys(settingsByBranch).map((bid) =>
      buildLedger({
        branchId: bid,
        settings: settingsByBranch[bid],
        records: {
          sales: ofBranch(sales, bid),
          costs: ofBranch(costs, bid),
          advances: ofBranch(advances, bid),
          staffLoans: ofBranch(allStaffLoans, bid),
          deposits: ofBranch(deposits, bid),
          salaries: ofBranch(salaries, bid),
          withdrawals: ofBranch(withdrawals, bid),
          loanActivities: approvedLoans,
        },
        from: fromKey,
        to: toKey,
        carriedIn: carriedByBranch[bid] || null,
      })
    );
  }, [settingsByBranch, carriedByBranch, sales, costs, advances, allStaffLoans, deposits, salaries, withdrawals, loanActivities, fromKey, toKey]);

  // What one sale adds to total sales and to the bank, by its branch's rules.
  const { saleTotal, bankedOfSale } = useMemo(() => {
    const configs = Object.fromEntries(ledgers.map((l) => [l.branchId, l.tenders]));
    const sum = (s, pick) => {
      const t = configs[s.branchId];
      return t ? t.keys.reduce((a, k) => a + (pick(t, k) ? num(s[k]) : 0), 0) : 0;
    };
    return {
      saleTotal: (s) => sum(s, (t, k) => t.countsInTotal(k)),
      bankedOfSale: (s) => sum(s, (t, k) => t.isBanked(k)),
    };
  }, [ledgers]);

  const totals = useMemo(() => {
    const sumOf = (k) => ledgers.reduce((s, l) => s + l.totals[k], 0);
    let backCard = 0, backQR = 0, backOnline = 0, backBank = 0;
    fCosts.forEach((c) => {
      if (isCashCost(c)) return;
      const amt = num(c.amount);
      const method = c.paidMethod || "";
      if (method === "card") backCard += amt;
      else if (method === "qr") backQR += amt;
      else if (method === "online") backOnline += amt;
      else if (method === "bank_transfer") backBank += amt;
    });
    const totalCash = sumOf("cashSales");
    const totalSalCash = sumOf("salaryCash");
    const totalSalBank = sumOf("salaryBank");
    return {
      totalCash,
      totalCard: fSales.reduce((s, x) => s + num(x.card), 0),
      totalQR: fSales.reduce((s, x) => s + num(x.qr), 0),
      totalOnline: fSales.reduce((s, x) => s + num(x.online), 0),
      bankedSales: sumOf("bankedSales"),
      totalWdr: sumOf("withdrawal"),
      totalDep: sumOf("deposit"),
      totalCosts: sumOf("costCash") + sumOf("costBank"),
      totalCostsFront: sumOf("costCash"),
      totalCostsBack: sumOf("costBank"),
      backCard,
      backQR,
      backOnline,
      backBank,
      totalAdv: sumOf("advance") + sumOf("advanceBank"),
      totalSal: totalSalCash + totalSalBank,
      totalSalCash,
      totalSalBank,
      totalStaffLoanCash: sumOf("staffLoanGiven"),
      // Opening floats + this period's cash flow (not a balance — see estCashOnHand).
      periodEstCashOnHand:
        totalOpeningCash + totalCash + sumOf("withdrawal") - sumOf("deposit") - sumOf("costCash") -
        totalSalCash - sumOf("advance") - sumOf("staffLoanGiven"),
      periodEffectiveBanked:
        sumOf("bankedSales") + sumOf("deposit") - sumOf("withdrawal") - sumOf("costBank") - totalSalBank,
      totalSales: sumOf("totalSales"),
    };
  }, [ledgers, fCosts, fSales, totalOpeningCash]);

  const currencies = useMemo(
    () => [...new Set(Object.values(settingsByBranch).map((s) => currencyInfo(s?.financeSales?.currency).code))],
    [settingsByBranch]
  );

  // Balances at the end of the period: every branch's closing cash and bank.
  const cumulative = useMemo(
    () => ({
      estCashOnHand: ledgers.reduce((s, l) => s + l.closing.cash, 0),
      effectiveBankedAfterWithdrawals: ledgers.reduce((s, l) => s + l.closing.bank, 0),
    }),
    [ledgers]
  );

  // charts (company-wide) — same shape as your branch hook
  const salesTrend = useMemo(() => {
    const map = new Map();
    fSales.forEach((s) => {
      const k = byDateKey(s.date);
      const prev = map.get(k) || { date: k, total: 0 };
      prev.total += saleTotal(s);
      map.set(k, prev);
    });
    return sortByDateKey([...map.values()]);
  }, [fSales, saleTotal]);

  const { tenderKeys, tenderLabelsByKey } = useMemo(
    () => tenderDefsFromSales(fSales),
    [fSales]
  );

  const salesBreakdown = useMemo(() => {
    const map = new Map();
    const ensureRow = (k) => {
      if (!map.has(k)) {
        const base = { date: k };
        tenderKeys.forEach((tk) => (base[tk] = 0));
        map.set(k, base);
      }
      return map.get(k);
    };
    fSales.forEach((s) => {
      const k = byDateKey(s.date);
      const row = ensureRow(k);
      tenderKeys.forEach((tk) => {
        row[tk] += num(s[tk]);
      });
    });
    return sortByDateKey([...map.values()]);
  }, [fSales, tenderKeys]);

  const salesVsCosts = useMemo(() => {
    const map = new Map();
    fSales.forEach((s) => {
      const k = byDateKey(s.date);
      const prev = map.get(k) || {
        date: k,
        sales: 0,
        costs_front: 0,
        costs_back: 0,
      };
      prev.sales += saleTotal(s);
      map.set(k, prev);
    });
    fCosts.forEach((c) => {
      const k = byDateKey(c.date || c.createdAt);
      const prev = map.get(k) || {
        date: k,
        sales: 0,
        costs_front: 0,
        costs_back: 0,
      };
      const from = isCashCost(c) ? "front" : "back";
      const amt = num(c.amount);
      if (from === "front") prev.costs_front += amt;
      else prev.costs_back += amt;
      map.set(k, prev);
    });
    return sortByDateKey(
      [...map.values()].map((row) => ({
        ...row,
        costs_total: row.costs_front + row.costs_back,
      }))
    );
  }, [fSales, fCosts, saleTotal]);

  const bankedVsWdr = useMemo(() => {
    const map = new Map();
    fSales.forEach((s) => {
      const k = byDateKey(s.date);
      const prev = map.get(k) || { date: k, bankedSales: 0, withdrawals: 0 };
      prev.bankedSales += bankedOfSale(s);
      map.set(k, prev);
    });
    fWdr.forEach((w) => {
      const k = byDateKey(w.date || w.createdAt);
      const prev = map.get(k) || { date: k, bankedSales: 0, withdrawals: 0 };
      prev.withdrawals += num(w.amount);
      map.set(k, prev);
    });
    return sortByDateKey([...map.values()]);
  }, [fSales, fWdr, bankedOfSale]);

  const cashVsCost = useMemo(() => {
    const map = new Map();
    fSales.forEach((s) => {
      const k = byDateKey(s.date);
      const prev = map.get(k) || { date: k, cashSales: 0, cashCosts: 0 };
      prev.cashSales += num(s.cash);
      map.set(k, prev);
    });
    fCosts.forEach((c) => {
      const k = byDateKey(c.date || c.createdAt);
      const prev = map.get(k) || { date: k, cashSales: 0, cashCosts: 0 };
      if (isCashCost(c)) prev.cashCosts += num(c.amount);
      map.set(k, prev);
    });
    return sortByDateKey([...map.values()]);
  }, [fSales, fCosts]);

  const loanTimeline = useMemo(() => {
    const map = new Map();
    const add = (k, field, amt) => {
      const row = map.get(k) || {
        date: k,
        lent: 0,
        borrowed: 0,
        repayReceived: 0,
        repayPaid: 0,
      };
      row[field] += amt;
      map.set(k, row);
    };
    fLoan.forEach((e) => {
      const k = loanActivityDay(e);
      const amt = num(e.amount);
      // For company view: aggregate all branches together
      if (e.type === "loan") {
        // company lent or borrowed both count (just show totals)
        add(k, "lent", amt);
        add(k, "borrowed", amt);
      } else if (e.type === "repayment") {
        add(k, "repayReceived", amt);
        add(k, "repayPaid", amt);
      }
    });
    return sortByDateKey([...map.values()]);
  }, [fLoan]);

  const recent = useMemo(() => {
    const rows = [];
    fSales
      .slice(-50)
      .forEach((x) =>
        rows.push({ type: "Sale", date: x.date, amount: saleTotal(x) })
      );
    fCosts.slice(-50).forEach((x) =>
      rows.push({
        type: "Cost",
        date: x.date || x.createdAt,
        amount: num(x.amount),
      })
    );
    fDep.slice(-50).forEach((x) =>
      rows.push({
        type: "Deposit",
        date: x.date || x.createdAt,
        amount: num(x.amount),
      })
    );
    fWdr.slice(-50).forEach((x) =>
      rows.push({
        type: "Withdraw",
        date: x.date || x.createdAt,
        amount: num(x.amount),
      })
    );
    fSal.slice(-50).forEach((x) =>
      rows.push({
        type: "Salary",
        date: x.date || x.createdAt,
        amount: num(x.amount),
      })
    );
    fAdv.slice(-50).forEach((x) =>
      rows.push({
        type: "Advance",
        date: x.date || x.createdAt,
        amount: num(x.amount),
      })
    );
    fStaffLoans.slice(-50).forEach((x) =>
      rows.push({
        type: "Staff Loan",
        date: x.date || x.createdAt,
        amount: num(x.amount),
      })
    );
    fLoan.slice(-50).forEach((x) =>
      rows.push({
        type: "Loan",
        date: x.date || x.createdAt,
        amount: num(x.amount),
      })
    );
    return rows
      .map((r) => ({ ...r, ts: +toDate(r.date) }))
      .filter((r) => !Number.isNaN(r.ts))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 15);
  }, [fSales, fCosts, fDep, fWdr, fSal, fAdv, fStaffLoans, fLoan, saleTotal]);
  // --- build a quick map for branch names (after you fetched branches) ---
  /* if you already have branches loaded in this hook, keep them;
   otherwise, you can pass a branches prop or fetch similarly to sales */
  const [branchesList, setBranchesList] = useState([]);
  useEffect(() => {
    // optional: if you want names in charts, fetch branches once
    async function loadBranches() {
      if (!companyId) return;
      const bSnap = await getDocs(
        collection(db, `companies/${companyId}/branches`)
      );
      setBranchesList(bSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    loadBranches();
  }, [companyId]);
  const branchName = (id) =>
    branchesList.find((b) => b.id === id)?.name || id || "Unknown";

  // --- PER-BRANCH PERFORMANCE (sales, costs, net) ---
  const branchPerf = useMemo(() => {
    const map = new Map(); // branchId -> { sales,costs,frontCosts,backCosts, salaries, advances }

    const ensure = (bid) => {
      const cur = map.get(bid) || {
        branchId: bid,
        sales: 0,
        costs: 0,
        frontCosts: 0,
        backCosts: 0,
        salaries: 0,
        advances: 0,
        staffLoans: 0,
        deposits: 0,
        withdrawals: 0,
      };
      map.set(bid, cur);
      return cur;
    };

    // sales
    fSales.forEach((s) => {
      const r = ensure(s.branchId);
      r.sales += saleTotal(s);
    });

    // costs split
    fCosts.forEach((c) => {
      const r = ensure(c.branchId);
      const amt = num(c.amount);
      const from = isCashCost(c) ? "front" : "back";
      if (from === "front") {
        r.frontCosts += amt;
      } else {
        r.backCosts += amt;
      }
      r.costs += amt;
    });

    // salaries/advances
    fSal.forEach((x) => {
      ensure(x.branchId).salaries += num(x.amount);
    });
    fAdv.forEach((x) => {
      ensure(x.branchId).advances += num(x.amount);
    });
    fStaffLoans.forEach((x) => {
      ensure(x.branchId).staffLoans += num(x.amount);
    });

    // bank cash flow (optional use in UI)
    fDep.forEach((x) => {
      ensure(x.branchId).deposits += num(x.amount);
    });
    fWdr.forEach((x) => {
      ensure(x.branchId).withdrawals += num(x.amount);
    });

    // finalize
    const rows = Array.from(map.values()).map((r) => ({
      ...r,
      name: branchName(r.branchId),
      net: r.sales - r.costs - r.salaries - r.advances - r.staffLoans, // 🔸 your definition of "performance"
      opMarginPct: r.sales ? ((r.sales - r.costs) / r.sales) * 100 : 0,
    }));

    // sort best → worst by net
    rows.sort((a, b) => b.net - a.net);
    return rows;
  }, [fSales, fCosts, fSal, fAdv, fStaffLoans, fDep, fWdr, branchesList, saleTotal]);

  // --- PER-BRANCH LOAN BALANCE (net owed vs owed-to) ---
  // Positive = others owe this branch (net lender)
  // Negative = this branch owes others (net borrower)
  const branchLoanBalances = useMemo(() => {
    const bal = new Map(); // branchId -> net

    const add = (bid, delta) => {
      bal.set(bid, (bal.get(bid) || 0) + delta);
    };

    const getFrom = (e) =>
      e.fromBranchId ||
      e.giverBranchId ||
      e.requestFromBranchId ||
      e.sourceBranchId;
    const getTo = (e) =>
      e.toBranchId ||
      e.receiverBranchId ||
      e.requestedToBranchId ||
      e.targetBranchId;

    fLoan.forEach((e) => {
      const amt = num(e.amount);
      const fromId = getFrom(e);
      const toId = getTo(e);
      if (!fromId || !toId || !amt) return;

      if (e.type === "loan") {
        // borrower (from) owes: -amt ; lender (to) is owed: +amt
        add(fromId, -amt);
        add(toId, +amt);
      } else if (e.type === "repayment") {
        // borrower pays lender back: borrower +amt ; lender -amt
        add(fromId, +amt);
        add(toId, -amt);
      }
    });

    const rows = Array.from(bal.entries()).map(([branchId, net]) => ({
      branchId,
      name: branchName(branchId),
      net,
    }));

    // sort by who is most owed at top
    rows.sort((a, b) => b.net - a.net);
    return rows;
  }, [fLoan, branchesList]);

  // banked tender labels (for KPI sub)
  const bankedTenderKeys = useMemo(() => {
    const set = new Set();
    for (const s of fSales) {
      if (Array.isArray(s?.tenderMeta)) {
        s.tenderMeta.forEach((t) => {
          if (t?.banked) set.add(t.key);
        });
      }
    }
    if (set.size === 0)
      ["card", "qr", "online", "grab", "foodpanda"].forEach((k) => set.add(k));
    return Array.from(set);
  }, [fSales]);

  const bankedTenderLabelList = useMemo(
    () =>
      bankedTenderKeys
        .map(
          (k) =>
            tenderLabelsByKey?.[k] ??
            (k === "qr" ? "QR" : k[0].toUpperCase() + k.slice(1))
        )
        .join(", "),
    [bankedTenderKeys, tenderLabelsByKey]
  );

  return {
    companyId,
    loading,
    // filtered collections (company scope)
    fSales,
    fCosts,
    fAdv,
    fDep,
    fWdr,
    fSal,
    // charts
    salesTrend,
    salesBreakdown,
    salesVsCosts,
    cashVsCost,
    bankedVsWdr,
    loanTimeline,
    recent,
    // kpis
    ...totals,
    // Cumulative balance KPIs (as-of end of filter period, matches reports page)
    estCashOnHand: cumulative.estCashOnHand,
    effectiveBankedAfterWithdrawals: cumulative.effectiveBankedAfterWithdrawals,
    // labels/series
    tenderKeys,
    tenderLabelsByKey,
    bankedTenderLabelList,

    branchPerf, // array of {name, branchId, sales, costs, frontCosts, backCosts, salaries, advances, net, opMarginPct}
    branchLoanBalances, // array of {name, branchId, net}
    branchesList,
    // Currency codes the branches use; more than one means company totals mix them.
    currencies,
  };
}
