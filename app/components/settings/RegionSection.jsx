/* eslint-disable react/prop-types */
// Branch region: time zone, business-day cut-off and currency (see lib/region).
// Edits three existing settings groups, so it takes the whole settings form.
import React, { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import SettingsSection from "./SettingsSection";
import { FieldRow, TextField } from "./fields";
import {
  TIME_ZONES, CURRENCIES, regionOf, businessToday, formatMoney, deviceTimeZone,
} from "@/lib/region";

const selectCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-100 disabled:text-slate-500";

/** The clock in a zone, e.g. "14:32". */
const clockIn = (timeZone, now) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(now);

export default function RegionSection({ role, form, setForm }) {
  const timeZone = form?.basic?.timeZone || "";
  const cutoff = form?.attendance?.dayCutoffTime || "";
  const currency = form?.financeSales?.currency || "";

  // Tick once a minute so the preview's clock stays right.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const set = (group, field, value) =>
    setForm((prev) => ({ ...prev, [group]: { ...(prev?.[group] || {}), [field]: value } }));

  const region = regionOf(form);
  const today = businessToday(now, region);
  const zones = TIME_ZONES.some((z) => z.id === timeZone) || !timeZone
    ? TIME_ZONES
    : [{ id: timeZone, label: timeZone }, ...TIME_ZONES];
  const knownCurrency = Object.values(CURRENCIES).some((c) => c.code === region.currency.code && currency);

  return (
    <SettingsSection role={role} sectionKey="region">
      {(can) => (
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Region &amp; business day</h3>
            <p className="text-xs text-slate-500 mt-1">
              Decides which day sales, costs and payments are booked to, and how money is written.
              {!can("timeZone") && " Only an owner or branch admin can change these."}
            </p>
          </div>

          <FieldRow label="Time zone" hint="The branch's own clock">
            <select
              className={selectCls}
              value={timeZone}
              onChange={(e) => set("basic", "timeZone", e.target.value)}
              disabled={!can("timeZone")}
            >
              <option value="">Not set — use each device&apos;s clock ({deviceTimeZone() || "unknown"})</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>{z.label}</option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Day ends at" hint="Business-day cut-off">
            <TextField
              type="time"
              value={cutoff}
              onChange={(v) => set("attendance", "dayCutoffTime", v)}
              disabled={!can("dayCutoffTime")}
            />
            <p className="text-xs text-slate-500 mt-1">
              Anything entered before this time belongs to the previous day. With 05:00, a sale entered at
              1:30am on the 18th is booked to the 17th. Leave empty (or 00:00) if the restaurant closes before
              midnight. Attendance and the POS use the same setting.
            </p>
          </FieldRow>

          <FieldRow label="Currency">
            <select
              className={selectCls}
              value={knownCurrency ? region.currency.code : currency}
              onChange={(e) => set("financeSales", "currency", e.target.value)}
              disabled={!can("currency")}
            >
              {!knownCurrency && <option value={currency}>{currency || "Not set (RM)"}</option>}
              {Object.values(CURRENCIES).map((c) => (
                <option key={c.code} value={c.code}>{c.symbol} — {c.name} ({c.code})</option>
              ))}
            </select>
          </FieldRow>

          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700 space-y-1">
            <div>
              It is <b>{clockIn(region.timeZone, now)}</b> at the branch
              {!region.timeZoneIsSet && <span className="text-slate-500"> (this device&apos;s clock)</span>}.
              New entries default to <b>{format(parseISO(today), "EEE d MMM yyyy")}</b>.
            </div>
            <div>
              Money is shown as <b>{formatMoney(123456.5, region.currency.code)}</b>.
            </div>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
