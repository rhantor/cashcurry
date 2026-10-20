// A staff member's private details live apart from their staff record
// (roadmap 4.1): companies/{c}/branches/{b}/staffPrivate/{staffId}, readable
// only by those the roles matrix lets see pay ("staff.pay": company roles,
// branchAdmin, manager, accountant) and by the person themselves. The staff
// record keeps what everyone at the branch needs — name, role, department,
// phone, photo, shift and kiosk settings — so a cashier can pick a name for an
// advance without seeing anyone's salary, IC or bank account.
// Firestore can't hide some fields of one document, hence two documents.

/** Fields kept in staffPrivate, never on the staff record. */
export const PRIVATE_FIELDS = [
  // pay
  "basicSalary", "basicPerHour", "OTPerHour", "allowance", "deductionSettings", "otMultiplier", "phMultiplier",
  // bank
  "bankName", "bankAccountNumber", "bankAccountHolderName",
  // identity and personal
  "icNumber", "passportNumber", "dob",
  "addressLine1", "addressLine2", "city", "state", "postalCode",
  "emergencyContactName", "emergencyContactPhone",
  "notes",
];

/** { public, private } halves of a staff form or record. */
export function splitStaff(data = {}) {
  const pub = {};
  const priv = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    (PRIVATE_FIELDS.includes(k) ? priv : pub)[k] = v;
  }
  return { public: pub, private: priv };
}

/** True if a staff record still carries private fields (written before the split). */
export const hasPrivateFields = (record = {}) => PRIVATE_FIELDS.some((k) => k in record);
