/* eslint-disable react/prop-types */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Cookies from "js-cookie";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import ProviderWrapper from "@/lib/redux/store/Provider";
import Sidebar from "./components/menu/Sidebar";
import AutoAskAfterLogin from "@/app/components/notifications/AutoAskAfterLogin";
import { registerFcm } from "@/lib/notifications/registerFcm"; // real push

export default function ClientLayoutWrapper({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  // ---- state
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ---- hooks (ALWAYS declare hooks before any early returns)

  // 1) Firebase auth listener + localStorage sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userData = localStorage.getItem("user");
        const parsedUser = userData ? JSON.parse(userData) : null;
        setUser(parsedUser);
      } else {
        setUser(null);
        localStorage.removeItem("user");
        Cookies.remove("isLoggedIn");
        Cookies.remove("role");
        Cookies.remove("companyId");
      }
      setIsLoading(false);
    });

    const handleStorageChange = () => {
      const userData = localStorage.getItem("user");
      setUser(userData ? JSON.parse(userData) : null);
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      unsubscribe();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

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
  const isLoggedIn =
    !!user && !!user.role && Cookies.get("isLoggedIn") !== undefined;

  useEffect(() => {
    // safe to early-return *inside* the effect
    if (!isLoggedIn || isAuthPage) return;

    const companyId = Cookies.get("companyId") || user?.companyId;
    const uid = user?.uid || auth.currentUser?.uid;
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
      await signOut(auth);
      localStorage.removeItem("user");
      sessionStorage.removeItem("posWelcomedThisSession");
      router.replace("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <ProviderWrapper>
      {/* Ask permission + show personalized welcome once per session after login */}
      {isLoggedIn && !isAuthPage && (
        <React.Suspense fallback={null}>
          <AutoAskAfterLogin enabled user={user} />
        </React.Suspense>
      )}

      {!isAuthPage && !isStaffPage && (
        <>
          <aside className="hidden lg:block fixed top-0 left-0 h-screen w-64 bg-white shadow-md border-r z-40">
            <React.Suspense fallback={<div className="h-full w-full bg-gray-50 animate-pulse" />}>
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
