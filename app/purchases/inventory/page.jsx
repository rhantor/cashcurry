"use client";
// Purchases → Inventory (owner, 8 Nov 2026): what is in stock at this branch.
// Goods come in on supplier bills (a purchase order received, a New Vendor
// Bill, a pay-out bill), someone counts each supplier's goods on the count
// day, waste is written off, and what was used between two counts shows
// week by week. The working-out: lib/inventory/model.js.
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertTriangle, Boxes, ClipboardCheck, Search, Settings2, Trash2 } from "lucide-react";
import Sheet from "@/app/components/purchases/Sheet";
import ConfirmSheet from "@/app/components/purchases/ConfirmSheet";
import useToast from "@/app/components/purchases/useToast";
import CountSheet from "@/app/components/inventory/CountSheet";
import WasteSheet from "@/app/components/inventory/WasteSheet";
import { DatePicker, Field, Select, Skeleton, Tabs, cn } from "@/app/components/ui";
import useResolvedCompanyBranch from "@/app/hooks/useResolvedCompanyBranch";
import { useBusinessToday } from "@/app/hooks/useRegion";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { can } from "@/lib/authz/permissions";
import { DAY_NAMES, qtyText, shift, weekday } from "@/lib/inventory/model";
import { addCount, addWaste, deleteCount, deleteWaste, saveStockSettings, useInventory } from "@/lib/inventory/client";

const dayText = (d) => (d ? format(parseISO(d), "EEE d MMM") : "—");
const TABS = [
  { value: "stock", label: "In stock" },
  { value: "used", label: "Used" },
  { value: "log", label: "Counts & waste" },
];

/** The next count day on or after today. */
const nextCountDay = (today, countDay) => shift(today, (countDay - weekday(today) + 7) % 7);

