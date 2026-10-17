"use client";
import React, { useMemo, useState, useRef } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import {
  useGetItemsQuery,
  useAddItemMutation,
  useUpdateItemMutation,
  useRetireItemMutation,
  useRestoreItemMutation,
  useAddItemToBranchMutation,
  useRemoveItemFromBranchMutation,
  useAddMultipleItemsMutation,
  itemKey,
  itemInBranch,
  branchLastPrice,
  branchLastPriceDate,
} from "@/lib/redux/api/itemsApiSlice";
import { useGetVendorsQuery } from "@/lib/redux/api/vendorsApiSlice";
import { useGetBranchesBasicQuery } from "@/lib/redux/api/branchApiSlice";
import Sheet from "@/app/components/purchases/Sheet";
import ConfirmSheet from "@/app/components/purchases/ConfirmSheet";
import ItemFilterBar, { filterItems } from "@/app/components/purchases/ItemFilterBar";
import useToast from "@/app/components/purchases/useToast";
import * as XLSX from "xlsx";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { Button, Menu } from "@/app/components/ui";
import {
  Upload,
  FileSpreadsheet,
  Archive,
  ArchiveRestore,
  Pencil,
  Plus,
  Store,
  DownloadCloud,
  MinusCircle,
  Check,
} from "lucide-react";

/** Shared field styling — one place so every input keeps a thumb-sized target. */
const FIELD =
  "w-full min-h-[48px] px-4 text-[15px] border border-line rounded-2xl bg-surface-2/60 " +
  "focus:bg-surface focus:border-brand focus:ring-2 focus:ring-[var(--cc-ring)]/20 outline-none transition-colors";

/**
 * Tappable multi-select.
 *
 * Replaces `<select multiple>`, which needs a Ctrl/Cmd-click to pick more than
 * one row — a gesture that does not exist on a phone or a tablet, so the
 * control was effectively single-select for anyone not at a desk.
 */
