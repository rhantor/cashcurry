/* eslint-disable react/prop-types */
import React from "react";
import SettingsSection from "./SettingsSection";
import { FieldRow, TextField, SectionCard } from "./fields";

export default function BasicInfoSection({ role, value, onChange }) {
  const v = value || {};
  console.log(v);
  const addr = v.address || {};

  const patch = (p) => onChange({ ...v, ...p });
  const patchAddr = (p) => onChange({ ...v, address: { ...addr, ...p } });

  return (
    <SettingsSection role={role} sectionKey="basic">
      {(can) => (
        <SectionCard
          title="Basic Branch Info"
          subtitle="Name, contact and operating details"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldRow label="Branch Name">
              <TextField
                value={v.name}
                onChange={(name) => patch({ name })}
                disabled={!can("name")}
                placeholder="e.g., Lazeez KLCC"
              />
            </FieldRow>

            <FieldRow label="Branch Code">
              <TextField
                value={v.code}
                onChange={(code) => patch({ code })}
                disabled={!can("code")}
                placeholder="e.g., KLCC-01"
              />
            </FieldRow>

            <FieldRow label="Phone">
              <TextField
                value={v.phone}
                onChange={(phone) => patch({ phone })}
                disabled={!can("phone")}
                placeholder="+60 12-345 6789"
                type="tel"
              />
            </FieldRow>

            <FieldRow label="WhatsApp">
              <TextField
                value={v.whatsapp}
                onChange={(whatsapp) => patch({ whatsapp })}
                disabled={!can("whatsapp")}
                placeholder="+60 12-345 6789"
                type="tel"
              />
            </FieldRow>

            <div className="md:col-span-2">
              <FieldRow label="Email">
                <TextField
                  value={v.email}
                  onChange={(email) => patch({ email })}
                  disabled={!can("email")}
                  placeholder="branch@company.com"
                  type="email"
                />
              </FieldRow>
            </div>

            <div className="md:col-span-2">
              <FieldRow label="Address line 1">
                <TextField
                  value={addr.line1}
                  onChange={(line1) => patchAddr({ line1 })}
                  disabled={!can("address")}
                  placeholder="Lot / Street / Building"
                />
              </FieldRow>
            </div>

            <FieldRow label="City">
              <TextField
                value={addr.city}
                onChange={(city) => patchAddr({ city })}
                disabled={!can("address")}
                placeholder="Kuala Lumpur"
              />
            </FieldRow>

            <FieldRow label="State">
              <TextField
                value={addr.state}
                onChange={(state) => patchAddr({ state })}
                disabled={!can("address")}
                placeholder="WP Kuala Lumpur"
              />
            </FieldRow>

            <FieldRow label="Postcode">
              <TextField
                value={addr.postcode}
                onChange={(postcode) => patchAddr({ postcode })}
                disabled={!can("address")}
                placeholder="50088"
              />
            </FieldRow>
          </div>

        </SectionCard>
      )}
    </SettingsSection>
  );
}
