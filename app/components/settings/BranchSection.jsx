// Branch: its name and how to reach it; these also show on invoices and
// purchase orders. (Branch name and code live on the branch itself; the form
// keeps them with the rest and saves them apart.)
import React from "react";
import { Card, Field, Input } from "@/app/components/ui";
import { canEdit } from "./rolePolicy";

function Group({ title, children }) {
  return (
    <Card className="p-4 sm:p-5">
      <h3 className="mb-3.5 text-[15px] font-bold text-fg">{title}</h3>
      <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

export default function BranchSection({ role, value, onChange }) {
  const v = value || {};
  const addr = v.address || {};
  const patch = (p) => onChange({ ...v, ...p });
  const patchAddr = (p) => onChange({ ...v, address: { ...addr, ...p } });
  const can = (field) => canEdit(role, "basic", field);

  const text = (label, field, placeholder, type = "text") => (
    <Field label={label}>
      {({ id }) => <Input id={id} type={type} value={v[field] ?? ""} onChange={(e) => patch({ [field]: e.target.value })} disabled={!can(field)} placeholder={placeholder} className="disabled:opacity-70" />}
    </Field>
  );
  const address = (label, field, placeholder, wide) => (
    <Field label={label} className={wide ? "sm:col-span-2" : undefined}>
      {({ id }) => <Input id={id} value={addr[field] ?? ""} onChange={(e) => patchAddr({ [field]: e.target.value })} disabled={!can("address")} placeholder={placeholder} className="disabled:opacity-70" />}
    </Field>
  );

  return (
    <>
      <Group title="Name and contact">
        {text("Branch name", "name", "e.g. Lazeez KLCC")}
        {text("Short code", "code", "e.g. KLCC")}
        {text("Phone", "phone", "+60 12-345 6789", "tel")}
        {text("WhatsApp", "whatsapp", "+60 12-345 6789", "tel")}
        <div className="sm:col-span-2">{text("Email", "email", "branch@company.com", "email")}</div>
      </Group>
      <Group title="Address">
        {address("Address", "line1", "Lot, street, building", true)}
        {address("City", "city", "Kuala Lumpur")}
        {address("State", "state", "WP Kuala Lumpur")}
        {address("Postcode", "postcode", "50088")}
      </Group>
      <Group title="Company details for invoices">
        {text("Company name", "companyName", "e.g. Cash Curry Sdn. Bhd.")}
        {text("Registration no.", "companyRegistration", "e.g. 202401012345 (1234567-A)")}
      </Group>
    </>
  );
}
