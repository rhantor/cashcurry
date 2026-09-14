import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase"; // your initialized Firestore

// Fallback map for legacy docs (no `banked`)
const DEFAULT_BANKED_BY_KEY = {
  cash: false,
  card: true,
  qr: true,
  grab: true,
  foodpanda: true,
  online: true,
  cheque: false, // ← usually not treated as instantly banked; change to true if you prefer
  promotion: false,
};

// Every field a sanitized tender carries. Used both to build the object and to
// compare a stored tender against its sanitized form without depending on the
// key ordering Firestore happens to return (it sorts map keys alphabetically,
// so JSON.stringify of the raw doc never matches the sanitized literal).
const TENDER_FIELDS = [
  "key",
  "label",
  "enabled",
  "includeInTotal",
  "requireProof",
  "banked",
  "delivery",
  "order",
];

const DEFAULT_DELIVERY_BY_KEY = { grab: true, foodpanda: true };

const sanitizeTenders = (tenders = []) =>
  tenders.map((t, i) => ({
    key: t.key,
    label: t.label ?? t.key,
    enabled: t.enabled !== false,
    includeInTotal: t.includeInTotal !== false,
    requireProof: !!t.requireProof,
    banked:
      typeof t.banked === "boolean"
        ? t.banked
        : DEFAULT_BANKED_BY_KEY[t.key] ?? false,
    // `delivery` drives the delivery-platform split on the dashboard and in
    // summaryMath. It used to be dropped here, so the editor's toggle never
    // survived a save.
    delivery:
      typeof t.delivery === "boolean"
        ? t.delivery
        : DEFAULT_DELIVERY_BY_KEY[String(t.key || "").toLowerCase()] ?? false,
    order: Number.isFinite(t.order) ? t.order : i + 1,
  }));

// Does the stored tender list already match its sanitized form? Compares values
// field by field so a doc that needs no upgrade never triggers a write-back.
const tendersMatch = (rawTenders, normTenders) =>
  rawTenders.length === normTenders.length &&
  normTenders.every((t, i) => {
    const r = rawTenders[i];
    return !!r && TENDER_FIELDS.every((f) => r[f] === t[f]);
  });

const normalizeSettings = (s) => {
  const out = { ...s };
  const fs = out.financeSales ?? {};
  const tenders = Array.isArray(fs.tenders) ? fs.tenders : [];
  fs.tenders = sanitizeTenders(tenders).sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );
  out.financeSales = fs;
  // Branches saved before purchasing controls existed have no `purchases` key;
  // fill it so the settings form and the PO screen read the same shape.
  out.purchases = { requirePoApproval: false, ...(out.purchases || {}) };
  return out;
};

const defaultSettings = (overrides = {}) => ({
  basic: {
    name: "",
    code: "",
    phone: "",
    whatsapp: "",
    email: "",
    address: {
      line1: "",
      city: "",
      state: "",
      postcode: "",
      country: "Malaysia",
    },
    openHours: Array.from({ length: 7 }).map((_, i) => ({
      day: i,
      open: "10:00",
      close: "22:00",
      closed: false,
    })),
    logoUrl: "",
  },
  financeSales: {
    currency: "MYR",
    openingBalance: 0,
    openingBankBalance: 0,
    tax: { type: "SST", rate: 0 },
    serviceCharge: 0,
    discountRules: { maxPercentCashier: 10 },
    depositDefaults: { bankName: "", accountRef: "" },
    cashDrawer: { startFloat: 0 },
    // ✅ banked flag defaults
    tenders: sanitizeTenders([
      {
        key: "cash",
        label: "Cash",
        enabled: true,
        order: 1,
        includeInTotal: true,
        requireProof: false,
        banked: false,
      },
      {
        key: "card",
        label: "Card",
        enabled: true,
        order: 2,
        includeInTotal: true,
        requireProof: false,
        banked: true,
      },
      {
        key: "qr",
        label: "QR",
        enabled: true,
        order: 3,
        includeInTotal: true,
        requireProof: false,
        banked: true,
      },
      {
        key: "grab",
        label: "Grab",
        enabled: true,
        order: 4,
        includeInTotal: true,
        requireProof: false,
        banked: true,
      },
      {
        key: "foodpanda",
        label: "Foodpanda",
        enabled: true,
        order: 5,
        includeInTotal: true,
        requireProof: false,
        banked: true,
      },
      {
        key: "online",
        label: "Online",
        enabled: false,
        order: 6,
        includeInTotal: true,
        requireProof: false,
        banked: true,
      },
      {
        key: "cheque",
        label: "Cheque",
        enabled: false,
        order: 7,
        includeInTotal: true,
        requireProof: true,
        banked: false,
      }, // ← changed to false
      {
        key: "promotion",
        label: "Promotion",
        enabled: false,
        order: 8,
        includeInTotal: false,
        requireProof: false,
        banked: false,
      },
    ]),
  },
  staffRoles: {
    managerUserId: "",
    allowedRoles: ["manager", "cashier", "waiter", "accountant"],
    roleOverrides: { cashier: { canRefund: false, maxDiscountPercent: 10 } },
    attendanceDeviceId: "",
  },
  purchases: {
    // Off by default so existing branches keep raising and sending purchase
    // orders exactly as before. Turn it on to insert an Approve/Reject step
    // between Pending and Sent.
    requirePoApproval: false,
  },
  loansFinance: {
    allowInterBranchLoans: true,
    maxLoanLimit: 500000,
    salaryAdvanceLimitPercent: 30,
  },
  reporting: {
    defaultDashboardMode: "front",
    defaultSummaryFilter: "thisMonth",
    bankedVsCashRule: "standard",
  },
  other: {
    notes: "",
    theme: { primary: "#0ea5e9" },
    enabled: true,
  },
  attendance: {
    payPeriodStart: 1,
    startDayOfWeek: "Monday",
    dayCutoffTime: "05:00",
    duplicatePunchInterval: 5,
    maxWorkHoursPerDay: 16,
    hoursFormat: "decimal",
    useBiometrics: false,
    useCamera: true,
  },
  updatedAt: null,
  ...overrides,
});

