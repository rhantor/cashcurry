"use client";
import { useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";

const COMPANY_ROLES = new Set(["owner", "gm", "superAdmin"]);

function cookieKeyFor(companyId) {
  return companyId ? `activeBranch_${companyId}` : "activeBranch";
}

/**
 * Resolves companyId + branchId with this priority:
 * 1) ?branch= from URL (for company roles only; optional guard for others)
 * 2) activeBranch cookie (namespaced by company)
 * 3) user's branchId from localStorage user
 *
 * For non-company roles, we force user's branch and overwrite cookie.
 */
export default function useResolvedCompanyBranch() {
  // We avoid useSearchParams here because it triggers Suspense requirements 
  // that can crash the layout in some Next.js environments.
  // Instead, we derive it from window.location if needed, or skip it.
  const [branchFromUrl, setBranchFromUrl] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setBranchFromUrl(params.get("branch"));
    }
  }, []);

  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [branchId, setBranchId] = useState(null);

  const isCompany = useMemo(
    () => (user?.role ? COMPANY_ROLES.has(user.role) : false),
    [user?.role]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) {
        setReady(true);
        return;
      }

      const u = JSON.parse(raw);
      setUser(u);

      const cId = u?.companyId ?? null;
      const uBranch = u?.branchId ?? null;
      setCompanyId(cId);

      const key = cookieKeyFor(cId);
      const cookieBranch = Cookies.get(key) || null;

      let effective = null;

      // Local isCompany check to avoid dependency loop
      const localIsCompany = u?.role ? COMPANY_ROLES.has(u.role) : false;

      if (localIsCompany) {
        if (branchFromUrl) {
          effective = branchFromUrl;
          Cookies.set(key, branchFromUrl, { path: "/" });
          Cookies.set("activeBranch", branchFromUrl, { path: "/" });
        } else {
          effective = cookieBranch || uBranch || null;
        }
      } else {
        effective = uBranch || null;
        if (effective) {
          Cookies.set(key, effective, { path: "/" });
          Cookies.set("activeBranch", effective, { path: "/" });
        }
      }

      setBranchId(effective);
    } catch {
      // ignore
    } finally {
      setReady(true);
    }
  }, [branchFromUrl]);

  const setActiveBranch = (newBranchId) => {
    if (!companyId || !newBranchId) return;
    const key = cookieKeyFor(companyId);
    Cookies.set(key, newBranchId, { path: "/" });
    Cookies.set("activeBranch", newBranchId, { path: "/" });
    setBranchId(newBranchId);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("activeBranchChanged", {
          detail: { branchId: newBranchId },
        })
      );
    }
  };

  const clearBranchCookies = () => {
    Cookies.remove("activeBranch", { path: "/" });
    const all = Cookies.get();
    Object.keys(all).forEach((k) => {
      if (k === "activeBranch" || k.startsWith("activeBranch_")) {
        Cookies.remove(k, { path: "/" });
      }
    });
  };

  return {
    ready,
    user,
    companyId,
    branchId,
    isCompany,
    setActiveBranch,
    clearBranchCookies,
    cookieKey: cookieKeyFor(companyId),
  };
}
