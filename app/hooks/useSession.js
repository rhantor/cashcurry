"use client";
// The signed-in user and active branch in React — see lib/session.
import { useSyncExternalStore } from "react";
import {
  subscribeSession, getSession, getServerSession, setActiveBranch, signOut, isCompanyWideRole,
} from "@/lib/session";

/**
 * {
 *   status, user, role, companyId,
 *   branchId          — the branch screens show (active branch)
 *   isCompanyWide     — owner / GM / super admin
 *   ready             — the user is known (cached or confirmed)
 *   setActiveBranch, signOut
 * }
 */
export default function useSession() {
  const s = useSyncExternalStore(subscribeSession, getSession, getServerSession);
  return {
    status: s.status,
    user: s.user,
    role: s.user?.role ?? null,
    companyId: s.user?.companyId ?? null,
    branchId: s.activeBranchId,
    isCompanyWide: isCompanyWideRole(s.user?.role),
    ready: !!s.user || s.status !== "loading",
    setActiveBranch,
    signOut,
  };
}