export const branchSettingsApi = createApi({
  reducerPath: "branchSettingsApi",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["BranchSettings"],
  endpoints: (builder) => ({
    getBranchSettings: builder.query({
      async queryFn({ companyId, branchId }) {
        try {
          const ref = doc(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "settings",
            "settings"
          );
          const snap = await getDoc(ref);

          if (!snap.exists()) {
            const init = defaultSettings();
            // Seeding is best-effort: roles that may read settings but not write
            // them (manager, accountant, supervisor) must still get the form.
            try {
              await setDoc(ref, {
                ...init,
                updatedAt: Date.now(),
                createdAt: serverTimestamp(),
              });
            } catch (seedErr) {
              console.warn(
                "[getBranchSettings] could not seed settings doc:",
                seedErr?.code || seedErr?.message
              );
            }
            return { data: init };
          }

          const raw = snap.data();
          const normalized = normalizeSettings(raw);

          // Optional: write back if normalization changed tenders (adds banked,
          // delivery, fixes order, etc.). This is an upgrade of stored data, not
          // part of the read — a caller without write access must still get the
          // settings back, so never let it fail the query.
          const rawTenders = Array.isArray(raw.financeSales?.tenders)
            ? raw.financeSales.tenders
            : [];
          if (!tendersMatch(rawTenders, normalized.financeSales.tenders)) {
            try {
              await setDoc(
                ref,
                {
                  financeSales: { tenders: normalized.financeSales.tenders },
                  updatedAt: Date.now(),
                },
                { merge: true }
              );
            } catch (upgradeErr) {
              console.warn(
                "[getBranchSettings] tender normalization not persisted:",
                upgradeErr?.code || upgradeErr?.message
              );
            }
          }

          return { data: normalized };
        } catch (e) {
          return { error: { message: e.message } };
        }
      },
      providesTags: (res, err, args) => [
        { type: "BranchSettings", id: `${args.companyId}-${args.branchId}` },
      ],
    }),

    updateBranchSettings: builder.mutation({
      async queryFn({ companyId, branchId, patch }) {
        try {
          const ref = doc(
            db,
            "companies",
            companyId,
            "branches",
            branchId,
            "settings",
            "settings"
          );

          // sanitize tenders if provided (enforce booleans, defaults, sequential order)
          let next = { ...patch, updatedAt: Date.now() };
          if (patch?.financeSales?.tenders) {
            next = {
              ...next,
              financeSales: {
                ...(patch.financeSales || {}),
                tenders: sanitizeTenders(patch.financeSales.tenders),
              },
            };
          }

          await setDoc(ref, next, { merge: true });
          return { data: next };
        } catch (e) {
          return { error: { message: e.message } };
        }
      },
      invalidatesTags: (res, err, args) => [
        { type: "BranchSettings", id: `${args.companyId}-${args.branchId}` },
      ],
    }),
  }),
});

export const { useGetBranchSettingsQuery, useUpdateBranchSettingsMutation } =
  branchSettingsApi;
