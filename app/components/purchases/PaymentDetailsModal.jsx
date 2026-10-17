"use client";
import React, { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { ExternalLink, FileText, ReceiptText } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { dayKey } from "@/lib/finance/rules";
import { personName } from "@/lib/people";
import { Badge, Sheet, Skeleton } from "@/app/components/ui";

const METHOD_LABEL = { cash: "Cash", card: "Card", qr: "QR", online: "Online", bank_transfer: "Bank transfer" };
const nice = (k) => (/^\d{4}-\d{2}-\d{2}$/.test(k || "") ? format(parseISO(k), "d MMM yyyy") : k || "—");

/**
 * Fetches invoiceNo and invoiceDate for each billId in the allocations.
 */
async function loadBillInfos({ companyId, branchId, allocations }) {
  const out = [];
  for (const { billId, amount } of allocations || []) {
    try {
      const billRef = doc(
        db,
        "companies",
        companyId,
        "branches",
        branchId,
        "vendorBills",
        billId
      );
      const snap = await getDoc(billRef);
      if (snap.exists()) {
        const b = snap.data();
        out.push({
          billId,
          amount: Number(amount || 0),
          invoiceNo: b?.invoiceNo || "-",
          invoiceDate: b?.invoiceDate || "-",
          vendorName: b?.vendorName || "",
          dueDate: b?.dueDate || "-",
          total: Number(b?.total || 0),
          attachments: b?.attachments || [],
        });
      } else {
        out.push({
          billId,
          amount: Number(amount || 0),
          invoiceNo: "(deleted)",
          invoiceDate: "-",
          vendorName: "",
          dueDate: "-",
          total: 0,
          attachments: [],
        });
      }
    } catch {
      out.push({
        billId,
        amount: Number(amount || 0),
        invoiceNo: "(error)",
        invoiceDate: "-",
        vendorName: "",
        dueDate: "-",
        total: 0,
        attachments: [],
      });
    }
  }
  return out;
}

const Line = ({ label, children }) => (
  <div className="flex items-start justify-between gap-3 py-2 text-sm">
    <span className="text-muted">{label}</span>
    <span className="text-right font-medium text-fg">{children}</span>
  </div>
);

const FileLink = ({ href, children }) => (
  <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
    {children} <ExternalLink className="size-3" />
  </a>
);

/** One vendor payment: how much, from where, and the bills it paid (with their invoices). */
export default function PaymentDetailsModal({ open, onClose, payment, companyId, branchId }) {
  const currency = useCurrency();
  const money = (v) => formatMoney(Number(v ?? 0), currency);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!open || !payment || !companyId || !branchId) return;
      setLoading(true);
      try {
        const details = await loadBillInfos({ companyId, branchId, allocations: payment.allocations || [] });
        if (active) setRows(details);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, payment, companyId, branchId]);

  const p = payment || {};
  const day = p.paymentDate || dayKey(p.createdISO || p.createdAt);
  const front = p.paidFromOffice === "front";
  const files = [...new Set([p.receiptURL, ...(p.attachments || [])].filter(Boolean))];

  return (
    <Sheet open={open} onClose={onClose} title="Vendor payment" description={p.vendorName || ""}>
      <div className="space-y-5">
        <div className="rounded-2xl bg-surface-2/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Paid</p>
          <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-fg">{money(p.total ?? p.totalPaid)}</p>
          <p className="mt-0.5 text-xs text-muted">
            on {nice(day)}
            {p.createdBy && personName(p.createdBy) ? ` · by ${personName(p.createdBy)}` : ""}
          </p>
        </div>

        <div className="divide-y divide-line">
          <Line label="From">
            <Badge tone={front ? "warning" : "info"}>{front ? "Front office" : "Back office"}</Badge>
          </Line>
          <Line label="Method">{METHOD_LABEL[p.paidMethod] || p.paidMethod || "—"}</Line>
          <Line label="Reference">{p.reference || <span className="text-subtle">—</span>}</Line>
          <Line label="Receipt">
            {files.length ? (
              <span className="flex flex-wrap justify-end gap-3">
                {files.map((u, i) => (
                  <FileLink key={u} href={u}>
                    {files.length > 1 ? `File ${i + 1}` : "Open"}
                  </FileLink>
                ))}
              </span>
            ) : (
              <span className="text-subtle">None attached</span>
            )}
          </Line>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
            Bills it paid {rows.length ? `(${rows.length})` : ""}
          </p>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-14" rounded="rounded-xl" />
              <Skeleton className="h-14" rounded="rounded-xl" />
            </div>
          ) : rows.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {rows.map((r) => (
                <li key={r.billId} className="flex items-start gap-3 p-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
                    <FileText className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-fg">{r.invoiceNo}</p>
                    <p className="text-[11px] text-muted">
                      Dated {nice(r.invoiceDate)} · due {nice(r.dueDate)} · bill {money(r.total)}
                    </p>
                    {r.attachments?.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-3">
                        {r.attachments.map((u, i) => (
                          <FileLink key={u} href={u}>
                            {r.attachments.length > 1 ? `Invoice ${i + 1}` : "Invoice"}
                          </FileLink>
                        ))}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-fg">{money(r.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 rounded-xl bg-surface-2/60 px-3 py-3 text-xs text-muted">
              <ReceiptText className="size-4" /> No bills recorded on this payment.
            </p>
          )}
        </div>
      </div>
    </Sheet>
  );
}
