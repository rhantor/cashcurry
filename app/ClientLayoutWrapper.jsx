/* eslint-disable react/prop-types */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import useSession from "@/app/hooks/useSession";
import ProviderWrapper from "@/lib/redux/store/Provider";
import Sidebar from "./components/menu/Sidebar";
import AutoAskAfterLogin from "@/app/components/notifications/AutoAskAfterLogin";
import RegionSync from "@/app/components/region/RegionSync";
import { registerFcm } from "@/lib/notifications/registerFcm"; // real push

export default function ClientLayoutWrapper({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  // ---- state
  // The signed-in user, from the shared session (lib/session): confirmed with
  // Firebase Auth and refreshed from the user's record on every load.
  const { status, user, signOut } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Wait for Firebase to confirm the sign-in: a screen that queried before
  // that would be refused by the database rules.
  const isLoading = status === "loading";

  // 2) Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // 3) Register FCM token once we know user + companyId (real push)
  //    This hook must NOT be behind a conditional return.
  const authPages = ["/login", "/signup", "/signup/verify", "/reset-password"];
  const staffPages = ["/staff-portal", "/requests", "/chat", "/kiosk", "/profile"];
  const isAuthPage = authPages.some((path) => pathname.startsWith(path));
  const isStaffPage = staffPages.some((path) => pathname.startsWith(path));
  const isLoggedIn = status === "signedIn" && !!user?.role;

  // 3a) Signed out (here or in another tab) on a page that needs a login → login.
  useEffect(() => {
    if (status === "signedOut" && !isAuthPage) router.replace("/login");
  }, [status, isAuthPage, router]);

  useEffect(() => {
    // safe to early-return *inside* the effect
    if (!isLoggedIn || isAuthPage) return;

    const companyId = user?.companyId;
    const uid = user?.uid;
    if (!companyId || !uid) return;

    (async () => {
      try {
        await registerFcm({ companyId, uid });
      } catch (e) {
        console.warn("registerFcm error:", e);
      }
    })();
  }, [isLoggedIn, isAuthPage, user]);

  // ---- early return AFTER hooks are declared
  if (isLoading) return null;

  // ---- logout
  const logout = async () => {
    try {
      await signOut(); // clears the cached profile and routing cookies too
      router.replace("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <ProviderWrapper>
      {/* Active branch's time zone, day cut-off and currency, for every screen */}
      {isLoggedIn && !isAuthPage && <RegionSync />}

      {/* Ask permission + show personalized welcome once per session after login */}
      {isLoggedIn && !isAuthPage && (
        <React.Suspense fallback={null}>
          <AutoAskAfterLogin enabled user={user} />
        </React.Suspense>
      )}

      {!isAuthPage && !isStaffPage && (
        <>
          <aside className="hidden lg:block fixed top-0 left-0 h-screen w-64 bg-white/90 backdrop-blur-xl shadow-sm border-r border-slate-100/60 z-40">
            <React.Suspense fallback={<div className="h-full w-full bg-slate-50 animate-pulse" />}>
              <Sidebar
                role={user?.role}
                onLogout={logout}
                onNavigate={() => {}}
              />
            </React.Suspense>
          </aside>

          <header className="fixed top-0 left-0 w-full backdrop-blur-md bg-white/80 shadow-sm z-40 border-b border-mint-100 lg:hidden p-2 px-5 flex items-center">
            <button
              onClick={() => setSidebarOpen(true)}
              className="z-50 bg-mint-500 hover:bg-mint-600 text-white p-2 rounded shadow transition-colors"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </header>

          {sidebarOpen && (
            <div className="fixed inset-0 z-50 flex lg:hidden">
              <div className="bg-white w-64 h-full shadow-2xl transform transition-transform duration-300 translate-x-0">
                <React.Suspense fallback={<div className="h-full w-full bg-gray-50 animate-pulse" />}>
                  <Sidebar
                    role={user?.role}
                    onLogout={logout}
                    onNavigate={() => setSidebarOpen(false)}
                  />
                </React.Suspense>
              </div>
              <div
                className="flex-1 bg-mint-950/40 backdrop-blur-sm"
                onClick={() => setSidebarOpen(false)}
              />
            </div>
          )}
        </>
      )}

      {user?.role === "owner" && (
        <div className="fixed top-4 right-6 z-50">
          {/* <NotificationBell /> */}
        </div>
      )}

      <div
        className={`min-h-screen bg-background ${
          isStaffPage ? "pt-0 lg:pt-0" : "pt-14 lg:pt-0"
        }  ${
          !isAuthPage && !isStaffPage ? "lg:ml-64" : ""
        }`}
      >
        <div className="h-full overflow-hidden">
          <React.Suspense fallback={<div className="p-8 text-gray-400">Loading page...</div>}>
            {children}
          </React.Suspense>
        </div>
      </div>
    </ProviderWrapper>
  );
}
