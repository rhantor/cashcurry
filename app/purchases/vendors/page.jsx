"use client";
import React, { useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { Archive, ArchiveRestore, CalendarClock, Download, Eye, FileSpreadsheet, FileText, MoreHorizontal, Pencil, Plus, RefreshCcw, Search, Store, Trash2, Wallet, AlertTriangle } from "lucide-react";
import { useGetVendorsQuery, useAddVendorMutation, useUpdateVendorMutation, useDeleteVendorMutation } from "@/lib/redux/api/vendorsApiSlice";
import useResolvedCompanyBranch from "@/app/hooks/useResolvedCompanyBranch";
import useCurrency from "@/app/hooks/useCurrency";
import useSession from "@/app/hooks/useSession";
import { formatMoney } from "@/lib/region/currency";
import { Badge, Button, DataTable, Input, Menu, cn } from "@/app/components/ui";
import { Chip } from "@/app/components/entry/Choices";
import { useGetVendorBillsQuery } from "@/lib/redux/api/vendorBillsApiSlice";
import { businessToday } from "@/lib/region";
import { duesTotal, isActive, payFirst, vendorDues } from "@/lib/purchases/vendors";
import { toast, confirmDialog } from "@/app/components/ui/notify";
import StatTiles from "@/app/components/purchases/StatTiles";
import VendorForm from "./VendorForm";
import VendorSheet from "./VendorSheet";
import { exportVendorsExcel, exportVendorsPDF } from "./exportVendors";
import { recountVendorTotals } from "./recountVendorTotals";
import { niceDate } from "./parts";
import { can, isCompanyRole } from "@/lib/authz/permissions";


/**
 * The company's vendors: who is owed what at this branch and when — overdue
 * and due this week first — their details and bills (lib/purchases/vendors.js).
 */
export default function VendorsPage() {
  const { companyId, branchId } = useResolvedCompanyBranch();
  const { user } = useSession();
  // adding, changing and removing vendors (roles matrix: catalog.manage)
  const canManage = can(user?.role, "catalog.manage");
  const currency = useCurrency();
  const money = (v) => formatMoney(Number(v ?? 0), currency);

  const { data: vendors = [], isLoading, refetch } = useGetVendorsQuery(companyId ? { companyId } : skipToken);
  const [addVendor] = useAddVendorMutation();
  const [updateVendor] = useUpdateVendorMutation();
  const [deleteVendor] = useDeleteVendorMutation();

  // this branch's open bills: what each vendor is owed here, and when
  const branchArgs = companyId && branchId ? { companyId, branchId } : null;
  const { data: unpaid = [] } = useGetVendorBillsQuery(branchArgs ? { ...branchArgs, status: "unpaid" } : skipToken);
  const { data: partial = [] } = useGetVendorBillsQuery(branchArgs ? { ...branchArgs, status: "partially_paid" } : skipToken);
  const openBills = useMemo(() => [...unpaid, ...partial], [unpaid, partial]);
  const today = businessToday();
  const dues = useMemo(() => vendorDues(openBills, today), [openBills, today]);
  const totals = duesTotal(dues);

  const [q, setQ] = useState("");
  const [view, setView] = useState("inUse"); // inUse | overdue | dueWeek | inactive
  const [form, setForm] = useState({ open: false, vendor: null });
  const [viewId, setViewId] = useState(null);
  const viewing = vendors.find((v) => v.id === viewId) || null; // stays fresh after an edit

  const inactive = vendors.filter((v) => !isActive(v)).length;
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    const inView = vendors.filter((v) =>
      view === "inactive" ? !isActive(v) : view === "overdue" ? dues[v.id]?.overdue > 0 : view === "dueWeek" ? dues[v.id]?.dueWeek > 0 : isActive(v)
    );
    if (!k) return inView;
    return inView.filter((v) => [v.name, v.code, v.phone, v.email, v.ownerName].some((x) => String(x || "").toLowerCase().includes(k)));
  }, [vendors, q, view, dues]);

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

  // a vendor with history isn't deleted: it is put away (kept for its bills, not offered any more)
  const hasHistory = (v) => Number(v.totalBilled || 0) > 0 || Number(v.currentBalance || 0) > 0 || !!dues[v.id];
  const setActive = async (v, active) => {
    try {
      await updateVendor({ companyId, vendorId: v.id, patch: { active } }).unwrap();
      toast.success(active ? `${v.name} is in use again` : `${v.name} put away — kept with its bills, no longer offered`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't change the vendor.");
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

  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const tiles = [
    {
      label: "Overdue",
      value: money(totals.overdue),
      note: totals.overdue > 0 ? `${plural(totals.overdueVendors, "supplier")} past the due date — pay first` : "Nothing past its due date",
      icon: AlertTriangle,
      tone: totals.overdue > 0 ? "bg-danger-soft text-danger" : "bg-success-soft text-success",
    },
    {
      label: "Due this week",
      value: money(totals.dueWeek),
      note: totals.dueWeek > 0 ? `${plural(totals.dueWeekVendors, "supplier")} in the next 7 days` : "Nothing due in the next 7 days",
      icon: CalendarClock,
      tone: totals.dueWeek > 0 ? "bg-warning-soft text-warning" : "bg-surface-2 text-muted",
    },
    { label: "Owed at this branch", value: money(totals.owed), note: `${plural(openBills.length, "open bill")} · all branches ${money(vendors.reduce((s, v) => s + Number(v.currentBalance || 0), 0))}`, icon: Wallet, tone: "bg-brand-soft text-brand" },
  ];

  // owed here, and when: "RM 750 overdue · 10 days" / "RM 100 due 25 Oct"
  const whenText = (d) =>
    d.overdue > 0
      ? <span className="text-danger">{money(d.overdue)} overdue · {d.oldestLate} day{d.oldestLate === 1 ? "" : "s"}</span>
      : d.nextDue
        ? <span className={d.dueWeek > 0 ? "text-warning" : "text-muted"}>Next due {niceDate(d.nextDue)}</span>
        : null;

  const columns = [
    {
      key: "name",
      label: "Vendor",
      primary: true,
      sortable: true,
      render: (v) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-fg">
            {v.name}
            {!isActive(v) && <Badge tone="neutral" className="ml-1.5 px-2 py-px text-[10px]">Put away</Badge>}
          </p>
          {(v.code || v.ownerName) && <p className="truncate text-[11px] font-normal text-muted">{[v.code, v.ownerName].filter(Boolean).join(" · ")}</p>}
        </div>
      ),
    },
    { key: "phone", label: "Phone", hideOnMobile: true, render: (v) => (v.phone ? <span className="whitespace-nowrap">{v.phone}</span> : <span className="text-subtle">—</span>) },
    { key: "terms", label: "Pays in", sortValue: (v) => Number(v.termsDays ?? -1), render: (v) => (v.termsDays != null && v.termsDays !== "" ? `${v.termsDays} days` : "—") },
    { key: "all", label: "All branches", align: "right", hideOnMobile: true, sortValue: (v) => Number(v.currentBalance || 0), render: (v) => <span className="text-muted">{money(v.currentBalance)}</span> },
    { key: "last", label: "Last paid", sortValue: (v) => v.lastPaymentDate || "", render: (v) => (v.lastPaymentDate ? <span className="whitespace-nowrap">{niceDate(v.lastPaymentDate)}</span> : <span className="text-subtle">Never</span>) },
    {
      key: "owed",
      label: "Owed here",
      align: "right",
      aside: true,
      // who to pay first: overdue money, then due this week, then owed
      sortValue: payFirst(dues),
      render: (v) => {
        const d = dues[v.id];
        if (!d) return <span className="text-muted">{money(0)}</span>;
        return (
          <span className="inline-flex flex-col items-end">
            <span className={cn("font-semibold", d.overdue > 0 ? "text-danger" : "text-fg")}>{money(d.owed)}</span>
            <span className="whitespace-nowrap text-[11px] font-medium">{whenText(d)}</span>
          </span>
        );
      },
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
              ...(canManage
                ? [
                    { label: "Edit", icon: Pencil, onSelect: () => setForm({ open: true, vendor: v }) },
                    { label: "Allow one more unpaid bill", icon: Plus, onSelect: () => allowOneMore(v) },
                    "divider",
                    isActive(v)
                      ? { label: "Put away (no longer used)", icon: Archive, onSelect: () => setActive(v, false) }
                      : { label: "Use again", icon: ArchiveRestore, onSelect: () => setActive(v, true) },
                    ...(hasHistory(v) ? [] : [{ label: "Delete", icon: Trash2, danger: true, onSelect: () => remove(v) }]),
                  ]
                : []),
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
          <p className="text-sm text-muted">Who to pay first, and what each supplier is owed here. Tap one to call, pay or order.</p>
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
              ...(isCompanyRole(user?.role) ? ["divider", { label: "Recount vendor totals", icon: RefreshCcw, onSelect: recount }] : []),
            ]}
          />
          {canManage && (
            <Button icon={Plus} disabled={!companyId} onClick={() => setForm({ open: true, vendor: null })}>
              Add vendor
            </Button>
          )}
        </div>
      </div>

      <StatTiles tiles={tiles} loading={isLoading} />

      <div className="flex flex-wrap gap-1.5">
        <Chip on={view === "inUse"} onClick={() => setView("inUse")}>In use ({vendors.length - inactive})</Chip>
        <Chip on={view === "overdue"} onClick={() => setView("overdue")}>Overdue ({totals.overdueVendors})</Chip>
        <Chip on={view === "dueWeek"} onClick={() => setView("dueWeek")}>Due this week ({totals.dueWeekVendors})</Chip>
        {inactive > 0 && <Chip on={view === "inactive"} onClick={() => setView("inactive")}>Put away ({inactive})</Chip>}
      </div>

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
            : view !== "inUse"
              ? { icon: Store, title: view === "overdue" ? "Nothing overdue" : view === "dueWeek" ? "Nothing due this week" : "None put away", description: "Every supplier in that list shows up here." }
              : {
                icon: Store,
                title: "No vendors yet",
                description: "Add the suppliers you buy from, then save their bills.",
                action: canManage && (
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
        onEdit={canManage ? (v) => setForm({ open: true, vendor: v }) : undefined}
        onDelete={canManage ? remove : undefined}
        onSetActive={canManage ? setActive : undefined}
        removable={(v) => !hasHistory(v)}
        dues={viewing ? dues[viewing.id] : null}
        openBills={viewing ? openBills.filter((b) => b.vendorId === viewing.id) : []}
      />
    </div>
  );
}
