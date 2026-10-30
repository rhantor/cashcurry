"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { skipToken } from "@reduxjs/toolkit/query";
import { TopProgress, cn, useToast } from "@/app/components/ui";
import useSession from "@/app/hooks/useSession";
import { useGetBranchesQuery, useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { useGetCompanyDetailsQuery } from "@/lib/redux/api/authApiSlice";
import { bottomNavFor, currentPage, isCompanyRole, navFor, pagesFor } from "./navigation";
import SideNav from "./SideNav";
import TopBar from "./TopBar";
import MobileNav from "./MobileNav";
import CommandPalette, { rememberPage } from "./CommandPalette";
import usePendingRequests from "./usePendingRequests";
import { useChats } from "@/app/components/chat/useChat";
import { useIssuesWaiting } from "@/app/components/issues/useIssues";

const COLLAPSE_KEY = "cc-nav-collapsed";

/**
 * The frame around every back-office page: sidebar (computers), top bar,
 * bottom bar (phones), Ctrl+K search, page-change progress and fade.
 * Switching branch re-opens the page for the new branch — no full reload.
 */
export default function AppShell({ onSignOut, children }) {
  const pathname = usePathname();
  const toast = useToast();
  const { user, role, companyId, branchId, setActiveBranch } = useSession();
  const isCompany = isCompanyRole(role);

  // ── menu ──
  const sections = useMemo(() => navFor(role), [role]);
  const pages = useMemo(() => pagesFor(role), [role]);
  const bottom = useMemo(() => bottomNavFor(role), [role]);
  const page = useMemo(() => currentPage(pathname, role), [pathname, role]);
  useEffect(() => {
    if (page?.path) rememberPage(page.path);
  }, [page?.path]);

  // ── branches ──
  const { data: branchList = [] } = useGetBranchesQuery(isCompany && companyId ? companyId : skipToken);
  const branches = useMemo(() => branchList.map((b) => ({ id: b.id, name: b.name, address: b.address })), [branchList]);

  // ── counts on menu items: what waits for approval (company roles: every branch's requests) ──
  const pending = usePendingRequests({ companyId, branchId, role, branchIds: isCompany ? branches.map((b) => b.id) : null });
  const { data: myBranch } = useGetSingleBranchQuery(!isCompany && companyId && branchId ? { companyId, branchId } : skipToken);

  // …and chats with something new (4.4)
  const chatBranches = useMemo(() => (isCompany ? branches : myBranch && branchId ? [{ id: branchId, name: myBranch.name }] : []), [isCompany, branches, myBranch, branchId]);
  const chat = useChats(user, chatBranches);
  // …and issues waiting on this person (company roles: every branch's)
  const issueBranchIds = useMemo(() => (isCompany ? branches.map((b) => b.id) : [branchId]), [isCompany, branches, branchId]);
  const issuesWaiting = useIssuesWaiting(user, issueBranchIds);
  const badges = useMemo(() => ({ "/requested-panel": pending.total, "/issues": issuesWaiting }), [pending.total, issuesWaiting]);
  // the phone's bar has Ops where Requests or Issues may have been: it carries both counts
  const phoneBadges = useMemo(() => ({ ...badges, "/ops": pending.total + issuesWaiting }), [badges, pending.total, issuesWaiting]);
  const { data: company } = useGetCompanyDetailsQuery(companyId ?? skipToken);

  // Owners/GMs with no branch chosen yet start in their default branch (or the first).
  useEffect(() => {
    if (!isCompany || !branches.length) return;
    if (branchId && branches.some((b) => b.id === branchId)) return;
    const preferred = branches.find((b) => b.id === user?.defaultBranchId) || branches[0];
    setActiveBranch(preferred.id);
  }, [isCompany, branches, branchId, user?.defaultBranchId, setActiveBranch]);

  const switchBranch = useCallback(
    (b) => {
      setActiveBranch(b.id);
      toast.success(`Now showing ${b.name}`);
    },
    [setActiveBranch, toast]
  );

  // ── collapsed sidebar (remembered on this device) ──
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* private mode */
    }
  }, []);
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* private mode */
      }
      return !c;
    });

  // ── Ctrl+K ──
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearching((s) => !s);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-bg">
      <Suspense fallback={null}>
        <TopProgress />
      </Suspense>

      <SideNav
        sections={sections}
        activePath={page?.path}
        badges={badges}
        user={user}
        companyName={company?.name}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        onSignOut={onSignOut}
      />

      <div className={cn("transition-[padding] duration-300 ease-out", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
        <TopBar
          page={page}
          user={user}
          isCompany={isCompany}
          branches={branches}
          activeBranchId={branchId}
          branchName={myBranch?.name}
          onSwitchBranch={switchBranch}
          onSearch={() => setSearching(true)}
          onSignOut={onSignOut}
          chatUnread={chat.unread}
        />
        {/* Keyed by branch: switching branch opens the page fresh for it. */}
        <main key={branchId || "none"} className="pb-24 lg:pb-0">
          <motion.div key={pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}>
            {children}
          </motion.div>
        </main>
      </div>

      <MobileNav
        items={bottom}
        sections={sections}
        activePath={page?.path}
        badges={phoneBadges}
        user={user}
        isCompany={isCompany}
        branches={branches}
        activeBranchId={branchId}
        onSwitchBranch={switchBranch}
        onSignOut={onSignOut}
      />

      <CommandPalette
        open={searching}
        onClose={() => setSearching(false)}
        pages={pages}
        branches={isCompany ? branches : []}
        activeBranchId={branchId}
        onSwitchBranch={switchBranch}
        onSignOut={onSignOut}
      />
    </div>
  );
}
