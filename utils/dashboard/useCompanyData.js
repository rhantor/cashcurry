"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

// ====== helpers (copy-kept in this file; if you prefer, extract to a shared helpers file) ======
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
const includedTenderKeys = (s) => {
  if (Array.isArray(s?.tenderMeta) && s.tenderMeta.length) {
    return s.tenderMeta
      .filter((t) => t?.includeInTotal !== false)
      .map((t) => t.key);
  }
  return Object.keys(s || {}).filter((k) => {
    if (META_KEYS.has(k)) return false;
    if (k === "promotion") return false;
    const n = parseFloat(s[k]);
    return Number.isFinite(n);
  });
};
const saleTotalDynamic = (s) => {
  const saved = parseFloat(s?.total);
  if (Number.isFinite(saved)) return saved;
  const cents = includedTenderKeys(s).reduce(
    (sum, k) => sum + Math.round((parseFloat(s?.[k]) || 0) * 100),
    0
  );
  return cents / 100;
};
const DEFAULT_BANKED_KEYS = new Set([
  "card",
  "qr",
  "online",
  "grab",
  "foodpanda",
]);
const saleBankedAmount = (s) => {
  if (Array.isArray(s?.tenderMeta) && s.tenderMeta.length) {
    const keys = s.tenderMeta.filter((t) => t?.banked).map((t) => t.key);
    return keys.reduce((sum, k) => sum + (parseFloat(s?.[k]) || 0), 0);
  }
  return Object.keys(s || {}).reduce((sum, k) => {
    if (META_KEYS.has(k)) return sum;
    if (DEFAULT_BANKED_KEYS.has(k)) return sum + (parseFloat(s[k]) || 0);
    return sum;
  }, 0);
};
const derivePaidFrom = (c) => {
  if (c?.paidFromOffice === "front" || c?.paidFromOffice === "back")
    return c.paidFromOffice;
  if (c?.paidMethod && c.paidMethod !== "cash") return "back";
  return "front";
};
const derivePaidMethod = (c) =>
  c?.paidMethod ? c.paidMethod : derivePaidFrom(c) === "front" ? "cash" : "";

/**
 * Returns true when a salary entry was paid in cash (front-office).
 * Mirrors the same helper in useBranchData / useSummaryReportLogic.
 * Priority: payMethod field (set by payroll run) → paidFromOffice legacy field.
 */
