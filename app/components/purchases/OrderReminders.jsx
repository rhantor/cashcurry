"use client";
// Order reminders on screen (owner, 4 Nov 2026): what's due, put off or skipped;
// a guide's own line; the form; and the list in Branch settings. The rules are
// in lib/purchases/reminders.js; the hourly function sends the notifications.
import React, { useEffect, useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { Bell, BellRing, ShoppingCart } from "lucide-react";
import { Chip } from "@/app/components/entry/Choices";
import Sheet from "@/app/components/purchases/Sheet";
import { Field, Select, Switch, cn, toast } from "@/app/components/ui";
import { localHour } from "@/lib/notify/model";
import { personName } from "@/lib/people";
import { BEFORE_CHOICES, SNOOZES, WEEKDAYS, dayLabel, hourLabel, localDay, newReminder, ordersForReminders, reminderStatus, reminderText, savedReminder, skipPatch, snoozePatch, unskipPatch } from "@/lib/purchases/reminders";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { useGetOrderGuidesQuery, useUpdateOrderGuideMutation } from "@/lib/redux/api/orderGuidesApiSlice";
import { useGetRequisitionsQuery } from "@/lib/redux/api/requisitionsApiSlice";
import { regionOf } from "@/lib/region";

const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
const timeText = (ms, timeZone) => new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(ms);

/** Where each guide's reminder stands now, on the branch's clock; looks again every minute. */
export function useGuideReminders(companyId, branchId) {
  const args = companyId && branchId ? { companyId, branchId } : skipToken;
  const { data: settings } = useGetBranchSettingsQuery(args);
  const { data: orders = [] } = useGetRequisitionsQuery(args);
  const timeZone = regionOf(settings).timeZone;
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  return useMemo(() => {
    const now = new Date(nowMs);
    const clock = { today: localDay(now, timeZone), hour: localHour(now, timeZone), nowMs };
    const list = ordersForReminders(orders, timeZone);
    return { clock, timeZone, statusOf: (guide) => reminderStatus(guide, list, clock) };
  }, [orders, timeZone, nowMs]);
}

/** Orders that need placing now: place, put off or skip. Shown on Order guides and Purchase orders. */
export function OrdersDue({ companyId, branchId, user, onPlace, highlight }) {
  const args = companyId && branchId ? { companyId, branchId } : skipToken;
  const { data: guides = [] } = useGetOrderGuidesQuery(args);
  const { statusOf, clock, timeZone } = useGuideReminders(companyId, branchId);
  const [update, { isLoading: saving }] = useUpdateOrderGuideMutation();
  const [later, setLater] = useState(null); // the guide whose "later" choices are open
  const by = personName(user) || user?.username || "";

  const rows = guides.map((guide) => ({ guide, st: statusOf(guide) })).filter(({ st }) => st);
  const due = rows.filter(({ st }) => st.state === "due");
  const snoozed = rows.filter(({ st }) => st.state === "snoozed");
  const missed = rows.filter(({ st }) => st.missedDay);
  if (!due.length && !snoozed.length && !missed.length) return null;

  const change = async (guide, patch, done) => {
    try {
      await update({ companyId, branchId, guideId: guide.id, patch }).unwrap();
      setLater(null);
      toast.success(done);
    } catch (e) {
      console.error(e);
      toast.error("Could not change the reminder");
    }
  };

  return (
    <div className="space-y-2.5">
      {due.map(({ guide, st }) => (
        <div key={guide.id} className={cn("rounded-2xl border border-warning/40 bg-warning-soft/60 p-4", highlight === guide.id && "ring-2 ring-brand")}>
          <div className="flex items-start gap-3">
            <BellRing className="mt-0.5 size-5 shrink-0 text-warning" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-fg">{guide.name}: order for {dayLabel(st.orderDay)}</p>
              <p className="text-sm text-muted">{guide.vendorName}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => onPlace(guide)} className="flex min-h-[44px] items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-fg active:brightness-95">
              <ShoppingCart className="size-4" /> Place order
            </button>
            <button onClick={() => setLater(later === guide.id ? null : guide.id)} className="min-h-[44px] rounded-xl bg-surface px-4 text-sm font-semibold text-fg">
              Remind me later
            </button>
            <button disabled={saving} onClick={() => change(guide, skipPatch(st.orderDay, by), `No order for ${dayLabel(st.orderDay)}.`)} className="min-h-[44px] rounded-xl px-3 text-sm font-semibold text-muted disabled:opacity-40">
              Skip this time
            </button>
          </div>
          {later === guide.id && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SNOOZES.filter((s) => s.key !== "morning" || clock.today !== st.orderDay).map((s) => (
                <Chip key={s.key} on={false} onClick={() => change(guide, snoozePatch(st.orderDay, s.key, { nowMs: clock.nowMs, hour: clock.hour, by }), "We'll remind everyone then.")}>
                  {s.label}
                </Chip>
              ))}
            </div>
          )}
        </div>
      ))}
      {snoozed.map(({ guide, st }) => (
        <p key={guide.id} className="flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-2.5 text-sm text-muted">
          <Bell className="size-4 shrink-0" /> {guide.name}: reminding again {timeText(st.snoozedUntil, timeZone)}
        </p>
      ))}
      {missed.map(({ guide, st }) => (
        <p key={guide.id} className="flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-2.5 text-sm text-muted">
          <Bell className="size-4 shrink-0" /> {guide.name}: missed, no order for {dayLabel(st.missedDay)}
        </p>
      ))}
    </div>
  );
}

