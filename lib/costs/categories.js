// lib/costs/categories.js — what a cost was for (roadmap 4.9, owner's
// decisions of 16 Oct 2026 in docs/ROADMAP.md):
//
// - Two levels: group → category. Owner, GM and super admin manage them in
//   Settings (companies/{c}/settings/costCategories); until they do, the
//   defaults below apply. No free-typed "Other".
// - Some categories need more: who was paid (a listed vendor or any shop typed
//   in) for food and stock; which bill and which month for utilities and rent.
// - Money that leaves but is not a cost — owner drawings,
//   deposits, loan principal, SST paid to customs — sits in its own
//   group, still moves the till or bank, and stays out of profit.
// - Each saved cost keeps its group, category and kind as they were (a
//   snapshot), so renaming or moving a category later never changes old books.
//   Records from before keep their old category names and are mapped to a
//   group for reports (LEGACY).

/** A group is either a real cost or money out that is not a cost. */
export const KINDS = { expense: "Cost", notCost: "Not a cost" };

/** Extra things a category asks for. */
export const NEEDS = {
  paidTo: "Who was paid",
  billFor: "Which bill and month",
};

export const DEFAULT_GROUPS = [
  {
    id: "food", name: "Food & stock", kind: "expense",
    categories: [
      { id: "ingredients", name: "Food & ingredients", needs: ["paidTo"] },
      { id: "drinks", name: "Drinks", needs: ["paidTo"] },
      { id: "gas", name: "Cooking gas", needs: ["paidTo"] },
      { id: "packaging", name: "Packaging", needs: ["paidTo"] },
      { id: "cleaning-supplies", name: "Cleaning supplies" },
    ],
  },
  {
    id: "premises", name: "Premises", kind: "expense",
    categories: [
      { id: "rent", name: "Rent", needs: ["billFor"] },
      { id: "electricity", name: "Electricity", needs: ["billFor"] },
      { id: "water", name: "Water", needs: ["billFor"] },
      { id: "internet", name: "Internet & phone", needs: ["billFor"] },
      { id: "repairs", name: "Repairs & maintenance" },
      { id: "pest", name: "Cleaning & pest control" },
    ],
  },
  {
    id: "staff", name: "Staff", kind: "expense",
    categories: [
      { id: "staff-meals", name: "Staff meals" },
      { id: "staff-transport", name: "Staff transport" },
      { id: "uniforms", name: "Uniforms" },
      { id: "staff-welfare", name: "Training & medical" },
    ],
  },
  {
    id: "running", name: "Running the business", kind: "expense",
    categories: [
      { id: "delivery", name: "Transport & delivery" },
      { id: "office", name: "Office supplies" },
      { id: "software", name: "Software & subscriptions", needs: ["billFor"] },
      { id: "marketing", name: "Marketing & ads" },
      { id: "bank-charges", name: "Bank charges" },
      { id: "licences", name: "Licences & permits" },
      { id: "fines", name: "Compounds & fines" },
      // equipment is a cost (owner, 19 Oct): no asset register is kept
      { id: "assets", name: "Equipment & assets" },
      { id: "professional", name: "Accounting & professional fees" },
      { id: "other", name: "Other running costs" },
    ],
  },
  {
    id: "not-cost", name: "Not a cost", kind: "notCost",
    categories: [
      { id: "drawings", name: "Owner drawings" },
      { id: "deposits", name: "Deposits paid (rent, utilities)" },
      { id: "loan-principal", name: "Loan repayment (principal)" },
      { id: "sst", name: "SST paid to customs" },
    ],
  },
];

/**
 * Old category names (before 4.9) → the group they belong to in reports.
 * "New Purchases/Assets" is equipment — a cost like any other (owner, 19 Oct:
 * no asset register is kept, so equipment is not set apart from profit). Anything
 * typed in by hand under the old "Other" counts as a running cost.
 */
export const LEGACY = {
  Utilities: "premises",
  Inventory: "food",
  Maintenance: "premises",
  "Staff Cost": "staff",
  "Rent/Deposit": "premises",
  "Transport/Delivery": "running",
  "Office Supplies": "running",
  Operation: "running",
  "New Purchases/Assets": "running",
  "Software/Subscriptions": "running",
  "Taxes/License": "running",
  compund: "running",
  Packaging: "food",
  "Marketing/Ads": "running",
  "Bank Charges": "running",
  Other: "running",
};