const isSalaryCash = (s) => {
  const m = String(s?.payMethod || "").toLowerCase();
  if (m === "bank" || m === "bank_transfer" || m === "cheque") return false;
  return String(s?.paidFromOffice || "front").toLowerCase() !== "back";
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

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) return;
    const u = JSON.parse(raw);
    setCompanyId(u.companyId);
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadAll() {
      if (!companyId) return;
      setLoading(true);

      const bCol = collection(db, `companies/${companyId}/branches`);
      const bSnap = await getDocs(bCol);
      const branchIds = bSnap.docs.map((d) => d.id);

      // pull in parallel
      const fetchColl = async (collName) => {
        const chunks = await Promise.all(
          branchIds.map(async (bid) => {
            const snap = await getDocs(
              collection(
                db,
                `companies/${companyId}/branches/${bid}/${collName}`
              )
            );
            return snap.docs.map((d) => ({
              id: d.id,
              branchId: bid,
              ...d.data(),
            }));
          })
        );
        return chunks.flat();
      };

      // Fetch branch-level subcollections + branch settings + staff loans in parallel.
      // Note: cash withdrawals are stored under "cashWithdrawals" (not "withdrawals").
      // Inter-branch loans are at company level — fetched separately below.
      const [salesAll, costsAll, advAll, depAll, wdrAll, salAll, staffLoansAll, settingsSnaps] =
        await Promise.all([
          fetchColl("sales"),
          fetchColl("costs"),
          fetchColl("advances"),
          fetchColl("deposits"),
          fetchColl("cashWithdrawals"),   // ← correct collection name
          fetchColl("salaries"),
          fetchColl("loans"),             // ← branch-level staff loans
          // Fetch settings doc for every branch to get opening cash balance
          Promise.all(
            branchIds.map((bid) =>
              getDoc(doc(db, "companies", companyId, "branches", bid, "settings", "settings"))
            )
          ),
        ]);

      // Sum opening cash float across all branches
      const openingCashSum = settingsSnaps.reduce((sum, snap) => {
        if (!snap.exists()) return sum;
        const s = snap.data();
        const v = parseFloat(s?.initialCash) || parseFloat(s?.financeSales?.openingBalance) || 0;
        return sum + v;
      }, 0);

      // Fetch company-level inter-branch loans
      const loansSnap = await getDocs(
        collection(db, `companies/${companyId}/loans`)
      );
      const loanAll = loansSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

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
      setLoading(false);
    }
    loadAll();
    return () => {
      alive = false;
    };
  }, [companyId]);

  const inRange = (d) => {
    const t = +toDate(d);
    return t >= +filter.from && t <= +filter.to;
  };

  // Cumulative filter: everything up to end of the selected period.
  // Used for "balance" KPIs (cash on hand, bank expected) so they include
  // pre-period history and match the branch reports page exactly.
  const cutoff = +filter.to;
  const upto = (d) => {
    const t = +toDate(d);
    return !!t && t <= cutoff;
  };

  // filter by date window
  const fSales = useMemo(
    () => sales.filter((s) => inRange(s.date)),
    [sales, filter]
  );
  const fCosts = useMemo(
    () => costs.filter((x) => inRange(x.date || x.createdAt)),
    [costs, filter]
  );
  const fAdv = useMemo(
    () => advances.filter((x) => inRange(x.date || x.createdAt)),
    [advances, filter]
  );
  const fDep = useMemo(
    () => deposits.filter((x) => inRange(x.date || x.createdAt)),
    [deposits, filter]
  );
  const fWdr = useMemo(
    () => withdrawals.filter((x) => inRange(x.date || x.createdAt)),
    [withdrawals, filter]
  );
  const fSal = useMemo(
    () => salaries.filter((x) => inRange(x.date || x.createdAt)),
    [salaries, filter]
  );
  const fLoan = useMemo(
    () => loanActivities.filter((x) => inRange(x.date || x.createdAt)),
    [loanActivities, filter]
  );

  // Staff loans: only cash-disbursed (front office), non-migration, approved/closed, in period
  const fStaffLoans = useMemo(
    () =>
      allStaffLoans.filter((x) => {
        if (!inRange(x.date || x.createdAt)) return false;
        const src    = String(x?.source || "").toLowerCase();
        const paid   = String(x?.paidFromOffice || "front").toLowerCase();
        const status = String(x?.status || "").toLowerCase();
        return src !== "migration" && paid !== "back" && (status === "approved" || status === "closed");
      }),
    [allStaffLoans, filter]
  );

  // totals (company-wide)
  const totals = useMemo(() => {
    const totalCash = fSales.reduce((s, x) => s + num(x.cash), 0);
    const totalCard = fSales.reduce((s, x) => s + num(x.card), 0);
    const totalQR = fSales.reduce((s, x) => s + num(x.qr), 0);
    const totalOnline = fSales.reduce((s, x) => s + num(x.online), 0);

    const bankedSales = fSales.reduce((sum, s) => sum + saleBankedAmount(s), 0);
    const totalWdr = fWdr.reduce((s, x) => s + num(x.amount), 0);
    const totalDep = fDep.reduce((s, x) => s + num(x.amount), 0);

    let totalCostsFront = 0,
      totalCostsBack = 0;
    let backCard = 0,
      backQR = 0,
      backOnline = 0,
      backBank = 0;

    fCosts.forEach((c) => {
      const amt = num(c.amount);
      const from = derivePaidFrom(c);
      const method = derivePaidMethod(c);
      if (from === "front") totalCostsFront += amt;
      else {
        totalCostsBack += amt;
        if (method === "card") backCard += amt;
        else if (method === "qr") backQR += amt;
        else if (method === "online") backOnline += amt;
        else if (method === "bank_transfer") backBank += amt;
      }
    });

    const totalCosts = totalCostsFront + totalCostsBack;
    const totalAdv = fAdv.reduce((s, x) => s + num(x.amount), 0);
    const totalSal = fSal.reduce((s, x) => s + num(x.amount), 0);

    // Split salaries into cash-paid vs bank-paid so each goes to the right pool.
    // totalSal is kept as the grand total for the KPI display card.
    const totalSalCash = fSal.filter(isSalaryCash).reduce((s, x) => s + num(x.amount), 0);
    const totalSalBank = totalSal - totalSalCash;

    // Staff loans paid in cash (from register) — reduces cash on hand.
    const totalStaffLoanCash = fStaffLoans.reduce((s, x) => s + num(x.amount), 0);

    // Bank side: banked receipts minus withdrawals, back-office costs and bank salaries.
    const effectiveBankedAfterWithdrawals =
      bankedSales - totalWdr - totalCostsBack - totalSalBank;

    // Cash side: sum of branch opening floats + cash in − cash out during the period.
    const estCashOnHand =
      totalOpeningCash +
      totalCash + totalWdr - totalDep -
      totalCostsFront - totalSalCash - totalAdv - totalStaffLoanCash;

    const totalSales = fSales.reduce((s, x) => s + saleTotalDynamic(x), 0);

    return {
      totalCash,
      totalCard,
      totalQR,
      totalOnline,
      bankedSales,
      totalWdr,
      totalDep,
      totalCosts,
      totalCostsFront,
      totalCostsBack,
      backCard,
      backQR,
      backOnline,
      backBank,
      totalAdv,
      totalSal,
      totalSalCash,
      totalSalBank,
      totalStaffLoanCash,
      // period-range values (kept for chart / period KPI use)
      periodEstCashOnHand: estCashOnHand,
      periodEffectiveBanked: effectiveBankedAfterWithdrawals,
      totalSales,
    };
  }, [fSales, fWdr, fDep, fCosts, fAdv, fSal, fStaffLoans, totalOpeningCash]);

  // ─────────────────────────────────────────────────────────────────────
  // Cumulative balances (all history up to filter.to) — mirrors the
  // branch reports page so company-wide totals match sum of branch reports.
  // ─────────────────────────────────────────────────────────────────────
  const cumulative = useMemo(() => {
    const sumCash = sales
      .filter((s) => upto(s.date))
      .reduce((s, x) => s + num(x.cash), 0);

    const sumBanked = sales
      .filter((s) => upto(s.date))
      .reduce((sum, s) => sum + saleBankedAmount(s), 0);

    const sumWdr = withdrawals
      .filter((x) => upto(x.date || x.createdAt))
      .reduce((s, x) => s + num(x.amount), 0);

    const sumDep = deposits
      .filter((x) => upto(x.date || x.createdAt))
      .reduce((s, x) => s + num(x.amount), 0);

    let sumCostsFront = 0;
    let sumCostsBack  = 0;
    costs
      .filter((c) => upto(c.date || c.createdAt))
      .forEach((c) => {
        const amt = num(c.amount);
        if (derivePaidFrom(c) === "front") sumCostsFront += amt;
        else sumCostsBack += amt;
      });

    const allSal = salaries.filter((x) => upto(x.date || x.createdAt));
    const sumSalCash = allSal.filter(isSalaryCash).reduce((s, x) => s + num(x.amount), 0);
    const sumSalBank = allSal.filter((s) => !isSalaryCash(s)).reduce((s, x) => s + num(x.amount), 0);

    const sumAdv = advances
      .filter((x) => upto(x.date || x.createdAt))
      .reduce((s, x) => s + num(x.amount), 0);

    const sumStaffLoanCash = allStaffLoans
      .filter((x) => {
        if (!upto(x.date || x.createdAt)) return false;
        const src    = String(x?.source || "").toLowerCase();
        const paid   = String(x?.paidFromOffice || "front").toLowerCase();
        const status = String(x?.status || "").toLowerCase();
        return src !== "migration" && paid !== "back" && (status === "approved" || status === "closed");
      })
      .reduce((s, x) => s + num(x.amount), 0);

    // Cash on hand: branch opening floats + all cash movements up to end of period.
    const estCashOnHand =
      totalOpeningCash +
      sumCash + sumWdr - sumDep -
      sumCostsFront - sumSalCash - sumAdv - sumStaffLoanCash;

    // Bank expected: banked receipts − withdrawals − back costs − bank salaries, all cumulative.
    const effectiveBankedAfterWithdrawals =
      sumBanked - sumWdr - sumCostsBack - sumSalBank;

    return { estCashOnHand, effectiveBankedAfterWithdrawals };
  }, [
    sales, costs, deposits, withdrawals, salaries, advances, allStaffLoans,
    totalOpeningCash, cutoff,
  ]);

  // charts (company-wide) — same shape as your branch hook
  const salesTrend = useMemo(() => {
    const map = new Map();
    fSales.forEach((s) => {
      const k = byDateKey(s.date);
      const prev = map.get(k) || { date: k, total: 0 };
      prev.total += saleTotalDynamic(s);
      map.set(k, prev);
    });
    return sortByDateKey([...map.values()]);
  }, [fSales]);

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
      prev.sales += saleTotalDynamic(s);
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
      const from = derivePaidFrom(c);
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
  }, [fSales, fCosts]);

  const bankedVsWdr = useMemo(() => {
    const map = new Map();
    fSales.forEach((s) => {
      const k = byDateKey(s.date);
      const prev = map.get(k) || { date: k, bankedSales: 0, withdrawals: 0 };
      prev.bankedSales += saleBankedAmount(s);
      map.set(k, prev);
    });
    fWdr.forEach((w) => {
      const k = byDateKey(w.date || w.createdAt);
      const prev = map.get(k) || { date: k, bankedSales: 0, withdrawals: 0 };
      prev.withdrawals += num(w.amount);
      map.set(k, prev);
    });
    return sortByDateKey([...map.values()]);
  }, [fSales, fWdr]);

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
      if (derivePaidFrom(c) === "front") prev.cashCosts += num(c.amount);
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
      const k = byDateKey(e.date || e.createdAt);
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
        rows.push({ type: "Sale", date: x.date, amount: saleTotalDynamic(x) })
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
  }, [fSales, fCosts, fDep, fWdr, fSal, fAdv, fLoan]);
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
        deposits: 0,
        withdrawals: 0,
      };
      map.set(bid, cur);
      return cur;
    };

    // sales
    fSales.forEach((s) => {
      const r = ensure(s.branchId);
      r.sales += saleTotalDynamic(s);
    });

    // costs split
    fCosts.forEach((c) => {
      const r = ensure(c.branchId);
      const amt = num(c.amount);
      const from = derivePaidFrom(c);
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
      net: r.sales - r.costs - r.salaries - r.advances, // 🔸 your definition of "performance"
      opMarginPct: r.sales ? ((r.sales - r.costs) / r.sales) * 100 : 0,
    }));

    // sort best → worst by net
    rows.sort((a, b) => b.net - a.net);
    return rows;
  }, [fSales, fCosts, fSal, fAdv, fDep, fWdr, branchesList]);

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
  };
}