export default function InventoryPage() {
  const { ready, companyId, branchId, user } = useResolvedCompanyBranch();
  const today = useBusinessToday();
  const currency = useCurrency();
  const money = (n) => formatMoney(n, currency);
  const { toastOk, toastError } = useToast();
  const { data, loading, error, reload } = useInventory(ready ? companyId : null, ready ? branchId : null, today);
  const manages = can(user?.role, "inventory.manage");

  const [tab, setTab] = useState("stock");
  const [find, setFind] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [counting, setCounting] = useState(false);
  const [counted, setCounted] = useState(null); // the count just saved: { vendorName, lines }
  const [wasting, setWasting] = useState(null); // { key? }
  const [openKey, setOpenKey] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null); // { kind, item }

  const rows = useMemo(() => Object.values(data?.stock || {}).sort((a, b) => a.name.localeCompare(b.name)), [data]);
  const low = rows.filter((r) => r.low);
  const open = openKey ? data?.stock?.[openKey] : null;

  // stock grouped by supplier, as counted
  const groups = useMemo(() => {
    const q = find.trim().toLowerCase();
    return (data?.groups || [])
      .map((g) => ({ ...g, items: g.items.filter((r) => (!q || r.name.toLowerCase().includes(q)) && (!lowOnly || r.low)) }))
      .filter((g) => g.items.length);
  }, [data, find, lowOnly]);

  const countDay = data?.countDay ?? 6;
  const isCountDay = today && weekday(today) === countDay;
  const toCount = (data?.groups || []).filter((g) => g.vendorId && g.items.length);
  const countedToday = toCount.filter((g) => g.countedToday).length;

  const run = async (fn, okText, failText) => {
    setBusy(true);
    try {
      await fn();
      if (okText) toastOk(okText);
      await reload();
      return true;
    } catch (e) {
      console.error(e);
      toastError(failText);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveCount = async ({ vendorId, vendorName, lines }) => {
    const ok = await run(() => addCount(companyId, branchId, { date: today, vendorId, vendorName, lines }, user), null, "Could not save the count.");
    if (ok) setCounted({ vendorName: vendorName || "Other", lines });
    return ok;
  };
  const saveWaste = (w) => run(() => addWaste(companyId, branchId, w, user), `${w.row.name}: ${qtyText(w.qty, w.row.unit)} written off.`, "Could not save it.");
  const start = (startDate) => run(() => saveStockSettings(companyId, branchId, { startDate, countDay }, user), "Stock starts today. Count each supplier's goods to begin.", "Could not start it.");
  const setMin = (key, qty) => run(() => saveStockSettings(companyId, branchId, { min: { [key]: Number(qty) || 0 } }, user), "Minimum saved.", "Could not save it.");
  const confirmDelete = async () => {
    const { kind, item } = toDelete;
    const ok = await run(() => (kind === "count" ? deleteCount(companyId, branchId, item.id) : deleteWaste(companyId, branchId, item.id)), kind === "count" ? "Count removed." : "Waste removed.", "Could not remove it.");
    if (ok) setToDelete(null);
  };

  if (!ready || (loading && !data)) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;

  if (error && !data)
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <p className="font-semibold text-fg">{error}</p>
        <button onClick={reload} className="mt-3 min-h-[44px] rounded-xl bg-surface-2 px-4 text-sm font-semibold text-fg">
          Try again
        </button>
      </div>
    );

  if (!data?.started) return <StartCard manages={manages} today={today} busy={busy} onStart={start} />;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 pb-24">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-fg">Inventory</h1>
          <p className="mt-0.5 text-sm text-muted">
            Counted on {DAY_NAMES[countDay]}s · since {dayText(data.startDate)}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setWasting({})} className="flex min-h-[48px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-surface-2 px-3 font-semibold text-fg sm:flex-none sm:px-4">
            <Trash2 className="size-4" /> Waste
          </button>
          <button onClick={() => setCounting(true)} className="flex min-h-[48px] flex-[1.4] items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-brand px-3 font-semibold text-brand-fg active:brightness-95 sm:flex-none sm:px-5">
            <ClipboardCheck className="size-5" /> Count stock
          </button>
          {manages && (
            <button onClick={() => setSettingsOpen(true)} aria-label="Inventory settings" className="flex min-h-[48px] w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-fg">
              <Settings2 className="size-5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setLowOnly(!lowOnly)} className={cn("rounded-2xl border bg-surface p-4 text-left", lowOnly ? "border-brand" : "border-line")}>
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Running low</p>
          <p className={cn("mt-1 text-2xl font-bold tabular-nums", low.length ? "text-danger" : "text-fg")}>{low.length}</p>
          <p className="text-xs text-muted">Under the minimum you set</p>
        </button>
        <div className={cn("rounded-2xl border p-4", isCountDay && countedToday < toCount.length ? "border-warning/30 bg-warning-soft" : "border-line bg-surface")}>
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{isCountDay ? "Count day" : "Next count"}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-fg">{isCountDay ? `${countedToday}/${toCount.length}` : dayText(nextCountDay(today, countDay))}</p>
          <p className="text-xs text-muted">{isCountDay ? "Suppliers counted today" : DAY_NAMES[countDay]}</p>
        </div>
      </div>

      <div className="overflow-x-auto [scrollbar-width:none]">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === "stock" && (
        <div className="space-y-4">
          <label className="flex min-h-[48px] items-center gap-2 rounded-2xl border border-line bg-surface px-3 focus-within:border-brand">
            <Search className="size-4 text-subtle" />
            <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find an item" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
          </label>
          {groups.map((g) => (
            <section key={g.vendorId || "other"} className="space-y-2">
              <h2 className="px-1 text-sm font-semibold text-fg">{g.vendorName}</h2>
              <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {g.items.map((r) => (
                  <StockRow key={r.key} r={r} onOpen={() => setOpenKey(r.key)} />
                ))}
              </div>
            </section>
          ))}
          {!groups.length && (
            <div className="rounded-3xl border border-line bg-surface px-6 py-14 text-center">
              <Boxes className="mx-auto mb-3 size-10 text-subtle" />
              <p className="font-bold text-fg">{rows.length ? "Nothing here" : "Nothing in stock yet"}</p>
              {!rows.length && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Count each supplier&apos;s goods, or receive an order: stock shows up here.</p>}
            </div>
          )}
        </div>
      )}

      {tab === "used" && <UsedTab periods={data.periods || []} money={money} />}

      {tab === "log" && <LogTab counts={data.counts || []} waste={data.waste || []} manages={manages} onDelete={setToDelete} />}

      <CountSheet open={counting} data={data} busy={busy} onClose={() => setCounting(false)} onSave={saveCount} />
      <WasteSheet open={!!wasting} rows={rows} start={wasting?.key ? data.stock[wasting.key] : null} today={today} busy={busy} onClose={() => setWasting(null)} onSave={saveWaste} />

      {/* the count just saved: what the app thought against what was there */}
      <Sheet open={!!counted} title={`Counted · ${counted?.vendorName || ""}`} subtitle="What the app had, and what you found" onClose={() => setCounted(null)} maxWidth="max-w-xl">
        {counted && (
          <ul className="divide-y divide-line">
            {counted.lines.map((l) => {
              const diff = Math.round((l.qty - (l.was || 0)) * 1000) / 1000;
              return (
                <li key={l.itemId || l.name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate font-medium text-fg">{l.name}</span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="font-semibold text-fg">{qtyText(l.qty, l.unit)}</span>
                    <span className={cn("ml-2 text-xs", diff < 0 ? "text-danger" : diff > 0 ? "text-success" : "text-muted")}>{diff === 0 ? "as expected" : `${diff > 0 ? "+" : ""}${qtyText(diff, l.unit)} vs ${qtyText(l.was || 0, "")}`}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>

      <ItemSheet r={open} manages={manages} busy={busy} periods={(data.periods || []).filter((p) => p.key === openKey)} money={money} onClose={() => setOpenKey(null)} onWaste={() => {
          setWasting({ key: openKey });
          setOpenKey(null);
        }} onMin={(q) => setMin(openKey, q)} />

      <SettingsSheet open={settingsOpen} data={data} today={today} busy={busy} onClose={() => setSettingsOpen(false)} onSave={(f) => run(() => saveStockSettings(companyId, branchId, f, user), "Saved.", "Could not save it.").then((ok) => ok && setSettingsOpen(false))} />

      <ConfirmSheet
        open={!!toDelete}
        title={toDelete?.kind === "count" ? "Remove this count?" : "Remove this waste?"}
        message={toDelete?.kind === "count" ? "Stock goes back to the count before it. Only do this for a count made by mistake." : "It goes back into stock."}
        confirmLabel="Remove"
        tone="danger"
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}

function StockRow({ r, onOpen }) {
  const sub = r.counted ? `Counted ${qtyText(r.counted.qty, r.unit)} ${dayText(r.counted.date)}${r.inSince ? ` · +${qtyText(r.inSince, "")} in` : ""}${r.wasteSince ? ` · −${qtyText(r.wasteSince, "")} waste` : ""}` : `Not counted yet${r.inSince ? ` · ${qtyText(r.inSince, r.unit)} came in` : ""}`;
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/60">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-fg">{r.name}</span>
        <span className="block truncate text-xs text-muted">{sub}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className={cn("block font-bold tabular-nums", r.low || r.short ? "text-danger" : "text-fg")}>{qtyText(Math.max(0, r.onHand), r.unit)}</span>
        {r.short ? <span className="block text-[11px] font-semibold text-danger">Count again</span> : r.low ? <span className="block text-[11px] font-semibold text-danger">Low · min {qtyText(r.min, "")}</span> : null}
      </span>
    </button>
  );
}

function StartCard({ manages, today, busy, onStart }) {
  const [date, setDate] = useState(today);
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-8">
      <Boxes className="size-10 text-brand" />
      <h1 className="text-2xl font-bold tracking-tight text-fg">Keep track of stock</h1>
      <ul className="space-y-2 text-sm text-muted">
        <li>• Goods you receive on a purchase order, a vendor bill or a pay-out bill are added.</li>
        <li>• On the count day, someone counts each supplier&apos;s goods on the phone. The count sets the stock.</li>
        <li>• Waste is written off, and you see what each week used, and what it cost.</li>
      </ul>
      {manages ? (
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <Field label="Start from">{() => <DatePicker value={date} onChange={setDate} />}</Field>
          <p className="text-xs text-muted">Goods received from this day count as stock. Then do a first count of what is already on the shelves.</p>
          <button onClick={() => onStart(date)} disabled={busy || !date} className="min-h-[52px] w-full rounded-2xl bg-brand text-base font-bold text-brand-fg active:brightness-95 disabled:opacity-40">
            {busy ? "Starting…" : "Start keeping stock"}
          </button>
        </div>
      ) : (
        <p className="rounded-2xl bg-surface-2 p-4 text-sm text-fg">A manager starts it for the branch. Ask them to open Purchases → Inventory.</p>
      )}
    </div>
  );
}

function ItemSheet({ r, manages, busy, periods, money, onClose, onWaste, onMin }) {
  const [min, setMin] = useState("");
  const [seen, setSeen] = useState(null);
  if (r && r.key !== seen) {
    setSeen(r.key);
    setMin(r.min ? String(r.min) : "");
  }
  if (!r && seen) setSeen(null);
  return (
    <Sheet open={!!r} title={r?.name || ""} subtitle={r ? `${qtyText(Math.max(0, r.onHand), r.unit)} in stock` : ""} onClose={onClose} maxWidth="max-w-xl">
      {r && (
        <div className="space-y-4">
          {r.short && (
            <p className="flex items-start gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> More went out than came in since the last count ({qtyText(r.onHand, r.unit)}). Count it again.
            </p>
          )}
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-subtle">Last counted</dt>
              <dd className="font-medium text-fg">{r.counted ? `${qtyText(r.counted.qty, r.unit)} · ${dayText(r.counted.date)}` : "Not yet"}</dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">Came in since</dt>
              <dd className="font-medium text-fg">{qtyText(r.inSince, r.unit)}</dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">Thrown away since</dt>
              <dd className="font-medium text-fg">{qtyText(r.wasteSince, r.unit)}</dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">Last bought</dt>
              <dd className="font-medium text-fg">{r.lastIn ? `${qtyText(r.lastIn.qty, r.unit)} · ${dayText(r.lastIn.date)}` : "—"}</dd>
            </div>
          </dl>

          {manages ? (
            <Field label={`Minimum to keep${r.unit ? ` (${r.unit})` : ""}`} hint="Shown as low under this. Leave empty for none.">
              {({ id }) => (
                <div className="flex gap-2">
                  <input id={id} inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value.replace(/[^\d.]/g, ""))} className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-4 text-lg font-semibold tabular-nums outline-none focus:border-brand" />
                  <button onClick={() => onMin(min)} disabled={busy || String(r.min || "") === min} className="min-h-[48px] rounded-2xl bg-brand px-5 font-semibold text-brand-fg disabled:opacity-40">
                    Save
                  </button>
                </div>
              )}
            </Field>
          ) : r.min ? (
            <p className="text-sm text-muted">Minimum to keep: {qtyText(r.min, r.unit)}</p>
          ) : null}

          {periods.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">Used, count to count</p>
              <ul className="space-y-1.5 text-sm">
                {periods.map((p) => (
                  <li key={p.to} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
                    <span className="text-muted">
                      {dayText(p.from)} → {dayText(p.to)}
                    </span>
                    <span className="text-right font-semibold tabular-nums text-fg">
                      {qtyText(p.used, p.unit)}
                      {p.cost > 0 && <span className="ml-2 text-xs font-normal text-muted">{money(p.cost)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button onClick={onWaste} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-surface-2 font-semibold text-fg">
            <Trash2 className="size-4" /> Thrown away
          </button>
        </div>
      )}
    </Sheet>
  );
}

/** What was used, by the count that closed it ("week to Sat 21 Nov"), with the cost. */
function UsedTab({ periods, money }) {
  const byEnd = useMemo(() => {
    const m = new Map();
    for (const p of periods) {
      if (!m.has(p.to)) m.set(p.to, []);
      m.get(p.to).push(p);
    }
    // the one before, per item, for a change against it
    const prev = (p) => periods.find((x) => x.key === p.key && x.to < p.to);
    return [...m.entries()].map(([to, list]) => ({
      to,
      list: list.map((p) => {
        const b = prev(p);
        const change = b && b.used > 0 ? Math.round(((p.used - b.used) / b.used) * 100) : null;
        return { ...p, change };
      }),
      cost: list.reduce((n, p) => n + p.cost, 0),
      waste: list.reduce((n, p) => n + p.waste * p.price, 0),
    }));
  }, [periods]);

  if (!byEnd.length)
    return (
      <div className="rounded-3xl border border-line bg-surface px-6 py-14 text-center">
        <ClipboardCheck className="mx-auto mb-3 size-10 text-subtle" />
        <p className="font-bold text-fg">Two counts needed</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">What was used shows once an item has been counted twice: the first count, what came in, less waste, less the second count.</p>
      </div>
    );

  return (
    <div className="space-y-5">
      {byEnd.map((w) => (
        <section key={w.to} className="space-y-2">
          <div className="flex items-end justify-between gap-3 px-1">
            <h2 className="text-sm font-semibold text-fg">Counted {dayText(w.to)}</h2>
            <p className="text-right text-xs text-muted">
              Used <span className="font-semibold text-fg">{money(w.cost)}</span>
              {w.waste > 0 && <span> · waste {money(w.waste)}</span>}
            </p>
          </div>
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {w.list.map((p) => (
              <div key={p.key} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-fg">{p.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {qtyText(p.opening, "")} + {qtyText(p.in, "")} in{p.waste ? ` − ${qtyText(p.waste, "")} waste` : ""} − {qtyText(p.closing, "")} left · since {dayText(p.from)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={cn("block font-bold tabular-nums", p.used < 0 ? "text-danger" : "text-fg")}>{qtyText(p.used, p.unit)}</span>
                  <span className="block text-[11px] text-muted">
                    {p.cost > 0 ? money(p.cost) : ""}
                    {p.change != null && <span className={cn("ml-1 font-semibold", p.change > 0 ? "text-warning" : "text-success")}>{`${p.change > 0 ? "+" : ""}${p.change}%`}</span>}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
      <p className="px-1 text-xs text-muted">A figure below 0 means more was counted than came in: a delivery may be missing from the bills, or a count was wrong.</p>
    </div>
  );
}

function LogTab({ counts, waste, manages, onDelete }) {
  const [openId, setOpenId] = useState(null);
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold text-fg">Counts</h2>
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {counts.map((c) => (
            <div key={c.id}>
              <button type="button" onClick={() => setOpenId(openId === c.id ? null : c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/60">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-fg">{c.vendorName || "Other"}</span>
                  <span className="block truncate text-xs text-muted">
                    {dayText(c.date)} · {c.by?.name || "—"} · {c.lines?.length || 0} items
                  </span>
                </span>
              </button>
              {openId === c.id && (
                <div className="space-y-2 bg-surface-2/50 px-4 py-3">
                  <ul className="space-y-1 text-sm">
                    {(c.lines || []).map((l) => (
                      <li key={l.itemId || l.name} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate text-fg">{l.name}</span>
                        <span className="shrink-0 tabular-nums text-muted">
                          {qtyText(l.qty, l.unit)}
                          {l.was != null && l.was !== l.qty && <span className="ml-1 text-xs">(app had {qtyText(l.was, "")})</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {manages && (
                    <button onClick={() => onDelete({ kind: "count", item: c })} className="text-sm font-semibold text-danger">
                      Remove this count
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {!counts.length && <p className="px-4 py-6 text-sm text-muted">No counts in the last 90 days.</p>}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold text-fg">Thrown away</h2>
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {waste.map((w) => (
            <div key={w.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-fg">
                  {w.name} · {qtyText(w.qty, w.unit)}
                </span>
                <span className="block truncate text-xs text-muted">
                  {dayText(w.date)} · {w.reason}
                  {w.note ? ` · ${w.note}` : ""} · {w.by?.name || "—"}
                </span>
              </span>
              {manages && (
                <button onClick={() => onDelete({ kind: "waste", item: w })} aria-label="Remove" className="flex size-10 shrink-0 items-center justify-center rounded-xl text-subtle hover:bg-danger-soft hover:text-danger">
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
          {!waste.length && <p className="px-4 py-6 text-sm text-muted">Nothing thrown away in the last 90 days.</p>}
        </div>
      </section>
    </div>
  );
}

function SettingsSheet({ open, data, today, busy, onClose, onSave }) {
  const [countDay, setCountDay] = useState(String(data?.countDay ?? 6));
  const [startDate, setStartDate] = useState(data?.startDate || "");
  // what is saved now, each time it opens
  useEffect(() => {
    if (!open) return;
    setCountDay(String(data?.countDay ?? 6));
    setStartDate(data?.startDate || "");
  }, [open, data?.countDay, data?.startDate]);
  return (
    <Sheet
      open={open}
      title="Inventory settings"
      onClose={onClose}
      maxWidth="max-w-md"
      footer={
        <button onClick={() => onSave({ countDay: Number(countDay), startDate })} disabled={busy || !startDate} className="min-h-[52px] w-full rounded-2xl bg-brand text-base font-bold text-brand-fg disabled:opacity-40">
          {busy ? "Saving…" : "Save"}
        </button>
      }
    >
      <div className="space-y-4">
        <Field label="Count day" hint="The day each supplier's goods are counted. Ops reminds on that day.">
          {({ id }) => (
            <Select id={id} value={countDay} onChange={(e) => setCountDay(e.target.value)}>
              {DAY_NAMES.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Stock started" hint="Bills from this day on count as goods in, for anything not counted yet. What has been counted stays as counted.">
          {() => <DatePicker value={startDate} onChange={setStartDate} max={today} />}
        </Field>
      </div>
    </Sheet>
  );
}
