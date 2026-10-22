"use client";

import { itemInBranch, branchLastPrice, branchLastPriceDate } from "@/lib/redux/api/itemsApiSlice";
import { SCOPE_BRANCH, SCOPE_COMPANY } from "../shared";
import { FileSpreadsheet, Archive, ArchiveRestore, Pencil, Store, DownloadCloud, MinusCircle, TrendingUp, TrendingDown } from "lucide-react";
import { useItemsContext } from "../ItemsContext";

export default function ItemList() {
  const { canManage, branchId, vendorNameById, money, branchNameById, scope, setScope, active, setOpenAdd, search, handlePullToBranch, setItemToDrop, setItemToRetire, handleOpenEdit, handleRestore, itemsByCategory, busy, statOf, setDetailItem } = useItemsContext();
  return (
    <>
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
                  const st = statOf(item);
                  return (
                    <li key={item.id} className={`p-4 ${here ? "" : "bg-surface-2/60"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <button type="button" onClick={() => setDetailItem(item)} className="min-w-0 flex-1 text-left">
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
                          {st && (st.change != null || st.month.spend > 0) && (
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-medium">
                              {st.change != null && (
                                <span className={`inline-flex items-center gap-0.5 ${st.change > 0 ? "text-warning" : "text-success"}`}>
                                  {st.change > 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                                  {st.change > 0 ? "+" : ""}
                                  {st.change}% · was {money(st.prev.price)}
                                </span>
                              )}
                              {st.month.spend > 0 && (
                                <span className="text-muted">
                                  This month {money(st.month.spend)} · {st.month.qty} {item.unit}
                                </span>
                              )}
                            </div>
                          )}
                        </button>

                        {canManage && <div className="flex items-center gap-1 shrink-0 -mr-1.5 -mt-1">
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
                        </div>}
                      </div>

                      {/* The pull action gets its own full-width row — it is the
                          reason anyone opens the All items tab. */}
                      {canManage && !here && branchId && item.isActive !== false && (
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
    </>
  );
}
