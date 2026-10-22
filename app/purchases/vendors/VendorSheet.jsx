"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { skipToken } from "@reduxjs/toolkit/query";
import { Archive, ArchiveRestore, Banknote, CircleDollarSign, ClipboardList, HandCoins, Info, MessageCircle, Package, Pencil, Phone, ReceiptText, ScrollText, ShoppingCart, Trash2 } from "lucide-react";
import { Button, Sheet, Tabs, cn } from "@/app/components/ui";
import { formatMoney } from "@/lib/region/currency";
import useCurrency from "@/app/hooks/useCurrency";
import ExportVendorOverviewBtn from "./ExportVendorOverviewBtn";
import VendorUnpaidBills from "./VendorUnpaidBills";
import VendorPaidBills from "./VendorPaidBills";
import VendorOrders from "./VendorOrders";
import VendorItems from "./VendorItems";
import VendorStatement from "./VendorStatement";
import { niceDate } from "./parts";
import useSession from "@/app/hooks/useSession";
import { can, canOpen } from "@/lib/authz/permissions";
import { regionOf } from "@/lib/region";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { waNumber } from "@/lib/purchases/orders";
import { billBalance, isActive } from "@/lib/purchases/vendors";
import { HandOutSheet } from "@/app/components/payouts/PayoutSheets";

