// middleware.js
import { NextResponse } from "next/server";
import { ROLES } from "@/lib/authz/roles";

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
];

const starts = (path, prefix) =>
  path === prefix || path.startsWith(prefix + "/");

// --- Branch section policies ---
const BRANCH_POLICIES = [
  {
    // Branch-level dashboard.
    // owner / gm / superAdmin can also view individual branches here.
    test: (p) => p === "/dashboard" || starts(p, "/dashboard/"),
    roles: [
      ROLES.branchAdmin, ROLES.manager, ROLES.accountant, ROLES.supervisor, ROLES.cashier,
      ROLES.owner, ROLES.gm, ROLES.superAdmin,
    ],
  },
  {
    test: (p) => starts(p, "/entry-data/sales-entry"),
    roles: [ROLES.accountant, ROLES.manager, ROLES.supervisor, ROLES.branchAdmin],
  },
  {
    test: (p) => starts(p, "/entry-data/cost-entry"),
    roles: [ROLES.manager, ROLES.accountant, ROLES.branchAdmin],
  },
  {
    test: (p) => starts(p, "/entry-data/deposit-entry"),
    roles: [ROLES.manager, ROLES.accountant, ROLES.branchAdmin],
  },
  {
    test: (p) => starts(p, "/entry-data/cash-withdraw"),
    roles: [ROLES.manager, ROLES.accountant, ROLES.branchAdmin],
  },
  {
    test: (p) => starts(p, "/entry-data/advance-entry"),
    roles: [ROLES.cashier, ROLES.supervisor, ROLES.manager, ROLES.branchAdmin, ROLES.accountant],
  },
  {
    test: (p) => starts(p, "/entry-data/salary-entry"),
    roles: [ROLES.cashier, ROLES.manager, ROLES.branchAdmin, ROLES.accountant],
  },
  {
    test: (p) => p === "/reports" || starts(p, "/reports"),
    roles: [ROLES.manager, ROLES.accountant, ROLES.supervisor, ROLES.branchAdmin, ROLES.gm],
  },
  {
    test: (p) => starts(p, "/requested-panel"),
    roles: [ROLES.manager, ROLES.branchAdmin],
  },
  {
    test: (p) => starts(p, "/supervisor-panel"),
    roles: [ROLES.supervisor],
  },
  {
    test: (p) => starts(p, "/feeds"),
    roles: [ROLES.manager, ROLES.branchAdmin, ROLES.accountant, ROLES.supervisor, ROLES.cashier, ROLES.gm],
  },
  {
    test: (p) => starts(p, "/loans"),
    roles: [ROLES.manager, ROLES.branchAdmin, ROLES.accountant, ROLES.gm],
  },
  {
    test: (p) => starts(p, "/branch-settings"),
    roles: [ROLES.branchAdmin, ROLES.manager],
  },
  {
    test: (p) => starts(p, "/support"),
    roles: [ROLES.cashier, ROLES.accountant, ROLES.manager, ROLES.supervisor, ROLES.branchAdmin, ROLES.owner, ROLES.gm],
  },
  {
    test: (p) => starts(p, "/kiosk"),
    roles: [ROLES.branchAdmin, ROLES.manager, ROLES.owner, ROLES.gm],
  },
  {
    test: (p) => starts(p, "/branch-chat"),
    roles: [ROLES.branchAdmin, ROLES.manager, ROLES.supervisor, ROLES.owner, ROLES.gm],
  },
  {
    test: (p) => starts(p, "/attendance-log"),
    roles: [ROLES.branchAdmin, ROLES.manager, ROLES.supervisor, ROLES.owner, ROLES.gm],
  },
];

// --- Company section policies ---
const COMPANY_POLICIES = [
  {
    test: (p) => starts(p, "/company/dashboard"),
    roles: [ROLES.gm, ROLES.superAdmin, ROLES.owner],
  },
  {
    test: (p) => p === "/reports" || starts(p, "/reports"),
    roles: [ROLES.gm, ROLES.superAdmin, ROLES.owner],
  },
  { test: (p) => starts(p, "/loans"), roles: [ROLES.gm, ROLES.superAdmin, ROLES.owner] },
  { test: (p) => starts(p, "/settings"), roles: [ROLES.gm, ROLES.superAdmin, ROLES.owner] },
  { test: (p) => starts(p, "/audit-log"), roles: [ROLES.owner, ROLES.gm, ROLES.superAdmin] },
  { test: (p) => starts(p, "/support"), roles: [ROLES.gm, ROLES.superAdmin, ROLES.owner] },
];

// --- Staff section policies ---
const STAFF_POLICIES = [
  { test: (p) => starts(p, "/staff-portal"), roles: [ROLES.staff] },
  { test: (p) => starts(p, "/requests"), roles: [ROLES.staff] },
  { test: (p) => starts(p, "/chat"), roles: [ROLES.staff] },
];

function allowedRolesForPath(pathname) {
  const matches = [];
  for (const p of STAFF_POLICIES)
    if (p.test(pathname)) matches.push(...p.roles);
  for (const p of BRANCH_POLICIES)
    if (p.test(pathname)) matches.push(...p.roles);
  for (const p of COMPANY_POLICIES)
    if (p.test(pathname)) matches.push(...p.roles);
  if (matches.length === 0) return null;
  return Array.from(new Set(matches));
}

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

  // Role-based authorization
  // Normalize legacy lowercase "branchadmin" stored in old user docs → canonical camelCase
  const rawRole = request.cookies.get("role")?.value || "";
  const role = rawRole === "branchadmin" ? ROLES.branchAdmin : rawRole;
  const allowed = allowedRolesForPath(pathname);
  if (allowed && !allowed.includes(role)) {
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