const STATE_TEXT = {
  placed: (st) => `Ordered for ${dayLabel(st.orderDay)}${st.order?.poNo ? ` · ${st.order.poNo}` : ""}`,
  skipped: (st) => `Skipped ${dayLabel(st.orderDay)}`,
  waiting: (st) => `Next: ${dayLabel(st.orderDay)}`,
  snoozed: (st) => `Put off, for ${dayLabel(st.orderDay)}`,
  due: (st) => `Due: order for ${dayLabel(st.orderDay)}`,
};

/** A guide's line: its schedule and where it stands, or the offer to set one. */
export function GuideReminder({ guide, status, onEdit, companyId, branchId }) {
  const [update] = useUpdateOrderGuideMutation();
  if (!status) {
    return (
      <button onClick={onEdit} className="mt-2 flex min-h-[40px] items-center gap-2 rounded-xl px-1 text-sm font-semibold text-brand">
        <Bell className="size-4" /> Set a reminder
      </button>
    );
  }
  return (
    <div className="mt-2 rounded-xl border border-line px-3 py-2.5 text-sm">
      <div className="flex items-start gap-2">
        <Bell className="mt-0.5 size-4 shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <p className="text-fg">{reminderText(guide.reminder)}</p>
          <p className={cn("text-xs", status.state === "due" ? "font-semibold text-warning" : "text-muted")}>{STATE_TEXT[status.state](status)}</p>
        </div>
        <button onClick={onEdit} className="shrink-0 text-xs font-semibold text-brand">
          Edit
        </button>
      </div>
      {status.state === "skipped" && (
        <button onClick={() => update({ companyId, branchId, guideId: guide.id, patch: unskipPatch() })} className="ml-6 mt-1 text-xs font-semibold text-brand">
          Remind me after all
        </button>
      )}
    </div>
  );
}

/** Which days a guide is ordered, and when people are told. */
export function ReminderSheet({ guide, onClose, companyId, branchId }) {
  const { clock } = useGuideReminders(companyId, branchId);
  const [update, { isLoading: saving }] = useUpdateOrderGuideMutation();
  const [form, setForm] = useState(newReminder());
  const [error, setError] = useState("");
  useEffect(() => {
    if (!guide) return;
    setForm({ ...newReminder(), ...(guide.reminder || {}) });
    setError("");
  }, [guide?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDay = (d) => {
    setError("");
    setForm((f) => ({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d] }));
  };
  const save = async () => {
    if (form.enabled && !form.days.length) return setError("Pick the day this is ordered");
    try {
      await update({ companyId, branchId, guideId: guide.id, patch: savedReminder(form, clock.today) }).unwrap();
      toast.success(form.enabled ? "Reminder saved" : "Reminder turned off");
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Could not save the reminder");
    }
  };

  return (
    <Sheet
      open={!!guide}
      title="Order reminder"
      subtitle={guide ? `${guide.name} · ${guide.vendorName || ""}` : ""}
      onClose={onClose}
      maxWidth="max-w-xl"
      footer={
        <button onClick={save} disabled={saving} className="min-h-[52px] w-full rounded-2xl bg-brand text-base font-bold text-brand-fg transition-colors active:brightness-95 disabled:opacity-40">
          {saving ? "Saving…" : "Save reminder"}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-fg">Remind us to order this</p>
          <Switch checked={form.enabled} onChange={(enabled) => setForm((f) => ({ ...f, enabled }))} />
        </div>
        {form.enabled && (
          <>
            <div>
              <p className="mb-2 text-sm font-semibold text-fg">Which days is it ordered?</p>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((w) => (
                  <Chip key={w.d} on={form.days.includes(w.d)} onClick={() => toggleDay(w.d)}>
                    {w.short}
                  </Chip>
                ))}
              </div>
              {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-fg">When should we remind you?</p>
              <div className="flex flex-wrap gap-1.5">
                {BEFORE_CHOICES.map((b) => (
                  <Chip key={b.days} on={Number(form.before) === b.days} onClick={() => setForm((f) => ({ ...f, before: b.days }))}>
                    {b.label}
                  </Chip>
                ))}
              </div>
            </div>
            <Field label="At">
              {({ id }) => (
                <Select id={id} value={form.at} onChange={(e) => setForm((f) => ({ ...f, at: e.target.value }))} className="h-11">
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <p className="text-xs text-muted">The last reminder comes on the morning of the order day. Once an order is placed, reminders stop until the next one. Reminders arrive on the hour.</p>
          </>
        )}
      </div>
    </Sheet>
  );
}

/** Branch settings → Purchases: every guide and its reminder. */
export function OrderReminderList({ companyId, branchId }) {
  const { data: guides = [], isLoading } = useGetOrderGuidesQuery(companyId && branchId ? { companyId, branchId } : skipToken);
  const [editing, setEditing] = useState(null);

  return (
    <div>
      {!isLoading && guides.length === 0 && <p className="text-sm text-muted">Make an order guide first, in Purchases → Order Guides.</p>}
      <div className="space-y-2">
        {guides.map((g) => (
          <div key={g.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">{g.name}</p>
              <p className="text-xs text-muted">{g.reminder?.enabled && g.reminder.days?.length ? reminderText(g.reminder) : "No reminder"}</p>
            </div>
            <button type="button" onClick={() => setEditing(g)} className="min-h-[40px] shrink-0 rounded-xl bg-surface-2 px-3 text-sm font-semibold text-fg">
              {g.reminder?.enabled ? "Edit" : "Set"}
            </button>
          </div>
        ))}
      </div>
      <ReminderSheet guide={editing} onClose={() => setEditing(null)} companyId={companyId} branchId={branchId} />
    </div>
  );
}
