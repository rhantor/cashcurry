// middleware.js
//
// Page routing only: sends people to the screens their role uses. It reads
// cookies the browser could change, so it is NOT security — the database and
// storage rules (firestore.rules, storage.rules) decide what anyone can read
// or write, and API routes check the caller's ID token themselves.
import { NextResponse } from "next/server";
import { ROLES } from "@/lib/authz/roles";
import { canOpen, normalizeRole } from "@/lib/authz/permissions";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/signup/verify",
  "/unauthorized",
  "/reset-password",
];

// Assets that must always be public so the app is installable/loggable
const ALWAYS_PUBLIC_PREFIXES = [
  "/manifest.webmanifest",
  "/manifest.json",
  "/robots.txt",
  "/sitemap.xml",
  "/icons",
  "/android-chrome",
  "/apple-touch-icon.png",
  "/site.webmanifest",
  "/sw.js",
  "/workbox-",
  // a new hire's join link (30 Oct): no sign-in — the link is the key
  "/join",
];

const starts = (path, prefix) =>
  path === prefix || path.startsWith(prefix + "/");

// Who may open which page lives in lib/authz/permissions.js (the roles
// matrix, docs/ROLES.md) — the menu reads the same table. This is routing
// only; the database rules are the real boundary.

export function middleware(request) {
  const url = request.nextUrl;
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  // Always allow manifest/icons/SW/etc so install prompt works while logged out
  if (ALWAYS_PUBLIC_PREFIXES.some((p) => starts(pathname, p))) {
    return NextResponse.next();
  }

  const isLoggedIn = request.cookies.get("isLoggedIn")?.value === "true";

  // Handle root: send logged-out users to /login, otherwise let through
  if (pathname === "/") {
    if (!isLoggedIn) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", "/");
      return NextResponse.redirect(loginUrl);
    }
    
    // If logged in, staff should land on their portal instead of the root dashboard
    const rawRole = request.cookies.get("role")?.value || "";
    if (rawRole === ROLES.staff) {
       return NextResponse.redirect(new URL("/staff-portal", request.url));
    }
    return NextResponse.next();
  }

  // Public pages (auth/utility)
  if (PUBLIC_PATHS.includes(pathname)) {
    // Keep logged-in users out of auth pages
    if (
      isLoggedIn &&
      ["/login", "/signup", "/signup/verify", "/reset-password"].includes(
        pathname
      )
    ) {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Protected: must be logged in past this point
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based authorization (deny by default: a page not in the matrix is
  // open to office roles only, never to staff or an unknown role)
  const role = normalizeRole(request.cookies.get("role")?.value || "");
  if (!canOpen(role, pathname)) {
    const unauth = new URL("/unauthorized", request.url);
    unauth.searchParams.set("from", pathname);
    return NextResponse.redirect(unauth);
  }

  return NextResponse.next();
}

// Ensure middleware never runs on static assets / PWA files
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images/|fonts/|icons/|manifest\\.webmanifest|manifest\\.json|robots\\.txt|sitemap\\.xml|apple-touch-icon\\.png|site\\.webmanifest|sw\\.js|workbox-).*)",
  ],
};
