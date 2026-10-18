"use client";

import Sheet from "@/app/components/purchases/Sheet";
import ConfirmSheet from "@/app/components/purchases/ConfirmSheet";
import ItemFields from "./ItemFields";
import { useItemsContext } from "../ItemsContext";

export default function ItemSheets() {
  const { vendors, branches, openAdd, setOpenAdd, addForm, setAddForm, editOpen, setEditOpen, editForm, setEditForm, handleSaveNew, itemToDrop, setItemToDrop, itemToRetire, setItemToRetire, confirmDropFromBranch, handleSaveEdit, confirmRetire, importToBranchOnly, pendingImport, setPendingImport, runImport, itemsByCategory, busy, bulkAdding, dropping, retiring } = useItemsContext();
  return (
    <>
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
    </>
  );
}
