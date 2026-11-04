"use client";
// The details of a warranty: on Cost Entry with a new purchase, and on
// Purchases → Warranties for something bought before.
import { DatePicker, Field, Input, Select } from "@/app/components/ui";
import { Chip } from "@/app/components/entry/Choices";
import ProofUpload from "@/app/components/entry/ProofUpload";
import { choosable } from "@/lib/purchases/vendors";
import { LENGTHS, addMonths } from "@/lib/warranties/model";

const SHRINK = { maxMB: 0.6, maxSide: 1600 };

export default function WarrantyFields({ value, onChange, vendors = [], errors = {}, paper, onPaper }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const pickVendor = (id) => {
    const v = vendors.find((x) => x.id === id);
    // their email and phone as listed, ready to change
    set(v ? { vendorId: id, soldBy: "", soldByEmail: v.email || v.enquiriesEmail || "", soldByPhone: v.phone || "" } : { vendorId: "" });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="What was bought" error={errors.itemName} className="sm:col-span-2">
        {({ id, invalid }) => <Input id={id} invalid={invalid} value={value.itemName} onChange={(e) => set({ itemName: e.target.value })} placeholder="e.g. Walk-in chiller" className="h-11" />}
      </Field>
      <Field label="Bought on">{() => <DatePicker value={value.startDate} onChange={(startDate) => set({ startDate })} />}</Field>
      <Field label="Warranty ends" error={errors.endsOn}>
        {({ invalid }) => <DatePicker value={value.endsOn} onChange={(endsOn) => set({ endsOn })} invalid={invalid} />}
      </Field>
      {value.startDate && (
        <div className="flex flex-wrap gap-1.5 sm:col-span-2">
          {LENGTHS.map((l) => {
            const end = addMonths(value.startDate, l.months);
            return (
              <Chip key={l.months} on={value.endsOn === end} onClick={() => set({ endsOn: end })}>
                {l.label}
              </Chip>
            );
          })}
        </div>
      )}
      <Field label="Bought from: a listed vendor">
        {({ id }) => (
          <Select id={id} value={value.vendorId} onChange={(e) => pickVendor(e.target.value)} className="h-11">
            <option value="">— Not a listed vendor —</option>
            {choosable(vendors, value.vendorId).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name || v.vendorName}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="…or the shop">
        {({ id }) => <Input id={id} value={value.soldBy} disabled={!!value.vendorId} onChange={(e) => set({ soldBy: e.target.value })} placeholder="e.g. Cold Tech Sdn Bhd" className="h-11" />}
      </Field>
      <Field label="Their email (optional)" error={errors.soldByEmail}>
        {({ id, invalid }) => <Input id={id} type="email" invalid={invalid} value={value.soldByEmail} onChange={(e) => set({ soldByEmail: e.target.value })} placeholder="sales@example.com" className="h-11" />}
      </Field>
      <Field label="Their phone (optional)">
        {({ id }) => <Input id={id} value={value.soldByPhone} onChange={(e) => set({ soldByPhone: e.target.value })} className="h-11" />}
      </Field>
      <Field label="Serial number (optional)" className="sm:col-span-2">
        {({ id }) => <Input id={id} value={value.serial} onChange={(e) => set({ serial: e.target.value })} className="h-11" />}
      </Field>
      <div className="sm:col-span-2">
        <ProofUpload
          label="Warranty paper (optional)"
          pdf
          pageDrop={false}
          shrink={SHRINK}
          file={paper?.file}
          preview={paper?.preview}
          progress={paper?.progress || 0}
          onPick={(file, preview) => onPaper({ file, preview })}
          onRemove={() => onPaper(null)}
        />
      </div>
    </div>
  );
}
