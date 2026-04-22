export default function useCompanyId() {
  try {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem("user") : null;
    return raw ? JSON.parse(raw).companyId : null;
  } catch {
    return null;
  }
}
