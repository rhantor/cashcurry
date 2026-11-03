// Approvals & limits: what can be spent or sent without someone checking it
// first (lib/authz/permissions.js selfApproves, outranks; docs/ROLES.md).
import React from "react";
import { Card, Switch } from "@/app/components/ui";
import { DEFAULT_VOUCHER_DAY_LIMIT, DEFAULT_VOUCHER_LIMIT, can as canDo, voucherLimits } from "@/lib/authz/permissions";
import { formatMoney } from "@/lib/region/currency";
import { canEdit } from "./rolePolicy";
import { LockedNote, MoneyField, SettingRow, SettingsCard } from "./fields";

const WHO = [
  ["Cashier, supervisor, accountant", "In-charge or above"],
  ["In-charge", "Manager or above"],
  ["Manager", "Branch admin or above"],
  ["Branch admin", "GM, super admin or owner"],
];

export default function ApprovalsSection({ role, form, setForm }) {
  const fin = form?.financeSales || {};
  const purchases = form?.purchases || {};
  const currency = fin.currency;
  const limits = voucherLimits(form);
  const money = (v) => formatMoney(v, currency);
  const canLimits = canDo(role, "moneySettings.manage");
  const canPo = canEdit(role, "purchases", "requirePoApproval");
  const setFin = (p) => setForm((prev) => ({ ...prev, financeSales: { ...(prev?.financeSales || {}), ...p } }));

  return (
    <>
      <SettingsCard
        title="Costs and bills with no invoice"
        note={
          <p className="rounded-xl bg-brand-soft px-3.5 py-3 text-fg">
            A manager or branch admin can spend {money(limits.entry)} at a time, and {money(limits.day)} a day, without approval. Above that, someone senior approves. GM, super admin and owner need no approval.
          </p>
        }
      >
        <SettingRow label="Each cost or bill" hint={`Above this, it waits for approval. Usually ${money(DEFAULT_VOUCHER_LIMIT)}.`}>
          {({ id }) => <MoneyField id={id} value={limits.entry} currency={currency} disabled={!canLimits} onChange={(voucherLimit) => setFin({ voucherLimit })} />}
        </SettingRow>
        <SettingRow label="All of one person's in a day" hint={`So a big buy can't be split into small ones. Usually ${money(DEFAULT_VOUCHER_DAY_LIMIT)}.`}>
          {({ id }) => <MoneyField id={id} value={limits.day} currency={currency} disabled={!canLimits} onChange={(voucherDayLimit) => setFin({ voucherDayLimit })} />}
        </SettingRow>
        {!canLimits && <LockedNote>These limits cover managers, so only the owner, super admin or branch admin can change them.</LockedNote>}
      </SettingsCard>

      <SettingsCard title="Who approves whose">
        {WHO.map(([from, to]) => (
          <div key={from} className="grid gap-x-5 gap-y-0.5 px-4 py-2.5 text-sm sm:grid-cols-2 sm:px-5">
            <span className="text-muted">{from}</span>
            <span className="font-semibold text-fg">{to}</span>
          </div>
        ))}
      </SettingsCard>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-4 px-4 py-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold text-fg">Purchase orders need approval before sending</h3>
            <p className="mt-0.5 text-[13px] text-muted">Owner, branch admin and manager can approve.</p>
          </div>
          <Switch
            checked={!!purchases.requirePoApproval}
            disabled={!canPo}
            onChange={(requirePoApproval) => setForm((prev) => ({ ...prev, purchases: { ...(prev?.purchases || {}), requirePoApproval } }))}
            aria-label="Purchase orders need approval before sending"
          />
        </div>
        {!canPo && <LockedNote>Only the owner, super admin or branch admin can change this.</LockedNote>}
      </Card>
    </>
  );
}
