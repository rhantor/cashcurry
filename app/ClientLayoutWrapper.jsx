"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import useSession from "@/app/hooks/useSession";
import ProviderWrapper from "@/lib/redux/store/Provider";
import AppShell from "./components/shell/AppShell";
import { Loader, UIProvider } from "./components/ui";
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

  // Wait for Firebase to confirm the sign-in: a screen that queried before
  // that would be refused by the database rules.
  const isLoading = status === "loading";

  // 3) Register FCM token once we know user + companyId (real push)
  //    This hook must NOT be behind a conditional return.
  const authPages = ["/login", "/signup", "/signup/verify", "/reset-password"];
  // No sidebar/top bar on these (the staff app, the kiosk, and the /ui design preview).
  const staffPages = ["/staff-portal", "/requests", "/chat", "/kiosk", "/profile", "/ui"];
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
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Loader label="Opening Cash Curry" />
      </div>
    );
  }

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
      <UIProvider>
        {/* Active branch's time zone, day cut-off and currency, for every screen */}
        {isLoggedIn && !isAuthPage && <RegionSync />}

        {/* Ask permission + show personalized welcome once per session after login */}
        {isLoggedIn && !isAuthPage && (
          <React.Suspense fallback={null}>
            <AutoAskAfterLogin enabled user={user} />
          </React.Suspense>
        )}

        {isAuthPage || isStaffPage ? (
          <div className="min-h-screen bg-background">
            <React.Suspense fallback={<Loader />}>{children}</React.Suspense>
          </div>
        ) : (
          <AppShell onSignOut={logout}>
            <React.Suspense fallback={<Loader />}>{children}</React.Suspense>
          </AppShell>
        )}
      </UIProvider>
    </ProviderWrapper>
  );
}
