"use client";
// The staff app's frame (roadmap 4.6): a bottom bar on phones (the Android
// app and the iPhone home-screen app), a side bar on wider screens. Same
// colours and parts as the office app.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarDays, Home, ListChecks, MessageCircle, FileText, TriangleAlert, User, Wallet, LogOut } from "lucide-react";
import NotificationBell from "@/app/components/notifications/NotificationBell";
import useSession from "@/app/hooks/useSession";
import { useChats } from "@/app/components/chat/useChat";
import { Avatar, LogoMark, cn } from "@/app/components/ui";
import { signOut } from "@/lib/session";
import { useMyStaff } from "./useStaffApp";
import { roleLabelOf } from "@/app/staff-management/lib/constants";
import { useIssuesWaiting } from "@/app/components/issues/useIssues";

const NAV = [
  { label: "Home", href: "/staff-portal", icon: Home },
  { label: "Pay", href: "/my-pay", icon: Wallet },
  { label: "Attendance", href: "/my-attendance", icon: CalendarDays, wide: true }, // phones: from Pay
  { label: "Requests", href: "/requests", icon: FileText },
  { label: "Chat", href: "/messages", icon: MessageCircle },
  { label: "Tasks", href: "/my-tasks", icon: ListChecks, wide: true }, // phones: from Home (4.11)
  { label: "Issues", href: "/my-issues", icon: TriangleAlert, wide: true }, // phones: from Home
  { label: "Me", href: "/profile", icon: User },
];

const TITLES = { "/staff-portal": "Home", "/my-pay": "My pay", "/my-attendance": "My attendance", "/requests": "Requests", "/my-issues": "Issues", "/my-tasks": "Tasks", "/profile": "Me" };

export default function StaffLayout({ children }) {
  const pathname = usePathname();
  const { user } = useSession();
  const { staff } = useMyStaff(user);
  // chats with something new (4.4)
  const { unread } = useChats(user, user?.branchId ? [{ id: user.branchId }] : []);
  // issues given to them, not resolved yet
  const issues = useIssuesWaiting(user, [user?.branchId]);
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "";

  const handleLogout = async () => {
    try {
      await signOut(); // Firebase sign-out, cached profile and cookies
    } catch (e) {
      console.error(e);
    }
    window.location.href = "/login";
  };

  const counts = { "/messages": unread, "/my-issues": issues, "/staff-portal": issues }; // phones: Issues is reached from Home
  const badge = (href) => counts[href] > 0;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-bg text-fg">
      {/* Side bar (wider screens) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center justify-between gap-2 px-5 py-5">
          <div className="flex items-center gap-2.5">
            <LogoMark size={32} />
            <div className="leading-tight">
              <p className="text-sm font-semibold">Cash Curry</p>
              <p className="text-xs text-muted">Staff</p>
            </div>
          </div>
          <NotificationBell />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "text-brand" : "text-muted hover:bg-surface-2 hover:text-fg"
                )}
              >
                {active && <motion.span layoutId="staff-nav" className="absolute inset-0 rounded-xl bg-brand-soft" transition={{ type: "spring", stiffness: 520, damping: 34 }} />}
                <Icon className="relative size-5" strokeWidth={active ? 2.4 : 2} />
                <span className="relative flex-1">{label}</span>
                {badge(href) && href !== "/staff-portal" && <span className="relative rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">{counts[href]}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line p-3">
          <Link href="/profile" className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
            <Avatar name={name} src={staff?.photoUrl} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{name}</span>
              <span className="block truncate text-xs text-muted">{staff?.department || roleLabelOf(staff?.role) || "Staff"}</span>
            </span>
          </Link>
          <button onClick={handleLogout} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-danger/10 hover:text-danger">
            <LogOut className="size-5" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Top bar (phones) */}
        <header className="z-40 flex shrink-0 items-center justify-between border-b border-line bg-surface/90 px-4 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <LogoMark size={28} />
            <span className="text-base font-semibold">{TITLES[pathname] || "Cash Curry"}</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Link href="/profile" aria-label="Me">
              <Avatar name={name} src={staff?.photoUrl} size="sm" />
            </Link>
          </div>
        </header>

        <main className="relative min-h-0 w-full flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl pb-28 md:max-w-3xl md:px-6 md:pb-10 md:pt-6">{children}</div>
        </main>
      </div>

      {/* Bottom bar (phones) */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.filter((n) => !n.wide).map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href === "/my-pay" && pathname === "/my-attendance"); // reached from Pay
          return (
            <Link key={href} href={href} className={cn("relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-brand" : "text-muted")}>
              <span className="relative flex h-8 w-14 items-center justify-center">
                {active && <motion.span layoutId="staff-tab" className="absolute inset-0 rounded-full bg-brand-soft" transition={{ type: "spring", stiffness: 520, damping: 34 }} />}
                <Icon className="relative size-5" strokeWidth={active ? 2.4 : 2} />
                {badge(href) && <span className="absolute right-2.5 top-0.5 size-2.5 rounded-full bg-danger ring-2 ring-surface" />}
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
