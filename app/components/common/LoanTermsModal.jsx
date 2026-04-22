/* eslint-disable react/prop-types */
"use client";
/**
 * LoanTermsModal — lets branchAdmin / manager edit the repayment schedule
 * of a staff loan OR advance after creation.
 *
 * Usage:
 *   <LoanTermsModal
 *     type="loan" | "advance"
 *     record={loanOrAdvanceDoc}
 *     companyId={...}
 *     branchId={...}
 *     onClose={fn}
 *     onSave={async (changes, note) => { ... }}
 *   />
 */
import React, { useState } from "react";

const STATUS_BADGE = {
  paid:    "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
};

export default function LoanTermsModal({
  type = "loan",
  record,
  onClose,
  onSave,
  saving = false,
}) {
  const installments = record?.installments || [];

  /** Compute where a deferred installment would land (mirrors server logic). */
  function calcDeferTarget(inst) {
    const [y, m] = inst.month.split('-').map(Number);
    const occupied = new Set(installments.map(i => i.month));
    let d = new Date(y, m, 1); // first day of next month
    let key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    while (occupied.has(key)) {
      d.setMonth(d.getMonth() + 1);
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    return key; // e.g. "2026-05"
  }

  /**
   * Local edits per installment index:
   * { amount?: string, deferred?: boolean, carryOver?: boolean }
   *
   * carryOver=true  → type:'partial' (carry remainder to a new installment)
   * carryOver=false → type:'amount'  (just change the scheduled amount; no carry-over)
   */
  const [edits, setEdits]   = useState({});
  const [note, setNote]     = useState("");
  const [error, setError]   = useState("");

  function setAmount(index, val) {
    setEdits(e => ({ ...e, [index]: { ...(e[index] || {}), amount: val } }));
  }

  function toggleDefer(index) {
    setEdits(e => {
      const cur = e[index] || {};
      return { ...e, [index]: { ...cur, deferred: !cur.deferred, carryOver: false } };
    });
  }

  function toggleCarryOver(index) {
    setEdits(e => {
      const cur = e[index] || {};
      return { ...e, [index]: { ...cur, carryOver: !cur.carryOver } };
    });
  }

  async function handleSave() {
    setError("");
    const changes = [];

    for (const [idxStr, edit] of Object.entries(edits)) {
      const index = parseInt(idxStr);
      const inst  = installments.find(i => i.index === index);
      if (!inst || inst.status === "paid") continue;

      if (edit.deferred) {
        // Send month alongside index so the server can find by month (stable after re-indexing)
        changes.push({ type: "defer", index, month: inst.month });
      } else if (edit.amount !== undefined) {
        const amt = parseFloat(edit.amount);
        if (isNaN(amt) || amt <= 0) {
          setError(`Invalid amount for installment #${index}`);
          return;
        }
        if (amt !== inst.amount) {
          if (edit.carryOver && amt < inst.amount) {
            // Partial payment: carry the remainder to a new installment next month
            changes.push({ type: "partial", index, amount: amt, note });
          } else {
            // Plain amount change (no carry-over; difference is written off/absorbed)
            changes.push({ type: "amount", index, amount: amt });
          }
        }
      }
    }

    if (changes.length === 0 && !note.trim()) {
      setError("No changes made.");
      return;
    }

    try {
      await onSave(changes, note.trim());
    } catch (e) {
      setError(e.message || "Failed to save");
    }
  }

  const title = type === "loan" ? "Edit Loan Terms" : "Edit Advance Terms";
  const staffName = record?.staffName || "Staff";

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-800">{title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {staffName} · Total:{" "}
              <span className="font-semibold">
                {Number(record?.amount || 0).toFixed(2)}
              </span>{" "}
              · Remaining:{" "}
              <span className="font-semibold text-orange-600">
                {Number(record?.remainingAmount || 0).toFixed(2)}
              </span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Installment table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden text-sm">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
              <div className="col-span-1">#</div>
              <div className="col-span-2">Month</div>
              <div className="col-span-3">Amount</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-4">Actions</div>
            </div>

            {installments.map(inst => {
              const edit         = edits[inst.index] || {};
              const isPaid       = inst.status === "paid";
              const isDeferred   = !!edit.deferred;
              const deferTarget  = isDeferred ? calcDeferTarget(inst) : null;
              const editedAmt  = edit.amount !== undefined ? parseFloat(edit.amount) : inst.amount;
              const isPartial  = !isNaN(editedAmt) && editedAmt > 0 && editedAmt < inst.amount;

              return (
                <div
                  key={inst.index}
                  className={`border-t border-gray-100 px-3 py-2.5 ${
                    isPaid ? "opacity-50" : ""
                  } ${isDeferred ? "bg-yellow-50" : ""}`}
                >
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-1 text-xs text-gray-400">{inst.index}</div>

                    {/* Month */}
                    <div className="col-span-2 text-xs text-gray-700 font-medium">
                      {isDeferred
                        ? <span className="line-through text-gray-400">{inst.month}</span>
                        : inst.month
                      }
                      {isDeferred && (
                        <span className="block text-[10px] text-yellow-700 font-semibold">
                          → {deferTarget}
                        </span>
                      )}
                    </div>

                    {/* Amount input */}
                    <div className="col-span-3">
                      {isPaid ? (
                        <span className="text-xs text-gray-500">
                          {Number(inst.amount).toFixed(2)}
                        </span>
                      ) : (
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={edit.amount !== undefined ? edit.amount : inst.amount}
                          onChange={e => setAmount(inst.index, e.target.value)}
                          disabled={isDeferred}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-mint-400 outline-none disabled:opacity-40"
                        />
                      )}
                    </div>

                    {/* Status */}
                    <div className="col-span-2">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[inst.status] || "bg-gray-100 text-gray-500"}`}>
                        {inst.status}
                      </span>
                    </div>

                    {/* Actions: Defer */}
                    <div className="col-span-4 flex gap-1.5">
                      {!isPaid && (
                        <button
                          type="button"
                          onClick={() => toggleDefer(inst.index)}
                          className={`text-[10px] px-2 py-1 rounded-lg border font-medium transition-colors ${
                            isDeferred
                              ? "border-yellow-400 bg-yellow-100 text-yellow-700"
                              : "border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          {isDeferred ? "↩ Undo" : "Defer"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Carry-over option: shown when amount is reduced */}
                  {!isPaid && !isDeferred && isPartial && (
                    <label className="mt-2 flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!edit.carryOver}
                        onChange={() => toggleCarryOver(inst.index)}
                        className="accent-mint-500"
                      />
                      <span className="text-[10px] text-mint-700">
                        Carry over remaining{" "}
                        <strong>{(inst.amount - editedAmt).toFixed(2)}</strong>{" "}
                        to next month
                      </span>
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          {/* Manager note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Manager Note <span className="text-gray-400 font-normal">(reason for change)</span>
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Staff requested deferral due to medical emergency — approved by manager."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-mint-400 outline-none resize-none"
            />
          </div>

          {/* Term edit history */}
          {record?.termEdits?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Edit History
              </p>
              <div className="space-y-1.5">
                {record.termEdits.map((e, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600">
                    <span className="font-medium">{e.editedBy?.username || "Manager"}</span>
                    {" · "}
                    {e.editedAt ? new Date(e.editedAt).toLocaleDateString() : ""}
                    {e.note && <span className="block text-gray-500 mt-0.5 italic">"{e.note}"</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-xs">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-mint-500 hover:bg-mint-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
