"use client";
import { useMemo, useState, useRef } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import useResolvedCompanyBranch from "@/app/hooks/useResolvedCompanyBranch";
import { useGetVendorBillsQuery } from "@/lib/redux/api/vendorBillsApiSlice";
import { businessToday } from "@/lib/region";
import { itemStats, itemsSummary, lineKey, lookAlikes, missingInfo, notBought, purchaseLines } from "@/lib/purchases/items";
import { Chip } from "@/app/components/entry/Choices";
import StatTiles from "@/app/components/purchases/StatTiles";
import ItemDetailSheet from "./components/ItemDetailSheet";
import ItemTidy from "./components/ItemTidy";
import { useGetItemsQuery, useAddItemMutation, useUpdateItemMutation, useRetireItemMutation, useRestoreItemMutation, useAddItemToBranchMutation, useRemoveItemFromBranchMutation, useAddMultipleItemsMutation, itemKey, itemInBranch } from "@/lib/redux/api/itemsApiSlice";
import { useGetVendorsQuery } from "@/lib/redux/api/vendorsApiSlice";
import { useGetBranchesBasicQuery } from "@/lib/redux/api/branchApiSlice";
import ItemFilterBar, { filterItems } from "@/app/components/purchases/ItemFilterBar";
import useToast from "@/app/components/purchases/useToast";
import * as XLSX from "xlsx";
import { SCOPE_BRANCH, SCOPE_COMPANY, SCOPE_RETIRED } from "./shared";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { Button, Menu } from "@/app/components/ui";
import { Upload, FileSpreadsheet, Plus, DownloadCloud, Wallet, TrendingUp, Sparkles } from "lucide-react";
import { ItemsContext } from "./ItemsContext";
import ItemList from "./components/ItemList";
import ItemSheets from "./components/ItemSheets";
import { can } from "@/lib/authz/permissions";

export default function ItemsCatalogPage() {
  const { ready, companyId, branchId, user } = useResolvedCompanyBranch();
  // adding, changing, retiring and stocking items (roles matrix: catalog.manage)
  const canManage = can(user?.role, "catalog.manage");
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

  // what each item really costs here: the item lines on this branch's supplier bills (lib/purchases/items.js)
  const { data: bills = [] } = useGetVendorBillsQuery(ready && companyId && branchId ? { companyId, branchId } : skipToken);
  const today = businessToday();
  const stats = useMemo(() => itemStats(purchaseLines(bills), today), [bills, today]);
  const summary = useMemo(() => itemsSummary(stats), [stats]);
  const statOf = (item) => stats[item?.id] || stats[lineKey({ name: item?.name })] || null;
  const tidy = useMemo(() => {
    const last = (i) => (stats[i.id] || stats[lineKey({ name: i.name })])?.lastBought || "";
    const price = (i) => (stats[i.id] || stats[lineKey({ name: i.name })])?.last.price || Number(i.lastPurchaseByBranch?.[branchId]?.price) || Number(i.lastPurchasePrice) || 0;
    return { alike: lookAlikes(branchItems), missing: missingInfo(branchItems, price), idle: notBought(branchItems, last, today) };
  }, [branchItems, stats, branchId, today]);
  const tidyCount = tidy.alike.length + tidy.missing.length + tidy.idle.length;
  const [view, setView] = useState("all"); // all | risen | top | tidy (this branch's items)
  const [detailItem, setDetailItem] = useState(null);

  const scoped =
    scope === SCOPE_RETIRED
      ? allItems.filter((i) => i.isActive === false)
      : scope === SCOPE_COMPANY
      ? active
      : branchItems;
  const items =
    scope !== SCOPE_BRANCH || view === "all" || view === "tidy"
      ? scoped
      : view === "risen"
        ? scoped.filter((i) => statOf(i)?.change > 0)
        : scoped.filter((i) => statOf(i)?.spend90 > 0).sort((a, b) => statOf(b).spend90 - statOf(a).spend90);

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
    <ItemsContext.Provider value={{ canManage, busy, bulkAdding, dropping, retiring, ready, companyId, branchId, toastOk, toastError, toastNode, allItems, isLoading, isFetching, vendors, vendorNameById, currency, money, branches, allBranchIds, branchNameById, scope, setScope, active, retiredCount, branchItems, otherBranchCount, openAdd, setOpenAdd, addForm, setAddForm, editOpen, setEditOpen, editForm, setEditForm, search, setSearch, category, setCategory, fileInputRef, handleSaveNew, handlePullToBranch, itemToDrop, setItemToDrop, itemToRetire, setItemToRetire, confirmDropFromBranch, handleOpenEdit, handleSaveEdit, confirmRetire, handleRestore, importToBranchOnly, pendingImport, setPendingImport, handleFileUpload, runImport, downloadTemplate, itemsByCategory, stats, statOf, setDetailItem, tidy }}>
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-5 pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Items catalog</h1>
          <p className="text-muted text-sm mt-0.5">The products this branch orders — what each costs here, and how its price moves. Tap one for its history.</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          {canManage && (
            <>
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
            </>
          )}
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

      {scope === SCOPE_BRANCH && (
        <>
          <StatTiles
            loading={isLoading}
            tiles={[
              { label: "Spent on items this month", value: money(summary.spendMonth), note: "From bills with their items listed", icon: Wallet, tone: "bg-brand-soft text-brand" },
              {
                label: "Price went up",
                value: `${summary.risen.length} item${summary.risen.length === 1 ? "" : "s"}`,
                note: "Last price above the one before",
                icon: TrendingUp,
                tone: summary.risen.length ? "bg-warning-soft text-warning" : "bg-surface-2 text-muted",
              },
              { label: "Needs a look", value: String(tidyCount), note: "Look-alikes, missing details, not bought lately", icon: Sparkles, tone: tidyCount ? "bg-info-soft text-info" : "bg-success-soft text-success" },
            ]}
          />
          <div className="flex flex-wrap gap-1.5">
            <Chip on={view === "all"} onClick={() => setView("all")}>All</Chip>
            <Chip on={view === "risen"} onClick={() => setView("risen")}>Price went up ({summary.risen.length})</Chip>
            <Chip on={view === "top"} onClick={() => setView("top")}>Most spent (90 days)</Chip>
            <Chip on={view === "tidy"} onClick={() => setView("tidy")}>Needs a look ({tidyCount})</Chip>
          </div>
        </>
      )}

      {scope === SCOPE_BRANCH && view === "tidy" ? (
        <ItemTidy />
      ) : (
      <>
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

      <ItemList />
      </>
      )}

      <ItemSheets />

      <ItemDetailSheet item={detailItem} stat={statOf(detailItem)} onClose={() => setDetailItem(null)} />

      {toastNode}
    </div>
    </ItemsContext.Provider>
  );
}
