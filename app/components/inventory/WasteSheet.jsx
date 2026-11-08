"use client";
// Thrown away (8 Nov): what, how much, why. It comes off the stock straight
// away and shows apart in what was used, so waste can be told from use.
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import Sheet from "@/app/components/purchases/Sheet";
import { Chip } from "@/app/components/entry/Choices";
import { DatePicker, Field, Textarea, cn } from "@/app/components/ui";
import { WASTE_REASONS, qtyText, wasteProblems } from "@/lib/inventory/model";

export default function WasteSheet({ open, rows, start, today, onClose, onSave, busy }) {
  const [form, setForm] = useState({ key: "", qty: "", reason: "", note: "", date: today });
  const [errors, setErrors] = useState({});
  const [find, setFind] = useState("");
  // each time it opens: fresh, on the item it was opened from (if any)
  useEffect(() => {
    if (!open) return;
    setForm({ key: start?.key || "", qty: "", reason: "", note: "", date: today });
    setErrors({});
    setFind("");
  }, [open, start?.key, today]);
  const row = rows.find((r) => r.key === form.key) || null;
  const shown = useMemo(() => {
    const q = find.trim().toLowerCase();
    return rows.filter((r) => !q || r.name.toLowerCase().includes(q)).slice(0, 30);
  }, [rows, find]);

  const close = () => onClose();
  const save = async () => {
    const e = wasteProblems(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (await onSave({ row, qty: form.qty, reason: form.reason, note: form.note, date: form.date })) close();
  };

  return (
    <Sheet
      open={open}
      title="Thrown away"
      subtitle={row ? `${row.name} · ${qtyText(row.onHand, row.unit)} in stock` : "What was thrown away?"}
      onClose={close}
      maxWidth="max-w-xl"
      footer={
        <button onClick={save} disabled={busy} className="min-h-[52px] w-full rounded-2xl bg-brand text-base font-bold text-brand-fg transition-colors active:brightness-95 disabled:opacity-40">
          {busy ? "Saving…" : "Save"}
        </button>
      }
    >
      <div className="space-y-4">
        {!row ? (
          <Field label="Item" error={errors.item}>
            {() => (
              <div className="space-y-2">
                <label className="flex min-h-[48px] items-center gap-2 rounded-2xl border border-line bg-surface-2/60 px-3 focus-within:border-brand">
                  <Search className="size-4 text-subtle" />
                  <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find an item" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
                </label>
                <div className="max-h-64 space-y-1.5 overflow-y-auto">
                  {shown.map((r) => (
                    <button key={r.key} type="button" onClick={() => setForm({ ...form, key: r.key })} className="flex w-full items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5 text-left text-sm">
                      <span className="min-w-0 truncate font-medium text-fg">{r.name}</span>
                      <span className="shrink-0 text-xs text-muted">{qtyText(r.onHand, r.unit)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Field>
        ) : (
          <button type="button" onClick={() => setForm({ ...form, key: "" })} className="text-sm font-semibold text-brand">
            Another item
          </button>
        )}

        <Field label={`How much${row?.unit ? ` (${row.unit})` : ""}`} error={errors.qty}>
          {({ id }) => (
            <input
              id={id}
              inputMode="decimal"
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value.replace(/[^\d.]/g, "") })}
              className={cn("h-12 w-full rounded-2xl border bg-surface px-4 text-lg font-semibold tabular-nums outline-none focus:border-brand", errors.qty ? "border-danger" : "border-line")}
            />
          )}
        </Field>

        <Field label="Why" error={errors.reason}>
          {() => (
            <div className="flex flex-wrap gap-1.5">
              {WASTE_REASONS.map((r) => (
                <Chip key={r} on={form.reason === r} onClick={() => setForm({ ...form, reason: r })}>
                  {r}
                </Chip>
              ))}
            </div>
          )}
        </Field>

        <Field label="Day" error={errors.date}>
          {() => <DatePicker value={form.date} onChange={(date) => setForm({ ...form, date })} />}
        </Field>

        <Field label="Note (optional)">{({ id }) => <Textarea id={id} rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />}</Field>
      </div>
    </Sheet>
  );
}