/** Old names people read differently ("compund" was always meant as compounds). */
const LEGACY_LABEL = { compund: "Compounds & fines" };

const slug = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

/** A usable id for a new group or category, unique among `taken`. */
export function newId(name, taken = []) {
  const base = slug(name) || "item";
  let id = base;
  for (let i = 2; taken.includes(id); i++) id = `${base}-${i}`;
  return id;
}

/** The company's groups (Settings), or the defaults; hidden categories kept for old records. */
export function groupsFrom(saved) {
  const groups = Array.isArray(saved?.groups) && saved.groups.length ? saved.groups : DEFAULT_GROUPS;
  return groups.map((g) => ({
    ...g,
    kind: g.kind === "notCost" ? "notCost" : "expense",
    categories: (g.categories || []).map((c) => ({ ...c, needs: c.needs || [] })),
  }));
}

/** Categories someone can pick today (not hidden), with their group. */
export function pickable(groups) {
  return groups
    .map((g) => ({ ...g, categories: g.categories.filter((c) => !c.hidden) }))
    .filter((g) => !g.hidden && g.categories.length);
}

/** { group, category } for a category id. */
export function findCategory(groups, categoryId) {
  for (const group of groups) {
    const category = group.categories.find((c) => c.id === categoryId);
    if (category) return { group, category };
  }
  return null;
}

/** The fields a new cost stores about its category (a snapshot). */
export function categoryFields(groups, categoryId) {
  const found = findCategory(groups, categoryId);
  if (!found) return null;
  return {
    categoryId: found.category.id,
    category: found.category.name, // what every report already reads
    costGroupId: found.group.id,
    costGroup: found.group.name,
    costKind: found.group.kind,
  };
}

/** Is this record money out that is not a cost (kept out of profit)? Used by the money engine. */
export function isNotCost(cost) {
  if (cost?.costKind) return cost.costKind === "notCost";
  return LEGACY[String(cost?.category || "").trim()] === "not-cost";
}

/** Group and kind of any cost, new or old — for reports. */
export function classify(cost, groups = DEFAULT_GROUPS) {
  if (cost?.costGroupId || cost?.costGroup) {
    const g = groups.find((x) => x.id === cost.costGroupId);
    return {
      groupId: cost.costGroupId || slug(cost.costGroup),
      group: g?.name || cost.costGroup || "Other",
      kind: cost.costKind === "notCost" ? "notCost" : "expense",
      category: cost.category || "",
    };
  }
  const name = String(cost?.category || "").trim();
  const groupId = LEGACY[name] || "running";
  const g = groups.find((x) => x.id === groupId) || DEFAULT_GROUPS.find((x) => x.id === groupId);
  return { groupId, group: g?.name || "Running the business", kind: isNotCost(cost) ? "notCost" : "expense", category: LEGACY_LABEL[name] || name || "Uncategorized" };
}

/**
 * What a cost entry is missing for its category: { paidTo?, billFor? }.
 * paidTo: a listed vendor or a shop name; billFor: a month ("YYYY-MM") and,
 * for utilities, the account / bill number.
 */
export function missingFor(category, entry = {}) {
  const errors = {};
  const needs = category?.needs || [];
  if (needs.includes("paidTo") && !entry.vendorId && !String(entry.paidTo || "").trim()) errors.paidTo = "Who was paid? Pick a vendor or type the shop";
  if (needs.includes("billFor") && !/^\d{4}-\d{2}$/.test(String(entry.billMonth || ""))) errors.billFor = "Which month is this bill for?";
  return errors;
}

/** Check a set of groups before saving it in Settings: names given, no repeats. */
export function checkGroups(groups) {
  const problems = [];
  const names = new Set();
  for (const g of groups) {
    if (!String(g.name || "").trim()) problems.push("Every group needs a name.");
    const cats = new Set();
    for (const c of g.categories || []) {
      if (!String(c.name || "").trim()) problems.push(`A category in "${g.name}" has no name.`);
      const key = String(c.name || "").trim().toLowerCase();
      if (cats.has(key)) problems.push(`"${c.name}" is in "${g.name}" twice.`);
      cats.add(key);
      if (names.has(key)) problems.push(`"${c.name}" is in two groups.`);
    }
    for (const k of cats) names.add(k);
  }
  return [...new Set(problems)];
}
