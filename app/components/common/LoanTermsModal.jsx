"use client";
/**
 * LoanTermsModal — lets branchAdmin / manager change the repayment schedule
 * of a staff loan OR advance after it was made: a different amount for a
 * month (optionally carrying the rest to a new month), or moving a month to
 * the next free one. Paid months can't be touched.
 *
 *   <LoanTermsModal type="loan" | "advance" record={doc} saving onClose onSave={async (changes, note) => …} />
 *
 * `changes`: [{ type: "defer", index, month } | { type: "amount", index, amount } | { type: "partial", index, amount, note }]
 */
import React, { useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { CalendarClock, Undo2 } from "lucide-react";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { Badge, Button, Field, Sheet, Switch, Textarea, cn } from "@/app/components/ui";
import MoneyInput from "@/app/components/entry/MoneyInput";

const monthText = (m) => {
  const d = m ? parseISO(`${m}-01`) : null;
  return d && isValid(d) ? format(d, "MMM yyyy") : m || "";
};

export default function LoanTermsModal({ type = "loan", record, onClose, onSave, saving = false }) {
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);
  const installments = record?.installments || [];

  /** Where a moved month would land (mirrors the server): the next month not already taken. */
  function calcDeferTarget(inst) {
    const [y, m] = inst.month.split("-").map(Number);
    const occupied = new Set(installments.map((i) => i.month));
    const d = new Date(y, m, 1);
    let key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    while (occupied.has(key)) {
      d.setMonth(d.getMonth() + 1);
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    return key;
  }

  // Edits per instalment index: { amount?: string, deferred?: boolean, carryOver?: boolean }
  const [edits, setEdits] = useState({});
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const setAmount = (index, val) => setEdits((e) => ({ ...e, [index]: { ...(e[index] || {}), amount: val } }));
  const toggleDefer = (index) => setEdits((e) => ({ ...e, [index]: { ...(e[index] || {}), deferred: !e[index]?.deferred, carryOver: false } }));
  const toggleCarryOver = (index) => setEdits((e) => ({ ...e, [index]: { ...(e[index] || {}), carryOver: !e[index]?.carryOver } }));

  async function handleSave() {
    setError("");
    const changes = [];
    for (const [idxStr, edit] of Object.entries(edits)) {
      const index = parseInt(idxStr);
      const inst = installments.find((i) => i.index === index);
      if (!inst || inst.status === "paid") continue;
      if (edit.deferred) {
        // the month goes too, so the server can find it after re-numbering
        changes.push({ type: "defer", index, month: inst.month });
      } else if (edit.amount !== undefined) {
        const amt = parseFloat(edit.amount);
        if (isNaN(amt) || amt <= 0) return setError(`Enter an amount for ${monthText(inst.month)}`);
        if (amt !== inst.amount) {
          if (edit.carryOver && amt < inst.amount) changes.push({ type: "partial", index, amount: amt, note });
          else changes.push({ type: "amount", index, amount: amt });
        }
      }
    }
    if (changes.length === 0 && !note.trim()) return setError("Nothing has been changed yet.");
    try {
      await onSave(changes, note.trim());
    } catch (e) {
      setError(e.message || "Couldn't save the changes");
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={type === "loan" ? "Change the loan's instalments" : "Change the advance's instalments"}
      description={`${record?.staffName || "Staff"} · ${money(record?.amount)} · ${money(record?.remainingAmount)} still owed`}
      footer={
        <>
          <Button variant="ghost" size="lg" onClick={onClose} className="flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button size="lg" onClick={handleSave} loading={saving} className="flex-1">
            Save changes
          </Button>
        </>
      }
    >
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
        {installments.map((inst) => {
          const edit = edits[inst.index] || {};
          const paid = inst.status === "paid";
          const moved = !!edit.deferred;
          const amt = edit.amount !== undefined ? parseFloat(edit.amount) : inst.amount;
          const partial = !isNaN(amt) && amt > 0 && amt < inst.amount;
          return (
            <li key={inst.index} className={cn("px-3 py-3", paid && "opacity-55", moved && "bg-warning-soft/50")}>
              <div className="flex items-center gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold text-muted">{inst.index}</span>
                <span className="w-20 shrink-0 text-sm">
                  <span className={cn("block font-semibold", moved ? "text-subtle line-through" : "text-fg")}>{monthText(inst.month)}</span>
                  {moved && <span className="block text-[11px] font-semibold text-warning">→ {monthText(calcDeferTarget(inst))}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  {paid ? (
                    <span className="text-sm tabular-nums text-muted">{money(inst.amount)}</span>
                  ) : (
                    <MoneyInput
                      aria-label={`Amount for ${monthText(inst.month)}`}
                      currency={currency}
                      value={edit.amount !== undefined ? edit.amount : String(inst.amount)}
                      onValueChange={(v) => setAmount(inst.index, v)}
                      disabled={moved}
                      size="md"
                    />
                  )}
                </span>
                {paid ? (
                  <Badge tone="brand" className="shrink-0">
                    Paid
                  </Badge>
                ) : (
                  <Button variant={moved ? "secondary" : "ghost"} size="sm" icon={moved ? Undo2 : CalendarClock} onClick={() => toggleDefer(inst.index)} className="shrink-0">
                    {moved ? "Undo" : "Move"}
                  </Button>
                )}
              </div>
              {!paid && !moved && partial && (
                <Switch
                  className="ml-10 mt-2"
                  checked={!!edit.carryOver}
                  onChange={() => toggleCarryOver(inst.index)}
                  label={`Carry the other ${money(inst.amount - amt)} to a new month`}
                />
              )}
            </li>
          );
        })}
      </ul>

      <Field label="Why the change" className="mt-5">
        {({ id }) => <Textarea id={id} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Asked to skip a month for a medical bill — agreed by the manager." />}
      </Field>

      {record?.termEdits?.length > 0 && (
        <div className="mt-5">
          <p className="mb-1.5 text-xs font-semibold text-muted">Changed before</p>
          <ul className="space-y-1.5">
            {record.termEdits.map((e, i) => (
              <li key={i} className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
                <span className="font-semibold text-fg">{e.editedBy?.username || "Manager"}</span>
                {e.editedAt ? ` · ${new Date(e.editedAt).toLocaleDateString()}` : ""}
                {e.note && <span className="mt-0.5 block italic">“{e.note}”</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
    </Sheet>
  );
}
