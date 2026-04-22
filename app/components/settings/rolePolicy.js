export function canEdit(role, section, field) {
  const isOwner = role === "owner" || role === "superAdmin" || role === "branchAdmin" || role === "admin";
  if (isOwner) return true;

  if (role === "manager") {
    const allow = {
      basic: ["phone", "whatsapp", "email", "address"],
      financeSales: ["tenders"], // label/enable/order only
      reporting: ["defaultDashboardMode", "defaultSummaryFilter"],
      other: ["notes", "theme", "enabled"],
    };
    const list = allow[section] || [];
    return !field || list.includes(field);
  }

  return false; // everyone else read-only
}