function CheckList({ options, selected = [], onToggle, empty = "Nothing to choose from" }) {
  if (!options.length) {
    return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  }
  return (
    <div className="rounded-2xl border border-line divide-y divide-line max-h-56 overflow-y-auto">
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onToggle(o.id)}
            className={`w-full flex items-center gap-3 p-3.5 text-left transition-colors ${
              on ? "bg-brand-soft/60" : "active:bg-surface-2/60"
            }`}
          >
            <span
              className={`w-6 h-6 rounded-lg border-2 shrink-0 flex items-center justify-center transition-colors ${
                on ? "bg-brand border-brand" : "border-line bg-surface"
              }`}
            >
              {on && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-fg truncate">{o.label}</span>
              {o.hint && <span className="block text-xs text-muted mt-0.5">{o.hint}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Which slice of the catalog is on screen. */
const SCOPE_BRANCH = "branch";
const SCOPE_COMPANY = "company";
const SCOPE_RETIRED = "retired";

/**
 * Picks which branches stock an item.
 *
 * Selecting nothing stores an empty list, which every screen reads as "all
 * branches" — the same shape items written before branch scoping have.
 */
function BranchPicker({ branches, selected = [], onChange }) {
  const all = selected.length === 0;

  const toggle = (id) => {
    // Coming off "all branches" has to start from the full list, otherwise
    // unticking one branch would silently drop every other one too.
    const base = all ? branches.map((b) => b.id) : selected;
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    onChange(next.length === branches.length ? [] : next);
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-fg mb-1.5">Stocked at</label>
      <div className="rounded-2xl border border-line divide-y divide-line max-h-56 overflow-y-auto">
        <button
          type="button"
          onClick={() => onChange([])}
          className={`w-full flex items-center gap-3 p-3.5 text-left transition-colors ${
            all ? "bg-brand-soft/60" : "active:bg-surface-2/60"
          }`}
        >
          <span
            className={`w-6 h-6 rounded-lg border-2 shrink-0 flex items-center justify-center transition-colors ${
              all ? "bg-brand border-brand" : "border-line bg-surface"
            }`}
          >
            {all && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
          </span>
          <span className="text-[15px] font-semibold text-fg">All branches</span>
        </button>
        {branches.map((b) => {
          const on = all || selected.includes(b.id);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => toggle(b.id)}
              className={`w-full flex items-center gap-3 p-3.5 text-left transition-colors ${
                on ? "bg-brand-soft/60" : "active:bg-surface-2/60"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-lg border-2 shrink-0 flex items-center justify-center transition-colors ${
                  on ? "bg-brand border-brand" : "border-line bg-surface"
                }`}
              >
                {on && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
              </span>
              <span className="text-[15px] text-fg min-w-0 truncate">
                {b.name || b.id}
                {b.code ? <span className="text-subtle ml-1.5">{b.code}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted mt-1.5">
        Only these branches see the item when ordering. Leave it on “All branches” if everyone carries it.
      </p>
    </div>
  );
}

export default function ItemsCatalogPage() {
  const { ready, companyId, branchId } = useResolvedCompanyBranch();
  const { toastOk, toastError, toastNode } = useToast();

  // The whole company catalog is fetched once, including retired rows, and the
  // three views below are slices of it — that way switching scope costs nothing
  // and the "pull from another branch" flow has the data it needs.
  const args =
    ready && companyId
      ? { companyId, includeInactive: true, includeAllBranches: true }
      : skipToken;

  const { data: allItems = [], isLoading, isFetching } = useGetItemsQuery(args);
  const { data: vendors = [] } = useGetVendorsQuery(ready && companyId ? { companyId } : skipToken);
  const vendorNameById = useMemo(() => new Map(vendors.map((v) => [v.id, v.name])), [vendors]);
  const currency = useCurrency();
  const money = (v) => formatMoney(Number(v || 0), currency);
  const { data: branches = [] } = useGetBranchesBasicQuery(ready && companyId ? companyId : skipToken);

  const allBranchIds = useMemo(() => branches.map((b) => b.id), [branches]);
  const branchNameById = useMemo(
    () => new Map(branches.map((b) => [b.id, b.code || b.name || b.id])),
    [branches]
  );

  const [scope, setScope] = useState(SCOPE_BRANCH);

  const active = allItems.filter((i) => i.isActive !== false);
  const retiredCount = allItems.length - active.length;
  const branchItems = active.filter((i) => itemInBranch(i, branchId));
  const otherBranchCount = active.length - branchItems.length;

  const items =
    scope === SCOPE_RETIRED
      ? allItems.filter((i) => i.isActive === false)
      : scope === SCOPE_COMPANY
      ? active
      : branchItems;

  const [addItem, { isLoading: adding }] = useAddItemMutation();
  const [updateItem, { isLoading: updating }] = useUpdateItemMutation();
  const [retireItem, { isLoading: retiring }] = useRetireItemMutation();
  const [restoreItem, { isLoading: restoring }] = useRestoreItemMutation();
  const [addItemToBranch, { isLoading: pulling }] = useAddItemToBranchMutation();
  const [removeItemFromBranch, { isLoading: dropping }] = useRemoveItemFromBranchMutation();
  const [addMultipleItems, { isLoading: bulkAdding }] = useAddMultipleItemsMutation();

  const busy =
    isLoading || isFetching || adding || updating || retiring || restoring || pulling || dropping || bulkAdding;

  const [openAdd, setOpenAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    category: "",
    unit: "Pcs",
    defaultPrice: "",
    vendorIds: [],
    branchIds: [],
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const fileInputRef = useRef(null);

  const handleSaveNew = async () => {
    if (!addForm.name?.trim()) return toastError("Give the item a name.");
    if (!addForm.category?.trim()) return toastError("Pick a category for the item.");

    const clash = allItems.find((i) => itemKey(i.name) === itemKey(addForm.name));
    if (clash) {
      return toastError(
        clash.isActive === false
          ? `"${clash.name}" already exists but is retired. Restore it from the Retired tab instead.`
          : `"${clash.name}" is already in the catalog.`
      );
    }

    try {
      await addItem({ companyId, item: addForm }).unwrap();
      setAddForm({ name: "", category: "", unit: "Pcs", defaultPrice: "", vendorIds: [], branchIds: [] });
      setOpenAdd(false);
      toastOk("Item added.");
    } catch (e) {
      console.error(e);
      toastError("Could not add the item.");
    }
  };

  /* --------------------------- branch availability -------------------------- */
  const handlePullToBranch = async (item) => {
    try {
      await addItemToBranch({ companyId, itemId: item.id, branchId }).unwrap();
      toastOk(`${item.name} added to this branch.`);
    } catch (e) {
      console.error(e);
      toastError("Could not add the item to this branch.");
    }
  };

  const [itemToDrop, setItemToDrop] = useState(null);
  const [itemToRetire, setItemToRetire] = useState(null);

  const confirmDropFromBranch = async () => {
    try {
      await removeItemFromBranch({
        companyId,
        itemId: itemToDrop.id,
        branchId,
        currentBranchIds: itemToDrop.branchIds || [],
        allBranchIds,
      }).unwrap();
      setItemToDrop(null);
      toastOk("Removed from this branch.");
    } catch (e) {
      console.error(e);
      toastError(e?.message || "Could not remove the item from this branch.");
    }
  };

  const handleOpenEdit = (i) => {
    setEditForm({ ...i });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm?.id) return;
    try {
      await updateItem({
        companyId,
        itemId: editForm.id,
        patch: {
          name: editForm.name,
          category: editForm.category,
          unit: editForm.unit,
          defaultPrice: Number(editForm.defaultPrice || 0),
          vendorIds: editForm.vendorIds,
          branchIds: editForm.branchIds || [],
        },
      }).unwrap();
      setEditOpen(false);
      toastOk("Item updated.");
    } catch (e) {
      console.error(e);
      toastError("Could not update the item.");
    }
  };

  const confirmRetire = async () => {
    try {
      await retireItem({ companyId, itemId: itemToRetire.id }).unwrap();
      setItemToRetire(null);
      toastOk("Item retired.");
    } catch (e) {
      console.error(e);
      toastError("Could not retire the item.");
    }
  };

  const handleRestore = async (i) => {
    try {
      await restoreItem({ companyId, itemId: i.id }).unwrap();
      toastOk(`${i.name} is back in the catalog.`);
    } catch (e) {
      console.error(e);
      toastError("Could not restore the item.");
    }
  };

  // Imports inherit the scope you are looking at, so the Excel sheet you paste
  // in while viewing your branch does not silently land in every branch.
  const importToBranchOnly = scope === SCOPE_BRANCH && !!branchId;
  const [pendingImport, setPendingImport] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          toastError("That spreadsheet is empty.");
          return;
        }

        // Vendors are matched by name so the sheet can carry a "Vendor" column
        // (comma-separated for several) instead of leaving every import
        // unmapped and needing a manual pass afterwards.
        const vendorByName = new Map(vendors.map((v) => [itemKey(v.name), v.id]));
        const unknownVendors = new Set();

        const validItems = data.map((row) => {
          const vendorCell = row["Vendor"] || row["Vendors"] || row["Supplier"] || "";
          const vendorIds = String(vendorCell)
            .split(",")
            .map((n) => n.trim())
            .filter(Boolean)
            .map((n) => {
              const id = vendorByName.get(itemKey(n));
              if (!id) unknownVendors.add(n);
              return id;
            })
            .filter(Boolean);

          return {
            name: row["Item Name"] || row["Name"] || "",
            category: row["Category"] || "Uncategorized",
            unit: row["Unit"] || "Pcs",
            defaultPrice: row["Default Price"] || row["Price"] || 0,
            vendorIds,
            // Follows whichever view you are importing from: a branch list stays
            // scoped to that branch, a company list goes everywhere. Empty means
            // every branch.
            branchIds: importToBranchOnly && branchId ? [branchId] : [],
          };
        }).filter(i => String(i.name).trim() !== "");

        if (validItems.length === 0) {
          toastError("No items found. The sheet needs an 'Item Name' column.");
          return;
        }

        // Parsing and importing are split so the confirmation can be a proper
        // sheet rather than a blocking browser dialog.
        setPendingImport({ items: validItems, unknownVendors: [...unknownVendors] });
      } catch (err) {
        console.error(err);
        toastError("Could not read that file. Make sure it is a valid XLSX or CSV.");
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsBinaryString(file);
  };

  const runImport = async () => {
    try {
      const res = await addMultipleItems({ companyId, items: pendingImport.items }).unwrap();
      const lines = [`Imported ${res.count} item${res.count === 1 ? "" : "s"}.`];
      if (res.skipped?.length) {
        lines.push(`${res.skipped.length} already in the catalog were skipped.`);
      }
      if (pendingImport.unknownVendors.length) {
        lines.push(`Unknown supplier name(s): ${pendingImport.unknownVendors.join(", ")}`);
      }
      setPendingImport(null);
      toastOk(lines.join("\n"));
    } catch (e) {
      console.error(e);
      toastError("The import failed. Nothing was saved.");
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { "Item Name": "Tomato", Category: "Groceries", Unit: "Kg", "Default Price": 5.50, Vendor: "" },
      { "Item Name": "Heineken Bottle", Category: "Bar Items", Unit: "Box", "Default Price": 120.00, Vendor: "" },
      { "Item Name": "Tissue Paper", Category: "Stationeries", Unit: "Pcs", "Default Price": 2.00, Vendor: "" },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ItemsTemplate");
    XLSX.writeFile(wb, "Items_Import_Template.xlsx");
  };

  // Group items by category for simple display
  const itemsByCategory = filterItems(items, { search, category })
    .reduce((acc, item) => {
      const cat = item.category || "Uncategorized";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-5 pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Items catalog</h1>
          <p className="text-muted text-sm mt-0.5">The products this branch can order.</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <Menu
            align="end"
            width={240}
            trigger={(p) => (
              <Button {...p} variant="secondary" icon={FileSpreadsheet} disabled={busy}>
                Excel
              </Button>
            )}
            items={[
              { label: "Import items from Excel", icon: Upload, onSelect: () => fileInputRef.current?.click() },
              { label: "Download the template", icon: DownloadCloud, onSelect: downloadTemplate },
            ]}
          />
          <Button icon={Plus} className="flex-1 sm:flex-none" disabled={!companyId || busy} onClick={() => setOpenAdd(true)}>
            Add item
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          onClick={() => setScope(SCOPE_BRANCH)}
          className={`min-h-[44px] px-4 rounded-2xl font-semibold transition-colors ${
            scope === SCOPE_BRANCH
              ? "bg-brand text-white"
              : "bg-surface text-muted border border-line active:bg-surface-2"
          }`}
        >
          This branch ({branchItems.length})
        </button>
        <button
          onClick={() => setScope(SCOPE_COMPANY)}
          className={`min-h-[44px] px-4 rounded-2xl font-semibold transition-colors ${
            scope === SCOPE_COMPANY
              ? "bg-brand text-white"
              : "bg-surface text-muted border border-line active:bg-surface-2"
          }`}
        >
          All items ({active.length})
          {otherBranchCount > 0 && (
            <span className="ml-1 text-xs opacity-60">+{otherBranchCount} elsewhere</span>
          )}
        </button>
        {retiredCount > 0 && (
          <button
            onClick={() => setScope(SCOPE_RETIRED)}
            className={`min-h-[44px] px-4 rounded-2xl font-semibold transition-colors ${
              scope === SCOPE_RETIRED
                ? "bg-brand text-white"
                : "bg-surface text-muted border border-line active:bg-surface-2"
            }`}
          >
            Retired ({retiredCount})
          </button>
        )}
      </div>

      <ItemFilterBar
        items={items}
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        placeholder="Find a product…"
      />

      {scope === SCOPE_COMPANY && (
        <div className="rounded-2xl border border-info/20 bg-info-soft/60 p-3.5 text-sm text-info leading-relaxed">
          Every product in the company. Greyed-out ones are not stocked here — tap{" "}
          <span className="font-semibold">Add to branch</span> to start using one. Ordering screens only ever
          show what this branch stocks.
        </div>
      )}

      {busy ? (
        <div className="text-subtle animate-pulse text-sm py-4">Working…</div>
      ) : Object.keys(itemsByCategory).length === 0 ? (
        <div className="text-center py-14 px-6 bg-surface rounded-3xl border border-line">
          <FileSpreadsheet className="w-12 h-12 mx-auto text-subtle mb-3" />
          <h3 className="text-lg font-bold text-fg">
            {search
              ? "Nothing matches that search"
              : scope === SCOPE_BRANCH && active.length > 0
              ? "Nothing stocked here yet"
              : "No items yet"}
          </h3>
          <p className="text-muted text-sm mb-5 max-w-sm mx-auto">
            {search
              ? "Try a different word, or check the All items tab."
              : scope === SCOPE_BRANCH && active.length > 0
              ? "Other branches already have products set up. Switch to All items to pull them in."
              : "Add a product, or import your list from Excel."}
          </p>
          {!search &&
            (scope === SCOPE_BRANCH && active.length > 0 ? (
              <button
                onClick={() => setScope(SCOPE_COMPANY)}
                className="min-h-[48px] px-6 rounded-2xl bg-brand text-white font-semibold active:brightness-95"
              >
                Browse all items
              </button>
            ) : (
              <button
                onClick={() => setOpenAdd(true)}
                className="min-h-[48px] px-6 rounded-2xl bg-brand text-white font-semibold active:brightness-95"
              >
                Add your first item
              </button>
            ))}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(itemsByCategory).map(([category, catItems]) => (
            <div key={category} className="bg-surface rounded-3xl border border-line overflow-hidden">
              <div className="px-4 py-3 bg-surface-2/60 border-b border-line font-bold text-fg flex items-center gap-2">
                {category}
                <span className="text-xs font-semibold text-brand px-2 py-0.5 bg-brand-soft rounded-full">
                  {catItems.length}
                </span>
              </div>
              <ul className="divide-y divide-line">
                {catItems.map((item) => {
                  const here = itemInBranch(item, branchId);
                  const localPrice = branchLastPrice(item, branchId);
                  const localDate = branchLastPriceDate(item, branchId);
                  const hasOwnPrice = Number(item.lastPurchaseByBranch?.[branchId]?.price) > 0;
                  return (
                    <li key={item.id} className={`p-4 ${here ? "" : "bg-surface-2/60"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-semibold text-[15px] ${here ? "text-fg" : "text-muted"}`}>
                              {item.name}
                            </span>
                            {!here && (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-muted">
                                not stocked here
                              </span>
                            )}
                            {here && item.branchIds?.length > 0 && (
                              <span
                                className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-info-soft text-info
                                           inline-flex items-center gap-1"
                                title={item.branchIds.map((id) => branchNameById.get(id) || id).join(", ")}
                              >
                                <Store className="w-3 h-3" />
                                {item.branchIds.length} branch{item.branchIds.length > 1 ? "es" : ""}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted mt-1.5">
                            <span>{item.unit}</span>
                            {item.defaultPrice > 0 && <span>· about {money(item.defaultPrice)}</span>}
                            {localPrice > 0 && (item.lastPurchasePrice > 0 || hasOwnPrice) && (
                              <span className={hasOwnPrice ? "text-brand font-semibold" : "text-subtle"}>
                                · {hasOwnPrice ? "Last paid" : "Other branch paid"} {money(localPrice)}
                                {localDate ? ` (${localDate})` : ""}
                              </span>
                            )}
                            {item.vendorIds?.length > 0 && <span className="min-w-0 basis-full truncate">From {item.vendorIds.map((id) => vendorNameById.get(id)).filter(Boolean).join(", ") || `${item.vendorIds.length} supplier${item.vendorIds.length === 1 ? "" : "s"}`}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 -mr-1.5 -mt-1">
                          {item.isActive === false ? (
                            <button
                              onClick={() => handleRestore(item)}
                              aria-label="Restore to catalog"
                              className="w-11 h-11 flex items-center justify-center rounded-full text-subtle
                                         active:bg-brand-soft active:text-brand transition-colors"
                            >
                              <ArchiveRestore className="w-5 h-5" />
                            </button>
                          ) : (
                            <>
                              {here && branchId && scope === SCOPE_COMPANY && (
                                <button
                                  onClick={() => setItemToDrop(item)}
                                  aria-label="Stop stocking here"
                                  className="w-11 h-11 flex items-center justify-center rounded-full text-subtle
                                             active:bg-warning-soft active:text-warning transition-colors"
                                >
                                  <MinusCircle className="w-5 h-5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenEdit(item)}
                                aria-label={`Edit ${item.name}`}
                                className="w-11 h-11 flex items-center justify-center rounded-full text-subtle
                                           active:bg-info-soft active:text-info transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setItemToRetire(item)}
                                aria-label={`Retire ${item.name}`}
                                className="w-11 h-11 flex items-center justify-center rounded-full text-subtle
                                           active:bg-danger-soft active:text-danger transition-colors"
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* The pull action gets its own full-width row — it is the
                          reason anyone opens the All items tab. */}
                      {!here && branchId && item.isActive !== false && (
                        <button
                          onClick={() => handlePullToBranch(item)}
                          className="mt-3 w-full min-h-[44px] rounded-xl bg-brand text-white font-semibold text-sm
                                     flex items-center justify-center gap-2 active:brightness-95 transition-colors"
                        >
                          <DownloadCloud className="w-4 h-4" /> Add to branch
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Add sheet */}
      <Sheet
        open={openAdd}
        title="Add Item"
        onClose={() => setOpenAdd(false)}
        maxWidth="max-w-lg"
        footer={
          <button
            onClick={handleSaveNew}
            disabled={busy}
            className="w-full min-h-[52px] rounded-2xl bg-brand text-white font-bold text-base
                       active:brightness-95 disabled:opacity-40 transition-colors"
          >
            Save Item
          </button>
        }
      >
        <ItemFields
          form={addForm}
          setForm={setAddForm}
          vendors={vendors}
          branches={branches}
          categories={Object.keys(itemsByCategory)}
        />
      </Sheet>

      {/* Edit sheet */}
      <Sheet
        open={editOpen && !!editForm}
        title="Edit Item"
        subtitle={editForm?.name}
        onClose={() => setEditOpen(false)}
        maxWidth="max-w-lg"
        footer={
          <button
            onClick={handleSaveEdit}
            disabled={busy}
            className="w-full min-h-[52px] rounded-2xl bg-brand text-white font-bold text-base
                       active:brightness-95 disabled:opacity-40 transition-colors"
          >
            Update Item
          </button>
        }
      >
        {editForm && (
          <ItemFields
            form={editForm}
            setForm={setEditForm}
            vendors={vendors}
            branches={branches}
            categories={Object.keys(itemsByCategory)}
          />
        )}
      </Sheet>

      <ConfirmSheet
        open={!!pendingImport}
        title={`Import ${pendingImport?.items.length || 0} items?`}
        message={
          importToBranchOnly
            ? "They will be stocked at this branch only. Anything already in the catalog is skipped."
            : "They will be available to every branch. Anything already in the catalog is skipped."
        }
        confirmLabel="Import"
        busy={bulkAdding}
        onConfirm={runImport}
        onClose={() => setPendingImport(null)}
      />

      <ConfirmSheet
        open={!!itemToDrop}
        title="Stop stocking here?"
        message={
          itemToDrop
            ? `${itemToDrop.name} will no longer appear when this branch orders. Other branches keep it.`
            : ""
        }
        confirmLabel="Remove from branch"
        tone="warn"
        busy={dropping}
        onConfirm={confirmDropFromBranch}
        onClose={() => setItemToDrop(null)}
      />

      <ConfirmSheet
        open={!!itemToRetire}
        title="Retire this item?"
        message={
          itemToRetire
            ? `${itemToRetire.name} disappears from new orders, but past orders and guides still show it. You can restore it any time.`
            : ""
        }
        confirmLabel="Retire"
        tone="danger"
        busy={retiring}
        onConfirm={confirmRetire}
        onClose={() => setItemToRetire(null)}
      />

      {toastNode}
    </div>
  );
}

/** Shared body of the add and edit sheets. */
function ItemFields({ form, setForm, vendors, branches, categories }) {
  const patch = (p) => setForm((f) => ({ ...f, ...p }));

  const toggleVendor = (id) => {
    const current = form.vendorIds || [];
    patch({ vendorIds: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-fg mb-1.5">Item name</label>
        <input
          value={form.name || ""}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="e.g. Tomato"
          className={FIELD}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-fg mb-1.5">Category</label>
        <input
          list="cat-list"
          value={form.category || ""}
          onChange={(e) => patch({ category: e.target.value })}
          placeholder="e.g. Groceries"
          className={FIELD}
        />
        <datalist id="cat-list">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-fg mb-1.5">Unit</label>
          <input
            value={form.unit || ""}
            onChange={(e) => patch({ unit: e.target.value })}
            placeholder="Kg, Pcs, Box"
            className={FIELD}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-fg mb-1.5">Usual price</label>
          <input
            type="text"
            inputMode="decimal"
            value={form.defaultPrice ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^\d*\.?\d*$/.test(v)) patch({ defaultPrice: v });
            }}
            placeholder="0.00"
            className={`${FIELD} text-right font-bold tabular-nums`}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-fg mb-1.5">Suppliers</label>
        <CheckList
          options={vendors.map((v) => ({ id: v.id, label: v.name }))}
          selected={form.vendorIds || []}
          onToggle={toggleVendor}
          empty="No suppliers added yet."
        />
        <p className="text-xs text-muted mt-1.5">
          Leave all unticked if any supplier can provide this item.
        </p>
      </div>

      {branches.length > 1 && (
        <BranchPicker
          branches={branches}
          selected={form.branchIds || []}
          onChange={(branchIds) => patch({ branchIds })}
        />
      )}
    </div>
  );
}
