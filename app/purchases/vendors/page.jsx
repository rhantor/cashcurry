"use client";
import React, { useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { Download, Eye, FileSpreadsheet, FileText, MoreHorizontal, Pencil, Plus, RefreshCcw, Search, Store, Trash2, Wallet, CheckCircle2 } from "lucide-react";
import { useGetVendorsQuery, useAddVendorMutation, useUpdateVendorMutation, useDeleteVendorMutation } from "@/lib/redux/api/vendorsApiSlice";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import useCurrency from "@/app/hooks/useCurrency";
import useSession from "@/app/hooks/useSession";
import { formatMoney } from "@/lib/region/currency";
import { Button, DataTable, Input, Menu, cn } from "@/app/components/ui";
import { toast, confirmDialog } from "@/app/components/ui/notify";
import StatTiles from "@/app/components/purchases/StatTiles";
import VendorForm from "./VendorForm";
import VendorSheet from "./VendorSheet";
import { exportVendorsExcel, exportVendorsPDF } from "./exportVendors";
import { recountVendorTotals } from "./recountVendorTotals";
import { niceDate } from "./parts";

const SEES_ALL_BRANCHES = ["owner", "gm", "superAdmin"];

/** The company's vendors: who is owed what, their details and bills. */
export default function VendorsPage() {
  const { companyId, branchId } = useResolvedCompanyBranch();
  const { user } = useSession();
  const currency = useCurrency();
  const money = (v) => formatMoney(Number(v ?? 0), currency);

  const { data: vendors = [], isLoading, refetch } = useGetVendorsQuery(companyId ? { companyId } : skipToken);
  const [addVendor] = useAddVendorMutation();
  const [updateVendor] = useUpdateVendorMutation();
  const [deleteVendor] = useDeleteVendorMutation();

  const [q, setQ] = useState("");
  const [form, setForm] = useState({ open: false, vendor: null });
  const [viewId, setViewId] = useState(null);
  const viewing = vendors.find((v) => v.id === viewId) || null; // stays fresh after an edit

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return vendors;
    return vendors.filter((v) => [v.name, v.code, v.phone, v.email, v.ownerName].some((x) => String(x || "").toLowerCase().includes(k)));
  }, [vendors, q]);

  const owed = vendors.reduce((s, v) => s + Number(v.currentBalance || 0), 0);
  const owing = vendors.filter((v) => Number(v.currentBalance || 0) > 0).length;
  const paid = vendors.reduce((s, v) => s + Number(v.totalPaid || 0), 0);

  const save = async (patch) => {
    if (form.vendor) {
      await updateVendor({ companyId, vendorId: form.vendor.id, patch }).unwrap();
      toast.success(`${patch.name} saved`);
    } else {
      await addVendor({ companyId, vendor: patch }).unwrap();
      toast.success(`${patch.name} added`);
    }
  };

  const allowOneMore = async (v) => {
    const next = (v.maxOpenBills || 0) + 1;
    try {
      await updateVendor({ companyId, vendorId: v.id, patch: { maxOpenBills: next } }).unwrap();
      toast.success(`${v.name} can now have ${next} unpaid bills`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't change the limit.");
    }
  };

  const remove = async (v) => {
    const ok = await confirmDialog({
      title: `Delete ${v.name}?`,
      message: Number(v.currentBalance || 0) > 0 ? `They are still owed ${money(v.currentBalance)}. Their bills stay, but the vendor is gone for good.` : "Their bills stay, but the vendor is gone for good.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteVendor({ companyId, vendorId: v.id }).unwrap();
      if (viewId === v.id) setViewId(null);
      toast.success(`${v.name} deleted`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't delete the vendor.");
    }
  };

  const recount = async () => {
    const ok = await confirmDialog({
      title: "Recount vendor totals?",
      message: "Reads every branch's bills and payments and sets each vendor's billed, paid and owed again. Use it if a total looks wrong.",
      confirmLabel: "Recount",
    });
    if (!ok) return;
    await toast
      .promise(recountVendorTotals(companyId), {
        loading: "Recounting…",
        success: (r) => `Recounted ${r.vendors} vendors across ${r.branches} branches`,
        error: "Couldn't recount",
      })
      .then(() => refetch())
      .catch(() => {});
  };

  const exportAs = (fn) => () => {
    if (!vendors.length) return toast.warning("No vendors to export yet.");
    try {
      fn();
    } catch (e) {
      console.error(e);
      toast.error("Couldn't export.");
    }
  };

  const tiles = [
    { label: "Owed to vendors", value: money(owed), note: `${owing} of ${vendors.length} vendor${vendors.length === 1 ? "" : "s"} waiting on money`, icon: Wallet, tone: owed > 0 ? "bg-danger-soft text-danger" : "bg-surface-2 text-muted" },
    { label: "Paid so far", value: money(paid), note: "To all vendors, all time", icon: CheckCircle2, tone: "bg-success-soft text-success" },
    { label: "Vendors", value: String(vendors.length), note: "Shared by every branch", icon: Store, tone: "bg-brand-soft text-brand" },
  ];

  const columns = [
    {
      key: "name",
      label: "Vendor",
      primary: true,
      sortable: true,
      render: (v) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-fg">{v.name}</p>
          {(v.code || v.ownerName) && <p className="truncate text-[11px] font-normal text-muted">{[v.code, v.ownerName].filter(Boolean).join(" · ")}</p>}
        </div>
      ),
    },
    { key: "phone", label: "Phone", hideOnMobile: true, render: (v) => v.phone || <span className="text-subtle">—</span> },
    { key: "terms", label: "Pays in", sortValue: (v) => Number(v.termsDays ?? -1), render: (v) => (v.termsDays != null && v.termsDays !== "" ? `${v.termsDays} days` : "—") },
    { key: "billed", label: "Billed", align: "right", hideOnMobile: true, sortValue: (v) => Number(v.totalBilled || 0), render: (v) => money(v.totalBilled) },
    { key: "last", label: "Last paid", sortValue: (v) => v.lastPaymentDate || "", render: (v) => (v.lastPaymentDate ? niceDate(v.lastPaymentDate) : <span className="text-subtle">Never</span>) },
    {
      key: "owed",
      label: "Owed",
      align: "right",
      aside: true,
      sortValue: (v) => Number(v.currentBalance || 0),
      render: (v) => <span className={cn("font-semibold", Number(v.currentBalance || 0) > 0 ? "text-danger" : "text-muted")}>{money(v.currentBalance)}</span>,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      hideOnMobile: true,
      render: (v) => (
        // keeps a tap on the menu from also opening the vendor
        <span onClick={(e) => e.stopPropagation()} className="inline-flex">
          <Menu
            align="end"
            width={230}
            trigger={(p) => (
              <Button {...p} size="icon" variant="ghost" aria-label={`More for ${v.name}`} className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            )}
            items={[
              { label: "Open", icon: Eye, onSelect: () => setViewId(v.id) },
              { label: "Edit", icon: Pencil, onSelect: () => setForm({ open: true, vendor: v }) },
              { label: "Allow one more unpaid bill", icon: Plus, onSelect: () => allowOneMore(v) },
              "divider",
              { label: "Delete", icon: Trash2, danger: true, onSelect: () => remove(v) },
            ]}
          />
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Vendors</h1>
          <p className="text-sm text-muted">Your suppliers and what each is owed. Tap one for their bills.</p>
        </div>
        <div className="flex gap-2">
          <Menu
            align="end"
            width={240}
            trigger={(p) => (
              <Button {...p} variant="secondary" icon={Download}>
                Export
              </Button>
            )}
            items={[
              { label: "Contacts (Excel)", icon: FileSpreadsheet, onSelect: exportAs(() => exportVendorsExcel(vendors, "directory")) },
              { label: "Contacts + money (Excel)", icon: FileSpreadsheet, onSelect: exportAs(() => exportVendorsExcel(vendors, "full")) },
              { label: "Money summary (PDF)", icon: FileText, onSelect: exportAs(() => exportVendorsPDF(vendors, currency)) },
              ...(SEES_ALL_BRANCHES.includes(user?.role) ? ["divider", { label: "Recount vendor totals", icon: RefreshCcw, onSelect: recount }] : []),
            ]}
          />
          <Button icon={Plus} disabled={!companyId} onClick={() => setForm({ open: true, vendor: null })}>
            Add vendor
          </Button>
        </div>
      </div>

      <StatTiles tiles={tiles} loading={isLoading} />

      {vendors.length > 5 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a vendor by name, code or phone…" className="pl-10" aria-label="Find a vendor" />
        </div>
      )}

      <DataTable
        columns={columns}
        rows={shown}
        loading={isLoading}
        onRowClick={(v) => setViewId(v.id)}
        defaultSort={{ key: "owed", dir: "desc" }}
        pageSize={20}
        empty={
          q
            ? { icon: Search, title: "No vendor matches", description: `Nothing for “${q}”.` }
            : {
                icon: Store,
                title: "No vendors yet",
                description: "Add the suppliers you buy from, then save their bills.",
                action: (
                  <Button icon={Plus} onClick={() => setForm({ open: true, vendor: null })}>
                    Add your first vendor
                  </Button>
                ),
              }
        }
      />

      <VendorForm open={form.open} vendor={form.vendor} onClose={() => setForm((f) => ({ ...f, open: false }))} onSave={save} />
      <VendorSheet
        open={!!viewing}
        vendor={viewing}
        companyId={companyId}
        branchId={branchId}
        onClose={() => setViewId(null)}
        onEdit={(v) => setForm({ open: true, vendor: v })}
        onDelete={remove}
      />
    </div>
  );
}
