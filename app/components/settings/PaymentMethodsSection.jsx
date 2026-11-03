// Payment methods: how customers pay, each on one row, with what it does on
// Sales Entry and in the books. Replaces the long form of TendersEditor; saves
// the same financeSales.tenders.
import React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button, Card, Input, Switch, cn } from "@/app/components/ui";
import { canEdit } from "./rolePolicy";
import { LockedNote } from "./fields";

const PRESETS = [
  { key: "cash", label: "Cash", banked: false, delivery: false },
  { key: "card", label: "Card", banked: true, delivery: false },
  { key: "qr", label: "QR Code", banked: true, delivery: false },
  { key: "grab", label: "Grab", banked: true, delivery: true },
  { key: "foodpanda", label: "Foodpanda", banked: true, delivery: true },
];
const RULES = [
  { field: "includeInTotal", label: "In total sales" },
  { field: "banked", label: "Goes to bank" },
  { field: "delivery", label: "Delivery app" },
  { field: "requireProof", label: "Photo needed" },
];
const COLS = "sm:grid-cols-[2rem_minmax(0,1fr)_repeat(4,5.25rem)_4.75rem]";

export default function PaymentMethodsSection({ role, value, onChange }) {
  const fin = value || {};
  const tenders = [...(fin.tenders || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const edit = canEdit(role, "financeSales", "tenders");
  const commit = (arr) => onChange({ ...fin, tenders: arr.map((t, i) => ({ ...t, order: i + 1 })) });
  const update = (i, patch) => commit(tenders.map((t, n) => (n === i ? { ...t, ...patch } : t)));
  const remove = (i) => commit(tenders.filter((_, n) => n !== i));
  const move = (i, by) => {
    const arr = [...tenders];
    const [t] = arr.splice(i, 1);
    arr.splice(i + by, 0, t);
    commit(arr);
  };
  const add = (preset) =>
    commit([...tenders, { key: preset?.key || `custom_${Date.now()}`, label: preset?.label || "New method", enabled: true, includeInTotal: true, requireProof: false, banked: !!preset?.banked, delivery: !!preset?.delivery }]);
  const missing = PRESETS.filter((p) => !tenders.some((t) => t.key === p.key));

  return (
    <>
      <Card className="overflow-hidden p-0">
        <div className={cn("hidden items-end gap-2 bg-surface-2 px-5 py-3 text-xs font-semibold text-muted sm:grid", COLS)}>
          <span className="col-span-2">Method</span>
          {RULES.map((r) => (
            <span key={r.field} className="text-center">{r.label}</span>
          ))}
          <span />
        </div>
        <ul className="divide-y divide-line">
          {tenders.map((t, i) => (
            <li key={t.key} className={cn("grid items-center gap-x-2 gap-y-3 px-4 py-3 sm:px-5", COLS, t.enabled === false && "bg-surface-2/50")}>
              <span className="flex items-center gap-2 sm:contents">
                <Switch checked={t.enabled !== false} disabled={!edit} onChange={(on) => update(i, { enabled: on })} aria-label={`Use ${t.label}`} />
                <Input value={t.label ?? ""} disabled={!edit} onChange={(e) => update(i, { label: e.target.value })} aria-label="Method name" className="min-w-0 flex-1 font-semibold disabled:opacity-100" />
              </span>
              <span className="grid grid-cols-2 gap-2 sm:contents">
                {RULES.map((r) => (
                  <label key={r.field} className="flex items-center gap-2 text-xs text-muted sm:justify-center">
                    <input
                      type="checkbox"
                      checked={r.field === "includeInTotal" ? t[r.field] !== false : !!t[r.field]}
                      disabled={!edit}
                      onChange={(e) => update(i, { [r.field]: e.target.checked })}
                      className="size-[18px] accent-[var(--cc-brand-hover)]"
                    />
                    <span className="sm:sr-only">{r.label}</span>
                  </label>
                ))}
              </span>
              {edit && (
                <span className="flex justify-end gap-0.5">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${t.label} up`} className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-30">
                    <ArrowUp className="size-4" />
                  </button>
                  <button type="button" disabled={i === tenders.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${t.label} down`} className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-30">
                    <ArrowDown className="size-4" />
                  </button>
                  <button type="button" onClick={() => remove(i)} aria-label={`Remove ${t.label}`} className="rounded-lg p-1.5 text-muted transition hover:bg-danger-soft hover:text-danger">
                    <Trash2 className="size-4" />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
        {!edit && <LockedNote>Only the owner, super admin, branch admin, GM or manager can change these.</LockedNote>}
      </Card>
      {edit && (
        <div className="flex flex-wrap items-center gap-2">
          {missing.map((p) => (
            <Button key={p.key} size="sm" variant="secondary" icon={Plus} onClick={() => add(p)}>{p.label}</Button>
          ))}
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => add()}>Another method</Button>
        </div>
      )}
      <p className="text-[13px] text-muted">The order here is the order on Sales Entry. A method switched off stays in old records but isn&apos;t offered for new sales.</p>
    </>
  );
}
