"use client";
import React, { useEffect, useState } from "react";
import { Button, Field, Input, Sheet, Textarea } from "@/app/components/ui";
import { toast } from "@/app/components/ui/notify";

const BLANK = {
  name: "",
  code: "",
  termsDays: "",
  maxOpenBills: "",
  phone: "",
  email: "",
  address: "",
  taxNumber: "",
  registrationNumber: "",
  bankName: "",
  bankAccountNumber: "",
  ownerName: "",
  enquiriesEmail: "",
  website: "",
};

const fromVendor = (v) => Object.fromEntries(Object.keys(BLANK).map((k) => [k, v?.[k] ?? ""]));

// what gets saved: text trimmed, the two numbers as numbers (blank = none)
export const toVendorPatch = (f) => ({
  ...Object.fromEntries(Object.keys(BLANK).map((k) => [k, String(f[k] ?? "").trim()])),
  termsDays: f.termsDays === "" || f.termsDays == null ? null : Number(f.termsDays),
  maxOpenBills: f.maxOpenBills === "" || f.maxOpenBills == null ? null : Number(f.maxOpenBills),
});

const Group = ({ title, children }) => (
  <section className="space-y-3">
    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">{title}</p>
    <div className="grid gap-3 sm:grid-cols-2">{children}</div>
  </section>
);

/**
 * Add or edit a vendor. `vendor` = the one being edited (null to add).
 * onSave(patch) saves it and resolves when done.
 */
export default function VendorForm({ open, vendor, onClose, onSave }) {
  const [f, setF] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setF(vendor ? fromVendor(vendor) : BLANK);
  }, [open, vendor]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const text = (k, label, props = {}) => (
    <Field label={label} className={props.wide ? "sm:col-span-2" : undefined} hint={props.hint}>
      {({ id }) => <Input id={id} value={f[k]} onChange={set(k)} placeholder={props.placeholder} type={props.type} inputMode={props.inputMode} />}
    </Field>
  );

  const save = async () => {
    if (!f.name.trim()) return toast.warning("Give the vendor a name.");
    setSaving(true);
    try {
      await onSave(toVendorPatch(f));
      onClose();
    } catch (e) {
      console.error(e);
      toast.error(vendor ? "Couldn't save the changes." : "Couldn't add the vendor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={vendor ? `Edit ${vendor.name}` : "Add a vendor"}
      description={vendor ? undefined : "Only the name is needed — the rest can be filled in later."}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            {vendor ? "Save changes" : "Add vendor"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <Group title="The vendor">
          {text("name", "Name", { wide: true, placeholder: "e.g. Fresh Farm Supplies" })}
          {text("code", "Code", { hint: "Optional", placeholder: "e.g. FFS" })}
          {text("registrationNumber", "Registration no. (SSM)", { hint: "Optional" })}
        </Group>

        <Group title="Paying them">
          {text("termsDays", "Pays in (days)", { type: "number", inputMode: "numeric", hint: "Sets each bill's due date", placeholder: "e.g. 30" })}
          {text("maxOpenBills", "Unpaid bills allowed", { type: "number", inputMode: "numeric", hint: "Blank = no limit" })}
          {text("bankName", "Bank")}
          {text("bankAccountNumber", "Account number", { inputMode: "numeric" })}
          {text("taxNumber", "Tax number", { wide: true, hint: "Optional" })}
        </Group>

        <Group title="Contact">
          {text("ownerName", "Person in charge")}
          {text("phone", "Phone", { type: "tel", inputMode: "tel" })}
          {text("email", "Email", { type: "email" })}
          {text("enquiriesEmail", "Enquiries email", { type: "email", hint: "Optional" })}
          {text("website", "Website", { wide: true, placeholder: "https://…" })}
          <Field label="Address" className="sm:col-span-2">
            {({ id }) => <Textarea id={id} rows={2} value={f.address} onChange={set("address")} />}
          </Field>
        </Group>
      </div>
    </Sheet>
  );
}
