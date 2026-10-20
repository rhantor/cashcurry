"use client";
// The signed-in user's company and the branch being viewed.
//
// Kept for the screens that already use it; it now reads the shared session
// (lib/session) — so switching branch updates every screen at once, and the
// profile comes from the database rather than a stale browser copy.
// New code: use app/hooks/useSession.js directly.
import Cookies from "js-cookie";
import useSession from "@/app/hooks/useSession";

const cookieKeyFor = (companyId) => (companyId ? `activeBranch_${companyId}` : "activeBranch");

export default function useResolvedCompanyBranch() {
  const { ready, user, companyId, branchId, isCompanyWide, setActiveBranch } = useSession();

  const clearBranchCookies = () => {
    Object.keys(Cookies.get()).forEach((k) => {
      if (k === "activeBranch" || k.startsWith("activeBranch_")) Cookies.remove(k, { path: "/" });
    });
  };

  return {
    ready,
    user,
    companyId,
    branchId,
    isCompany: isCompanyWide,
    setActiveBranch,
    clearBranchCookies,
    cookieKey: cookieKeyFor(companyId),
  };
}
