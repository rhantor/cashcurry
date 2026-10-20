"use client";
// The audit log screen, for the whole company (/audit-log) and for one branch
// (/branch-audit): filters, the list, and a sheet that shows one entry in
// words — what record it was, who, when, and what changed.
import { useMemo, useState } from "react";
import { ArrowRight, ClipboardList, Search } from "lucide-react";
import { Badge, EmptyState, Input, Select, Sheet, SkeletonRows } from "@/app/components/ui";
import Pagination from "@/app/components/common/Pagination";
import { AREA_LABELS } from "@/lib/audit/normalize";
import { changeRows, summaryOf } from "@/lib/audit/describe";

const PAGE_SIZE = 15;

const localISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgoISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localISO(d);
};

/** The period picked on the screen and the dates to ask the database for. */
export function useAuditPeriod() {
  const [period, setPeriod] = useState("last7days");
  const [range, setRange] = useState({ from: daysAgoISO(7), to: localISO() });
  const { startDate, endDate } = useMemo(() => {
    const today = localISO();
    if (period === "last7days") return { startDate: daysAgoISO(7), endDate: today };
    if (period === "monthly") return { startDate: today.slice(0, 8) + "01", endDate: today };
    if (period === "range" && range.from && range.to) return { startDate: range.from, endDate: range.to };
    return { startDate: null, endDate: null };
  }, [period, range]);
  return { period, setPeriod, range, setRange, startDate, endDate };
}

