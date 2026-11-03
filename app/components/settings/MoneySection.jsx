// Money: where this branch's cash and bank figures start, its currency, and
// how its days are counted (see lib/region). Edits three settings groups, so
// it takes the whole settings form.
import React, { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Input, Select } from "@/app/components/ui";
import { can as canDo } from "@/lib/authz/permissions";
import { CURRENCIES, TIME_ZONES, businessToday, deviceTimeZone, formatMoney, regionOf } from "@/lib/region";
import { canEdit } from "./rolePolicy";
import { LockedNote, MoneyField, SettingRow, SettingsCard } from "./fields";

/** The clock in a zone, e.g. "14:32". */
const clockIn = (timeZone, now) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(now);

/** The hour before a cut-off, for the example: 05:00 → "2 am"; none → null. */
const exampleBefore = (cutoff) => {
  const h = Number(String(cutoff || "").split(":")[0]);
  if (!h) return null;
  const at = Math.max(0, h - 3);
  return at === 0 ? "12:30 am" : `${at}:30 am`;
};

export default function MoneySection({ role, form, setForm }) {
  const fin = form?.financeSales || {};
  const timeZone = form?.basic?.timeZone || "";
  const cutoff = form?.attendance?.dayCutoffTime || "";
  const canMoney = canDo(role, "moneySettings.manage");
  const can = (field) => canEdit(role, "region", field);

  // Once a minute, so the branch's clock stays right.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const set = (group, field, value) => setForm((prev) => ({ ...prev, [group]: { ...(prev?.[group] || {}), [field]: value } }));

  const region = regionOf(form);
  const today = businessToday(now, region);
  const zones = TIME_ZONES.some((z) => z.id === timeZone) || !timeZone ? TIME_ZONES : [{ id: timeZone, label: timeZone }, ...TIME_ZONES];
  const knownCurrency = Object.values(CURRENCIES).some((c) => c.code === region.currency.code && fin.currency);
  const before = exampleBefore(cutoff);

  return (
    <>
      <SettingsCard title="Starting balances">
        <SettingRow label="Opening cash" hint="Cash in the till when this branch started on Cash Curry.">
          {({ id }) => <MoneyField id={id} value={fin.openingBalance ?? 0} currency={region.currency.code} disabled={!canMoney} onChange={(v) => set("financeSales", "openingBalance", v)} />}
        </SettingRow>
        <SettingRow label="Opening bank" hint="Bank balance on the same day.">
          {({ id }) => <MoneyField id={id} value={fin.openingBankBalance ?? 0} currency={region.currency.code} disabled={!canMoney} onChange={(v) => set("financeSales", "openingBankBalance", v)} />}
        </SettingRow>
        {canMoney ? (
          <p className="bg-warning-soft px-4 py-3 text-[13px] text-fg sm:px-5">Changing a starting balance moves cash in hand and bank on every report.</p>
        ) : (
          <LockedNote>Only the owner, super admin or branch admin can change the starting balances.</LockedNote>
        )}
      </SettingsCard>

      <SettingsCard title="Currency and business day">
        <SettingRow label="Currency" hint={`Money shows like ${formatMoney(123456.5, region.currency.code)}.`} width="sm:grid-cols-[minmax(0,1fr)_16rem]">
          {({ id }) => (
            <Select id={id} value={knownCurrency ? region.currency.code : fin.currency || ""} disabled={!can("currency")} onChange={(e) => set("financeSales", "currency", e.target.value)}>
              {!knownCurrency && <option value={fin.currency || ""}>{fin.currency || "Not set (RM)"}</option>}
              {Object.values(CURRENCIES).map((c) => (
                <option key={c.code} value={c.code}>{c.symbol} — {c.name}</option>
              ))}
            </Select>
          )}
        </SettingRow>
        <SettingRow label="Time zone" hint={`It is ${clockIn(region.timeZone, now)} at the branch${region.timeZoneIsSet ? "" : " (this device's clock)"}.`} width="sm:grid-cols-[minmax(0,1fr)_16rem]">
          {({ id }) => (
            <Select id={id} value={timeZone} disabled={!can("timeZone")} onChange={(e) => set("basic", "timeZone", e.target.value)}>
              <option value="">Not set — each device&apos;s clock ({deviceTimeZone() || "unknown"})</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>{z.label}</option>
              ))}
            </Select>
          )}
        </SettingRow>
        <SettingRow label="Day ends at" hint={`New entries default to ${format(parseISO(today), "EEE d MMM")}. Attendance and the POS use this too.`} width="sm:grid-cols-[minmax(0,1fr)_16rem]">
          {({ id }) => <Input id={id} type="time" value={cutoff} disabled={!can("dayCutoffTime")} onChange={(e) => set("attendance", "dayCutoffTime", e.target.value)} className="disabled:opacity-70" />}
        </SettingRow>
        <p className="px-4 py-3 text-[13px] text-muted sm:px-5">
          {before ? `With a day end of ${cutoff}, a sale at ${before} counts for the day before.` : "With no day end set, each day ends at midnight. Set one if the restaurant closes after midnight."}
        </p>
        {!can("timeZone") && <LockedNote>Only the owner, super admin or branch admin can change these.</LockedNote>}
      </SettingsCard>
    </>
  );
}