/** One quick action: a big icon button, a link or a click. */
const Action = ({ icon: Icon, label, href, onClick, external, tone = "bg-surface-2 text-fg" }) => {
  const cls = cn("flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl px-2 text-xs font-semibold transition-colors active:brightness-95", tone);
  const body = (
    <>
      <Icon className="size-5" />
      {label}
    </>
  );
  return href ? (
    <a href={href} className={cls} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {body}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
};

const Line = ({ label, children, mono }) => (
  <div className="flex items-start justify-between gap-4 py-2 text-sm">
    <span className="shrink-0 text-muted">{label}</span>
    <span className={cn("min-w-0 break-words text-right font-medium text-fg", mono && "font-mono tracking-wide")}>{children || <span className="text-subtle">—</span>}</span>
  </div>
);

const Group = ({ title, children }) => (
  <section>
    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">{title}</p>
    <div className="divide-y divide-line">{children}</div>
  </section>
);

/**
 * One vendor: what is owed here and when, one tap to call, WhatsApp, pay,
 * order or send cash, their details, and their bills in this branch.
 * dues: lib/purchases/vendors.js vendorDues for this vendor; openBills: theirs here.
 */
export default function VendorSheet({ open, vendor, companyId, branchId, onClose, onEdit, onDelete, onSetActive, removable = () => true, dues = null, openBills = [] }) {
  const router = useRouter();
  const { user } = useSession();
  const role = user?.role;
  const { data: settings } = useGetBranchSettingsQuery(open && companyId && branchId ? { companyId, branchId } : skipToken);
  const [sendCash, setSendCash] = useState(false);
  const tabsRef = useRef(null);
  const currency = useCurrency();
  const money = (v) => formatMoney(Number(v ?? 0), currency);
  const [tab, setTab] = useState("owed");
  // the chosen tab stays in view when the tabs scroll sideways (a phone)
  useEffect(() => {
    tabsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [tab]);
  useEffect(() => {
    if (open) setTab("owed");
  }, [open, vendor?.id]);

  const v = vendor || {};
  const owed = Number(v.currentBalance || 0);
  const wa = waNumber(v.phone, regionOf(settings).timeZone);
  // send cash: for their bills here, oldest due first
  const cashPreset = useMemo(
    () =>
      sendCash && v.id
        ? { vendorId: v.id, vendorName: v.name, bills: [...openBills].sort((a, b) => String(a.dueDate || "9").localeCompare(String(b.dueDate || "9"))).map((b) => ({ ...b, balance: billBalance(b) })) }
        : null,
    [sendCash, v.id, v.name, openBills]
  );
  const figures = [
    { label: "Owed here", value: money(dues?.owed || 0), tone: dues?.owed > 0 ? "text-danger" : "text-success" },
    { label: "All branches", value: money(owed) },
    { label: "Billed in all", value: money(v.totalBilled) },
    { label: "Last paid", value: v.lastPaymentDate ? niceDate(v.lastPaymentDate) : "Never" },
  ];

  const actions = [
    v.phone && { icon: Phone, label: "Call", href: `tel:${v.phone}` },
    wa && { icon: MessageCircle, label: "WhatsApp", href: `https://wa.me/${wa}`, external: true, tone: "bg-[#25D366]/15 text-[#128C7E]" },
    dues?.owed > 0 && canOpen(role, "/purchases/due-bills") && { icon: Banknote, label: "Pay bills", onClick: () => router.push(`/purchases/due-bills?vendor=${v.id}`), tone: "bg-brand-soft text-brand" },
    isActive(v) && canOpen(role, "/purchases/order-guides") && { icon: ShoppingCart, label: "New order", onClick: () => router.push(`/purchases/order-guides?vendor=${v.id}`) },
    isActive(v) && can(role, "payouts.handOut") && { icon: HandCoins, label: "Send cash", onClick: () => setSendCash(true) },
  ].filter(Boolean);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      title={v.name || "Vendor"}
      description={[v.code, v.termsDays != null && v.termsDays !== "" ? `pays in ${v.termsDays} days` : null].filter(Boolean).join(" · ") || undefined}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
          {figures.map((f) => (
            <div key={f.label} className="bg-surface p-3">
              <p className="text-[11px] font-semibold text-muted">{f.label}</p>
              <p className={cn("mt-0.5 truncate text-base font-bold tabular-nums", f.tone || "text-fg")}>{f.value}</p>
            </div>
          ))}
        </div>
        {dues?.overdue > 0 ? (
          <p className="-mt-2 rounded-xl bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
            {money(dues.overdue)} overdue — {dues.overdueBills} bill{dues.overdueBills === 1 ? "" : "s"}, the oldest {dues.oldestLate} day{dues.oldestLate === 1 ? "" : "s"} past its due date
          </p>
        ) : dues?.dueWeek > 0 ? (
          <p className="-mt-2 rounded-xl bg-warning-soft px-3 py-2 text-sm font-medium text-fg">
            {money(dues.dueWeek)} due this week — next on {niceDate(dues.nextDue)}
          </p>
        ) : null}
        {!isActive(v) && <p className="-mt-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">Put away — kept with its bills, not offered for new bills, orders or pay-outs.</p>}

        {actions.length > 0 && (
          <div className={cn("grid gap-2", actions.length >= 5 ? "grid-cols-5" : actions.length === 4 ? "grid-cols-4" : "grid-cols-3")}>
            {actions.map((a) => (
              <Action key={a.label} {...a} />
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* six tabs: they scroll sideways on a phone */}
          <div ref={tabsRef} className="-mx-1 w-full max-w-full overflow-x-auto px-1 [scrollbar-width:none]">
            <Tabs
              size="sm"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "owed", label: "Owed", icon: CircleDollarSign },
                { value: "paid", label: "Paid", icon: ReceiptText },
                { value: "orders", label: "Orders", icon: ClipboardList },
                { value: "items", label: "Items", icon: Package },
                { value: "statement", label: "Statement", icon: ScrollText },
                { value: "details", label: "Details", icon: Info },
              ]}
            />
          </div>
          <div className="flex gap-1.5">
            <ExportVendorOverviewBtn companyId={companyId} branchId={branchId} vendor={v} />
            {onEdit && (
              <Button size="sm" variant="secondary" icon={Pencil} onClick={() => onEdit(v)}>
                Edit
              </Button>
            )}
          </div>
        </div>

        {tab === "owed" && <VendorUnpaidBills companyId={companyId} branchId={branchId} vendorId={v.id} />}
        {tab === "paid" && <VendorPaidBills companyId={companyId} branchId={branchId} vendorId={v.id} />}
        {tab === "orders" && <VendorOrders companyId={companyId} branchId={branchId} vendorId={v.id} />}
        {tab === "items" && <VendorItems companyId={companyId} branchId={branchId} vendorId={v.id} />}
        {tab === "statement" && <VendorStatement companyId={companyId} branchId={branchId} vendor={v} />}
        {tab === "details" && (
          <div className="space-y-5">
            <Group title="Paying them">
              <Line label="Pays in">{v.termsDays != null && v.termsDays !== "" ? `${v.termsDays} days` : null}</Line>
              <Line label="Delivers in">{v.leadDays != null && v.leadDays !== "" ? `${v.leadDays} day${Number(v.leadDays) === 1 ? "" : "s"} after the order` : null}</Line>
              <Line label="Unpaid bills allowed">{v.maxOpenBills ? v.maxOpenBills : "No limit"}</Line>
              <Line label="Bank">{v.bankName}</Line>
              <Line label="Account number" mono>
                {v.bankAccountNumber}
              </Line>
              <Line label="Tax number">{v.taxNumber}</Line>
              <Line label="Registration (SSM)">{v.registrationNumber}</Line>
            </Group>
            <Group title="Contact">
              <Line label="Person in charge">{v.ownerName}</Line>
              <Line label="Phone">{v.phone && <a href={`tel:${v.phone}`} className="text-brand hover:underline">{v.phone}</a>}</Line>
              <Line label="Email">{v.email && <a href={`mailto:${v.email}`} className="text-brand hover:underline">{v.email}</a>}</Line>
              <Line label="Enquiries">{v.enquiriesEmail}</Line>
              <Line label="Website">
                {v.website && (
                  <a href={/^https?:\/\//i.test(v.website) ? v.website : `https://${v.website}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                    {v.website}
                  </a>
                )}
              </Line>
              <Line label="Address">{v.address && <span className="whitespace-pre-wrap">{v.address}</span>}</Line>
            </Group>
            <div className="flex flex-wrap gap-2">
              {onSetActive &&
                (isActive(v) ? (
                  <Button variant="secondary" icon={Archive} onClick={() => onSetActive(v, false)}>
                    Put away (no longer used)
                  </Button>
                ) : (
                  <Button variant="secondary" icon={ArchiveRestore} onClick={() => onSetActive(v, true)}>
                    Use again
                  </Button>
                ))}
              {/* only a vendor with no bills can go for good; one with history is put away */}
              {onDelete && removable(v) && (
                <Button variant="ghost" icon={Trash2} className="text-danger hover:bg-danger-soft" onClick={() => onDelete(v)}>
                  Delete this vendor
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
      <HandOutSheet open={!!cashPreset} onClose={() => setSendCash(false)} companyId={companyId} branchId={branchId} user={user} preset={cashPreset} />
    </Sheet>
  );
}