const VERB = { created: "Added", updated: "Changed", deleted: "Deleted" };
const TONE = { created: "brand", updated: "warning", deleted: "danger" };
const SINGULAR = { sales: "Sale", costs: "Cost", salaries: "Salary", loans: "Loan", vendorBills: "Vendor bill", advances: "Advance", payroll: "Payroll", staff: "Staff", leave: "Leave", requests: "Request" };

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const verbOf = (log) => (log.did ? log.did : VERB[log.action] || cap(log.what) || "Event");
const toneOf = (log) => (log.did === "Rejected" ? "danger" : log.did === "Approved" ? "success" : TONE[log.action] || "info");
const timeText = (iso) =>
  iso ? new Date(iso).toLocaleString("en-MY", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "—";

function Value({ v, tone }) {
  if (!v) return null;
  if (v.links?.length)
    return (
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        {v.links.map((l) => (
          <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="font-medium text-brand underline underline-offset-2">
            {l.label}
          </a>
        ))}
      </span>
    );
  return <span className={v.empty ? "italic text-subtle" : tone === "old" ? "text-muted line-through decoration-danger/60" : "text-fg"}>{v.text}</span>;
}

/** One entry, in words. */
function EntrySheet({ log, onClose, currency, branchLabel }) {
  const rows = useMemo(() => (log ? changeRows(log, { currency }) : []), [log, currency]);
  if (!log) return <Sheet open={false} onClose={onClose} />;
  const isUpdate = log.action === "updated" && log.before && log.after;
  const summary = summaryOf(log, { currency });
  const area = SINGULAR[log.collection] || "Record";
  return (
    <Sheet
      open
      onClose={onClose}
      size="lg"
      title={log.before || log.after ? `${area} ${verbOf(log).toLowerCase()}` : verbOf(log)}
      description={[log.actorName, timeText(log.timestamp), branchLabel].filter(Boolean).join(" · ")}
    >
      <div className="space-y-5">
        {summary && <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm font-medium text-fg">{summary}</p>}
        {!log.before && !log.after ? (
          !summary && <p className="text-sm text-subtle">No details were saved with this entry.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-subtle">Saved again with nothing changed.</p>
        ) : (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {isUpdate ? "What changed" : log.action === "deleted" ? "What it had" : "What was saved"}
            </h3>
            <dl className="divide-y divide-line rounded-xl border border-line">
              {rows.map((r) => (
                <div key={r.label} className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[11rem_1fr] sm:gap-4">
                  <dt className="text-muted">{r.label}</dt>
                  <dd className="min-w-0 whitespace-pre-line break-words">
                    {isUpdate ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <Value v={r.before} tone="old" />
                        <ArrowRight className="size-3.5 shrink-0 text-subtle" aria-label="changed to" />
                        <Value v={r.after} />
                      </span>
                    ) : (
                      <Value v={r.after || r.before} />
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/**
 * logs: normalized entries (lib/audit/normalize). branchName(id) → name, when
 * the list covers more than one branch.
 */
export default function AuditLogView({ title, subtitle, logs, isLoading, isError, periodState, branchName, currency }) {
  const { period, setPeriod, range, setRange } = periodState;
  const [action, setAction] = useState("all");
  const [area, setArea] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);

  // only the kinds that are in the list
  const areas = useMemo(() => [...new Set(logs.map((l) => l.collection).filter(Boolean))].sort(), [logs]);
  const verbs = useMemo(() => [...new Set(logs.map(verbOf))].sort(), [logs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (action !== "all" && verbOf(l) !== action) return false;
      if (area !== "all" && l.collection !== area) return false;
      if (q && !`${l.actorName} ${summaryOf(l, { currency })} ${l.details || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, action, area, search, currency]);

  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const reset = (fn) => (e) => {
    fn(e.target.value);
    setPage(1);
  };
  const branchOf = (l) => (branchName ? (l.branchId ? branchName(l.branchId) : "Company") : "");

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">{title}</h1>
        <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm [&_select]:w-auto [&_select]:min-w-40">
        <Select aria-label="Period" value={period} onChange={reset(setPeriod)} className="w-auto">
          <option value="last7days">Last 7 days</option>
          <option value="monthly">This month</option>
          <option value="range">Pick dates</option>
          <option value="all">All time</option>
        </Select>
        {period === "range" && (
          <span className="flex items-center gap-2">
            <Input type="date" aria-label="From" value={range.from} onChange={(e) => setRange((p) => ({ ...p, from: e.target.value }))} className="w-auto" />
            <span className="text-sm text-subtle">to</span>
            <Input type="date" aria-label="To" value={range.to} onChange={(e) => setRange((p) => ({ ...p, to: e.target.value }))} className="w-auto" />
          </span>
        )}
        <Select aria-label="What was done" value={action} onChange={reset(setAction)} className="w-auto">
          <option value="all">Everything done</option>
          {verbs.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
        <Select aria-label="Type" value={area} onChange={reset(setArea)} className="w-auto">
          <option value="all">All types</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {AREA_LABELS[a] || a}
            </option>
          ))}
        </Select>
        <span className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input type="search" aria-label="Search" placeholder="Search name or record…" value={search} onChange={reset(setSearch)} className="w-56 pl-9" />
        </span>
        <span className="ml-auto text-xs text-subtle">
          {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      <div className="@container overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
        {isLoading ? (
          <div className="p-4">
            <SkeletonRows rows={6} />
          </div>
        ) : isError ? (
          <p className="p-10 text-center text-sm text-danger">The audit log could not be loaded. You may not have access to it.</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nothing here for these filters" description="Try a longer period or clear the filters." />
        ) : (
          <>
            {/* narrow (phone, or beside the menu on a small laptop): one card per entry */}
            <ul className="divide-y divide-line @4xl:hidden">
              {shown.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => setOpen(l)} className="flex w-full flex-col gap-1.5 px-4 py-3 text-left hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={toneOf(l)}>{verbOf(l)}</Badge>
                      {l.collection && <Badge>{AREA_LABELS[l.collection] || l.collection}</Badge>}
                      <span className="ml-auto text-xs text-subtle">{timeText(l.timestamp)}</span>
                    </span>
                    <span className="text-sm text-fg">{summaryOf(l, { currency }) || <span className="text-subtle">No details</span>}</span>
                    <span className="text-xs text-muted">{[l.actorName, branchOf(l)].filter(Boolean).join(" · ")}</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto @4xl:block">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2/60 text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3 font-semibold">When</th>
                    <th className="px-4 py-3 font-semibold">Who</th>
                    <th className="px-4 py-3 font-semibold">Did</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    {branchName && <th className="px-4 py-3 font-semibold">Branch</th>}
                    <th className="px-4 py-3 font-semibold">Record</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shown.map((l) => (
                    <tr key={l.id} onClick={() => setOpen(l)} className="cursor-pointer hover:bg-surface-2">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{timeText(l.timestamp)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-fg">{l.actorName}</td>
                      <td className="px-4 py-3">
                        <Badge tone={toneOf(l)}>{verbOf(l)}</Badge>
                      </td>
                      <td className="px-4 py-3">{l.collection ? <Badge>{AREA_LABELS[l.collection] || l.collection}</Badge> : <span className="text-subtle">—</span>}</td>
                      {branchName && <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{branchOf(l)}</td>}
                      <td className="max-w-md px-4 py-3">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(l); }} className="flex w-full items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-ring)] rounded">
                          <span className="min-w-0 flex-1 truncate text-fg">{summaryOf(l, { currency }) || <span className="text-subtle">No details</span>}</span>
                          <span className="shrink-0 text-xs font-medium text-brand">View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {pages > 1 && <Pagination currentPage={page} totalPages={pages} onPageChange={setPage} />}

      <EntrySheet log={open} onClose={() => setOpen(null)} currency={currency} branchLabel={open ? branchOf(open) : ""} />
    </div>
  );
}
