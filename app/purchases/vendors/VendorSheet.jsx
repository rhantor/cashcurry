"use client";
import React, { useEffect, useState } from "react";
import { CircleDollarSign, Info, Pencil, ReceiptText, Trash2 } from "lucide-react";
import { Button, Sheet, Tabs, cn } from "@/app/components/ui";
import { formatMoney } from "@/lib/region/currency";
import useCurrency from "@/app/hooks/useCurrency";
import ExportVendorOverviewBtn from "./ExportVendorOverviewBtn";
import VendorUnpaidBills from "./VendorUnpaidBills";
import VendorPaidBills from "./VendorPaidBills";
import { niceDate } from "./parts";

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

/** One vendor: what is owed and paid, their details, and their bills in this branch. */
export default function VendorSheet({ open, vendor, companyId, branchId, onClose, onEdit, onDelete }) {
  const currency = useCurrency();
  const money = (v) => formatMoney(Number(v ?? 0), currency);
  const [tab, setTab] = useState("owed");
  useEffect(() => {
    if (open) setTab("owed");
  }, [open, vendor?.id]);

  const v = vendor || {};
  const owed = Number(v.currentBalance || 0);
  const figures = [
    { label: "Owed now", value: money(owed), tone: owed > 0 ? "text-danger" : "text-success" },
    { label: "Billed in all", value: money(v.totalBilled) },
    { label: "Paid in all", value: money(v.totalPaid) },
    { label: "Last paid", value: v.lastPaymentDate ? niceDate(v.lastPaymentDate) : "Never" },
  ];

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
        <p className="-mt-3 text-[11px] text-subtle">Totals are for the whole company; the bills below are this branch&apos;s.</p>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "owed", label: "Owed", icon: CircleDollarSign },
              { value: "paid", label: "Paid", icon: ReceiptText },
              { value: "details", label: "Details", icon: Info },
            ]}
          />
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
            {onDelete && (
              <Button variant="ghost" icon={Trash2} className="text-danger hover:bg-danger-soft" onClick={() => onDelete(v)}>
                Delete this vendor
              </Button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
