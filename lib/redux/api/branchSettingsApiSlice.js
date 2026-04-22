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
    order: Number.isFinite(t.order) ? t.order : i + 1,
  }));

const normalizeSettings = (s) => {
  const out = { ...s };
  const fs = out.financeSales ?? {};
  const tenders = Array.isArray(fs.tenders) ? fs.tenders : [];
  fs.tenders = sanitizeTenders(tenders).sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );
  out.financeSales = fs;
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
            await setDoc(ref, {
              ...init,
              updatedAt: Date.now(),
              createdAt: serverTimestamp(),
            });
            return { data: init };
          }

          const raw = snap.data();
          const normalized = normalizeSettings(raw);

          // Optional: write back if normalization changed tenders (adds banked, fixes order, etc.)
          const rawStr = JSON.stringify(raw.financeSales?.tenders || []);
          const normStr = JSON.stringify(
            normalized.financeSales?.tenders || []
          );
          if (rawStr !== normStr) {
            await setDoc(
              ref,
              {
                financeSales: { tenders: normalized.financeSales.tenders },
                updatedAt: Date.now(),
              },
              { merge: true }
            );
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
